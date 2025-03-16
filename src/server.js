require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { Server } = require("socket.io");
const http = require("http");
const jwt = require("jsonwebtoken");
const User = require("./models/User"); // Import User Model
const { createClient } = require("redis");
const { sendPushNotification } = require("./fire");
const sequelize = require("./database");
const Message = require("./models/Message");
const auth = require("./routes/auth");
//const {authMiddleware} = require('./routes/auth.js');
//const Client = require("../models/User")

const JWT_SECRET = process.env.JWT_SECRET;

// Initialize Express
const app = express();
app.use(cors());
app.use(express.json());

//home page

app.get('/', async (re, res) => {
  res.send("This is a backend site for chat application");
});

app.use("/auth",auth);

// Database Connection
// Sync database models with PostgreSQL
sequelize.sync().then(() => {
  console.log("Database synced!");
}).catch((err) => console.log("Error syncing database:", err));

// Create HTTP server
const server = http.createServer(app);

// Initialize WebSocket Server
const io = new Server(server, {
  cors: {
    origin: "*",  // Allow frontend to connect
    methods: ["GET", "POST","DELETE","PUT"],
  },
});

// This will verify all users first with token and authenticate them 
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    //console.log('authenticating...',token)
    if (!token) return next(new Error("Authentication error"));

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findOne({ where:{ id:decoded.userId }});
    if (!user) return next(new Error("Authentication error"));

    socket.user = user; // Attach user info to socket
    next();
  } catch (err) {
    //console.log('error while connecting to socket',err);
    next(new Error("Authentication error"));
  }
});

let connectedUsers = {};  // will keeps track of connected users

// Connect to Redis Cloud
const pubClient = createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379",
});

pubClient.connect()
  .then(() => console.log("Connected to Redis"))
  .catch((err) => console.error("Redis Connection Error:", err));

// Redis Pub/Sub Setup
//const pubClient = redisClient.duplicate();
const subClient = pubClient.duplicate();

//pubClient.connect();
subClient.connect();

pubClient.on('error', (err) => console.error('Pub Client Error: ',err));
subClient.on('error',(err)=> console.error('Sub Client Error: ',err));


// Subscribe to Redis Channel for Message Broadcasting
subClient.subscribe("chat_messages", (message) => {
  //console.log('Message is ',message);
  const parsedMessage = JSON.parse(message);
  //console.log('Parsed message is ',J);
  //console.log('Received Message from redis', parsedMessage.newMessage);
  io.to(connectedUsers[parsedMessage.receiver]).emit("receiveMessage", parsedMessage.newMessage);
});

// Handle WebSocket Connections
io.on("connection", (socket) => {
  try{
    console.log(`User connected: ${socket.user.username}`)

    connectedUsers[socket.user.username] = socket.id;

    io.emit('userConnected', connectedUsers);

    socket.on("typing", async (user, isTyping) => {
      //console.log(`${user} is typing...`);
      const socketId = connectedUsers[user];
      io.to(socketId).emit("userTyping", isTyping, socket.user.username);
    });

    // Send message
    socket.on("sendMessage", async (data) => {
      const { sender, receiver, message } = data;

      //console.log(`Message from ${sender} to ${receiver}: ${message}`, data);
  
      // Save message with "sent" status
      const newMessage = await Message.create({
        sender,
        receiver,
        message,
        status: "sent",
      });


      io.to(socket.id).emit('messageId',newMessage.id);
      
      //console.log('Message is ',newMessage);
      //console.log('First Stage....')
      // Publish message to Redis for other servers
      pubClient.publish("chat_messages", JSON.stringify({newMessage,receiver}));
      //console.log('Second Stage');
      // Check if the receiver is online
      const receiverSocket = [...io.sockets.sockets.values()].find(
        (s) => s.user.username === receiver
      );

      //console.log('Third Stage');
      if (receiverSocket) {
        // Receiver is online → mark as "delivered"
       
        await Message.findOne({where: {id: parseInt(newMessage.id)}});
        //console.log('Fourth Stage...')
        await Message.update({ status: 'delivered' }, {where: {id: parseInt(newMessage.id)}});
        //console.log('Fifth Stage....');
        io.to(socket.id).emit("messageDelivered", newMessage.id);
      } else {
        // Receiver is offline → send push notification
        const receiverUser = await User.findOne({ username: receiver });
        if (receiverUser && receiverUser.fcmToken) {
          await sendPushNotification(receiverUser.fcmToken, message);
        }
      } 
    });
  
    // Mark message as "Seen"
    socket.on("markAsSeen", async (messageId) => {
      try{
        //await Message.findByIdAndUpdate(messageId, { status: "seen" });
        const msg = await Message.findOne({where :{id: parseInt(messageId)}});
        await Message.update({ status: 'seen' },{where: {id: parseInt(messageId)}});
        const senderSocket = [...io.sockets.sockets.values()].find(
          (s) => s.user.username === msg.sender
        );
        io.to(senderSocket.id).emit("messageSeen", messageId);
      }catch(err){
        //console.log('Error while updating message seen', err);
      }
    });
  
    socket.on("disconnect", () => {
      //connectedUsers = connectedUsers.filter((user) => user !== socket.user.username);
      const username = socket.user.username;
      delete connectedUsers[username];
      //console.log(connectedUsers);
      io.emit('userDisconnected', username);
      console.log(`User disconnected: ${socket.user.username}`);
    });
  }catch(err){console.log(err); io.emit('error','Error sending messaging...',err);}
});



// Start Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
