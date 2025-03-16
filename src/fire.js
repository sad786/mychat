const admin = require("firebase-admin");

//const serviceAccount = require('./secret.json');


// if(!serviceAccount){
//   console.error('Error: FIRE_BASE_PATH environment not set up');
//   process.exit(1);
// }

const serviceAccount = {
  type: process.env.FIRBASE_TYPE,
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g,'\n'),
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: process.env.FIREBASE_AUTH_URI,
  token_uri: process.env.FIREBASE_TOKEN_URI,
  auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_CERT_URL,
  client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL,
  universe_domain:process.env.FIREBASE_UNIVERSE_DOMAIN,
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});


console.log('Firebase Admin SDK initialized successfully.');



//  console.log("Error sending message: ",err);



const sendPushNotification = async (token, message) => {
  const payload = {
    notification: {
      title: "New Message",
      body: message,
    },
    token:token,
  };

  try {
    await admin.messaging().send(payload);
    console.log("Push notification sent successfully");
  } catch (error) {
    console.error("Error sending push notification:", error);
  }
};

module.exports = { sendPushNotification };


