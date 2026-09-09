"use client";
import { useState, useEffect, useRef } from "react";
import { auth, db } from "../../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  doc, getDoc, getDocs, collection, runTransaction, setDoc,
} from "firebase/firestore";
import { useRouter } from "next/navigation";
import { CROMOS } from "../../data/cromos";
import { addFeedEvent } from "../../lib/feedHelper";
import { getPaginasCompletas } from "../../lib/cromoHelper";
import "../hv.css";
import HvBottomNav from "../HvBottomNav";

// ─── Ruleta ───────────────────────────────────────────────────────────────────
const SECTORES = [
  { id: "sobre",            emoji: "📦", label: "Sobre gratis",     color: "#3b82f6", prob: 20 },
  { id: "robar_comun",      emoji: "🃏", label: "Robar común",       color: "#94a3b8", prob: 20 },
  { id: "robar_rara",       emoji: "💎", label: "Robar rara",        color: "#60a5fa", prob: 15 },
  { id: "robar_legendaria", emoji: "⭐", label: "Robar legendaria",  color: "#fbbf24", prob: 5  },
  { id: "quema",            emoji: "🔥", label: "La quema",          color: "#ef4444", prob: 17 },
  { id: "maldicion",        emoji: "😈", label: "La maldición",      color: "#8b5cf6", prob: 11 },
  { id: "perdedor",         emoji: "💀", label: "Perdedor",          color: "#475569", prob: 12 },
];
const SECTOR_ANGLE  = 360 / SECTORES.length;
const SPIN_DURATION = 9000;
const FULL_SPINS    = 6;

// ─── Tienda ───────────────────────────────────────────────────────────────────
const ITEMS = [
  { id: "sobre",            emoji: "📦", nombre: "Sobre extra",          precio: 20, desc: "Un sobre adicional hoy",           badge: null    },
  { id: "mega_sobre",       emoji: "🎁", nombre: "Mega Sobre",           precio: 30, desc: "3 sobres de golpe",                badge: "PRO"   },
  { id: "proteccion",       emoji: "🛡️", nombre: "Protección racha",    precio: 15, desc: "No pierdas la racha mañana",       badge: null    },
  { id: "cancelar_maldicion",emoji:"💀", nombre: "Cancelar maldición",   precio: 12, desc: "Elimina tu maldición activa",      badge: null    },
  { id: "robo_cr",          emoji: "🎯", nombre: "Robo común/rara",      precio: 30, desc: "Roba una carta a otro jugador",    badge: null    },
  { id: "robo_leg",         emoji: "⭐", nombre: "Robo legendaria",      precio: 35, desc: "Roba una legendaria",             badge: "ÉPICO" },
  { id: "espiar",           emoji: "👁️", nombre: "Espiar colección",    precio: 10, desc: "Ve todas las cartas de alguien",   badge: null    },
];
const MAX_COMPRAS = 3;

// ─── Helpers ──────────────────────────────────────────────────────────────────
const HOY = new Date().toLocaleDateString("en-CA");

function getManana() {
  const d = new Date(); d.setDate(d.getDate() + 1);
  return d.toLocaleDateString("en-CA");
}

function nameToHue(name = "") {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) & 0xffff;
  return h % 360;
}
function initials(name = "") {
  const p = name.trim().split(/\s+/);
  return p.length >= 2 ? (p[0][0] + p[1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
}

// ─── SVG Wheel ────────────────────────────────────────────────────────────────
function Wheel({ rotation, spinning }) {
  const CX = 140, CY = 140, R = 128, Ri = 24;
  const toRad = (d) => (d * Math.PI) / 180;
  const sectors = SECTORES.map((s, i) => {
    const start = i * SECTOR_ANGLE - 90;
    const end   = start + SECTOR_ANGLE;
    const mid   = start + SECTOR_ANGLE / 2;
    const x1 = CX + R * Math.cos(toRad(start));
    const y1 = CY + R * Math.sin(toRad(start));
    const x2 = CX + R * Math.cos(toRad(end));
    const y2 = CY + R * Math.sin(toRad(end));
    const lx = CX + (R * 0.66) * Math.cos(toRad(mid));
    const ly = CY + (R * 0.66) * Math.sin(toRad(mid));
    return { path: `M${CX} ${CY} L${x1} ${y1} A${R} ${R} 0 0 1 ${x2} ${y2}Z`, lx, ly, ...s };
  });

  return (
    <div className="hv-wheel-wrap">
      <div className="hv-wheel-pointer-wrap">▼</div>
      <svg
        className="hv-wheel-svg"
        width={280} height={280}
        style={{
          transform:  `rotate(${rotation}deg)`,
          transition: spinning
            ? `transform ${SPIN_DURATION / 1000}s cubic-bezier(.16,.84,.3,1)`
            : "none",
        }}
      >
        <circle cx={CX} cy={CY} r={R + 4} fill="none" stroke="rgba(255,255,255,.07)" strokeWidth={8} />
        {sectors.map((s, i) => (
          <g key={i}>
            <path d={s.path} fill={s.color} opacity={0.88} />
            <path d={s.path} fill="none" stroke="rgba(0,0,0,.25)" strokeWidth={1.5} />
            <text x={s.lx} y={s.ly} textAnchor="middle" dominantBaseline="middle"
              fontSize={26} style={{ userSelect: "none", pointerEvents: "none" }}>
              {s.emoji}
            </text>
          </g>
        ))}
        {/* labels removed — only emojis fit inside the sectors on mobile */}
        {/* Center hub */}
        <circle cx={CX} cy={CY} r={Ri + 2} fill="rgba(0,0,0,.35)" />
        <circle cx={CX} cy={CY} r={Ri} fill="var(--bg2)" stroke="var(--line)" strokeWidth={2} />
        <text x={CX} y={CY} textAnchor="middle" dominantBaseline="middle"
          fontSize={14} fill="#39d6e8" fontFamily="IBM Plex Mono" fontWeight={700}
          style={{ userSelect: "none", pointerEvents: "none" }}>◉</text>
      </svg>
    </div>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ msg, tipo }) {
  if (!msg) return null;
  return <div className={`hv-toast ${tipo === "err" ? "err" : "ok"}`}>{msg}</div>;
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ConseguirHvPage() {
  const [loading,       setLoading]       = useState(true);
  const [user,          setUser]          = useState(null);
  const [datosUser,     setDatosUser]     = useState(null);
  const [tab,           setTab]           = useState("sobres");

  // Ruleta state
  const [ruletaFase,    setRuletaFase]    = useState("intro"); // intro|girando|revelando|seleccion|ejecutando|done|ya_jugada|locked
  const [cylinderRot,   setCylinderRot]   = useState(0);
  const [winnerIdx,     setWinnerIdx]     = useState(null);
  const [todosJug,      setTodosJug]      = useState([]);
  const [jugFiltrados,  setJugFiltrados]  = useState([]);
  const [ruletaResult,  setRuletaResult]  = useState(null); // { title, desc, emoji }

  // Tienda state
  const [comprasHoy,    setComprasHoy]    = useState(0);
  const [toast,         setToast]         = useState(null); // { msg, tipo }

  const router       = useRouter();
  const procesandoRef = useRef(false);

  // ── Cargar datos ──────────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { router.push("/"); return; }
      setUser(u);
      try {
        const [snap, jugSnap] = await Promise.all([
          getDoc(doc(db, "usuarios", u.uid)),
          getDocs(collection(db, "usuarios")),
        ]);
        if (snap.exists()) {
          const d = snap.data();
          setDatosUser(d);
          setComprasHoy(d.fechaUltimaCompra === HOY ? (d.comprasHoy || 0) : 0);
          if (d.fechaRuleta === HOY) setRuletaFase("ya_jugada");
          else setRuletaFase("intro");
        }
        const jug = [];
        jugSnap.forEach(d => { if (d.id !== u.uid) jug.push({ id: d.id, ...d.data() }); });
        setTodosJug(jug);
      } catch (err) { console.error(err); }
      setLoading(false);
    });
    return () => unsub();
  }, [router]);

  // ── Toast helper ──────────────────────────────────────────────────────────
  const showToast = (msg, tipo = "ok") => {
    setToast({ msg, tipo });
    setTimeout(() => setToast(null), 3000);
  };

  // ── Ruleta: elegir sector ─────────────────────────────────────────────────
  const elegirSector = () => {
    const total = SECTORES.reduce((s, x) => s + x.prob, 0);
    let r = Math.random() * total;
    for (let i = 0; i < SECTORES.length; i++) { r -= SECTORES[i].prob; if (r <= 0) return i; }
    return SECTORES.length - 1;
  };

  // ── Ruleta: girar ─────────────────────────────────────────────────────────
  const girar = async () => {
    if (ruletaFase !== "intro" || procesandoRef.current) return;
    procesandoRef.current = true;

    // Marcar en Firestore ANTES de la animación → si el usuario sale a mitad,
    // cuando vuelva verá "ya_jugada" y no podrá volver a tirar.
    try {
      await runTransaction(db, async tx => {
        const ref  = doc(db, "usuarios", user.uid);
        const snap = await tx.get(ref);
        const d    = snap.data() || {};
        if (d.fechaRuleta === HOY) throw new Error("ya-jugada-hoy");
        tx.update(ref, { fechaRuleta: HOY });
      });
    } catch (err) {
      if (err.message === "ya-jugada-hoy") setRuletaFase("ya_jugada");
      procesandoRef.current = false;
      return;
    }

    const idx = elegirSector();
    setWinnerIdx(idx);
    setRuletaFase("girando");
    const extraRot = (360 - idx * SECTOR_ANGLE) % 360;
    setCylinderRot(r => r + FULL_SPINS * 360 + extraRot);
    setTimeout(() => { setRuletaFase("revelando"); procesandoRef.current = false; }, SPIN_DURATION + 300);
  };

  // ── Ruleta: continuar tras revelación ─────────────────────────────────────
  const continuarRuleta = () => {
    if (procesandoRef.current) return;
    procesandoRef.current = true;
    const s = SECTORES[winnerIdx];
    if (s.id.startsWith("robar_") || s.id === "maldicion") {
      const rareza = s.id.startsWith("robar_") ? s.id.replace("robar_", "") : null;
      const filtrados = todosJug.filter(j => {
        if (s.id === "maldicion") return true;
        const prot = getPaginasCompletas(j.cromos);
        return (j.cromos || []).some(c => {
          const info = CROMOS.find(x => x.id === c.cromoId);
          return info?.rareza === rareza && c.cantidad > 0 && !prot.has(info?.pagina);
        });
      });
      setJugFiltrados(filtrados);
      setRuletaFase("seleccion");
      procesandoRef.current = false;
    } else {
      setRuletaFase("ejecutando");
      _ejecutar(winnerIdx, null, null);
    }
  };

  const seleccionarVictima = (jug) => {
    if (procesandoRef.current) return;
    procesandoRef.current = true;
    setRuletaFase("ejecutando");
    _ejecutar(winnerIdx, jug.id, jug);
  };

  // ── Ruleta: ejecutar premio ───────────────────────────────────────────────
  const _ejecutar = async (idx, victimId, victimData) => {
    const s = SECTORES[idx];
    try {
      if      (s.id === "sobre")            await _rSobre();
      else if (s.id.startsWith("robar_"))   await _rRobar(victimId, victimData, s.id.replace("robar_", ""));
      else if (s.id === "quema")            await _rQuemar();
      else if (s.id === "maldicion")        await _rMaldecir(victimId, victimData);
      else                                  await _rPerdedor();
    } catch (err) { console.error(err); setRuletaFase("done"); }
    finally { procesandoRef.current = false; }
  };

  const _marcarRuleta = async (tx, ref, _data) => {
    // fechaRuleta ya fue marcado atómicamente en girar().
    // Solo confirmamos; no lanzamos error para no bloquear la ejecución del premio.
    tx.update(ref, { fechaRuleta: HOY });
  };

  const _rSobre = async () => {
    await runTransaction(db, async tx => {
      const ref = doc(db, "usuarios", user.uid);
      const snap = await tx.get(ref); const d = snap.data() || {};
      await _marcarRuleta(tx, ref, d);
      tx.update(ref, { sobresRuleta: (d.sobresRuleta || 0) + 1, fechaRuleta: HOY });
    });
    setDatosUser(p => ({ ...p, sobresRuleta: (p?.sobresRuleta || 0) + 1, fechaRuleta: HOY }));
    setRuletaResult({ emoji: "📦", title: "¡Sobre gratis!", desc: "Se ha añadido un sobre a tu cuenta. Ábrelo en la pantalla principal." });
    setRuletaFase("done");
    addFeedEvent({ type: "racha", userName: datosUser?.nombre, details: "ganó un sobre en la ruleta 📦" });
  };

  const _rRobar = async (victimId, victimData, rareza) => {
    let cartaRobada = null;
    await runTransaction(db, async tx => {
      const myRef = doc(db, "usuarios", user.uid);
      const vicRef = doc(db, "usuarios", victimId);
      const [mySnap, vicSnap] = await Promise.all([tx.get(myRef), tx.get(vicRef)]);
      const myD = mySnap.data() || {}; const vicD = vicSnap.data() || {};
      await _marcarRuleta(tx, myRef, myD);
      const prot = getPaginasCompletas(vicD.cromos || []);
      const disponibles = (vicD.cromos || []).filter(c => {
        const info = CROMOS.find(x => x.id === c.cromoId);
        return info?.rareza === rareza && c.cantidad > 0 && !prot.has(info?.pagina);
      });
      if (!disponibles.length) throw new Error("sin-cartas");
      const elegida = disponibles[Math.floor(Math.random() * disponibles.length)];
      const info = CROMOS.find(x => x.id === elegida.cromoId);
      cartaRobada = info;
      const vicCromos = (vicD.cromos || []).map(c => c.cromoId === elegida.cromoId ? { ...c, cantidad: c.cantidad - 1 } : c).filter(c => c.cantidad > 0);
      const myExist = (myD.cromos || []).find(c => c.cromoId === elegida.cromoId);
      const myCromos = myExist
        ? (myD.cromos || []).map(c => c.cromoId === elegida.cromoId ? { ...c, cantidad: c.cantidad + 1 } : c)
        : [...(myD.cromos || []), { cromoId: elegida.cromoId, cantidad: 1, fechaObtenido: HOY, pegado: false }];
      tx.update(vicRef, { cromos: vicCromos });
      tx.update(myRef, { cromos: myCromos, fechaRuleta: HOY });
    });
    const nombre = cartaRobada?.nombre || "una carta";
    setRuletaResult({ emoji: rareza === "legendaria" ? "⭐" : "💎", title: `¡Robaste a ${victimData?.nombre || "jugador"}!`, desc: `Has conseguido: ${nombre}` });
    setRuletaFase("done");
    addFeedEvent({ type: "robo", userName: datosUser?.nombre, details: `robó a ${victimData?.nombre} en la ruleta` });
  };

  const _rQuemar = async () => {
    await runTransaction(db, async tx => {
      const ref = doc(db, "usuarios", user.uid);
      const snap = await tx.get(ref); const d = snap.data() || {};
      await _marcarRuleta(tx, ref, d);
      const pegadas = (d.cromos || []).filter(c => c.pegado !== false && c.cantidad > 0);
      if (!pegadas.length) { tx.update(ref, { fechaRuleta: HOY }); return; }
      const elegida = pegadas[Math.floor(Math.random() * pegadas.length)];
      const cromos = (d.cromos || []).map(c => {
        if (c.cromoId !== elegida.cromoId) return c;
        if (c.cantidad <= 1) return null;
        return { ...c, cantidad: c.cantidad - 1, pegado: false };
      }).filter(Boolean);
      tx.update(ref, { cromos, fechaRuleta: HOY });
    });
    setRuletaResult({ emoji: "🔥", title: "¡La quema!", desc: "Una de tus cartas pegadas ha sido quemada." });
    setRuletaFase("done");
  };

  const _rMaldecir = async (victimId, victimData) => {
    await runTransaction(db, async tx => {
      const myRef = doc(db, "usuarios", user.uid);
      const vicRef = doc(db, "usuarios", victimId);
      const [mySnap] = await Promise.all([tx.get(myRef), tx.get(vicRef)]);
      const myD = mySnap.data() || {};
      await _marcarRuleta(tx, myRef, myD);
      tx.update(myRef, { fechaRuleta: HOY });
      tx.update(vicRef, { fechaMaldicion: HOY });
    });
    setRuletaResult({ emoji: "😈", title: `¡${victimData?.nombre || "alguien"} está maldecido!`, desc: "Mañana solo podrá abrir 1 sobre." });
    setRuletaFase("done");
    addFeedEvent({ type: "racha", userName: datosUser?.nombre, details: `maldijo a ${victimData?.nombre} 😈` });
  };

  const _rPerdedor = async () => {
    await runTransaction(db, async tx => {
      const ref = doc(db, "usuarios", user.uid);
      const snap = await tx.get(ref); const d = snap.data() || {};
      await _marcarRuleta(tx, ref, d);
      tx.update(ref, { fechaRuleta: HOY });
    });
    setRuletaResult({ emoji: "💀", title: "Perdedor", desc: "Mala suerte. Vuelve mañana." });
    setRuletaFase("done");
  };

  // ── Tienda: comprar ───────────────────────────────────────────────────────
  const comprar = async (item) => {
    if (item.requiereJugador) {
      router.push("/tienda"); // items complejos → página tienda original
      return;
    }
    const monedas = datosUser?.monedas ?? 50;
    if (monedas < item.precio) { showToast("❌ Monedas insuficientes", "err"); return; }
    if (comprasHoy >= MAX_COMPRAS) { showToast("❌ Límite de compras diarias alcanzado", "err"); return; }
    try {
      await runTransaction(db, async tx => {
        const ref = doc(db, "usuarios", user.uid);
        const snap = await tx.get(ref); const d = snap.data() || {};
        const coins = d.monedas ?? 50;
        const compras = d.fechaUltimaCompra === HOY ? (d.comprasHoy || 0) : 0;
        if (coins < item.precio) throw new Error("sin-monedas");
        if (compras >= MAX_COMPRAS) throw new Error("limite");
        const update = {
          monedas: coins - item.precio,
          comprasHoy: compras + 1,
          fechaUltimaCompra: HOY,
        };
        if (item.id === "sobre")              update.sobresBonus     = (d.sobresBonus || 0) + 1;
        if (item.id === "mega_sobre")         update.megaSobresBonus = (d.megaSobresBonus || 0) + 1;
        if (item.id === "proteccion")         update.rachaProtegidaFecha = getManana();
        if (item.id === "cancelar_maldicion") update.fechaMaldicion  = null;
        tx.set(ref, update, { merge: true });
      });
      setDatosUser(p => ({ ...p, monedas: (p?.monedas ?? 50) - item.precio }));
      setComprasHoy(c => c + 1);
      showToast(`✅ ${item.nombre} comprado`);
    } catch (err) {
      showToast(err.message === "sin-monedas" ? "❌ Monedas insuficientes"
               : err.message === "limite"    ? "❌ Límite diario alcanzado"
               : "❌ Error al comprar", "err");
    }
  };

  if (loading) return <div className="hv-app hv-loading"><span>Cargando…</span></div>;

  const sobresDisponibles = Math.max(0, (datosUser?.fechaMaldicion === HOY ? 1 : 2) - (datosUser?.fechaUltimoSobre === HOY ? (datosUser?.sobresAbiertosHoy || 0) : 0));
  const bonusSobres   = datosUser?.sobresBonus || 0;
  const megaSobres    = datosUser?.megaSobresBonus || 0;
  const sobresRuleta  = datosUser?.sobresRuleta || 0;
  const monedas       = datosUser?.monedas ?? 50;

  return (
    <div className="hv-app hv-page">
      <div className="hv-content">
      <div className="hv-screen">

        {/* ── Header ── */}
        <div className="hv-shead" style={{ paddingTop: 16 }}>
          <div>
            <div className="hv-kicker">Álbum Yeissy</div>
            <h1 className="hv-h1">Conseguir</h1>
          </div>
          <div className="hv-coin-pill">
            <span className="hv-coin-icon">◉</span>
            {monedas}
          </div>
        </div>

        {/* ── Segmented control ── */}
        <div className="hv-seg">
          {[
            { id: "sobres",  label: "📦 Sobres" },
            { id: "ruleta",  label: "🎰 Ruleta" },
            { id: "tienda",  label: "🏪 Tienda" },
            { id: "tortura", label: "😈 Tortura" },
          ].map(t => (
            <button key={t.id}
              className={"hv-seg-btn" + (tab === t.id ? " on" : "")}
              onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ════════════════════ SOBRES ════════════════════ */}
        {tab === "sobres" && (
          <div className="hv-pack-row">
            {/* Sobre diario */}
            <div className="hv-pack-card">
              <span className="hv-pack-icon">📦</span>
              <div className="hv-pack-info">
                <div className="hv-pack-title">Sobre diario</div>
                <div className="hv-pack-desc">5 cromos · gratis cada día</div>
                <div className={"hv-pack-avail " + (sobresDisponibles > 0 ? "ok" : "done")}>
                  {sobresDisponibles > 0
                    ? `${sobresDisponibles} disponible${sobresDisponibles > 1 ? "s" : ""} hoy`
                    : "Vuelve mañana"}
                </div>
              </div>
              <button
                className="hv-btn primary"
                style={{ width: "auto", padding: "10px 16px", fontSize: 13 }}
                onClick={() => router.push("/sobre-hv")}
              >Abrir →</button>
            </div>

            {/* Bonus / Mega */}
            {(bonusSobres > 0 || megaSobres > 0 || sobresRuleta > 0) && (
              <div className="hv-pack-card mega">
                <span className="hv-pack-icon">🎁</span>
                <div className="hv-pack-info">
                  <div className="hv-pack-title">Bonus pendientes</div>
                  {bonusSobres  > 0 && <div className="hv-pack-avail gold">🎁 Bonus ×{bonusSobres}</div>}
                  {megaSobres   > 0 && <div className="hv-pack-avail gold">⭐ Mega ×{megaSobres}</div>}
                  {sobresRuleta > 0 && <div className="hv-pack-avail ok">🎰 Ruleta ×{sobresRuleta}</div>}
                </div>
                <button
                  className="hv-btn primary"
                  style={{ width: "auto", padding: "10px 16px", fontSize: 13 }}
                  onClick={() => router.push("/sobre-hv")}
                >Abrir →</button>
              </div>
            )}

            {/* Info total sobres */}
            <div style={{
              textAlign: "center", padding: "12px 0",
              fontFamily: "'IBM Plex Mono', monospace", fontSize: 10,
              letterSpacing: ".1em", color: "var(--muted)",
            }}>
              {datosUser?.totalSobresAbiertos || 0} SOBRES ABIERTOS EN TOTAL
            </div>
          </div>
        )}

        {/* ════════════════════ RULETA ════════════════════ */}
        {tab === "ruleta" && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, paddingTop: 8 }}>
            <Wheel rotation={cylinderRot} spinning={ruletaFase === "girando"} />

            {/* Leyenda de sectores */}
            <div style={{
              display: "grid", gridTemplateColumns: "1fr 1fr",
              gap: "4px 12px", width: "100%", maxWidth: 280,
            }}>
              {SECTORES.map(s => (
                <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
                  <span style={{
                    width: 10, height: 10, borderRadius: 3, background: s.color,
                    flexShrink: 0, display: "inline-block",
                  }} />
                  <span style={{ color: "var(--muted)" }}>{s.emoji} {s.label}</span>
                </div>
              ))}
            </div>

            {ruletaFase === "intro" && (
              <>
                <p style={{ fontSize: 12, color: "var(--muted)", textAlign: "center", maxWidth: 260 }}>
                  1 giro gratis al día · Los premios afectan a todos los jugadores
                </p>
                <button className="hv-btn primary" style={{ maxWidth: 240 }} onClick={girar}>
                  🎰 Girar la ruleta
                </button>
              </>
            )}

            {ruletaFase === "girando" && (
              <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: "var(--accent)", letterSpacing: ".08em" }}>
                GIRANDO…
              </p>
            )}

            {ruletaFase === "revelando" && winnerIdx !== null && (
              <div className="hv-wheel-result" onClick={continuarRuleta}>
                <div className="hv-wheel-result-inner" onClick={e => e.stopPropagation()}>
                  <div className="hv-wheel-result-emoji">{SECTORES[winnerIdx].emoji}</div>
                  <div className="hv-wheel-result-label">{SECTORES[winnerIdx].label}</div>
                  <p className="hv-wheel-result-desc">
                    {SECTORES[winnerIdx].id === "sobre" && "¡Recibirás un sobre extra!"}
                    {SECTORES[winnerIdx].id.startsWith("robar_") && "Elige a quién robar."}
                    {SECTORES[winnerIdx].id === "quema" && "Una de tus cartas pegadas será quemada."}
                    {SECTORES[winnerIdx].id === "maldicion" && "Elige a quién maldecir (solo 1 sobre mañana)."}
                    {SECTORES[winnerIdx].id === "perdedor" && "Mala suerte hoy."}
                  </p>
                  <button className="hv-btn primary" onClick={continuarRuleta}>Continuar →</button>
                </div>
              </div>
            )}

            {ruletaFase === "seleccion" && (
              <div className="hv-wheel-result">
                <div className="hv-wheel-result-inner">
                  <div className="hv-wheel-result-emoji">
                    {SECTORES[winnerIdx]?.id === "maldicion" ? "😈" : "🎯"}
                  </div>
                  <div className="hv-wheel-result-label">Elige un jugador</div>
                  <div className="hv-victim-list">
                    {jugFiltrados.length === 0
                      ? <p style={{ color: "var(--muted)", fontSize: 13, textAlign: "center" }}>No hay jugadores disponibles</p>
                      : jugFiltrados.map(j => (
                        <button key={j.id} className="hv-victim-btn" onClick={() => seleccionarVictima(j)}>
                          <div style={{
                            width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
                            background: `linear-gradient(155deg, hsl(${nameToHue(j.nombre || j.email)},65%,52%), hsl(${nameToHue(j.nombre || j.email)},55%,33%))`,
                            display: "grid", placeItems: "center",
                            fontFamily: "var(--head-font)", fontWeight: 700, fontSize: 12, color: "#fff",
                          }}>
                            {initials(j.nombre || j.email || "?")}
                          </div>
                          {j.nombre || j.email}
                        </button>
                      ))}
                  </div>
                  <button className="hv-btn ghost" onClick={() => setRuletaFase("done")} style={{ marginTop: 4 }}>
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {ruletaFase === "ejecutando" && (
              <div className="hv-wheel-result">
                <div className="hv-wheel-result-inner">
                  <div className="hv-wheel-result-emoji">⏳</div>
                  <div className="hv-wheel-result-label">Aplicando…</div>
                </div>
              </div>
            )}

            {ruletaFase === "done" && ruletaResult && (
              <div className="hv-wheel-result">
                <div className="hv-wheel-result-inner">
                  <div className="hv-wheel-result-emoji">{ruletaResult.emoji}</div>
                  <div className="hv-wheel-result-label">{ruletaResult.title}</div>
                  <p className="hv-wheel-result-desc">{ruletaResult.desc}</p>
                  <button className="hv-btn primary" onClick={() => { setRuletaFase("ya_jugada"); setRuletaResult(null); }}>
                    ¡Perfecto!
                  </button>
                </div>
              </div>
            )}

            {ruletaFase === "ya_jugada" && (
              <div style={{
                background: "var(--bg2)", border: "1px solid var(--line)",
                borderRadius: 14, padding: "20px 18px", textAlign: "center", maxWidth: 280,
              }}>
                <p style={{ fontSize: "1.6rem", marginBottom: 8 }}>✅</p>
                <p style={{ fontWeight: 700, marginBottom: 4 }}>Ya has girado hoy</p>
                <p style={{ fontSize: 12, color: "var(--muted)" }}>Vuelve mañana para el siguiente giro.</p>
              </div>
            )}
          </div>
        )}

        {/* ════════════════════ TIENDA ════════════════════ */}
        {tab === "tienda" && (
          <>
            {comprasHoy >= MAX_COMPRAS && (
              <div style={{
                background: "var(--bg2)", border: "1px solid var(--line)",
                borderRadius: 12, padding: "10px 14px", marginBottom: 12,
                textAlign: "center", fontSize: 13, color: "var(--muted)",
              }}>
                Ya hiciste tus 3 compras de hoy. ¡Vuelve mañana!
              </div>
            )}
            <div className="hv-shop-grid">
              {ITEMS.map(item => (
                <div key={item.id} className="hv-shop-card">
                  {item.badge && <span className="hv-shop-badge">{item.badge}</span>}
                  <span className="hv-shop-icon">{item.emoji}</span>
                  <div className="hv-shop-name">{item.nombre}</div>
                  <div className="hv-shop-desc">{item.desc}</div>
                  <button
                    className="hv-shop-buy"
                    disabled={comprasHoy >= MAX_COMPRAS || monedas < item.precio}
                    onClick={() => comprar({ ...item, requiereJugador: ["robo_cr","robo_leg","espiar"].includes(item.id) })}
                  >
                    ◉ {item.precio}
                  </button>
                </div>
              ))}
            </div>
            <div className="hv-shop-limit">
              {MAX_COMPRAS - comprasHoy} compra{MAX_COMPRAS - comprasHoy !== 1 ? "s" : ""} restante{MAX_COMPRAS - comprasHoy !== 1 ? "s" : ""}
            </div>
          </>
        )}

        {/* ════════════════════ TORTURA ════════════════════ */}
        {tab === "tortura" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingTop: 8 }}>
            <div style={{
              background: "linear-gradient(145deg, color-mix(in oklch, #ef4444 12%, var(--surface)), var(--bg2))",
              border: "1.5px solid color-mix(in oklch, #ef4444 35%, var(--line))",
              borderRadius: 18, padding: 20,
              boxShadow: "0 0 30px -12px #ef4444",
            }}>
              <p style={{ fontSize: "2.8rem", margin: "0 0 10px" }}>😈</p>
              <div style={{ fontFamily: "var(--head-font)", fontWeight: 700, fontSize: 20, marginBottom: 6 }}>Tortura del Día</div>
              <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.5, marginBottom: 18 }}>
                Supera un mini-juego de sufrimiento para ganar un sobre bonus. Si te rindes a medias, igual te llevas 2 cromos.
              </p>
              <div style={{ display: "flex", justifyContent: "space-around", marginBottom: 18, background: "var(--bg)", borderRadius: 12, padding: "12px 8px" }}>
                <div style={{ textAlign: "center" }}>
                  <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: "#f59e0b", margin: "0 0 4px" }}>RENDIRSE</p>
                  <p style={{ fontFamily: "var(--head-font)", fontWeight: 700, fontSize: 16, margin: 0 }}>2 cromos</p>
                  <p style={{ fontSize: 10, color: "var(--muted)", margin: "2px 0 0" }}>+ 5🪙</p>
                </div>
                <div style={{ width: 1, background: "var(--line)" }} />
                <div style={{ textAlign: "center" }}>
                  <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: "#10b981", margin: "0 0 4px" }}>COMPLETAR</p>
                  <p style={{ fontFamily: "var(--head-font)", fontWeight: 700, fontSize: 16, margin: 0 }}>1 sobre</p>
                  <p style={{ fontSize: 10, color: "var(--muted)", margin: "2px 0 0" }}>+ 10🪙</p>
                </div>
              </div>
              <button className="hv-btn primary" onClick={() => router.push("/tortura-hv")}>
                😈 Ir a la Tortura →
              </button>
            </div>
          </div>
        )}

      </div>
      </div>

      <Toast msg={toast?.msg} tipo={toast?.tipo} />
      <HvBottomNav />
    </div>
  );
}
