import { collection, addDoc, doc, getDoc } from "firebase/firestore";
import { db } from "./firebase";

export const addFeedEvent = async ({ type, userName, details, image }) => {
  try {
    // No publicar en el feed durante el modo mantenimiento (testing)
    const configSnap = await getDoc(doc(db, "config", "features"));
    if (configSnap.exists() && configSnap.data().mantenimiento === true) return;

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