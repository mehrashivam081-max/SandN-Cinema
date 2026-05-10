// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

// आपकी Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyAv8X2AkyJUxfOnmYAD_Bos4GVKkf6EPdY",
  authDomain: "sandn-cinema.firebaseapp.com",
  projectId: "sandn-cinema",
  storageBucket: "sandn-cinema.firebasestorage.app",
  messagingSenderId: "713760532025",
  appId: "1:713760532025:web:58c1e93ef784416ec44fe8",
  measurementId: "G-SFNYZMH9S6"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication
export const auth = getAuth(app);