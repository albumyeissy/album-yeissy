import { describe, it, expect } from "vitest";
import {
  SECTORES,
  SECTOR_ANGLE,
  FULL_SPINS,
  elegirSectorPonderado,
  calcularRotacion,
  calcularFechaMaldicion,
  sectorRequiereVictima,
  rarezaDeSectorRobo,
} from "../lib/ruletaHelper.js";

// ─── SECTORES sanity checks ───────────────────────────────────────────────────
describe("SECTORES config", () => {
  it("tiene 7 sectores", () => expect(SECTORES).toHaveLength(7));

  it("las probabilidades suman 100", () => {
    const total = SECTORES.reduce((s, x) => s + x.prob, 0);
    expect(total).toBe(100);
  });

  it("todos los sectores tienen id, emoji, label y prob > 0", () => {
    SECTORES.forEach((s) => {
      expect(s.id).toBeTruthy();
      expect(s.emoji).toBeTruthy();
      expect(s.label).toBeTruthy();
      expect(s.prob).toBeGreaterThan(0);
    });
  });

  it("SECTOR_ANGLE = 360 / 7 ≈ 51.43°", () => {
    expect(SECTOR_ANGLE).toBeCloseTo(360 / 7, 5);
  });
});

// ─── elegirSectorPonderado ────────────────────────────────────────────────────
describe("elegirSectorPonderado", () => {
  // Sectores simplificados para tests deterministas
  const sectores = [
    { id: "A", prob: 50 },
    { id: "B", prob: 30 },
    { id: "C", prob: 20 },
  ];
  // total = 100

  it("random=0 → primer sector (A)", () => {
    // rand = 0 * 100 = 0; 0 - 50 = -50 ≤ 0 → índice 0
    expect(elegirSectorPonderado(sectores, () => 0)).toBe(0);
  });

  it("random muy pequeño pero > 0 → primer sector", () => {
    // rand = 0.001 * 100 = 0.1; 0.1 - 50 ≤ 0 → índice 0
    expect(elegirSectorPonderado(sectores, () => 0.001)).toBe(0);
  });

  it("random=0.5 → segundo sector (B)", () => {
    // rand = 0.5 * 100 = 50; 50 - 50 = 0 ≤ 0 → ¡índice 0! Ajustamos:
    // En realidad rand=50, 50-50=0 <= 0 → sí es índice 0
    // Usamos 0.501: rand=50.1; 50.1-50=0.1 > 0; 0.1-30=-29.9 ≤ 0 → índice 1
    expect(elegirSectorPonderado(sectores, () => 0.501)).toBe(1);
  });

  it("random=0.8 → segundo sector (B)", () => {
    // rand=80; 80-50=30; 30-30=0 ≤ 0 → índice 1
    expect(elegirSectorPonderado(sectores, () => 0.8)).toBe(1);
  });

  it("random=0.81 → tercer sector (C)", () => {
    // rand=81; 81-50=31 > 0; 31-30=1 > 0; 1-20=-19 ≤ 0 → índice 2
    expect(elegirSectorPonderado(sectores, () => 0.81)).toBe(2);
  });

  it("random=0.999 → último sector (C)", () => {
    // rand=99.9; 99.9-50=49.9; 49.9-30=19.9; 19.9-20=-0.1 ≤ 0 → índice 2
    expect(elegirSectorPonderado(sectores, () => 0.999)).toBe(2);
  });

  it("funciona con los SECTORES reales (no lanza excepción)", () => {
    expect(() => elegirSectorPonderado(SECTORES, Math.random)).not.toThrow();
    const idx = elegirSectorPonderado(SECTORES, Math.random);
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(idx).toBeLessThan(SECTORES.length);
  });

  it("distribución estadística aproximada (1000 muestras)", () => {
    // El sector A (50%) debe salir ~500 veces de 1000
    const counts = [0, 0, 0];
    for (let i = 0; i < 1000; i++) counts[elegirSectorPonderado(sectores)]++;
    // Tolerancia amplia: entre 350 y 650 para una prob de 50%
    expect(counts[0]).toBeGreaterThan(350);
    expect(counts[0]).toBeLessThan(650);
  });
});

// ─── calcularRotacion ─────────────────────────────────────────────────────────
describe("calcularRotacion", () => {
  it("sector 0 (indicator ya apunta ahí) → solo las vueltas completas", () => {
    // extraRot = (360 - 0 * 51.43) % 360 = 0
    // newRot = 0 + 6*360 + 0 = 2160
    const angle = 360 / 7;
    const r = calcularRotacion(0, angle, 6, 0);
    expect(r).toBeCloseTo(6 * 360, 5);
  });

  it("acumula sobre la rotación actual", () => {
    const angle = 360 / 7;
    const base = 1440; // 4 vueltas previas
    const r1 = calcularRotacion(0, angle, 6, 0);
    const r2 = calcularRotacion(0, angle, 6, base);
    expect(r2 - r1).toBe(base);
  });

  it("sector 1 → ángulo extra correcto", () => {
    const angle = 360 / 7;
    const extraRot = (360 - 1 * angle) % 360;
    const expected = 0 + 6 * 360 + extraRot;
    expect(calcularRotacion(1, angle, 6, 0)).toBeCloseTo(expected, 5);
  });

  it("con 4 vueltas en lugar de 6", () => {
    const angle = 360 / 7;
    const extraRot = (360 - 2 * angle) % 360;
    const expected = 0 + 4 * 360 + extraRot;
    expect(calcularRotacion(2, angle, 4, 0)).toBeCloseTo(expected, 5);
  });

  it("resultado siempre mayor que la rotación base", () => {
    const angle = SECTOR_ANGLE;
    for (let i = 0; i < SECTORES.length; i++) {
      const r = calcularRotacion(i, angle, FULL_SPINS, 0);
      expect(r).toBeGreaterThan(0);
    }
  });
});

// ─── calcularFechaMaldicion ───────────────────────────────────────────────────
describe("calcularFechaMaldicion", () => {
  it("devuelve el día siguiente en YYYY-MM-DD", () => {
    expect(calcularFechaMaldicion("2026-05-25")).toBe("2026-05-26");
  });

  it("fin de mes → primer día del mes siguiente", () => {
    expect(calcularFechaMaldicion("2026-01-31")).toBe("2026-02-01");
  });

  it("fin de año → primer día del año siguiente", () => {
    expect(calcularFechaMaldicion("2026-12-31")).toBe("2027-01-01");
  });

  it("año bisiesto: 28 feb → 29 feb", () => {
    expect(calcularFechaMaldicion("2024-02-28")).toBe("2024-02-29");
  });

  it("año NO bisiesto: 28 feb → 1 mar", () => {
    expect(calcularFechaMaldicion("2026-02-28")).toBe("2026-03-01");
  });
});

// ─── sectorRequiereVictima ────────────────────────────────────────────────────
describe("sectorRequiereVictima", () => {
  it("robar_comun → requiere víctima", () =>
    expect(sectorRequiereVictima("robar_comun")).toBe(true));

  it("robar_rara → requiere víctima", () =>
    expect(sectorRequiereVictima("robar_rara")).toBe(true));

  it("robar_legendaria → requiere víctima", () =>
    expect(sectorRequiereVictima("robar_legendaria")).toBe(true));

  it("maldicion → requiere víctima", () =>
    expect(sectorRequiereVictima("maldicion")).toBe(true));

  it("sobre → no requiere", () =>
    expect(sectorRequiereVictima("sobre")).toBe(false));

  it("quema → no requiere", () =>
    expect(sectorRequiereVictima("quema")).toBe(false));

  it("perdedor → no requiere", () =>
    expect(sectorRequiereVictima("perdedor")).toBe(false));
});

// ─── rarezaDeSectorRobo ───────────────────────────────────────────────────────
describe("rarezaDeSectorRobo", () => {
  it("extrae 'comun' de robar_comun", () =>
    expect(rarezaDeSectorRobo("robar_comun")).toBe("comun"));

  it("extrae 'rara' de robar_rara", () =>
    expect(rarezaDeSectorRobo("robar_rara")).toBe("rara"));

  it("extrae 'legendaria' de robar_legendaria", () =>
    expect(rarezaDeSectorRobo("robar_legendaria")).toBe("legendaria"));

  it("null para sectores que no son robo", () => {
    expect(rarezaDeSectorRobo("maldicion")).toBeNull();
    expect(rarezaDeSectorRobo("sobre")).toBeNull();
    expect(rarezaDeSectorRobo("quema")).toBeNull();
    expect(rarezaDeSectorRobo("perdedor")).toBeNull();
  });
});
