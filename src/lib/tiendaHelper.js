/**
 * tiendaHelper.js — lógica pura de la tienda y economía.
 */

export const PRECIO_VENTA = { legendaria: 8, rara: 4, comun: 1, mitica: 0 };
export const MAX_COMPRAS_DIA = 3;
export const MONEDAS_INICIALES = 50;

export const ITEMS = [
  { id: "sobre",              precio: 20, requiereJugador: false },
  { id: "proteccion",         precio: 15, requiereJugador: false },
  { id: "robo_cr",            precio: 30, requiereJugador: true  },
  { id: "robo_leg",           precio: 35, requiereJugador: true  },
  { id: "cancelar_maldicion", precio: 12, requiereJugador: false },
  { id: "espiar",             precio: 10, requiereJugador: true  },
];

/**
 * Valida si una compra puede realizarse.
 * @returns {{ ok: boolean, error?: string }}
 */
export const validarCompra = (monedas, comprasHoy, precio) => {
  if (comprasHoy >= MAX_COMPRAS_DIA) return { ok: false, error: "limite" };
  if (monedas < precio)              return { ok: false, error: "sin-monedas" };
  return { ok: true };
};

/**
 * Calcula las monedas obtenidas por vender un lote de cartas.
 * cantVenta: { [cromoId]: cantidad }
 * cromos: array de { id, rareza } (del catálogo CROMOS)
 */
export const calcularMonedasVenta = (cantVenta, cromos) => {
  let total = 0;
  for (const [id, cant] of Object.entries(cantVenta)) {
    if (cant <= 0) continue;
    const info = cromos.find((c) => c.id === Number(id));
    total += (PRECIO_VENTA[info?.rareza] ?? 0) * cant;
  }
  return total;
};

/**
 * Devuelve las cartas vendibles de un usuario (cantidad > 1, no mítica).
 * userCromos: array de { cromoId, cantidad }
 * cromos: catálogo
 */
export const cromosVendibles = (userCromos, cromos) => {
  return userCromos
    .filter((c) => {
      const info = cromos.find((x) => x.id === c.cromoId);
      return c.cantidad > 1 && info?.rareza !== "mitica";
    })
    .map((c) => {
      const info = cromos.find((x) => x.id === c.cromoId);
      return { ...c, rareza: info?.rareza ?? "comun" };
    });
};

/**
 * Aplica una venta: resta las cantidades vendidas del inventario del usuario.
 * Elimina entradas que lleguen a 0.
 * @returns {{ cromosActualizados, ganancias }}
 */
export const aplicarVenta = (userCromos, cantVenta, cromos) => {
  let ganancias = 0;
  const cromosActualizados = userCromos
    .map((c) => {
      const vender = cantVenta[c.cromoId] ?? 0;
      if (vender === 0) return c;
      const info = cromos.find((x) => x.id === c.cromoId);
      ganancias += (PRECIO_VENTA[info?.rareza] ?? 0) * vender;
      return { ...c, cantidad: c.cantidad - vender };
    })
    .filter((c) => c.cantidad > 0);
  return { cromosActualizados, ganancias };
};

/**
 * Aplica un robo: quita 1 carta al array de la víctima, la añade al comprador.
 * Elimina entradas que lleguen a 0.
 * @returns {{ cromosVictima, cromosComprador }}
 */
export const aplicarRobo = (cromosVictima, cromosComprador, cromoId, hoy) => {
  // Quitar de víctima
  const nuevosVictima = cromosVictima
    .map((c) => c.cromoId === cromoId ? { ...c, cantidad: c.cantidad - 1 } : c)
    .filter((c) => c.cantidad > 0);

  // Añadir al comprador
  const existing = cromosComprador.find((c) => c.cromoId === cromoId);
  const nuevosComprador = existing
    ? cromosComprador.map((c) => c.cromoId === cromoId ? { ...c, cantidad: c.cantidad + 1 } : c)
    : [...cromosComprador, { cromoId, cantidad: 1, fechaObtenido: hoy, pegado: false }];

  return { cromosVictima: nuevosVictima, cromosComprador: nuevosComprador };
};

/**
 * Clasifica el interés del vendedor en una carta del ofertante.
 * vendedorCantidad: cuántas tiene el vendedor de esa carta
 * @returns {"interesa"|"tiene"|"sobra"}
 */
export const clasificarInteresCarta = (vendedorCantidad) => {
  if (vendedorCantidad === 0) return "interesa";
  if (vendedorCantidad === 1) return "tiene";
  return "sobra";
};
