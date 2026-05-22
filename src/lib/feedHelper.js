import { collection, addDoc } from "firebase/firestore";
import { db } from "./firebase";

export const addFeedEvent = async ({ type, userName, details, image }) => {
  try {
    await addDoc(collection(db, "feed"), {
      type,
      userName: userName || "???",
      details: details || "",
      image: image || null,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Error feed:", err);
  }
};