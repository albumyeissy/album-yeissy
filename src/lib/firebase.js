import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAUC7Noyp87KG-wKwNFXmfKRABRnS3KrVA",
  authDomain: "album-yeissy-ebfa4.firebaseapp.com",
  projectId: "album-yeissy-ebfa4",
  storageBucket: "album-yeissy-ebfa4.firebasestorage.app",
  messagingSenderId: "280243735798",
  appId: "1:280243735798:web:a1fb3cae33acb7915d30d7"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);