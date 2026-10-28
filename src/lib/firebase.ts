import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, get, onValue, off, push, update, remove } from "firebase/database";

// HARDCODED REAL CONFIG — Supreme Global Foods production Firebase
export const firebaseConfig = {
  apiKey: "AIzaSyAj68G-CmO9ImmBB5MgPwlas389gHWqPu8",
  authDomain: "supreme-global-foods-835b0.firebaseapp.com",
  databaseURL: "https://supreme-global-foods-835b0-default-rtdb.firebaseio.com",
  projectId: "supreme-global-foods-835b0",
  storageBucket: "supreme-global-foods-835b0.appspot.com",
  messagingSenderId: "570220829537",
  appId: "1:570220829537:web:3c8d3c870887e9cc7a4320"
};

export const USE_FIREBASE = true;
export { ref, set, get, onValue, off, push, update, remove };
