// Firebase Configuration
// To set up your own Firebase project:
// 1. Go to https://console.firebase.google.com/ → Create Project
// 2. Click "Add App" → Web → Register
// 3. Copy the config values below
// 4. Go to Build → Realtime Database → Create Database → Start in test mode

import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, get, onValue, off, push, update, remove } from "firebase/database";

// Replace these with your own Firebase config after creating a project
const firebaseConfig = {
  apiKey: "AIzaSyDemoKeyForSupremeSalesCommand",
  authDomain: "supreme-sales-command.firebaseapp.com",
  databaseURL: "https://supreme-sales-command-default-rtdb.firebaseio.com",
  projectId: "supreme-sales-command",
  storageBucket: "supreme-sales-command.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef123456"
};

// For now, use localStorage fallback until Firebase is configured
// To switch to Firebase: uncomment the lines below and fill in your config
// const app = initializeApp(firebaseConfig);
// export const db = getDatabase(app);

// LocalStorage-based fallback (current mode)
// This keeps existing data working while Firebase setup is pending
const USE_FIREBASE = false;

export { USE_FIREBASE };
export { ref, set, get, onValue, off, push, update, remove };
