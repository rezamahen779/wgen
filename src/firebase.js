import { initializeApp } from "firebase/app";
import { 
  initializeAuth, 
  indexedDBLocalPersistence, 
  browserLocalPersistence 
} from "firebase/auth";

// Ambil konfigurasi dari file .env
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDQJc23XCfpGp07iNmh8Gmuu8F-aZ2p5XQ",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "wgen-note.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "wgen-note",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "438908630210",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:438908630210:web:654fad669096a51315775b"
};

// 1. Inisialisasi Firebase App
const app = initializeApp(firebaseConfig);

// 2. Inisialisasi Auth dengan Persistence (Agar user TIDAK ter-logout sendiri di Android)
export const auth = initializeAuth(app, {
  persistence: [indexedDBLocalPersistence, browserLocalPersistence]
});