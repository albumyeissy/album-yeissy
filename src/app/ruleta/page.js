"use client";
import { useState, useEffect } from "react";
import { auth, db } from "../../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc, getDocs, collection, writeBatch } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { CROMOS } from "../../data/cromos";
import { addFeedEvent } from "../../lib/feedHelper";
import { getFeatures, isRuletaAvailable } from "../../lib/featuresHelper";

const SECTORES = [
  { id: "sobre",            emoji: "📦", label: "Sobre gratis",       prob: 20 },
  { id: "robar_comun",      emoji: "🃏", label: "Robar común",        prob: 20 },
  { id: "robar_rara",       emoji: "💎", label: "Robar rara",         prob: 15 },
  { id: "robar_legendaria", emoji: "⭐", label: "Robar legendaria",   prob: 5  },
  { id: "quema",            emoji: "🔥", label: "La quema",           prob: 17 },
  { id: "maldicion",        emoji: "😈", label: "La maldición",       prob: 11 },
  { id: "perdedor",         emoji: "💀", label: "Perdedor",           prob: 12 },
];

const SECTOR_ANGLE  = 360 / SECTORES.length; // ≈ 51.43°
const CYLINDER_R    = 95;
const SPIN_DURATION = 9000;
const FULL_SPINS    = 6;
const RELEASE_DATE  = new Date("2026-05-25T00:00:00");

export default function RuletaPage() {
  const [user,               setUser]               = useState(null);
  const [loading,            setLoading]            = useState(true);
  const [datosUsuario,       setDatosUsuario]       = useState(null);
  const [todosJugadores,     setTodosJugadores]     = useState([]);
  const [fase,               setFase]               = useState("locked");
  const [cylinderRot,        setCylinderRot]        = useState(0);
  const [winnerIdx,          setWinnerIdx]          = useState(null);
  const [resultado,          setResultado]          = useState(null);
  const [countdown,          setCountdown]          = useState("");
  const [jugadoresFiltrados, setJugadoresFiltrados] = useState([]);
  const router = useRouter();

  const HOY = new Date().toISOString().split("T")[0];

  /* ── Countdown (release o siguiente día) ─────────────────────── */
  useEffect(() => {
    const calcTarget = () => {
      const now = new Date();
      if (now < RELEASE_DATE) return RELEASE_DATE;
      const t = new Date(now);
      t.setDate(t.getDate() + 1);
      t.setHours(0, 0, 0, 0);
      return t;
    };
    const update = () => {
      const diff = calcTarget() - new Date();
      if (diff <= 0) { setCountdown("00:00:00"); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setCountdown(
        `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`
      );
    };
    update();
    const iv = setInterval(update, 1000);
    return () => clearInterval(iv);
  }, []);

  /* ── Auth + carga inicial ─────────────────────────────────────── */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { router.push("/"); return; }
      setUser(u);
      try {
        const [snap, feats, jugSnap] = await Promise.all([
          getDoc(doc(db, "usuarios", u.uid)),
          getFeatures(),
          getDocs(collection(db, "usuarios")),
        ]);
        const jugadores = [];
        jugSnap.forEach((d) => {
          if (d.id !== u.uid) jugadores.push({ id: d.id, ...d.data() });
        });
        setTodosJugadores(jugadores);

        if (snap.exists()) {
          const data = snap.data();
          setDatosUsuario(data);
          if (!isRuletaAvailable(feats)) {
            setFase("locked");
          } else if (data.fechaRuleta === HOY) {
            setFase("ya_jugada");
          } else {
            setFase("intro");
          }
        } else {
          setFase("locked");
        }
      } catch (err) { console.error(err); }
      setLoading(false);
    });
    return () => unsub();
  }, [router, HOY]);

  /* ── Elegir sector ponderado ─────────────────────────────────── */
  const elegirSector = () => {
    const total = SECTORES.reduce((s, x) => s + x.prob, 0);
    let rand = Math.random() * total;
    for (let i = 0; i < SECTORES.length; i++) {
      rand -= SECTORES[i].prob;
      if (rand <= 0) return i;
    }
    return SECTORES.length - 1;
  };

  /* ── Lanzar giro ─────────────────────────────────────────────── */
  const girar = () => {
    if (fase !== "intro") return;
    if (navigator.vibrate) navigator.vibrate(50);
    const idx = elegirSector();
    setWinnerIdx(idx);
    setFase("girando");
    const extraRot   = (360 - idx * SECTOR_ANGLE) % 360;
    const newRot     = cylinderRot + FULL_SPINS * 360 + extraRot;
    setCylinderRot(newRot);
    setTimeout(() => {
      if (navigator.vibrate) navigator.vibrate([80, 40, 180]);
      setFase("revelando");
    }, SPIN_DURATION + 200);
  };

  /* ── Continuar tras ver el resultado ─────────────────────────── */
  const continuarTrasRevelacion = () => {
    const sector = SECTORES[winnerIdx];
    if (sector.id.startsWith("robar_")) {
      const rareza = sector.id.replace("robar_", "");
      setJugadoresFiltrados(
        todosJugadores.filter((j) =>
          (j.cromos || []).some((c) => {
            const info = CROMOS.find((x) => x.id === c.cromoId);
            return info?.rareza === rareza && c.cantidad > 0;
          })
        )
      );
      setFase("seleccion");
    } else if (sector.id === "maldicion") {
      setJugadoresFiltrados(todosJugadores);
      setFase("seleccion");
    } else {
      setFase("ejecutando");
      _ejecutar(winnerIdx, null, null);
    }
  };

  /* ── Seleccionar víctima ─────────────────────────────────────── */
  const handleSeleccion = (jugador) => {
    setFase("ejecutando");
    _ejecutar(winnerIdx, jugador.id, jugador);
  };

  /* ── Dispatcher de sectores ──────────────────────────────────── */
  const _ejecutar = async (idx, victimId, victimData) => {
    const sector = SECTORES[idx];
    try {
      if      (sector.id === "sobre")              await _sobre();
      else if (sector.id.startsWith("robar_"))     await _robar(victimId, victimData, sector.id.replace("robar_", ""));
      else if (sector.id === "quema")              await _quemar();
      else if (sector.id === "maldicion")          await _maldecir(victimId, victimData);
      else                                         await _perdedor();
    } catch (err) { console.error(err); setFase("done"); }
  };

  /* ── Sobre gratis ────────────────────────────────────────────── */
  const _sobre = async () => {
    await setDoc(doc(db, "usuarios", user.uid), {
      sobresRuleta: (datosUsuario?.sobresRuleta || 0) + 1,
      fechaRuleta:  HOY,
    }, { merge: true });
    setResultado({ tipo: "sobre" });
    setFase("done");
  };

  /* ── Robo ────────────────────────────────────────────────────── */
  const _robar = async (victimId, victimData, rareza) => {
    const victimCromos = victimData?.cromos || [];
    const disponibles  = victimCromos.filter((c) => {
      const info = CROMOS.find((x) => x.id === c.cromoId);
      return info?.rareza === rareza && c.cantidad > 0;
    });

    if (disponibles.length === 0) {
      await setDoc(doc(db, "usuarios", user.uid), { fechaRuleta: HOY }, { merge: true });
      setResultado({ tipo: "robo_vacio", rareza });
      setFase("done");
      return;
    }

    const elegida   = disponibles[Math.floor(Math.random() * disponibles.length)];
    const cromoInfo = CROMOS.find((c) => c.id === elegida.cromoId);
    const victimName = victimData?.nombre || victimData?.email || "alguien";

    // Batch: quitar de víctima, añadir a mí
    const batch = writeBatch(db);

    const vAct = victimCromos.map((c) =>
      c.cromoId === elegida.cromoId
        ? c.cantidad <= 1 ? null : { ...c, cantidad: c.cantidad - 1 }
        : c
    ).filter(Boolean);
    batch.update(doc(db, "usuarios", victimId), { cromos: vAct });

    const mis = datosUsuario?.cromos || [];
    const ex  = mis.find((c) => c.cromoId === elegida.cromoId);
    const misAct = ex
      ? mis.map((c) => c.cromoId === elegida.cromoId ? { ...c, cantidad: c.cantidad + 1 } : c)
      : [...mis, { cromoId: elegida.cromoId, cantidad: 1, fechaObtenido: HOY, pegado: false }];
    batch.update(doc(db, "usuarios", user.uid), { cromos: misAct, fechaRuleta: HOY });
    await batch.commit();

    addFeedEvent({
      type:    "robo_ruleta",
      userName: "???",
      details: `🔫 A ${victimName} le han robado una ${rareza} usando la ruleta rusa.`,
    });

    setResultado({ tipo: "robo", cromo: cromoInfo, rareza, victimName });
    setFase("done");
  };

  /* ── Quema ───────────────────────────────────────────────────── */
  const _quemar = async () => {
    const cromosAct = datosUsuario?.cromos || [];
    const pegadas   = cromosAct.filter((c) => c.pegado !== false && c.cantidad > 0);

    if (pegadas.length === 0) {
      await setDoc(doc(db, "usuarios", user.uid), { fechaRuleta: HOY }, { merge: true });
      setResultado({ tipo: "quema_escape" });
      setFase("done");
      return;
    }

    const victima   = pegadas[Math.floor(Math.random() * pegadas.length)];
    const cromoInfo = CROMOS.find((c) => c.id === victima.cromoId);

    const cromosAct2 = cromosAct.map((c) => {
      if (c.cromoId !== victima.cromoId) return c;
      if (c.cantidad <= 1)               return null;
      return { ...c, cantidad: c.cantidad - 1, pegado: false };
    }).filter(Boolean);

    await setDoc(doc(db, "usuarios", user.uid), {
      cromos:      cromosAct2,
      fechaRuleta: HOY,
    }, { merge: true });

    addFeedEvent({
      type:    "quema_ruleta",
      userName: datosUsuario?.nombre,
      details: `🔥 ${cromoInfo?.nombre ?? "una carta"} de ${datosUsuario?.nombre} ha ardido en la ruleta. Minuto de silencio. 🕯️`,
    });

    setResultado({ tipo: "quema", cromo: cromoInfo });
    setFase("done");
  };

  /* ── Maldición ───────────────────────────────────────────────── */
  const _maldecir = async (victimId, victimData) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];
    const victimName  = victimData?.nombre || victimData?.email || "alguien";

    const batch = writeBatch(db);
    batch.update(doc(db, "usuarios", victimId), { fechaMaldicion: tomorrowStr });
    batch.update(doc(db, "usuarios", user.uid), { fechaRuleta: HOY });
    await batch.commit();

    addFeedEvent({
      type:    "maldicion_ruleta",
      userName: datosUsuario?.nombre,
      details: `😈 ${datosUsuario?.nombre} ha maldecido a ${victimName}. Mañana solo podrá abrir 1 sobre. 💀`,
    });

    setResultado({ tipo: "maldicion", victimName });
    setFase("done");
  };

  /* ── Perdedor ────────────────────────────────────────────────── */
  const _perdedor = async () => {
    await setDoc(doc(db, "usuarios", user.uid), { fechaRuleta: HOY }, { merge: true });
    setResultado({ tipo: "perdedor" });
    setFase("done");
  };

  /* ──────────────────────────── RENDER ───────────────────────── */

  if (loading) return (
    <div style={{ display:"flex", justifyContent:"center", alignItems:"center", minHeight:"100vh" }}>
      <p style={{ fontSize:"1.5rem" }}>Cargando...</p>
    </div>
  );

  const winnerSector = winnerIdx !== null ? SECTORES[winnerIdx] : null;

  return (
    <div style={{ minHeight:"100vh", background:"#0f172a", color:"white", padding:"20px" }}>
      <style>{`
        @keyframes pulsoSuave  { 0%,100%{opacity:1} 50%{opacity:0.55} }
        @keyframes fadeInUp    { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:translateY(0)} }
        @keyframes chamberPop  {
          0%   { box-shadow: 0 0 10px rgba(251,191,36,0.4); }
          50%  { box-shadow: 0 0 35px rgba(251,191,36,1), 0 0 60px rgba(251,191,36,0.4); }
          100% { box-shadow: 0 0 20px rgba(251,191,36,0.7); }
        }
        @keyframes cdPulse { 0%,100%{color:#94a3b8} 50%{color:#f59e0b} }
        @keyframes spin    { to { transform: rotate(360deg); } }
      `}</style>

      {/* ── Header ── */}
      <div style={{ display:"flex", alignItems:"center", gap:"12px", marginBottom:"28px" }}>
        <button
          onClick={() => router.push("/album")}
          style={{ padding:"8px 16px", borderRadius:"10px", border:"1px solid #475569", background:"transparent", color:"#94a3b8", cursor:"pointer" }}
        >← Álbum</button>
        <h1 style={{ margin:0, fontSize:"1.4rem", letterSpacing:"1px" }}>🔫 Ruleta Rusa</h1>
      </div>

      {/* ══════════════ LOCKED ══════════════ */}
      {fase === "locked" && (
        <div style={{ textAlign:"center", animation:"fadeInUp 0.5s" }}>
          <div style={{ fontSize:"5rem", marginBottom:"16px" }}>🔒</div>
          <h2 style={{ fontSize:"1.5rem", marginBottom:"8px" }}>Próximamente</h2>
          <p style={{ color:"#64748b", marginBottom:"28px", lineHeight:1.6 }}>
            La ruleta estará disponible el<br />
            <strong style={{ color:"#94a3b8" }}>lunes 25 de mayo a las 00:00</strong>
          </p>
          <div style={{
            background:"#1e293b", borderRadius:"16px",
            padding:"20px 28px", display:"inline-block",
            border:"1px solid #334155", marginBottom:"36px",
          }}>
            <p style={{ color:"#64748b", fontSize:"0.8rem", marginBottom:"8px" }}>Disponible en:</p>
            <p style={{
              fontSize:"2.6rem", fontWeight:"bold", fontFamily:"monospace",
              margin:0, letterSpacing:"3px", animation:"cdPulse 2s infinite",
            }}>{countdown}</p>
          </div>

          <p style={{ color:"#475569", fontSize:"0.75rem", marginBottom:"10px", letterSpacing:"1px" }}>SECTORES</p>
          <div style={{ maxWidth:"290px", margin:"0 auto", display:"flex", flexDirection:"column", gap:"6px" }}>
            {SECTORES.map((s) => (
              <div key={s.id} style={{
                display:"flex", alignItems:"center", gap:"10px",
                padding:"9px 14px", background:"#1e293b",
                borderRadius:"10px", border:"1px solid #334155",
              }}>
                <span style={{ fontSize:"1.3rem" }}>{s.emoji}</span>
                <span style={{ fontSize:"0.85rem", color:"#94a3b8" }}>{s.label}</span>
                <span style={{ marginLeft:"auto", fontSize:"0.75rem", color:"#475569" }}>{s.prob}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══════════════ YA JUGADA ══════════════ */}
      {fase === "ya_jugada" && (
        <div style={{ textAlign:"center", paddingTop:"50px", animation:"fadeInUp 0.5s" }}>
          <div style={{ fontSize:"4rem", marginBottom:"16px" }}>🔫</div>
          <h2 style={{ fontSize:"1.4rem", marginBottom:"8px" }}>Ya jugaste hoy</h2>
          <p style={{ color:"#64748b", marginBottom:"28px" }}>Solo puedes girar la ruleta una vez al día.</p>
          <div style={{
            background:"#1e293b", borderRadius:"16px",
            padding:"20px 28px", display:"inline-block",
            border:"1px solid #334155", marginBottom:"28px",
          }}>
            <p style={{ color:"#64748b", fontSize:"0.8rem", marginBottom:"8px" }}>Nueva oportunidad en:</p>
            <p style={{
              fontSize:"2.2rem", fontWeight:"bold", fontFamily:"monospace",
              color:"#8b5cf6", margin:0, letterSpacing:"2px",
            }}>{countdown}</p>
          </div>
          <div>
            <button
              onClick={() => router.push("/album")}
              style={{
                padding:"12px 28px", borderRadius:"12px", border:"none",
                background:"linear-gradient(135deg,#3b82f6,#2563eb)",
                color:"white", fontWeight:"bold", cursor:"pointer",
              }}
            >Volver al álbum</button>
          </div>
        </div>
      )}

      {/* ══════════════ TAMBOR (intro / girando / revelando) ══════════════ */}
      {(fase === "intro" || fase === "girando" || fase === "revelando") && (
        <div style={{ textAlign:"center" }}>

          {/* Cilindro */}
          <div style={{ position:"relative", width:"260px", height:"300px", margin:"0 auto 20px" }}>

            {/* Indicador (cañón) */}
            <div style={{ position:"absolute", top:"0", left:"50%", transform:"translateX(-50%)", zIndex:10 }}>
              <div style={{
                width:"4px", height:"22px",
                background:"linear-gradient(to bottom,#ef4444,#b91c1c)",
                margin:"0 auto 0", borderRadius:"2px 2px 0 0",
              }} />
              <div style={{
                width:0, height:0,
                borderLeft:"9px solid transparent",
                borderRight:"9px solid transparent",
                borderTop:"13px solid #ef4444",
                margin:"0 auto",
              }} />
            </div>

            {/* Tambor giratorio */}
            <div style={{
              position:"absolute", top:"34px", left:"50%",
              width:"260px", height:"260px",
              marginLeft:"-130px",
              borderRadius:"50%",
              background:"radial-gradient(circle at 32% 30%, #374151, #1e293b 55%, #0d1526)",
              border:"4px solid #374151",
              boxShadow:"0 0 40px rgba(0,0,0,0.9), inset 0 0 30px rgba(0,0,0,0.6), 0 0 0 2px #0f172a",
              transform:`rotate(${cylinderRot}deg)`,
              transition: fase === "girando"
                ? `transform ${SPIN_DURATION}ms cubic-bezier(0.2,0,0.05,1)`
                : "none",
            }}>

              {/* Cámaras */}
              {SECTORES.map((s, i) => {
                const angle    = i * SECTOR_ANGLE;
                const isWinner = fase === "revelando" && i === winnerIdx;
                return (
                  <div key={s.id} style={{
                    position:"absolute",
                    top:"50%", left:"50%",
                    width:"56px", height:"56px",
                    marginLeft:"-28px", marginTop:"-28px",
                    transform: isWinner
                      ? `rotate(${angle}deg) translateY(-${CYLINDER_R}px) rotate(-${angle}deg) scale(1.35)`
                      : `rotate(${angle}deg) translateY(-${CYLINDER_R}px) rotate(-${angle}deg)`,
                    transition:"transform 0.4s cubic-bezier(0.34,1.56,0.64,1)",
                    zIndex: isWinner ? 5 : 1,
                  }}>
                    <div style={{
                      width:"100%", height:"100%", borderRadius:"50%",
                      background: isWinner
                        ? "radial-gradient(circle,rgba(251,191,36,0.35),rgba(13,21,38,0.95))"
                        : "radial-gradient(circle,rgba(55,65,81,0.9),rgba(13,21,38,0.97))",
                      border: isWinner ? "2px solid #fbbf24" : "2px solid #2d3748",
                      boxShadow: isWinner
                        ? "0 0 0 3px rgba(251,191,36,0.25), inset 0 0 8px rgba(0,0,0,0.5)"
                        : "inset 0 0 12px rgba(0,0,0,0.8), inset 0 2px 4px rgba(0,0,0,0.5)",
                      display:"flex", justifyContent:"center", alignItems:"center",
                      fontSize:"1.5rem",
                      animation: isWinner ? "chamberPop 1.4s ease-in-out infinite" : "none",
                    }}>
                      {s.emoji}
                    </div>
                  </div>
                );
              })}

              {/* Pin central */}
              <div style={{
                position:"absolute", top:"50%", left:"50%",
                width:"26px", height:"26px",
                marginLeft:"-13px", marginTop:"-13px",
                borderRadius:"50%",
                background:"radial-gradient(circle,#475569,#0f172a)",
                border:"2px solid #64748b",
                boxShadow:"inset 0 0 8px rgba(0,0,0,0.8)",
                zIndex:10,
              }} />
            </div>
          </div>

          {/* Leyenda (solo en intro) */}
          {fase === "intro" && (
            <div style={{ maxWidth:"300px", margin:"0 auto 24px" }}>
              <p style={{ color:"#475569", fontSize:"0.72rem", letterSpacing:"1px", marginBottom:"10px" }}>SECTORES</p>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"6px" }}>
                {SECTORES.map((s) => (
                  <div key={s.id} style={{
                    display:"flex", alignItems:"center", gap:"6px",
                    padding:"7px 10px", background:"#1e293b",
                    borderRadius:"8px", border:"1px solid #334155",
                  }}>
                    <span style={{ fontSize:"1rem" }}>{s.emoji}</span>
                    <span style={{ fontSize:"0.68rem", color:"#94a3b8" }}>{s.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Botón / estado */}
          {fase === "intro" && (
            <button
              onClick={girar}
              style={{
                padding:"16px 44px", borderRadius:"16px", border:"none",
                background:"linear-gradient(135deg,#ef4444,#b91c1c)",
                color:"white", fontSize:"1.1rem", fontWeight:"bold",
                cursor:"pointer", letterSpacing:"1px",
                boxShadow:"0 4px 22px rgba(239,68,68,0.45)",
              }}
            >🔫 GIRAR</button>
          )}

          {fase === "girando" && (
            <p style={{
              color:"#94a3b8", fontSize:"1rem",
              animation:"pulsoSuave 0.9s infinite", marginTop:"8px",
            }}>El tambor gira…</p>
          )}

          {fase === "revelando" && winnerSector && (
            <div style={{ animation:"fadeInUp 0.4s" }}>
              <div style={{
                background:"#1e293b", borderRadius:"16px",
                padding:"20px 24px", maxWidth:"270px",
                margin:"0 auto 20px", border:"1px solid #334155",
              }}>
                <p style={{ margin:"0 0 8px", fontSize:"3rem" }}>{winnerSector.emoji}</p>
                <p style={{ margin:"0 0 4px", fontWeight:"bold", fontSize:"1.2rem" }}>{winnerSector.label}</p>
              </div>
              <button
                onClick={continuarTrasRevelacion}
                style={{
                  padding:"14px 36px", borderRadius:"14px", border:"none",
                  background:"linear-gradient(135deg,#10b981,#059669)",
                  color:"white", fontSize:"1rem", fontWeight:"bold", cursor:"pointer",
                }}
              >Continuar →</button>
            </div>
          )}
        </div>
      )}

      {/* ══════════════ SELECCIÓN DE VÍCTIMA ══════════════ */}
      {fase === "seleccion" && (
        <div style={{ animation:"fadeInUp 0.4s" }}>
          <div style={{
            background:"#1e293b", borderRadius:"16px",
            padding:"16px 20px", marginBottom:"20px",
            border:"1px solid #334155", textAlign:"center",
          }}>
            <span style={{ fontSize:"2.2rem" }}>{winnerSector?.emoji}</span>
            <h3 style={{ margin:"8px 0 4px" }}>{winnerSector?.label}</h3>
            <p style={{ color:"#94a3b8", fontSize:"0.85rem", margin:0 }}>
              {winnerSector?.id === "maldicion"
                ? "Elige a quién maldecir mañana"
                : "Elige a quién robar"}
            </p>
          </div>

          {jugadoresFiltrados.length === 0 ? (
            <div style={{ textAlign:"center", padding:"40px 20px" }}>
              <p style={{ fontSize:"3rem", marginBottom:"12px" }}>😔</p>
              <p style={{ color:"#64748b", marginBottom:"20px" }}>
                Ningún jugador tiene cartas de esa rareza.
              </p>
              <button
                onClick={async () => {
                  await setDoc(doc(db, "usuarios", user.uid), { fechaRuleta: HOY }, { merge: true });
                  setResultado({ tipo:"robo_vacio", rareza: winnerSector?.id.replace("robar_","") });
                  setFase("done");
                }}
                style={{
                  padding:"12px 28px", borderRadius:"12px", border:"none",
                  background:"#334155", color:"white", cursor:"pointer",
                }}
              >Continuar</button>
            </div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
              {jugadoresFiltrados.map((j) => {
                const rareza = winnerSector?.id.replace("robar_","");
                const nCartas = (j.cromos || []).filter((c) => {
                  const info = CROMOS.find((x) => x.id === c.cromoId);
                  return info?.rareza === rareza && c.cantidad > 0;
                }).length;
                return (
                  <button
                    key={j.id}
                    onClick={() => handleSeleccion(j)}
                    style={{
                      display:"flex", alignItems:"center", gap:"14px",
                      padding:"14px 18px", borderRadius:"14px",
                      border:"1px solid #334155", background:"#1e293b",
                      color:"white", cursor:"pointer", textAlign:"left",
                    }}
                  >
                    <div style={{
                      width:"42px", height:"42px", borderRadius:"50%",
                      background:"linear-gradient(135deg,#374151,#1e293b)",
                      border:"1px solid #475569",
                      display:"flex", justifyContent:"center", alignItems:"center",
                      fontSize:"1.2rem", flexShrink:0,
                    }}>👤</div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <p style={{ margin:0, fontWeight:"bold", fontSize:"0.95rem" }}>
                        {j.nombre || j.email || "Jugador"}
                      </p>
                      {winnerSector?.id !== "maldicion" && nCartas > 0 && (
                        <p style={{ margin:0, fontSize:"0.72rem", color:"#64748b" }}>
                          {nCartas} carta{nCartas !== 1 ? "s" : ""} disponible{nCartas !== 1 ? "s" : ""}
                        </p>
                      )}
                    </div>
                    <span style={{ color:"#ef4444", fontSize:"1.2rem" }}>→</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ══════════════ EJECUTANDO ══════════════ */}
      {fase === "ejecutando" && (
        <div style={{ textAlign:"center", paddingTop:"80px" }}>
          <div style={{
            width:"48px", height:"48px", borderRadius:"50%",
            border:"3px solid #334155", borderTop:"3px solid #f59e0b",
            margin:"0 auto 20px",
            animation:"spin 0.8s linear infinite",
          }} />
          <p style={{ color:"#64748b" }}>Un momento…</p>
        </div>
      )}

      {/* ══════════════ RESULTADO ══════════════ */}
      {fase === "done" && resultado && (
        <div style={{ textAlign:"center", animation:"fadeInUp 0.5s" }}>

          {/* Sobre gratis */}
          {resultado.tipo === "sobre" && (<>
            <div style={{ fontSize:"5rem", marginBottom:"16px", animation:"pulsoSuave 2s infinite" }}>📦</div>
            <h2 style={{ fontSize:"1.5rem", marginBottom:"8px" }}>¡Sobre gratis!</h2>
            <p style={{ color:"#94a3b8", marginBottom:"28px" }}>
              Se ha añadido un sobre a tu cuenta. Ábrelo cuando quieras.
            </p>
            <button
              onClick={() => router.push("/abrir-sobre")}
              style={{
                display:"block", width:"100%", maxWidth:"280px",
                margin:"0 auto 12px", padding:"14px", borderRadius:"14px",
                border:"none", background:"linear-gradient(135deg,#f59e0b,#d97706)",
                color:"#000", fontSize:"1rem", fontWeight:"bold", cursor:"pointer",
              }}
            >📦 Abrir ahora</button>
          </>)}

          {/* Robo exitoso */}
          {resultado.tipo === "robo" && (<>
            <div style={{ fontSize:"5rem", marginBottom:"16px" }}>
              {resultado.rareza === "legendaria" ? "⭐" : resultado.rareza === "rara" ? "💎" : "🃏"}
            </div>
            <h2 style={{ fontSize:"1.5rem", marginBottom:"4px" }}>¡Robo exitoso!</h2>
            <p style={{ color:"#94a3b8", marginBottom:"20px" }}>Has robado a {resultado.victimName}</p>
            {resultado.cromo && (
              <div style={{
                background:"#1e293b", borderRadius:"16px",
                padding:"14px", maxWidth:"200px",
                margin:"0 auto 24px", border:"1px solid #334155",
              }}>
                <img
                  src={resultado.cromo.imagen}
                  alt={resultado.cromo.nombre}
                  style={{ width:"100%", borderRadius:"10px", marginBottom:"8px", display:"block" }}
                />
                <p style={{ margin:0, fontWeight:"bold", fontSize:"0.9rem" }}>{resultado.cromo.nombre}</p>
                <p style={{ margin:"4px 0 0", fontSize:"0.75rem", color:"#94a3b8" }}>
                  {resultado.rareza === "legendaria" ? "⭐ Legendaria"
                    : resultado.rareza === "rara"    ? "💎 Rara"
                    : "Común"}
                </p>
              </div>
            )}
          </>)}

          {/* Robo vacío */}
          {resultado.tipo === "robo_vacio" && (<>
            <div style={{ fontSize:"4rem", marginBottom:"16px" }}>😅</div>
            <h2 style={{ fontSize:"1.4rem", marginBottom:"8px" }}>Sin suerte</h2>
            <p style={{ color:"#64748b", marginBottom:"24px" }}>
              Tu víctima no tenía cartas{" "}
              {resultado.rareza === "legendaria" ? "legendarias"
                : resultado.rareza === "rara"    ? "raras"
                : "comunes"} disponibles.
            </p>
          </>)}

          {/* Quema */}
          {resultado.tipo === "quema" && (<>
            <div style={{ fontSize:"5rem", marginBottom:"16px" }}>🔥</div>
            <h2 style={{ fontSize:"1.5rem", marginBottom:"8px" }}>¡La quema!</h2>
            {resultado.cromo && (
              <p style={{ color:"#ef4444", marginBottom:"24px", fontSize:"1rem" }}>
                <strong>{resultado.cromo.nombre}</strong> ha ardido en la ruleta.<br />
                Minuto de silencio. 🕯️
              </p>
            )}
          </>)}

          {/* Quema escape */}
          {resultado.tipo === "quema_escape" && (<>
            <div style={{ fontSize:"4rem", marginBottom:"16px" }}>😅</div>
            <h2 style={{ fontSize:"1.4rem", marginBottom:"8px" }}>¡Escapaste!</h2>
            <p style={{ color:"#64748b", marginBottom:"24px" }}>
              Tu álbum está vacío. La llama no encontró nada que quemar.
            </p>
          </>)}

          {/* Maldición */}
          {resultado.tipo === "maldicion" && (<>
            <div style={{ fontSize:"5rem", marginBottom:"16px" }}>😈</div>
            <h2 style={{ fontSize:"1.5rem", marginBottom:"8px" }}>¡Maldición lanzada!</h2>
            <p style={{ color:"#8b5cf6", marginBottom:"24px" }}>
              <strong>{resultado.victimName}</strong> solo podrá abrir 1 sobre mañana. 💀
            </p>
          </>)}

          {/* Perdedor */}
          {resultado.tipo === "perdedor" && (<>
            <div style={{ fontSize:"5rem", marginBottom:"16px" }}>💀</div>
            <h2 style={{ fontSize:"1.5rem", marginBottom:"8px" }}>Perdedor</h2>
            <p style={{ color:"#64748b", marginBottom:"24px" }}>Vuelve a intentarlo mañana.</p>
          </>)}

          <button
            onClick={() => router.push("/album")}
            style={{
              display:"block", width:"100%", maxWidth:"280px",
              margin:"0 auto", padding:"14px", borderRadius:"14px",
              border:"none", background:"linear-gradient(135deg,#3b82f6,#2563eb)",
              color:"white", fontSize:"1rem", fontWeight:"bold", cursor:"pointer",
            }}
          >Volver al álbum</button>
        </div>
      )}
    </div>
  );
}
