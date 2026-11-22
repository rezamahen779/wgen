import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Ambil konfigurasi dari file .env
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDQJc23XCfpGp07iNmh8Gmuu8F-aZ2p5XQ",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "wgen-note.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "wgen-note",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "438908630210",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:438908630210:web:654fad669096a51315775b"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app); // EXPORT DB HARUS ADAs