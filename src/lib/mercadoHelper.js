/**
 * mercadoHelper.js — lógica pura del mercado de intercambios.
 */

export const EXPIRY_HORAS = 24;

/**
 * Comprueba si una oferta/venta ha expirado.
 * @param {string} fechaCreacion ISO string
 * @param {Date} ahora
 */
export const ofertaExpirada = (fechaCreacion, ahora = new Date()) => {
  const diff = ahora - new Date(fechaCreacion);
  return diff >= EXPIRY_HORAS * 60 * 60 * 1000;
};

/**
 * Valida que el ofertante tiene ≥2 copias de cada carta que quiere ofrecer.
 * cromosOferta: array de cromoIds
 * userCromos: array de { cromoId, cantidad }
 * @returns {{ ok: boolean, faltante?: number }}
 */
export const validarCromosParaOferta = (cromosOferta, userCromos) => {
  for (const id of cromosOferta) {
    const entry = userCromos.find((c) => c.cromoId === id);
    if (!entry || entry.cantidad < 2) return { ok: false, faltante: id };
  }
  return { ok: true };
};

/**
 * Valida que el vendedor tiene ≥2 copias de cada carta de la venta
 * (para poder aceptar el intercambio manteniendo al menos 1).
 */
export const validarCromosParaAceptar = (cromosVenta, userCromos) => {
  return validarCromosParaOferta(cromosVenta, userCromos);
};

/**
 * Comprueba si un usuario ya hizo una oferta en esta venta.
 */
export const yaHizoOferta = (ofertas, userId) => {
  return (ofertas ?? []).some((o) => o.ofertanteId === userId);
};

/**
 * Ejecuta el intercambio entre vendedor y ofertante.
 * Devuelve los nuevos arrays de cromos para cada parte.
 * @returns {{ cromosVendedor, cromosOfertante }}
 */
export const ejecutarIntercambio = (
  cromosVendedor,
  cromosVenta,      // ids que da el vendedor
  cromosOfertante,
  cromosOferta,     // ids que da el ofertante
  hoy
) => {
  let vendedor = [...cromosVendedor];
  let ofertante = [...cromosOfertante];

  // Vendedor entrega y recibe
  for (const id of cromosVenta) {
    vendedor = quitarCromo(vendedor, id);
    ofertante = anadirCromo(ofertante, id, hoy);
  }
  // Ofertante entrega y recibe
  for (const id of cromosOferta) {
    ofertante = quitarCromo(ofertante, id);
    vendedor = anadirCromo(vendedor, id, hoy);
  }

  return { cromosVendedor: vendedor, cromosOfertante: ofertante };
};

// ── helpers internos ──────────────────────────────────────────────────────────

const quitarCromo = (cromos, cromoId) =>
  cromos
    .map((c) => c.cromoId === cromoId ? { ...c, cantidad: c.cantidad - 1 } : c)
    .filter((c) => c.cantidad > 0);

const anadirCromo = (cromos, cromoId, hoy) => {
  const existing = cromos.find((c) => c.cromoId === cromoId);
  if (existing)
    return cromos.map((c) => c.cromoId === cromoId ? { ...c, cantidad: c.cantidad + 1 } : c);
  return [...cromos, { cromoId, cantidad: 1, fechaObtenido: hoy, pegado: false }];
};
