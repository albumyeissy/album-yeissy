/**
 * torturaHelper.js — lógica pura de las torturas.
 */

/**
 * Normaliza un texto para comparación: trim, espacios únicos,
 * comillas tipográficas → estándar. Previene falsos errores por
 * teclados móviles que insertan comillas inteligentes o espacios dobles.
 */
export const normalizarTexto = (s) =>
  (s ?? "")
    .trim()
    .replace(/\s+/g, " ")
        .replace(/[‘’]/g, "'")
        .replace(/[“”]/g, '"');

/**
 * Compara el texto objetivo con el escrito (ya normalizados).
 * @returns {{ ok: boolean, pos?: number, detalle?: string }}
 */
export const compararTexto = (objetivoRaw, escritoRaw) => {
  const objetivo = normalizarTexto(objetivoRaw);
  const escrito  = normalizarTexto(escritoRaw);

  if (escrito === objetivo) return { ok: true };

  // Encontrar primera diferencia
  let pos = 0;
  const minLen = Math.min(objetivo.length, escrito.length);
  while (pos < minLen && objetivo[pos] === escrito[pos]) pos++;

  let detalle;
  if (escrito.length === 0) {
    detalle = "No has escrito nada.";
  } else if (pos >= objetivo.length) {
    detalle = `Texto demasiado largo: escribiste ${escrito.length} caracteres, el original tiene ${objetivo.length}.`;
  } else if (pos >= escrito.length) {
    detalle = `Texto incompleto: escribiste ${escrito.length} de ${objetivo.length} caracteres.`;
  } else {
    const ctx    = 18;
    const start  = Math.max(0, pos - ctx);
    const endObj = Math.min(objetivo.length, pos + ctx);
    const endEsc = Math.min(escrito.length, pos + ctx);
    const snipObj = (start > 0 ? "…" : "") + objetivo.slice(start, endObj) + (endObj < objetivo.length ? "…" : "");
    const snipEsc = (start > 0 ? "…" : "") + escrito.slice(start, endEsc) + (endEsc < escrito.length ? "…" : "");
    detalle = `Posición ${pos + 1} → esperado: «${snipObj}» · escrito: «${snipEsc}»`;
  }

  return { ok: false, pos, detalle };
};

/**
 * Devuelve el número de día del año (1-366) para una fecha dada.
 */
export const getDayOfYear = (date = new Date()) => {
  const start = new Date(date.getFullYear(), 0, 0);
  return Math.floor((date - start) / 86400000);
};

/**
 * Selecciona la tortura del día de forma determinista.
 * @param {Array} torturas
 * @param {number} dayOfYear
 */
export const torturaDelDia = (torturas, dayOfYear) =>
  torturas[dayOfYear % torturas.length];

/**
 * Selecciona el texto del día de forma determinista.
 * @param {Array} textos
 * @param {number} dayOfYear
 */
export const textoDelDia = (textos, dayOfYear) =>
  textos[dayOfYear % textos.length];

/**
 * Decide si el usuario ha completado la tortura del contador.
 */
export const contadorCompletado = (taps) => taps >= 500;

/**
 * Decide si mostrar la oferta de rendirse en el contador (a mitad de camino).
 */
export const contadorMostrarOferta = (taps) => taps >= 200;
