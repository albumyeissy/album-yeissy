import { db } from "./firebase";
import { doc, getDoc } from "firebase/firestore";

export const getFeatures = async () => {
  try {
    const snap = await getDoc(doc(db, "config", "features"));
    if (snap.exists()) return snap.data();
  } catch (err) {}
  return {};
};

export const isRuletaAvailable = (features) => {
  if (features?.ruletaDesactivada) return false;
  if (features?.ruleta === true) return true;
  if (features?.ruletaFecha) return new Date() >= new Date(features.ruletaFecha);
  return false;
};
