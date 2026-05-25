import { describe, it, expect } from "vitest";
import {
  calcularRacha,
  calcularBonusRacha,
  puedeAbrirSobre,
  calcularMaxSobres,
  tipoSobre,
} from "../lib/rachaHelper.js";

// Fechas fijas para que los tests no dependan del día real
const HOY      = "2026-05-25";
const AYER     = "2026-05-24";
const ANTEAYER = "2026-05-23";
const HACE5    = "2026-05-20";

// ─── calcularRacha ────────────────────────────────────────────────────────────
describe("calcularRacha", () => {

  describe("primer sobre del día", () => {
    it("continúa racha si abrió ayer", () => {
      const r = calcularRacha(AYER, 5, null, HOY, AYER);
      expect(r.esPrimerSobreDelDia).toBe(true);
      expect(r.nuevaRacha).toBe(6);
      expect(r.consumirProteccion).toBe(false);
    });

    it("racha 0 + ayer → racha 1", () => {
      const r = calcularRacha(AYER, 0, null, HOY, AYER);
      expect(r.nuevaRacha).toBe(1);
    });

    it("resetea a 1 si falló un día", () => {
      const r = calcularRacha(ANTEAYER, 10, null, HOY, AYER);
      expect(r.nuevaRacha).toBe(1);
    });

    it("resetea a 1 si lleva muchos días sin abrir", () => {
      const r = calcularRacha(HACE5, 20, null, HOY, AYER);
      expect(r.nuevaRacha).toBe(1);
    });

    it("primer día de siempre (fecha vacía) → racha 1", () => {
      const r = calcularRacha("", 0, null, HOY, AYER);
      expect(r.nuevaRacha).toBe(1);
    });

    it("fecha undefined → racha 1", () => {
      const r = calcularRacha(undefined, 0, null, HOY, AYER);
      expect(r.nuevaRacha).toBe(1);
    });
  });

  describe("ya abrió hoy (segundo sobre)", () => {
    it("no modifica la racha", () => {
      const r = calcularRacha(HOY, 7, null, HOY, AYER);
      expect(r.esPrimerSobreDelDia).toBe(false);
      expect(r.nuevaRacha).toBe(7);
    });

    it("no consume protección aunque esté activa", () => {
      const r = calcularRacha(HOY, 3, HOY, HOY, AYER);
      expect(r.consumirProteccion).toBe(false);
    });
  });

  describe("protección de racha", () => {
    it("protección activa + faltó un día → conserva racha", () => {
      const r = calcularRacha(ANTEAYER, 5, HOY, HOY, AYER);
      expect(r.nuevaRacha).toBe(5);
      expect(r.consumirProteccion).toBe(true);
    });

    it("protección activa + faltaron muchos días → conserva racha", () => {
      const r = calcularRacha(HACE5, 12, HOY, HOY, AYER);
      expect(r.nuevaRacha).toBe(12);
      expect(r.consumirProteccion).toBe(true);
    });

    it("protección activa + racha 0 → sigue en 0 (no incrementa)", () => {
      const r = calcularRacha(ANTEAYER, 0, HOY, HOY, AYER);
      expect(r.nuevaRacha).toBe(0);
      expect(r.consumirProteccion).toBe(true);
    });

    it("protección caducada (fecha = ayer) NO protege", () => {
      const r = calcularRacha(ANTEAYER, 5, AYER, HOY, AYER);
      expect(r.nuevaRacha).toBe(1); // sin protección → reset
      expect(r.consumirProteccion).toBe(false);
    });

    it("protección futura (fecha = mañana) NO protege hoy", () => {
      const manana = "2026-05-26";
      const r = calcularRacha(ANTEAYER, 5, manana, HOY, AYER);
      expect(r.nuevaRacha).toBe(1);
      expect(r.consumirProteccion).toBe(false);
    });

    it("protección activa + abrió ayer (racha no rota) → conserva sin incrementar", () => {
      // Compró protección pero tampoco la necesitaba (abrió ayer igual)
      // La protección consume pero la racha se mantiene (no +1)
      const r = calcularRacha(AYER, 5, HOY, HOY, AYER);
      expect(r.nuevaRacha).toBe(5);   // conserva, no +1
      expect(r.consumirProteccion).toBe(true);
    });

    it("protección anula maldición (racha no se rompe aunque viniera de hace 3 días)", () => {
      const r = calcularRacha(HACE5, 8, HOY, HOY, AYER);
      expect(r.nuevaRacha).toBe(8);
      expect(r.consumirProteccion).toBe(true);
    });
  });
});

// ─── calcularBonusRacha ───────────────────────────────────────────────────────
describe("calcularBonusRacha", () => {
  it("da +1 sobre en racha 5", ()  => expect(calcularBonusRacha(5, 0)).toBe(1));
  it("da +1 sobre en racha 10", () => expect(calcularBonusRacha(10, 2)).toBe(3));
  it("da +1 sobre en racha 15", () => expect(calcularBonusRacha(15, 1)).toBe(2));
  it("da +1 sobre en racha 20", () => expect(calcularBonusRacha(20, 0)).toBe(1));
  it("da +1 sobre en racha 25", () => expect(calcularBonusRacha(25, 5)).toBe(6));
  it("no da bonus en racha 4",  () => expect(calcularBonusRacha(4, 0)).toBe(0));
  it("no da bonus en racha 6",  () => expect(calcularBonusRacha(6, 1)).toBe(1));
  it("no da bonus en racha 1",  () => expect(calcularBonusRacha(1, 3)).toBe(3));
  it("racha 0 no da bonus",     () => expect(calcularBonusRacha(0, 0)).toBe(0));
});

// ─── puedeAbrirSobre ─────────────────────────────────────────────────────────
describe("puedeAbrirSobre", () => {
  it("puede si no llegó al límite", ()    => expect(puedeAbrirSobre(0, 2, 0, 0)).toBe(true));
  it("puede si tiene bonus",         ()    => expect(puedeAbrirSobre(2, 2, 1, 0)).toBe(true));
  it("puede si tiene ruleta",        ()    => expect(puedeAbrirSobre(2, 2, 0, 3)).toBe(true));
  it("no puede sin sobres ni bonus", ()    => expect(puedeAbrirSobre(2, 2, 0, 0)).toBe(false));
  it("maldición: límite=1, ya abrió 1 → no puede", () =>
    expect(puedeAbrirSobre(1, 1, 0, 0)).toBe(false));
  it("maldición: límite=1, aún no abrió → puede", () =>
    expect(puedeAbrirSobre(0, 1, 0, 0)).toBe(true));
});

// ─── calcularMaxSobres ────────────────────────────────────────────────────────
describe("calcularMaxSobres", () => {
  it("sin maldición → 2", () => expect(calcularMaxSobres(null,  HOY)).toBe(2));
  it("maldición hoy → 1",  () => expect(calcularMaxSobres(HOY,  HOY)).toBe(1));
  it("maldición ayer → 2", () => expect(calcularMaxSobres(AYER, HOY)).toBe(2));
  it("respeta maxNormal custom", () => expect(calcularMaxSobres(null, HOY, 3)).toBe(3));
});

// ─── tipoSobre ────────────────────────────────────────────────────────────────
describe("tipoSobre", () => {
  it("normal si no llegó al límite",        () => expect(tipoSobre(0, 2, 0, 0)).toBe("normal"));
  it("bonus si agotó normales y tiene bonus",() => expect(tipoSobre(2, 2, 2, 0)).toBe("bonus"));
  it("ruleta si no hay bonus pero sí ruleta",() => expect(tipoSobre(2, 2, 0, 1)).toBe("ruleta"));
  it("bonus tiene prioridad sobre ruleta",   () => expect(tipoSobre(2, 2, 1, 1)).toBe("bonus"));
});
