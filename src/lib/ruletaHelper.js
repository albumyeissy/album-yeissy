/**
 * ruletaHelper.js — lógica pura de la ruleta rusa.
 * Funciones de cromo reutilizadas desde cromoHelper.
 */

export const SECTORES = [
  { id: "sobre",            emoji: "📦", label: "Sobre gratis",       prob: 20 },
  { id: "robar_comun",      emoji: "🃏", label: "Robar común",        prob: 20 },
  { id: "robar_rara",       emoji: "💎", label: "Robar rara",         prob: 15 },
  { id: "robar_legendaria", emoji: "⭐", label: "Robar legendaria",   prob: 5  },
  { id: "quema",            emoji: "🔥", label: "La quema",           prob: 17 },
  { id: "maldicion",        emoji: "😈", label: "La maldición",       prob: 11 },
  { id: "perdedor",         emoji: "💀", label: "Perdedor",           prob: 12 },
];

export const SECTOR_ANGLE = 360 / SECTORES.length; // ≈ 51.43°
export const FULL_SPINS   = 6;

/**
 * Elige un sector de forma ponderada según el campo `prob` de cada entrada.
 * @param {Array} sectores   — Array de { id, prob, ... }
 * @param {Function} randomFn — Función que devuelve un número en [0, 1)
 * @returns {number} Índice del sector ganador
 */
export const elegirSectorPonderado = (sectores, randomFn = Math.random) => {
  const total = sectores.reduce((s, x) => s + x.prob, 0);
  let rand = randomFn() * total;
  for (let i = 0; i < sectores.length; i++) {
    rand -= sectores[i].prob;
    if (rand <= 0) return i;
  }
  return sectores.length - 1; // fallback (nunca debería llegar aquí si prob > 0)
};

/**
 * Calcula la nueva rotación del tambor para la animación CSS.
 * El tambor debe acabar apuntando al winnerIdx en la posición superior (cañón).
 *
 * @param {number} winnerIdx    — Índice del sector ganador
 * @param {number} sectorAngle  — Grados por sector (360 / N)
 * @param {number} fullSpins    — Vueltas completas extra
 * @param {number} currentRot  — Rotación actual del tambor (acumulada)
 * @returns {number} Nuevos grados totales a aplicar
 */
export const calcularRotacion = (winnerIdx, sectorAngle, fullSpins, currentRot) => {
  const extraRot = (360 - winnerIdx * sectorAngle) % 360;
  return currentRot + fullSpins * 360 + extraRot;
};

/**
 * Calcula la fecha de la maldición (mañana) dado el día de hoy en formato YYYY-MM-DD.
 * Usa mediodía UTC para evitar problemas de DST.
 *
 * @param {string} hoy  — YYYY-MM-DD
 * @returns {string}    — YYYY-MM-DD del día siguiente
 */
export const calcularFechaMaldicion = (hoy) => {
  const d = new Date(hoy + "T12:00:00");
  d.setDate(d.getDate() + 1);
  return d.toLocaleDateString("en-CA");
};

/**
 * Determina si el sector requiere elegir una víctima.
 * @param {string} sectorId
 * @returns {boolean}
 */
export const sectorRequiereVictima = (sectorId) =>
  sectorId.startsWith("robar_") || sectorId === "maldicion";

/**
 * Extrae la rareza del id de un sector de robo.
 * Ejemplo: "robar_rara" → "rara"
 * Devuelve null si no es un sector de robo.
 */
export const rarezaDeSectorRobo = (sectorId) =>
  sectorId.startsWith("robar_") ? sectorId.replace("robar_", "") : null;
