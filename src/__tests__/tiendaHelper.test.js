import { describe, it, expect } from "vitest";
import {
  validarCompra,
  calcularMonedasVenta,
  cromosVendibles,
  aplicarVenta,
  aplicarRobo,
  clasificarInteresCarta,
  PRECIO_VENTA,
  MAX_COMPRAS_DIA,
} from "../lib/tiendaHelper.js";

const HOY = "2026-05-25";

// Catálogo mínimo para tests
const CROMOS_MOCK = [
  { id: 1, rareza: "comun"     },
  { id: 2, rareza: "comun"     },
  { id: 3, rareza: "rara"      },
  { id: 4, rareza: "rara"      },
  { id: 5, rareza: "legendaria"},
  { id: 6, rareza: "legendaria"},
  { id: 7, rareza: "mitica"    },
];

// ─── PRECIO_VENTA ─────────────────────────────────────────────────────────────
describe("PRECIO_VENTA", () => {
  it("común vale 1",      () => expect(PRECIO_VENTA.comun).toBe(1));
  it("rara vale 4",       () => expect(PRECIO_VENTA.rara).toBe(4));
  it("legendaria vale 8", () => expect(PRECIO_VENTA.legendaria).toBe(8));
  it("mítica vale 0",     () => expect(PRECIO_VENTA.mitica).toBe(0));
});

// ─── validarCompra ────────────────────────────────────────────────────────────
describe("validarCompra", () => {
  it("OK con monedas suficientes y compras disponibles", () => {
    expect(validarCompra(50, 0, 20).ok).toBe(true);
  });

  it("error sin-monedas cuando no alcanza", () => {
    const r = validarCompra(10, 0, 20);
    expect(r.ok).toBe(false);
    expect(r.error).toBe("sin-monedas");
  });

  it("error sin-monedas con 0 monedas", () => {
    expect(validarCompra(0, 0, 1).ok).toBe(false);
  });

  it("error limite al llegar a MAX_COMPRAS_DIA", () => {
    const r = validarCompra(100, MAX_COMPRAS_DIA, 10);
    expect(r.ok).toBe(false);
    expect(r.error).toBe("limite");
  });

  it("el límite tiene prioridad sobre las monedas", () => {
    // aunque no tenga monedas, el error que salta primero es límite
    const r = validarCompra(0, MAX_COMPRAS_DIA, 10);
    expect(r.error).toBe("limite");
  });

  it("exactamente el precio justo → OK", () => {
    expect(validarCompra(20, 0, 20).ok).toBe(true);
  });

  it("2 compras hechas de 3 → todavía puede", () => {
    expect(validarCompra(50, 2, 10).ok).toBe(true);
  });
});

// ─── calcularMonedasVenta ─────────────────────────────────────────────────────
describe("calcularMonedasVenta", () => {
  it("1 común = 1 moneda", () =>
    expect(calcularMonedasVenta({ 1: 1 }, CROMOS_MOCK)).toBe(1));

  it("3 comunes = 3 monedas", () =>
    expect(calcularMonedasVenta({ 1: 3 }, CROMOS_MOCK)).toBe(3));

  it("1 rara = 4 monedas", () =>
    expect(calcularMonedasVenta({ 3: 1 }, CROMOS_MOCK)).toBe(4));

  it("2 raras = 8 monedas", () =>
    expect(calcularMonedasVenta({ 3: 2 }, CROMOS_MOCK)).toBe(8));

  it("1 legendaria = 8 monedas", () =>
    expect(calcularMonedasVenta({ 5: 1 }, CROMOS_MOCK)).toBe(8));

  it("mezcla: 2 comunes + 1 rara + 1 legendaria = 14", () =>
    expect(calcularMonedasVenta({ 1: 2, 3: 1, 5: 1 }, CROMOS_MOCK)).toBe(14));

  it("mítica: 0 monedas (no vendible en la práctica)", () =>
    expect(calcularMonedasVenta({ 7: 1 }, CROMOS_MOCK)).toBe(0));

  it("cantidades 0 no suman nada", () =>
    expect(calcularMonedasVenta({ 1: 0, 3: 0 }, CROMOS_MOCK)).toBe(0));

  it("objeto vacío = 0", () =>
    expect(calcularMonedasVenta({}, CROMOS_MOCK)).toBe(0));
});

// ─── cromosVendibles ─────────────────────────────────────────────────────────
describe("cromosVendibles", () => {
  const inventario = [
    { cromoId: 1, cantidad: 3 }, // común × 3 → vendible
    { cromoId: 2, cantidad: 1 }, // común × 1 → NO vendible (solo queda 1)
    { cromoId: 3, cantidad: 2 }, // rara × 2   → vendible
    { cromoId: 5, cantidad: 4 }, // legendaria  → vendible
    { cromoId: 7, cantidad: 2 }, // mítica      → NO vendible
  ];

  it("solo devuelve cartas con cantidad > 1", () => {
    const r = cromosVendibles(inventario, CROMOS_MOCK);
    expect(r.find((c) => c.cromoId === 2)).toBeUndefined();
  });

  it("excluye míticas", () => {
    const r = cromosVendibles(inventario, CROMOS_MOCK);
    expect(r.find((c) => c.cromoId === 7)).toBeUndefined();
  });

  it("incluye común, rara y legendaria con cantidad > 1", () => {
    const r = cromosVendibles(inventario, CROMOS_MOCK);
    const ids = r.map((c) => c.cromoId);
    expect(ids).toContain(1);
    expect(ids).toContain(3);
    expect(ids).toContain(5);
  });
});

// ─── aplicarVenta ─────────────────────────────────────────────────────────────
describe("aplicarVenta", () => {
  const inventario = [
    { cromoId: 1, cantidad: 3 },
    { cromoId: 3, cantidad: 2 },
    { cromoId: 5, cantidad: 1 },
  ];

  it("resta la cantidad vendida", () => {
    const { cromosActualizados } = aplicarVenta(inventario, { 1: 2 }, CROMOS_MOCK);
    expect(cromosActualizados.find((c) => c.cromoId === 1).cantidad).toBe(1);
  });

  it("elimina la entrada si cantidad llega a 0", () => {
    const { cromosActualizados } = aplicarVenta(inventario, { 3: 2 }, CROMOS_MOCK);
    expect(cromosActualizados.find((c) => c.cromoId === 3)).toBeUndefined();
  });

  it("calcula ganancias correctamente", () => {
    const { ganancias } = aplicarVenta(inventario, { 1: 2, 3: 1 }, CROMOS_MOCK);
    // 2 comunes (×1) + 1 rara (×4) = 6
    expect(ganancias).toBe(6);
  });

  it("no toca cartas no incluidas en la venta", () => {
    const { cromosActualizados } = aplicarVenta(inventario, { 1: 1 }, CROMOS_MOCK);
    expect(cromosActualizados.find((c) => c.cromoId === 5).cantidad).toBe(1);
  });

  it("vender 0 de una carta → sin cambios ni ganancias", () => {
    const { cromosActualizados, ganancias } = aplicarVenta(inventario, { 1: 0 }, CROMOS_MOCK);
    expect(cromosActualizados.find((c) => c.cromoId === 1).cantidad).toBe(3);
    expect(ganancias).toBe(0);
  });
});

// ─── aplicarRobo ──────────────────────────────────────────────────────────────
describe("aplicarRobo", () => {
  const victima = [
    { cromoId: 1, cantidad: 2 },
    { cromoId: 3, cantidad: 1 },
  ];
  const comprador = [
    { cromoId: 2, cantidad: 1 },
  ];

  it("quita 1 de la víctima", () => {
    const { cromosVictima } = aplicarRobo(victima, comprador, 1, HOY);
    expect(cromosVictima.find((c) => c.cromoId === 1).cantidad).toBe(1);
  });

  it("elimina entrada de víctima si llega a 0", () => {
    const { cromosVictima } = aplicarRobo(victima, comprador, 3, HOY);
    expect(cromosVictima.find((c) => c.cromoId === 3)).toBeUndefined();
  });

  it("añade la carta al comprador si ya la tiene", () => {
    const compradorConCarta = [{ cromoId: 1, cantidad: 1 }];
    const { cromosComprador } = aplicarRobo(victima, compradorConCarta, 1, HOY);
    expect(cromosComprador.find((c) => c.cromoId === 1).cantidad).toBe(2);
  });

  it("crea entrada nueva en el comprador si no la tenía", () => {
    const { cromosComprador } = aplicarRobo(victima, comprador, 1, HOY);
    const nueva = cromosComprador.find((c) => c.cromoId === 1);
    expect(nueva).toBeDefined();
    expect(nueva.cantidad).toBe(1);
    expect(nueva.pegado).toBe(false);
    expect(nueva.fechaObtenido).toBe(HOY);
  });

  it("robo de carta única: desaparece del álbum de la víctima", () => {
    const soloUna = [{ cromoId: 5, cantidad: 1 }];
    const { cromosVictima } = aplicarRobo(soloUna, [], 5, HOY);
    expect(cromosVictima.length).toBe(0);
  });
});

// ─── clasificarInteresCarta ───────────────────────────────────────────────────
describe("clasificarInteresCarta", () => {
  it("0 → interesa (no la tiene)", () => expect(clasificarInteresCarta(0)).toBe("interesa"));
  it("1 → tiene (única)",          () => expect(clasificarInteresCarta(1)).toBe("tiene"));
  it("2 → sobra",                   () => expect(clasificarInteresCarta(2)).toBe("sobra"));
  it("5 → sobra",                   () => expect(clasificarInteresCarta(5)).toBe("sobra"));
});
