import { describe, it, expect } from "vitest";
import {
  normalizarTexto,
  compararTexto,
  getDayOfYear,
  torturaDelDia,
  textoDelDia,
  contadorCompletado,
  contadorMostrarOferta,
} from "../lib/torturaHelper.js";

// ─── normalizarTexto ──────────────────────────────────────────────────────────
describe("normalizarTexto", () => {
  it("trim de espacios iniciales y finales", () =>
    expect(normalizarTexto("  hola  ")).toBe("hola"));

  it("colapsa múltiples espacios en uno", () =>
    expect(normalizarTexto("hola   mundo")).toBe("hola mundo"));

  it("normaliza comillas tipograficas simples (U+2019) a apostrofe ASCII (U+0027)", () => {
    // Construimos con charCode para no confundir al parser
    const apost = String.fromCharCode(0x2019); // RIGHT SINGLE QUOTATION MARK
    const input = "it" + apost + "s";
    const result = normalizarTexto(input);
    expect(result.charCodeAt(2)).toBe(0x27); // U+0027 APOSTROPHE
    expect(result).toBe("it's");
  });

  it("normaliza comillas tipograficas dobles (U+201C/D) a comilla ASCII (U+0022)", () => {
    // Construimos con charCode para no confundir al parser
    const lq    = String.fromCharCode(0x201C); // LEFT DOUBLE QUOTATION MARK
    const rq    = String.fromCharCode(0x201D); // RIGHT DOUBLE QUOTATION MARK
    const input = lq + "hola" + rq;
    const result = normalizarTexto(input);
    expect(result.charCodeAt(0)).toBe(0x22); // primer char = U+0022
    expect(result.charCodeAt(5)).toBe(0x22); // ultimo char = U+0022
    expect(result).toBe('"hola"');
  });

  it("null/undefined → cadena vacía", () => {
    expect(normalizarTexto(null)).toBe("");
    expect(normalizarTexto(undefined)).toBe("");
  });

  it("cadena ya limpia → igual", () =>
    expect(normalizarTexto("hola mundo")).toBe("hola mundo"));

  it("cadena vacía → vacía", () =>
    expect(normalizarTexto("")).toBe(""));

  it("combina trim + colapso + comillas", () => {
    // Construimos con códigos explícitos para evitar confusión de codificación
    const apost = String.fromCharCode(0x2019); // RIGHT SINGLE QUOTATION MARK
    const lq    = String.fromCharCode(0x201C); // LEFT DOUBLE QUOTATION MARK
    const rq    = String.fromCharCode(0x201D); // RIGHT DOUBLE QUOTATION MARK
    const input = "  it" + apost + "s   a   " + lq + "test" + rq + "  ";
    expect(normalizarTexto(input)).toBe("it's a \"test\"");
  });
});

// ─── compararTexto ────────────────────────────────────────────────────────────
describe("compararTexto", () => {
  it("ok:true si los textos son idénticos", () => {
    const r = compararTexto("hola mundo", "hola mundo");
    expect(r.ok).toBe(true);
  });

  it("ok:true con normalización aplicada (espacios extra)", () => {
    const r = compararTexto("hola mundo", "hola  mundo");
    expect(r.ok).toBe(true);
  });

  it("ok:true con normalización de comillas (ambos lados tienen curly → misma cadena)", () => {
    // Usamos códigos explícitos para garantizar que ambos tienen la misma comilla
    const curly = String.fromCharCode(0x2019);
    const objetivo = "it" + curly + "s fine";
    const escrito  = "it" + curly + "s fine";
    expect(compararTexto(objetivo, escrito).ok).toBe(true);
  });

  it("ok:false + mensaje 'nada' si escrito está vacío", () => {
    const r = compararTexto("hola", "");
    expect(r.ok).toBe(false);
    expect(r.detalle).toMatch(/No has escrito nada/i);
  });

  it("ok:false + 'demasiado largo' si se escribió más de lo necesario", () => {
    const r = compararTexto("hola", "hola mundo");
    expect(r.ok).toBe(false);
    expect(r.detalle).toMatch(/demasiado largo/i);
  });

  it("ok:false + 'incompleto' si se escribió menos de lo necesario", () => {
    const r = compararTexto("hola mundo", "hola");
    expect(r.ok).toBe(false);
    expect(r.detalle).toMatch(/incompleto/i);
  });

  it("ok:false + posición cuando hay diferencia en medio", () => {
    const r = compararTexto("hola mundo", "hola MUNDO");
    expect(r.ok).toBe(false);
    expect(r.pos).toBe(5);       // pos es 0-indexed: 'm' vs 'M' está en índice 5
    expect(r.detalle).toContain("6"); // detalle usa 1-indexed (pos + 1 = 6)
  });

  it("posición correcta: primera letra diferente", () => {
    const r = compararTexto("abc", "axc");
    expect(r.pos).toBe(1);
  });

  it("contexto incluye fragmentos del objetivo y escrito", () => {
    const r = compararTexto("La vida es bella", "La vida es BELLA");
    expect(r.detalle).toContain("esperado:");
    expect(r.detalle).toContain("escrito:");
  });
});

// ─── getDayOfYear ─────────────────────────────────────────────────────────────
describe("getDayOfYear", () => {
  it("1 de enero → día 1", () => {
    expect(getDayOfYear(new Date(2026, 0, 1))).toBe(1);
  });

  it("2 de enero → día 2", () => {
    expect(getDayOfYear(new Date(2026, 0, 2))).toBe(2);
  });

  it("31 de diciembre año no bisiesto → día 365", () => {
    expect(getDayOfYear(new Date(2026, 11, 31))).toBe(365);
  });

  it("31 de diciembre año bisiesto → día 366", () => {
    expect(getDayOfYear(new Date(2024, 11, 31))).toBe(366);
  });

  it("15 de enero → día 15 (sin cruce de DST)", () => {
    // Usamos enero para evitar problemas de DST en Europa
    expect(getDayOfYear(new Date(2026, 0, 15))).toBe(15);
  });
});

// ─── torturaDelDia ────────────────────────────────────────────────────────────
describe("torturaDelDia", () => {
  const torturas = ["A", "B", "C"];

  it("selecciona por módulo", () =>
    expect(torturaDelDia(torturas, 0)).toBe("A"));

  it("día 1 → índice 1", () =>
    expect(torturaDelDia(torturas, 1)).toBe("B"));

  it("día 3 → vuelve al índice 0 (modulo)", () =>
    expect(torturaDelDia(torturas, 3)).toBe("A"));

  it("número grande → módulo correcto", () =>
    expect(torturaDelDia(torturas, 100)).toBe(torturas[100 % 3]));
});

// ─── textoDelDia ──────────────────────────────────────────────────────────────
describe("textoDelDia", () => {
  const textos = ["texto1", "texto2", "texto3", "texto4"];

  it("selecciona por módulo", () =>
    expect(textoDelDia(textos, 0)).toBe("texto1"));

  it("día 4 → vuelve al índice 0", () =>
    expect(textoDelDia(textos, 4)).toBe("texto1"));

  it("día 7 → índice 3", () =>
    expect(textoDelDia(textos, 7)).toBe("texto4"));
});

// ─── contadorCompletado ───────────────────────────────────────────────────────
describe("contadorCompletado", () => {
  it("false con 499 taps", ()  => expect(contadorCompletado(499)).toBe(false));
  it("true con 500 taps",  ()  => expect(contadorCompletado(500)).toBe(true));
  it("true con 501 taps",  ()  => expect(contadorCompletado(501)).toBe(true));
  it("false con 0 taps",   ()  => expect(contadorCompletado(0)).toBe(false));
  it("false con 200 taps", ()  => expect(contadorCompletado(200)).toBe(false));
});

// ─── contadorMostrarOferta ────────────────────────────────────────────────────
describe("contadorMostrarOferta", () => {
  it("false con 199 taps", () => expect(contadorMostrarOferta(199)).toBe(false));
  it("true con 200 taps",  () => expect(contadorMostrarOferta(200)).toBe(true));
  it("true con 300 taps",  () => expect(contadorMostrarOferta(300)).toBe(true));
  it("false con 0 taps",   () => expect(contadorMostrarOferta(0)).toBe(false));
  it("true con 499 taps",  () => expect(contadorMostrarOferta(499)).toBe(true));
});
