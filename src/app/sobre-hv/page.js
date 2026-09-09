"use client";
/**
 * /sobre-hv — Flujo de apertura de sobres con diseño HoloVault.
 * Lógica idéntica a /abrir-sobre; visual completamente rediseñado.
 */
import { useState, useEffect, useRef } from "react";
import { auth, db } from "../../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc, runTransaction } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { CROMOS } from "../../data/cromos";
import { addFeedEvent } from "../../lib/feedHelper";
import "../hv.css";
import HvBottomNav from "../HvBottomNav";

// ─── Rareza ───────────────────────────────────────────────────────────────────
const RAREZA = {
  comun:      { label: "COMÚN",      color: "oklch(0.74 0.03 265)", soft: "oklch(0.5 0.04 265)" },
  rara:       { label: "RARA",       color: "oklch(0.76 0.15 230)", soft: "oklch(0.5 0.13 230)" },
  legendaria: { label: "LEGENDARIA", color: "oklch(0.83 0.13 85)",  soft: "oklch(0.6 0.13 85)"  },
  mitica:     { label: "MÍTICA",     color: "oklch(0.68 0.22 18)",  soft: "oklch(0.5 0.2 18)"   },
};

const MAX_SOBRES   = 2;
const CROMOS_NORM  = 5;
const CROMOS_MEGA  = 7;
const MEGA_CADA    = 15;
const PROB_MITICA  = 0.5;
const HOY          = new Date().toLocaleDateString("en-CA");

function getAyer() {
  const d = new Date(); d.setDate(d.getDate() - 1);
  return d.toLocaleDateString("en-CA");
}

// ─── Seleccionar cromo ────────────────────────────────────────────────────────
function seleccionar(bloquearMitica = false, mega = false) {
  if (!bloquearMitica && Math.random() * 100 < PROB_MITICA) {
    const m = CROMOS.find(c => c.rareza === "mitica");
    if (m) return m;
  }
  const roll = Math.random() * 100;
  let rareza;
  if (mega) rareza = roll < 6 ? "legendaria" : roll < 33 ? "rara" : "comun";
  else       rareza = roll < 3 ? "legendaria" : roll < 19 ? "rara" : "comun";
  const pool = CROMOS.filter(c => c.rareza === rareza);
  return pool[Math.floor(Math.random() * pool.length)] ?? CROMOS[0];
}

// ─── Chip de rareza ───────────────────────────────────────────────────────────
function RarityChip({ rareza, small }) {
  const R = RAREZA[rareza] ?? RAREZA.comun;
  return (
    <span className={"hv-rchip" + (small ? " sm" : "")}
      style={{ "--rc": R.color, "--rs": R.soft }}>
      {R.label}
    </span>
  );
}

export default function SobreHvPage() {
  const [user,         setUser]         = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [datos,        setDatos]        = useState(null);
  const [sobresHoy,    setSobresHoy]    = useState(0);
  const [sobresBonus,  setSobresBonus]  = useState(0);
  const [megaBonus,    setMegaBonus]    = useState(0);
  const [sobresRuleta, setSobresRuleta] = useState(0);
  const [totalAb,      setTotalAb]      = useState(0);

  // Flujo apertura
  const [fase,         setFase]         = useState("idle"); // idle|abriendo|revelando|resumen
  const [errorMsg,     setErrorMsg]     = useState("");
  const [esMega,       setEsMega]       = useState(false);
  const [cartas,       setCartas]       = useState([]);   // cartas del sobre
  const [cardIdx,      setCardIdx]      = useState(0);
  const [cardFlipped,  setCardFlipped]  = useState(false);
  const [nuevosCount,  setNuevosCount]  = useState(0);
  const [repetCount,   setRepetCount]   = useState(0);

  const abriendoRef = useRef(false);
  const router      = useRouter();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { router.push("/"); return; }
      setUser(u);
      try {
        const snap = await getDoc(doc(db, "usuarios", u.uid));
        if (snap.exists()) {
          const d = snap.data();
          setDatos(d);
          setSobresHoy(d.fechaUltimoSobre === HOY ? (d.sobresAbiertosHoy || 0) : 0);
          setSobresBonus(d.sobresBonus || 0);
          setMegaBonus(d.megaSobresBonus || 0);
          setSobresRuleta(d.sobresRuleta || 0);
          setTotalAb(d.totalSobresAbiertos || 0);
        }
      } catch (err) { console.error(err); }
      setLoading(false);
    });
    return () => unsub();
  }, [router]);

  const maxHoy       = datos?.fechaMaldicion === HOY ? 1 : MAX_SOBRES;
  const puedeAbrir   = sobresHoy < maxHoy || sobresBonus > 0 || megaBonus > 0 || sobresRuleta > 0;
  const proximoMega  = MEGA_CADA - (totalAb % MEGA_CADA);
  const sigEsMega    = proximoMega === MEGA_CADA || proximoMega <= 0;

  // ── Abrir sobre ──────────────────────────────────────────────────────────────
  const abrirSobre = async () => {
    if (!puedeAbrir || fase !== "idle" || abriendoRef.current) return;
    abriendoRef.current = true;

    let freshSobresHoy = sobresHoy, freshMax = maxHoy;
    let freshBonus = sobresBonus, freshMega = megaBonus, freshRuleta = sobresRuleta;

    setErrorMsg("");
    try {
      await runTransaction(db, async tx => {
        const ref  = doc(db, "usuarios", user.uid);
        const snap = await tx.get(ref);
        if (!snap.exists()) throw new Error("no-data");
        const d = snap.data();
        freshSobresHoy = d.fechaUltimoSobre === HOY ? (d.sobresAbiertosHoy || 0) : 0;
        freshMax       = d.fechaMaldicion === HOY ? 1 : MAX_SOBRES;
        freshBonus     = d.sobresBonus || 0;
        freshMega      = d.megaSobresBonus || 0;
        freshRuleta    = d.sobresRuleta || 0;
        if (freshSobresHoy >= freshMax && !freshBonus && !freshMega && !freshRuleta)
          throw new Error("limite");
        const usandoBonus = freshSobresHoy >= freshMax && freshBonus > 0;
        const usandoMega  = freshSobresHoy >= freshMax && !freshBonus && freshMega > 0;
        const usandoRuleta = freshSobresHoy >= freshMax && !freshBonus && !freshMega && freshRuleta > 0;
        const claim = {};
        if (!usandoBonus && !usandoMega && !usandoRuleta) {
          claim.sobresAbiertosHoy = freshSobresHoy + 1;
          claim.fechaUltimoSobre  = HOY;
        }
        if (usandoBonus)  claim.sobresBonus     = freshBonus - 1;
        if (usandoMega)   claim.megaSobresBonus = freshMega - 1;
        if (usandoRuleta) claim.sobresRuleta    = freshRuleta - 1;
        tx.set(ref, claim, { merge: true });
      });
    } catch (err) {
      console.error("[sobre-hv] transacción:", err);
      setSobresHoy(freshSobresHoy);
      setSobresBonus(freshBonus); setMegaBonus(freshMega); setSobresRuleta(freshRuleta);
      setErrorMsg(err.message === "limite" ? "Ya abriste todos tus sobres hoy." : `Error: ${err.message}`);
      abriendoRef.current = false;
      return;
    }

    const usandoBonus  = freshSobresHoy >= freshMax && freshBonus > 0;
    const usandoMega   = freshSobresHoy >= freshMax && !freshBonus && freshMega > 0;
    const usandoRuleta = freshSobresHoy >= freshMax && !freshBonus && !freshMega && freshRuleta > 0;
    const mega         = (!usandoRuleta && sigEsMega) || usandoMega;
    setEsMega(mega);
    if (!usandoBonus && !usandoMega && !usandoRuleta) setSobresHoy(freshSobresHoy + 1);
    if (usandoBonus)  setSobresBonus(freshBonus - 1);
    if (usandoMega)   setMegaBonus(freshMega - 1);
    if (usandoRuleta) setSobresRuleta(freshRuleta - 1);
    abriendoRef.current = false;

    setFase("abriendo");
    setTimeout(async () => {
      // Generar cartas
      const n = mega ? CROMOS_MEGA : CROMOS_NORM;
      const cromosActuales = datos?.cromos || [];
      const seen = new Set(cromosActuales.map(c => c.cromoId));
      let mitica = cromosActuales.some(c => c.cromoId === 999);
      let nc = 0, rc = 0;
      const nuevas = [];
      for (let i = 0; i < n; i++) {
        const cromo = seleccionar(mitica, mega);
        if (cromo.rareza === "mitica") mitica = true;
        const esNueva = !seen.has(cromo.id);
        if (esNueva) { nc++; seen.add(cromo.id); } else { rc++; }
        nuevas.push({ ...cromo, esNueva });
      }
      nuevas.sort((a, b) => {
        const w = { comun: 0, rara: 1, legendaria: 2, mitica: 3 };
        return w[a.rareza] - w[b.rareza];
      });
      setCartas(nuevas);
      setNuevosCount(nc);
      setRepetCount(rc);
      setCardIdx(0);
      setCardFlipped(false);
      setFase("revelando");

      // Guardar en Firestore
      try {
        const cromosActualizados = [...cromosActuales];
        nuevas.forEach(cromo => {
          const ex = cromosActualizados.find(c => c.cromoId === cromo.id);
          if (ex) ex.cantidad += 1;
          else cromosActualizados.push({ cromoId: cromo.id, cantidad: 1, fechaObtenido: HOY, pegado: false });
        });
        setDatos(p => ({ ...p, cromos: cromosActualizados }));
        setTotalAb(p => p + 1);
        setDoc(doc(db, "usuarios", user.uid), {
          cromos: cromosActualizados,
          totalSobresAbiertos: (totalAb || 0) + 1,
        }, { merge: true });
        // Feed para legendarias/míticas
        nuevas.filter(c => c.rareza === "legendaria" || c.rareza === "mitica").forEach(c => {
          addFeedEvent({ type: c.rareza, userName: datos?.nombre, details: `sacó ${c.nombre}`, image: c.imagen });
        });
        if (mega) addFeedEvent({ type: "legendaria", userName: datos?.nombre, details: "abrió un ⭐ Mega Sobre" });
      } catch (err) { console.error(err); }
    }, mega ? 2000 : 1400);
  };

  // ── Voltear carta ─────────────────────────────────────────────────────────────
  const voltear = () => {
    if (cardFlipped) return;
    setCardFlipped(true);
  };

  // ── Siguiente carta / fin ─────────────────────────────────────────────────────
  const siguiente = () => {
    const total = esMega ? CROMOS_MEGA : CROMOS_NORM;
    if (cardIdx < total - 1) {
      setCardIdx(i => i + 1);
      setCardFlipped(false);
    } else {
      setFase("resumen");
    }
  };

  const reset = () => {
    setFase("idle"); setCartas([]); setCardIdx(0); setCardFlipped(false); setEsMega(false);
  };

  if (loading) return <div className="hv-app hv-loading"><span>Cargando…</span></div>;

  const carta     = cartas[cardIdx];
  const totalCar  = esMega ? CROMOS_MEGA : CROMOS_NORM;
  const R         = carta ? (RAREZA[carta.rareza] ?? RAREZA.comun) : null;

  return (
    <div className="hv-app hv-page">
      <div className="hv-content">
      <div className="hv-screen">

        {/* ── Header ── */}
        <div className="hv-shead" style={{ paddingTop: 16 }}>
          <div>
            <div className="hv-kicker">Álbum Yeissy</div>
            <h1 className="hv-h1">{esMega ? "⭐ Mega Sobre" : "Sobre"}</h1>
          </div>
          <button className="hv-x" onClick={() => router.push("/conseguir-hv")} style={{ marginTop: 10 }}>✕</button>
        </div>

        {/* ════════ IDLE ════════ */}
        {fase === "idle" && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20, paddingTop: 20 }}>
            {!puedeAbrir ? (
              <div style={{ textAlign: "center", padding: 30 }}>
                <p style={{ fontSize: "2rem", marginBottom: 10 }}>😴</p>
                <p style={{ color: "var(--muted)" }}>Sin sobres disponibles hoy.</p>
                <p style={{ color: "var(--muted)", fontSize: 12, marginTop: 6 }}>Vuelve mañana o consigue más en la tienda.</p>
              </div>
            ) : (
              <>
                <button
                  className={"hv-bigpack" + (sigEsMega || esMega ? " mega" : "")}
                  onClick={abrirSobre}
                  style={{ border: "none", cursor: "pointer" }}
                  disabled={abriendoRef.current}
                >
                  <div className="hv-foil" />
                  <div className="hv-bigpack-mark">{sigEsMega ? "⭐" : "AY"}</div>
                  <div className="hv-bigpack-label">{sigEsMega ? "MEGA SOBRE" : "ÁLBUM YEISSY"}</div>
                </button>
                {errorMsg ? (
                  <p style={{ color: "#f87171", fontFamily: "'IBM Plex Mono',monospace", fontSize: 12, textAlign: "center" }}>
                    {errorMsg}
                  </p>
                ) : (
                  <p className="hv-tap-pulse">TOCA PARA ABRIR</p>
                )}
                {/* Disponibilidad */}
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "var(--muted)", textAlign: "center", lineHeight: 1.8 }}>
                  {sobresHoy < maxHoy && <div>📦 {maxHoy - sobresHoy} sobre{maxHoy - sobresHoy > 1 ? "s" : ""} diario{maxHoy - sobresHoy > 1 ? "s" : ""}</div>}
                  {sobresBonus  > 0  && <div>🎁 Bonus ×{sobresBonus}</div>}
                  {megaBonus    > 0  && <div>⭐ Mega ×{megaBonus}</div>}
                  {sobresRuleta > 0  && <div>🎰 Ruleta ×{sobresRuleta}</div>}
                </div>
              </>
            )}
          </div>
        )}

        {/* ════════ ABRIENDO ════════ */}
        {fase === "abriendo" && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, gap: 20 }}>
            <div className={"hv-bigpack" + (esMega ? " mega" : "")} style={{ animation: "none", transform: "scale(1.05)" }}>
              <div className="hv-foil" style={{ opacity: .7, animation: "foilSweep 1.5s linear infinite" }} />
              <div className="hv-bigpack-mark" style={{ fontSize: 60 }}>{esMega ? "⭐" : "✨"}</div>
            </div>
            <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, letterSpacing: ".1em", color: "var(--accent)", animation: "tapPulse .8s infinite" }}>
              {esMega ? "ABRIENDO MEGA SOBRE…" : "ABRIENDO SOBRE…"}
            </p>
          </div>
        )}

        {/* ════════ REVELANDO ════════ */}
        {fase === "revelando" && carta && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, paddingTop: 8 }}>
            {/* Contador */}
            <p className="hv-reveal-count">{cardIdx + 1} / {totalCar}</p>
            {/* Rareza burst */}
            {cardFlipped && carta.rareza !== "comun" && (
              <div className="hv-rarity-burst" style={{ color: R.color }}>
                {carta.rareza === "mitica" ? "⚡ MÍTICA ⚡"
                  : carta.rareza === "legendaria" ? "⭐ LEGENDARIA"
                  : "💎 RARA"}
              </div>
            )}
            {cardFlipped && carta.esNueva && <div className="hv-new-big">¡NUEVO!</div>}

            {/* Carta */}
            <div
              className="hv-reveal-card"
              onClick={!cardFlipped ? voltear : undefined}
              style={{
                width: 220, cursor: cardFlipped ? "default" : "pointer",
                "--rc": R?.color, "--rs": R?.soft,
              }}
            >
              {!cardFlipped ? (
                /* Dorso */
                <div style={{
                  width: 220, height: Math.round(220 / 0.7),
                  borderRadius: 19, background: "linear-gradient(160deg, var(--bg2), var(--bg))",
                  border: "1.5px solid var(--line)", display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center", gap: 8,
                }}>
                  <div style={{ fontFamily: "var(--head-font)", fontWeight: 700, fontSize: 28, letterSpacing: ".06em", color: "var(--accent)", textAlign: "center", lineHeight: .95 }}>
                    ÁLBUM<br/>YEISSY
                  </div>
                  <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: ".16em", color: "var(--muted)" }}>
                    toca para revelar
                  </p>
                </div>
              ) : (
                /* Frente */
                <div style={{
                  width: 220, height: Math.round(220 / 0.7),
                  borderRadius: 19,
                  background: "linear-gradient(168deg, var(--surface), var(--bg))",
                  border: `1.5px solid ${R.color}`,
                  boxShadow: `0 0 24px -8px ${R.color}`,
                  display: "flex", flexDirection: "column", overflow: "hidden",
                  position: "relative",
                }}>
                  <div className="hv-foil" style={{ opacity: .6 }} />
                  <div className="hv-sheen" />
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px 0", position: "relative", zIndex: 7 }}>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, fontSize: 13, color: R.color }}>
                      #{String(carta.id).padStart(2, "0")}
                    </span>
                    <RarityChip rareza={carta.rareza} small />
                  </div>
                  <div style={{ flex: 1, margin: "8px 10px", borderRadius: 10, overflow: "hidden", position: "relative", zIndex: 7 }}>
                    <img src={carta.imagen} alt={carta.nombre} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </div>
                  <div style={{ padding: "0 12px 12px", position: "relative", zIndex: 7 }}>
                    <div style={{ fontFamily: "var(--head-font)", fontWeight: 700, fontSize: 20, lineHeight: 1.1 }}>{carta.nombre}</div>
                  </div>
                </div>
              )}
            </div>

            {/* Botón siguiente */}
            {cardFlipped && (
              <button className="hv-btn primary" style={{ maxWidth: 240 }} onClick={siguiente}>
                {cardIdx < totalCar - 1 ? `Siguiente → (${cardIdx + 2}/${totalCar})` : "Ver resumen"}
              </button>
            )}
            {!cardFlipped && (
              <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "var(--muted)", letterSpacing: ".06em" }}>
                TOCA LA CARTA PARA REVELAR
              </p>
            )}
          </div>
        )}

        {/* ════════ RESUMEN ════════ */}
        {fase === "resumen" && (
          <div style={{ paddingTop: 8 }}>
            <h2 style={{ fontFamily: "var(--head-font)", fontSize: 22, marginBottom: 4 }}>
              {esMega ? "⭐ Mega Sobre abierto" : "¡Sobre abierto!"}
            </h2>
            <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 14 }}>
              {nuevosCount > 0 && `🆕 ${nuevosCount} nuevo${nuevosCount > 1 ? "s" : ""}`}
              {nuevosCount > 0 && repetCount > 0 && " · "}
              {repetCount > 0 && `🔄 ${repetCount} repetido${repetCount > 1 ? "s" : ""}`}
            </p>
            <div className="hv-loot">
              {cartas.map((c, i) => {
                const Rc = RAREZA[c.rareza] ?? RAREZA.comun;
                return (
                  <div key={i} className="hv-loot-card" style={{ "--rc": Rc.color }}>
                    {c.esNueva && <span className="hv-loot-new">NUEVO</span>}
                    <img src={c.imagen} alt={c.nombre} className="hv-loot-img" />
                    <div className="hv-loot-name">{c.nombre}</div>
                    <RarityChip rareza={c.rareza} small />
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              {puedeAbrir && (
                <button className="hv-btn primary" style={{ flex: 1 }} onClick={reset}>
                  Otro sobre 📦
                </button>
              )}
              <button className="hv-btn ghost" style={{ flex: 1 }} onClick={() => router.push("/album-hv")}>
                Ver álbum 📖
              </button>
            </div>
          </div>
        )}

        <div className="hv-screen-pad" />
      </div>
    </div>
    <HvBottomNav />
  </div>
  );
}
