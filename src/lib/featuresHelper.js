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

const TIENDA_RELEASE_DATE = new Date("2026-05-28T00:00:00");

export const isTiendaAvailable = (features) => {
  if (features?.tiendaDesactivada) return false;
  if (features?.tienda === true) return true;
  if (features?.tiendaFecha) return new Date() >= new Date(features.tiendaFecha);
  // Fallback: fecha de lanzamiento hardcodeada
  return new Date() >= TIENDA_RELEASE_DATE;
};
