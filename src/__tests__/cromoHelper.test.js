import { describe, it, expect } from "vitest";
import {
  anadirCromo,
  quitarCromo,
  quemarCartaPegada,
  mergeCromosConSobre,
  elegirCartaAleatoria,
  filtrarJugadoresConRareza,
  elegirCartaPegadaAleatoria,
} from "../lib/cromoHelper.js";

const HOY = "2026-05-25";

// Catálogo mínimo
const CATALOGO = [
  { id: 1, rareza: "comun"      },
  { id: 2, rareza: "rara"       },
  { id: 3, rareza: "legendaria" },
  { id: 4, rareza: "mitica"     },
];

// ─── anadirCromo ─────────────────────────────────────────────────────────────
describe("anadirCromo", () => {
  it("crea entrada nueva si el cromo no existe", () => {
    const r = anadirCromo([], 1, HOY);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ cromoId: 1, cantidad: 1, pegado: false, fechaObtenido: HOY });
  });

  it("incrementa cantidad si ya existe", () => {
    const base = [{ cromoId: 1, cantidad: 2, pegado: false, fechaObtenido: HOY }];
    const r = anadirCromo(base, 1, HOY);
    expect(r).toHaveLength(1);
    expect(r[0].cantidad).toBe(3);
  });

  it("no modifica otras entradas", () => {
    const base = [
      { cromoId: 1, cantidad: 1, pegado: false, fechaObtenido: HOY },
      { cromoId: 2, cantidad: 3, pegado: true,  fechaObtenido: HOY },
    ];
    const r = anadirCromo(base, 1, HOY);
    expect(r.find((c) => c.cromoId === 2).cantidad).toBe(3);
  });

  it("preserva pegado:false en nuevas entradas", () => {
    const r = anadirCromo([], 99, HOY);
    expect(r[0].pegado).toBe(false);
  });

  it("no muta el array original", () => {
    const base = [];
    anadirCromo(base, 1, HOY);
    expect(base).toHaveLength(0);
  });
});

// ─── quitarCromo ─────────────────────────────────────────────────────────────
describe("quitarCromo", () => {
  it("decrementa cantidad en 1", () => {
    const base = [{ cromoId: 1, cantidad: 3 }];
    const r = quitarCromo(base, 1);
    expect(r[0].cantidad).toBe(2);
  });

  it("elimina la entrada si cantidad llega a 0", () => {
    const base = [{ cromoId: 1, cantidad: 1 }];
    const r = quitarCromo(base, 1);
    expect(r).toHaveLength(0);
  });

  it("no toca otros cromos", () => {
    const base = [{ cromoId: 1, cantidad: 2 }, { cromoId: 2, cantidad: 5 }];
    const r = quitarCromo(base, 1);
    expect(r.find((c) => c.cromoId === 2).cantidad).toBe(5);
  });

  it("no modifica nada si el cromo no existe", () => {
    const base = [{ cromoId: 1, cantidad: 2 }];
    const r = quitarCromo(base, 99);
    // cromo 99 no existe → cantidad se decrementaría a NaN, pero filter > 0 lo elimina
    // lo importante es que cromo 1 sigue intacto
    expect(r.find((c) => c.cromoId === 1).cantidad).toBe(2);
  });
});

// ─── quemarCartaPegada ────────────────────────────────────────────────────────
describe("quemarCartaPegada", () => {
  it("devuelve quemada:false si el cromo no existe", () => {
    const { quemada } = quemarCartaPegada([], 1);
    expect(quemada).toBe(false);
  });

  it("elimina la entrada si tenía cantidad 1", () => {
    const base = [{ cromoId: 1, cantidad: 1, pegado: true }];
    const { cromosActualizados, quemada } = quemarCartaPegada(base, 1);
    expect(quemada).toBe(true);
    expect(cromosActualizados.find((c) => c.cromoId === 1)).toBeUndefined();
  });

  it("reduce cantidad y despega si tenía >1", () => {
    const base = [{ cromoId: 1, cantidad: 3, pegado: true }];
    const { cromosActualizados, quemada } = quemarCartaPegada(base, 1);
    expect(quemada).toBe(true);
    const entry = cromosActualizados.find((c) => c.cromoId === 1);
    expect(entry.cantidad).toBe(2);
    expect(entry.pegado).toBe(false);
  });

  it("no toca otros cromos", () => {
    const base = [
      { cromoId: 1, cantidad: 2, pegado: true },
      { cromoId: 2, cantidad: 4, pegado: false },
    ];
    const { cromosActualizados } = quemarCartaPegada(base, 1);
    expect(cromosActualizados.find((c) => c.cromoId === 2).cantidad).toBe(4);
  });
});

// ─── mergeCromosConSobre ──────────────────────────────────────────────────────
describe("mergeCromosConSobre", () => {
  it("añade cromos nuevos con pegado:false", () => {
    const { cromosActualizados, nuevosCount } = mergeCromosConSobre([], [{ id: 1 }], HOY);
    expect(nuevosCount).toBe(1);
    expect(cromosActualizados[0]).toMatchObject({ cromoId: 1, cantidad: 1, pegado: false, fechaObtenido: HOY });
  });

  it("incrementa cantidad si ya existe (repetido)", () => {
    const base = [{ cromoId: 1, cantidad: 1, pegado: false, fechaObtenido: HOY }];
    const { cromosActualizados, repetidosCount } = mergeCromosConSobre(base, [{ id: 1 }], HOY);
    expect(repetidosCount).toBe(1);
    expect(cromosActualizados[0].cantidad).toBe(2);
  });

  it("contadores correctos con mezcla de nuevos y repetidos", () => {
    const base = [{ cromoId: 1, cantidad: 2, pegado: false, fechaObtenido: HOY }];
    const nuevos = [{ id: 1 }, { id: 2 }, { id: 3 }];
    const { nuevosCount, repetidosCount } = mergeCromosConSobre(base, nuevos, HOY);
    expect(nuevosCount).toBe(2);
    expect(repetidosCount).toBe(1);
  });

  it("sobre vacío → sin cambios ni conteos", () => {
    const base = [{ cromoId: 1, cantidad: 1, pegado: false, fechaObtenido: HOY }];
    const { cromosActualizados, nuevosCount, repetidosCount } = mergeCromosConSobre(base, [], HOY);
    expect(cromosActualizados).toHaveLength(1);
    expect(nuevosCount).toBe(0);
    expect(repetidosCount).toBe(0);
  });

  it("no muta el array original", () => {
    const base = [{ cromoId: 1, cantidad: 1, pegado: false, fechaObtenido: HOY }];
    mergeCromosConSobre(base, [{ id: 2 }], HOY);
    expect(base).toHaveLength(1); // el original no cambia de longitud
  });
});

// ─── elegirCartaAleatoria ─────────────────────────────────────────────────────
describe("elegirCartaAleatoria", () => {
  const inventario = [
    { cromoId: 1, cantidad: 2 }, // comun
    { cromoId: 2, cantidad: 1 }, // rara
    { cromoId: 3, cantidad: 3 }, // legendaria
    { cromoId: 4, cantidad: 0 }, // mitica, pero cantidad 0
  ];

  it("devuelve una entrada de la rareza correcta", () => {
    const r = elegirCartaAleatoria(inventario, "rara", CATALOGO);
    expect(r.cromoId).toBe(2);
  });

  it("null si no hay cartas de esa rareza", () => {
    expect(elegirCartaAleatoria(inventario, "mitica", CATALOGO)).toBeNull();
  });

  it("null si cantidad es 0 aunque rareza coincida", () => {
    const inv = [{ cromoId: 4, cantidad: 0 }];
    expect(elegirCartaAleatoria(inv, "mitica", CATALOGO)).toBeNull();
  });

  it("respeta randomFn (índice 0)", () => {
    const inv = [
      { cromoId: 1, cantidad: 2 }, // comun
      { cromoId: 2, cantidad: 2 }, // rara
      { cromoId: 3, cantidad: 2 }, // legendaria
    ];
    // randomFn = () => 0 → elige el primero de la rareza
    const comunesDispo = [{ cromoId: 1, cantidad: 2 }];
    const r = elegirCartaAleatoria(inv, "comun", CATALOGO, () => 0);
    expect(r.cromoId).toBe(1);
  });

  it("inventario vacío → null", () => {
    expect(elegirCartaAleatoria([], "comun", CATALOGO)).toBeNull();
  });
});

// ─── filtrarJugadoresConRareza ────────────────────────────────────────────────
describe("filtrarJugadoresConRareza", () => {
  const jugadores = [
    { id: "a", cromos: [{ cromoId: 1, cantidad: 1 }] },           // comun
    { id: "b", cromos: [{ cromoId: 2, cantidad: 1 }] },           // rara
    { id: "c", cromos: [{ cromoId: 1, cantidad: 0 }] },           // comun pero 0
    { id: "d", cromos: [] },                                       // sin cartas
  ];

  it("incluye jugadores con ≥1 carta de la rareza", () => {
    const r = filtrarJugadoresConRareza(jugadores, "comun", CATALOGO);
    expect(r.map((j) => j.id)).toContain("a");
  });

  it("excluye jugadores sin esa rareza", () => {
    const r = filtrarJugadoresConRareza(jugadores, "comun", CATALOGO);
    expect(r.map((j) => j.id)).not.toContain("b");
  });

  it("excluye jugadores con cantidad 0", () => {
    const r = filtrarJugadoresConRareza(jugadores, "comun", CATALOGO);
    expect(r.map((j) => j.id)).not.toContain("c");
  });

  it("jugador sin cromos → excluido", () => {
    const r = filtrarJugadoresConRareza(jugadores, "comun", CATALOGO);
    expect(r.map((j) => j.id)).not.toContain("d");
  });

  it("lista vacía → resultado vacío", () => {
    expect(filtrarJugadoresConRareza([], "comun", CATALOGO)).toHaveLength(0);
  });
});

// ─── elegirCartaPegadaAleatoria ───────────────────────────────────────────────
describe("elegirCartaPegadaAleatoria", () => {
  it("devuelve una carta pegada", () => {
    const inv = [
      { cromoId: 1, cantidad: 1, pegado: true },
      { cromoId: 2, cantidad: 1, pegado: false },
    ];
    const r = elegirCartaPegadaAleatoria(inv);
    expect(r.cromoId).toBe(1);
  });

  it("null si no hay cartas pegadas", () => {
    const inv = [{ cromoId: 1, cantidad: 2, pegado: false }];
    expect(elegirCartaPegadaAleatoria(inv)).toBeNull();
  });

  it("null si inventario vacío", () => {
    expect(elegirCartaPegadaAleatoria([])).toBeNull();
  });

  it("ignora cartas pegadas con cantidad 0", () => {
    const inv = [{ cromoId: 1, cantidad: 0, pegado: true }];
    expect(elegirCartaPegadaAleatoria(inv)).toBeNull();
  });

  it("respeta randomFn (último elemento)", () => {
    const inv = [
      { cromoId: 1, cantidad: 1, pegado: true },
      { cromoId: 2, cantidad: 1, pegado: true },
    ];
    // randomFn → 0.999… → Math.floor(0.999 * 2) = 1 → elige índice 1
    const r = elegirCartaPegadaAleatoria(inv, () => 0.999);
    expect(r.cromoId).toBe(2);
  });

  it("pegado=undefined también entra en la selección (undefined !== false)", () => {
    // El filtro es c.pegado !== false: undefined !== false → incluido
    const inv = [
      { cromoId: 1, cantidad: 1, pegado: undefined },
      { cromoId: 2, cantidad: 1, pegado: true },
    ];
    // randomFn = () => 0 → elige índice 0 de las pegadas → cromoId 1
    const r = elegirCartaPegadaAleatoria(inv, () => 0);
    expect(r.cromoId).toBe(1);
  });
});
