const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { body, validationResult } = require("express-validator");
const Client = require("../models/User");
const Message = require("../models/Message");
const { Op } = require("sequelize");

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "sfdlk35435jlkwrw9475sdfsd93dfs48dfkj";


const authMiddleware = (req, res, next) => {
    //console.log("First here..... and headers are ",req.headers);
    const token = req.header("Authorization");
    //console.log(token, req.header)
    if (!token) return res.status(401).json({ message: "No token, authorization denied" });
  
    try {
      const decoded = jwt.verify(token.split(" ")[1], JWT_SECRET);
      req.user = decoded.userId;
      next();
    } catch (err) {
      res.status(401).json({ message: "Token is not valid"+err });
    }
};


//router.use("/", authMiddleware);

// Register User
router.post(
  "/register",
  [body("username").notEmpty(), body("password").isLength({ min: 6 })],
  async (req, res) => {
    //console.log("Request received....")
    const errors = validationResult(req);
    //console.log("Request is validated ",errors);
    if (!errors.isEmpty()) return res.status(400).json({ message: errors.array() });

    const username  = req.body.username;
    const password = req.body.password;
    //console.log('Request body is ',req.body);
    //console.log("fetched request body successfully")

    try {
      //console.log('fetched user is this ,',username)
      let user = await Client.findOne({ where:{ username:username }});
      if (user) return res.status(400).json({ message: "User already exists" });

      const hashedPassword = await bcrypt.hash(password, 10);
      user = new Client({ username, password: hashedPassword,fcmToken:"" });
      await user.save();
      
      //console.log("User created successfully....")
      //const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: "7d" });
      res.status(200).json({user: { id: user._id, username: user.username } });
    } catch (err) {
      //console.error("This is the error: ",err)
      res.status(500).json({ message: "Server error" });
    }
  }
);

// Login User
router.post(
  "/login",
  [body("username").notEmpty(), body("password").notEmpty()],
  async (req, res) => {
    const { username, password } = req.body;
    //console.log('username and password is ,',username,password);
    try {
      const user = await Client.findOne({ where:{ username:username }});
      if (!user) return res.status(400).json({ message: "Invalid credentials" });
      //console.log('first stage');
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });
      //console.log('second stage');
      const token = jwt.sign({ userId: user.id, username:user.username }, JWT_SECRET, { expiresIn: "7d" });
      //console.log('User id is ',user.id);
      res.status(200).json({ token, user: { id: user.id, username: user.username } });
    } catch (err) {
      res.status(500).json({ message: "Server error"+err });
    }
  }
);

router.post("/save-fcm-token", authMiddleware, async (req, res) => {
    //console.log("Second here...",req.body);
    const { userId, fcmToken } = req.body;
    //console.log('userid ',userId, 'FCM Token ',fcmToken);
    try {
      //await Client.findByIdAndUpdate(userId, { fcmToken });
      const client = await Client.findByPk(parseInt(userId));
      if(!client)
      {
        //console.log('User not Found');
        res.status(401).send('User does not exist');
      }
      await client.update({ fcmToken });

      res.status(200).json({ message: "FCM token saved" });
    } catch (error) {
      res.status(500).json({ message: "Server error"+error });
    }
  });
  
  
// API to get old messages
router.get("/messages/:sender/:receiver", authMiddleware, async (req, res) => {
  //console.log('Entered messages API');
  try{
      const { sender, receiver } = req.params;
      //console.log(sender , receiver);
      const messages = await Message.findAll({
        where:{
          [Op.or]: [
            { sender, receiver },
            { sender: receiver, receiver: sender },
          ],
        },
        order: [['timestamp','ASC']],
        //logging:console.log, // Log the generated query on console
      });
      //console.log('Messages are ',messages);
      res.status(200).json(messages);
    }catch(err){
      //console.log('Error ->',err);
      res.status(401).json({'error':err});
    } 
});

module.exports = router;
//module.exports.authMiddleware = authMiddleware;
