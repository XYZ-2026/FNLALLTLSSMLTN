// Test Firestore connection and userActivityLogs count
const firebase = require('firebase/compat/app');
require('firebase/compat/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyAtWXG-w4sqidiHeOiK18MQ1EAfiUoCJrY",
  authDomain: "mht-cet-counselling.firebaseapp.com",
  projectId: "mht-cet-counselling",
  storageBucket: "mht-cet-counselling.firebasestorage.app",
  messagingSenderId: "1002324097341",
  appId: "1:1002324097341:web:943cdbd9f3279af1c96d54",
  measurementId: "G-QRRDKVPB4K"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

async function run() {
  try {
    console.log("Fetching userActivityLogs...");
    const snap = await db.collection('userActivityLogs').get();
    console.log(`Total activity logs in database: ${snap.size}`);
    if (snap.size > 0) {
      console.log("Recent logs:");
      snap.docs.slice(0, 5).forEach(doc => {
        console.log(doc.id, doc.data());
      });
    }
  } catch (err) {
    console.error("Error querying Firestore:", err);
  } finally {
    process.exit(0);
  }
}

run();
