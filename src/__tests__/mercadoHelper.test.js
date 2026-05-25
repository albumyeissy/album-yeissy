import { describe, it, expect } from "vitest";
import {
  ofertaExpirada,
  validarCromosParaOferta,
  validarCromosParaAceptar,
  yaHizoOferta,
  ejecutarIntercambio,
} from "../lib/mercadoHelper.js";

const HOY = "2026-05-25";

// ─── ofertaExpirada ───────────────────────────────────────────────────────────
describe("ofertaExpirada", () => {
  const hace25h = new Date("2026-05-25T10:00:00");
  const hace23h = new Date("2026-05-25T12:00:00");
  const ahora   = new Date("2026-05-26T11:00:00");

  it("expirada si pasaron más de 24h", () =>
    expect(ofertaExpirada(hace25h.toISOString(), ahora)).toBe(true));

  it("no expirada si pasaron menos de 24h", () =>
    expect(ofertaExpirada(hace23h.toISOString(), ahora)).toBe(false));

  it("exactamente 24h = expirada", () => {
    const exactas = new Date(ahora.getTime() - 24 * 60 * 60 * 1000);
    expect(ofertaExpirada(exactas.toISOString(), ahora)).toBe(true);
  });

  it("recién creada no está expirada", () => {
    const ahoraISO = new Date().toISOString();
    expect(ofertaExpirada(ahoraISO, new Date())).toBe(false);
  });
});

// ─── validarCromosParaOferta ──────────────────────────────────────────────────
describe("validarCromosParaOferta", () => {
  const inventario = [
    { cromoId: 1, cantidad: 3 },
    { cromoId: 2, cantidad: 2 },
    { cromoId: 3, cantidad: 1 }, // solo 1 → NO puede ofrecerla
    { cromoId: 4, cantidad: 0 }, // 0 → NO puede
  ];

  it("OK si tiene ≥2 de todas las cartas ofrecidas", () => {
    const r = validarCromosParaOferta([1, 2], inventario);
    expect(r.ok).toBe(true);
  });

  it("falla si tiene solo 1 de una carta", () => {
    const r = validarCromosParaOferta([1, 3], inventario);
    expect(r.ok).toBe(false);
    expect(r.faltante).toBe(3);
  });

  it("falla si tiene 0 de una carta", () => {
    const r = validarCromosParaOferta([4], inventario);
    expect(r.ok).toBe(false);
  });

  it("falla si la carta no existe en el inventario", () => {
    const r = validarCromosParaOferta([99], inventario);
    expect(r.ok).toBe(false);
    expect(r.faltante).toBe(99);
  });

  it("oferta vacía → OK (caso borde)", () => {
    expect(validarCromosParaOferta([], inventario).ok).toBe(true);
  });
});

// ─── yaHizoOferta ─────────────────────────────────────────────────────────────
describe("yaHizoOferta", () => {
  const ofertas = [
    { ofertanteId: "user-A", cromos: [] },
    { ofertanteId: "user-B", cromos: [] },
  ];

  it("devuelve true si ya ofertó", () =>
    expect(yaHizoOferta(ofertas, "user-A")).toBe(true));

  it("devuelve false si no ha ofertado", () =>
    expect(yaHizoOferta(ofertas, "user-C")).toBe(false));

  it("array vacío → false", () =>
    expect(yaHizoOferta([], "user-A")).toBe(false));

  it("undefined → false", () =>
    expect(yaHizoOferta(undefined, "user-A")).toBe(false));
});

// ─── ejecutarIntercambio ──────────────────────────────────────────────────────
describe("ejecutarIntercambio", () => {
  // Escenario: vendedor tiene carta 1 (común ×2), ofertante tiene carta 2 (rara ×2)
  const cromosVendedor  = [{ cromoId: 1, cantidad: 2 }, { cromoId: 5, cantidad: 1 }];
  const cromosOfertante = [{ cromoId: 2, cantidad: 2 }, { cromoId: 6, cantidad: 1 }];
  const ventaIds   = [1]; // vendedor da carta 1
  const ofertaIds  = [2]; // ofertante da carta 2

  it("vendedor pierde la carta que da", () => {
    const { cromosVendedor: v } = ejecutarIntercambio(
      cromosVendedor, ventaIds, cromosOfertante, ofertaIds, HOY
    );
    expect(v.find((c) => c.cromoId === 1).cantidad).toBe(1);
  });

  it("vendedor recibe la carta del ofertante", () => {
    const { cromosVendedor: v } = ejecutarIntercambio(
      cromosVendedor, ventaIds, cromosOfertante, ofertaIds, HOY
    );
    expect(v.find((c) => c.cromoId === 2)?.cantidad).toBe(1);
  });

  it("ofertante pierde la carta que da", () => {
    const { cromosOfertante: o } = ejecutarIntercambio(
      cromosVendedor, ventaIds, cromosOfertante, ofertaIds, HOY
    );
    expect(o.find((c) => c.cromoId === 2).cantidad).toBe(1);
  });

  it("ofertante recibe la carta del vendedor", () => {
    const { cromosOfertante: o } = ejecutarIntercambio(
      cromosVendedor, ventaIds, cromosOfertante, ofertaIds, HOY
    );
    expect(o.find((c) => c.cromoId === 1)?.cantidad).toBe(1);
  });

  it("cartas no involucradas permanecen igual", () => {
    const { cromosVendedor: v, cromosOfertante: o } = ejecutarIntercambio(
      cromosVendedor, ventaIds, cromosOfertante, ofertaIds, HOY
    );
    expect(v.find((c) => c.cromoId === 5).cantidad).toBe(1);
    expect(o.find((c) => c.cromoId === 6).cantidad).toBe(1);
  });

  it("intercambio 1:1 con carta única → ambas partes siguen con exactamente 1", () => {
    const v = [{ cromoId: 1, cantidad: 2 }];
    const o = [{ cromoId: 2, cantidad: 2 }];
    const { cromosVendedor: rv, cromosOfertante: ro } = ejecutarIntercambio(v, [1], o, [2], HOY);
    expect(rv.find((c) => c.cromoId === 1).cantidad).toBe(1);
    expect(rv.find((c) => c.cromoId === 2).cantidad).toBe(1);
    expect(ro.find((c) => c.cromoId === 2).cantidad).toBe(1);
    expect(ro.find((c) => c.cromoId === 1).cantidad).toBe(1);
  });

  it("intercambio múltiple (2 cartas por 2 cartas)", () => {
    const v = [{ cromoId: 1, cantidad: 3 }, { cromoId: 3, cantidad: 2 }];
    const o = [{ cromoId: 2, cantidad: 2 }, { cromoId: 4, cantidad: 2 }];
    const { cromosVendedor: rv, cromosOfertante: ro } = ejecutarIntercambio(v, [1, 3], o, [2, 4], HOY);
    // vendedor: carta 1 (3-1=2), carta 3 (2-1=1), recibe carta 2 y carta 4
    expect(rv.find((c) => c.cromoId === 1).cantidad).toBe(2);
    expect(rv.find((c) => c.cromoId === 3).cantidad).toBe(1); // queda 1, no desaparece
    expect(rv.find((c) => c.cromoId === 2).cantidad).toBe(1); // recibida
    expect(rv.find((c) => c.cromoId === 4).cantidad).toBe(1); // recibida
    // ofertante: carta 2 (2-1=1), carta 4 (2-1=1), recibe carta 1 y carta 3
    expect(ro.find((c) => c.cromoId === 2).cantidad).toBe(1);
    expect(ro.find((c) => c.cromoId === 4).cantidad).toBe(1);
    expect(ro.find((c) => c.cromoId === 1).cantidad).toBe(1); // recibida
    expect(ro.find((c) => c.cromoId === 3).cantidad).toBe(1); // recibida
  });
});

// ─── featuresHelper (isRuletaAvailable) ──────────────────────────────────────
import { isRuletaAvailable } from "../lib/featuresHelper.js";

describe("isRuletaAvailable", () => {
  it("sin features → no disponible", () =>
    expect(isRuletaAvailable({})).toBe(false));

  it("ruletaDesactivada = true → no disponible aunque tenga fecha", () =>
    expect(isRuletaAvailable({ ruletaDesactivada: true, ruleta: true })).toBe(false));

  it("ruleta = true → disponible", () =>
    expect(isRuletaAvailable({ ruleta: true })).toBe(true));

  it("ruletaFecha pasada → disponible", () =>
    expect(isRuletaAvailable({ ruletaFecha: "2026-01-01T00:00:00" })).toBe(true));

  it("ruletaFecha futura → no disponible", () =>
    expect(isRuletaAvailable({ ruletaFecha: "2099-01-01T00:00:00" })).toBe(false));

  it("ruletaFecha = hoy exacto → disponible (borde)", () => {
    const hoyISO = new Date().toISOString().slice(0, 19); // truncar ms
    expect(isRuletaAvailable({ ruletaFecha: hoyISO })).toBe(true);
  });
});
