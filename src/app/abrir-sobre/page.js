"use client";
import { useState, useEffect, useRef } from "react";
import { auth, db } from "../../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { CROMOS } from "../../data/cromos";
import { addFeedEvent } from "../../lib/feedHelper";

export default function AbrirSobrePage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sobresHoy, setSobresHoy] = useState(0);
  const [datosUsuario, setDatosUsuario] = useState(null);
  const [fase, setFase] = useState("idle");
  const [cromosDelSobre, setCromosDelSobre] = useState([]);
  const [cardIndex, setCardIndex] = useState(0);
  const [cardFlipped, setCardFlipped] = useState(false);
  const [nuevosCount, setNuevosCount] = useState(0);
  const [repetidosCount, setRepetidosCount] = useState(0);
  const [dragProgress, setDragProgress] = useState(0);
  const [showFlash, setShowFlash] = useState(false);
  const [rachaActual, setRachaActual] = useState(0);
  const [sobresBonus, setSobresBonus] = useState(0);
  const [sobresRuleta, setSobresRuleta] = useState(0);
  const [rachaMsg, setRachaMsg] = useState(null);
  const [totalSobresAbiertos, setTotalSobresAbiertos] = useState(0);
  const [esMegaSobre, setEsMegaSobre] = useState(false);
  const [esSobreRuleta, setEsSobreRuleta] = useState(false);
  const [countdown, setCountdown] = useState("");
  const dragStartY = useRef(null);
  const dragProgressRef = useRef(0);
  const router = useRouter();

  const HOY = new Date().toISOString().split("T")[0];
  const MAX_SOBRES = 2;
  const CROMOS_NORMAL = 5;
  const CROMOS_MEGA = 7;
  const MEGA_CADA = 15;
  const PROB_MITICA = 0.5; // 20% para testing, luego 0.5%

  const getAyer = () => {
    const d = new Date(); d.setDate(d.getDate() - 1);
    return d.toISOString().split("T")[0];
  };

  // Countdown
  useEffect(() => {
    const update = () => {
      const now = new Date();
      const tom = new Date(now); tom.setDate(tom.getDate() + 1); tom.setHours(0, 0, 0, 0);
      const diff = tom - now;
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setCountdown(`${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`);
    };
    update();
    const iv = setInterval(update, 1000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        try {
          const snap = await getDoc(doc(db, "usuarios", u.uid));
          if (snap.exists()) {
            const data = snap.data();
            setDatosUsuario(data);
            setSobresHoy(data.fechaUltimoSobre === HOY ? (data.sobresAbiertosHoy || 0) : 0);
            setSobresBonus(data.sobresBonus || 0);
            setSobresRuleta(data.sobresRuleta || 0);
            setTotalSobresAbiertos(data.totalSobresAbiertos || 0);
            const fecha = data.fechaUltimaApertura || "";
            if (fecha === HOY || fecha === getAyer()) setRachaActual(data.rachaActual || 0);
            else setRachaActual(0);
          } else { setDatosUsuario({ cromos: [] }); }
        } catch (err) { setDatosUsuario({ cromos: [] }); }
      } else { router.push("/"); }
      setLoading(false);
    });
    return () => unsub();
  }, [router, HOY]);

  const seleccionarCromo = (bloquearMitica = false, mega = false) => {
    if (!bloquearMitica) {
      const rollMitica = Math.random() * 100;
      if (rollMitica < PROB_MITICA) {
        const mitica = CROMOS.find((c) => c.rareza === "mitica");
        if (mitica) return mitica;
      }
    }
    const roll = Math.random() * 100;
    let rareza;
    if (mega) {
      rareza = roll < 6 ? "legendaria" : roll < 33 ? "rara" : "comun";
    } else {
      rareza = roll < 3 ? "legendaria" : roll < 19 ? "rara" : "comun";
    }
    const pool = CROMOS.filter((c) => c.rareza === rareza);
    return pool.length > 0
      ? pool[Math.floor(Math.random() * pool.length)]
      : CROMOS[Math.floor(Math.random() * CROMOS.length)];
  };

  const handleTouchStart = (e) => { if (fase !== "idle") return; dragStartY.current = e.touches[0].clientY; };
  const handleTouchMove = (e) => {
    if (dragStartY.current === null) return;
    const diff = dragStartY.current - e.touches[0].clientY;
    const progress = Math.min(Math.max(diff / 120, 0), 1);
    dragProgressRef.current = progress; setDragProgress(progress);
  };
  const handleTouchEnd = () => {
    if (dragProgressRef.current >= 0.5) iniciarApertura();
    dragProgressRef.current = 0; setDragProgress(0); dragStartY.current = null;
  };

  const maxSobresHoy   = datosUsuario?.fechaMaldicion === HOY ? 1 : MAX_SOBRES;
  const puedeAbrir     = sobresHoy < maxSobresHoy || sobresBonus > 0 || sobresRuleta > 0;
  const proximoMega    = MEGA_CADA - (totalSobresAbiertos % MEGA_CADA);
  const siguienteEsMega = proximoMega === MEGA_CADA || proximoMega <= 0;

  const iniciarApertura = async () => {
    if (!puedeAbrir || fase !== "idle") return;
    const usandoRuleta = sobresHoy >= maxSobresHoy && sobresBonus === 0 && sobresRuleta > 0;
    const usandoBonus  = sobresHoy >= maxSobresHoy && sobresBonus > 0 && !usandoRuleta;
    const mega = !usandoRuleta && siguienteEsMega;   // los sobres de ruleta nunca son mega
    setEsMegaSobre(mega);
    setEsSobreRuleta(usandoRuleta);
    setFase("abriendo");
    setDragProgress(1);
    setRachaMsg(null);
    if (navigator.vibrate) navigator.vibrate(mega ? [40, 20, 40] : 40);
    setShowFlash(mega ? "gold" : "white");
    setTimeout(() => setShowFlash(false), 250);

    // Racha
    let nuevaRacha = rachaActual;
    let nuevoBonus = sobresBonus;
    const fechaUltima = datosUsuario?.fechaUltimaApertura || "";
    if (fechaUltima !== HOY) {
      nuevaRacha = fechaUltima === getAyer() ? (datosUsuario?.rachaActual || 0) + 1 : 1;
      setRachaActual(nuevaRacha);
      if (nuevaRacha > 0 && nuevaRacha % 5 === 0) {
        nuevoBonus = (usandoBonus ? sobresBonus - 1 : sobresBonus) + 1;
        setSobresBonus(nuevoBonus);
        setRachaMsg(`🔥 ¡${nuevaRacha} días de racha! 🎁 +1 sobre bonus`);
        addFeedEvent({ type: "racha", userName: datosUsuario?.nombre, details: `¡Lleva ${nuevaRacha} días de racha! 🎁 Sobre bonus` });
      } else {
        if (usandoBonus) nuevoBonus = sobresBonus - 1;
        setSobresBonus(nuevoBonus);
      }
    } else {
      if (usandoBonus) { nuevoBonus = sobresBonus - 1; setSobresBonus(nuevoBonus); }
    }

    // Sobre de ruleta
    let nuevoSobresRuleta = sobresRuleta;
    if (usandoRuleta) {
      nuevoSobresRuleta = sobresRuleta - 1;
      setSobresRuleta(nuevoSobresRuleta);
    }

    const cantidadCromos = mega ? CROMOS_MEGA : CROMOS_NORMAL;
    const nuevos = [];
    let miticaYaSalio = datosUsuario?.cromos?.some((c) => c.cromoId === 999);
    for (let i = 0; i < cantidadCromos; i++) {
      const cromo = seleccionarCromo(miticaYaSalio, mega);
      if (cromo.rareza === "mitica") miticaYaSalio = true;
      nuevos.push(cromo);
    }

    const cromosActuales = datosUsuario?.cromos || [];
    const seen = new Set(cromosActuales.map((c) => c.cromoId));
    let nc = 0, rc = 0;
    const cromosConInfo = nuevos.map((cromo) => {
      const esNuevo = !seen.has(cromo.id);
      if (esNuevo) { nc++; seen.add(cromo.id); } else { rc++; }
      return { ...cromo, esNuevo };
    });
    cromosConInfo.sort((a, b) => {
      const orden = { comun: 0, rara: 1, legendaria: 2, mitica: 3 };
      return orden[a.rareza] - orden[b.rareza];
    });

    setCromosDelSobre(cromosConInfo);
    setNuevosCount(nc);
    setRepetidosCount(rc);

    // Feed
    cromosConInfo.filter((c) => c.rareza === "legendaria").forEach((leg) => {
      addFeedEvent({ type: "legendaria", userName: datosUsuario?.nombre, details: `¡Ha sacado una LEGENDARIA! ${leg.nombre}`, image: leg.imagen });
    });
    cromosConInfo.filter((c) => c.rareza === "mitica").forEach(() => {
      addFeedEvent({ type: "mitica", userName: datosUsuario?.nombre, details: `⚡⚡ ¡¡HA DESCUBIERTO LA CARTA MÍTICA!! ⚡⚡` });
    });

    if (mega) {
      addFeedEvent({ type: "legendaria", userName: datosUsuario?.nombre, details: `¡Ha abierto un ⭐ MEGA SOBRE ⭐!` });
    }

    await new Promise((r) => setTimeout(r, mega ? 2500 : 1800));
    setFase("revelando");
    setCardIndex(0);
    setCardFlipped(false);

    try {
      setDoc(doc(db, "usuarios", user.uid), {
        rachaActual: nuevaRacha, fechaUltimaApertura: HOY, sobresBonus: nuevoBonus,
        sobresRuleta: nuevoSobresRuleta,
        totalSobresAbiertos: (totalSobresAbiertos || 0) + 1,
      }, { merge: true });
    } catch (err) { console.error(err); }
    setTotalSobresAbiertos((prev) => prev + 1);
  };

  const flipCard = async () => {
    if (cardFlipped) return;
    const cromo = cromosDelSobre[cardIndex];
    if (cromo.rareza === "mitica") {
      if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 500]);
      setShowFlash("dark"); await new Promise((r) => setTimeout(r, 1000));
      setShowFlash("flicker"); await new Promise((r) => setTimeout(r, 800));
      setShowFlash("red"); await new Promise((r) => setTimeout(r, 400));
      setCardFlipped(true); await new Promise((r) => setTimeout(r, 600));
      setShowFlash(false);
    } else if (cromo.rareza === "legendaria") {
      setShowFlash("gold"); await new Promise((r) => setTimeout(r, 300));
      setCardFlipped(true); setTimeout(() => setShowFlash(false), 500);
    } else if (cromo.rareza === "rara") {
      setShowFlash("blue"); await new Promise((r) => setTimeout(r, 200));
      setCardFlipped(true); setTimeout(() => setShowFlash(false), 500);
    } else {
      setShowFlash("white"); await new Promise((r) => setTimeout(r, 100));
      setCardFlipped(true); setTimeout(() => setShowFlash(false), 500);
    }
  };

  const nextCard = () => {
    const total = esMegaSobre ? CROMOS_MEGA : CROMOS_NORMAL;
    if (cardIndex < total - 1) { setCardIndex(cardIndex + 1); setCardFlipped(false); }
    else { setFase("resumen"); guardarCromos(); }
  };

  const guardarCromos = async () => {
    const cromosActuales = datosUsuario?.cromos || [];
    const cromosActualizados = [...cromosActuales];
    cromosDelSobre.forEach((cromo) => {
      const existing = cromosActualizados.find((c) => c.cromoId === cromo.id);
      if (existing) existing.cantidad += 1;
      else cromosActualizados.push({ cromoId: cromo.id, cantidad: 1, fechaObtenido: HOY, pegado: false });
    });
    const usandoExtra     = sobresHoy >= maxSobresHoy;
    const nuevosSobresHoy = usandoExtra ? sobresHoy : sobresHoy + 1;
    setSobresHoy(nuevosSobresHoy);
    setDatosUsuario({ ...datosUsuario, cromos: cromosActualizados });
    try {
      setDoc(doc(db, "usuarios", user.uid), {
        cromos: cromosActualizados, sobresAbiertosHoy: nuevosSobresHoy,
        fechaUltimoSobre: HOY, email: user.email,
      }, { merge: true });
    } catch (err) { console.error(err); }
  };

  const resetSobre = () => {
    setFase("idle"); setCromosDelSobre([]); setCardIndex(0);
    setCardFlipped(false); setDragProgress(0); setShowFlash(false);
    setEsMegaSobre(false); setEsSobreRuleta(false);
  };

  const getBorderColor = (r) =>
    r === "mitica" ? "#ef4444" : r === "legendaria" ? "#fbbf24" : r === "rara" ? "#3b82f6" : "#94a3b8";
  const getRarezaLabel = (r) =>
    r === "mitica" ? "🔴 MÍTICA" : r === "legendaria" ? "⭐ LEGENDARIA" : r === "rara" ? "💎 RARA" : "Común";
  const getRarezaBg = (r) =>
    r === "mitica" ? "linear-gradient(135deg, #ef4444, #dc2626, #b91c1c)"
      : r === "legendaria" ? "linear-gradient(135deg, #f59e0b, #d97706)"
        : r === "rara" ? "linear-gradient(135deg, #3b82f6, #2563eb)"
          : "linear-gradient(135deg, #475569, #334155)";

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh" }}>
        <p style={{ fontSize: "1.5rem" }}>Cargando...</p>
      </div>
    );
  }

  const currentCromo = cromosDelSobre[cardIndex];
  const rachaProgreso = rachaActual % 5;
  const totalEnSobre = esMegaSobre ? CROMOS_MEGA : CROMOS_NORMAL;

  // Calcular progreso del mega sobre
  const megaProgreso = totalSobresAbiertos % MEGA_CADA;
  const sobresParaMega = MEGA_CADA - megaProgreso;

  return (
    <div style={{
      minHeight: "100vh", background: "#0f172a", padding: "20px",
      overflow: "hidden", position: "relative"
    }}>
      {/* FLASH */}
      {showFlash && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 50, pointerEvents: "none",
          background: showFlash === "dark" ? "rgba(0,0,0,0.95)"
            : showFlash === "flicker" ? "none"
              : showFlash === "red" ? "radial-gradient(circle, rgba(239,68,68,0.6), rgba(0,0,0,0.85) 70%)"
                : showFlash === "gold" ? "radial-gradient(circle, rgba(251,191,36,0.4), transparent 70%)"
                  : showFlash === "blue" ? "radial-gradient(circle, rgba(59,130,246,0.3), transparent 70%)"
                    : "radial-gradient(circle, rgba(255,255,255,0.15), transparent 70%)",
          ...(showFlash === "flicker" ? { animation: "miticaFlicker 0.8s ease-out", background: "rgba(239,68,68,0.7)" } : {}),
        }} />
      )}

      {/* HEADER */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginBottom: "15px", position: "relative", zIndex: 10
      }}>
        <button onClick={() => router.push("/album")} style={{
          padding: "8px 16px", borderRadius: "10px", border: "1px solid #475569",
          background: "transparent", color: "#94a3b8", cursor: "pointer"
        }}>← Álbum</button>
        <div style={{ display: "flex", gap: "12px", alignItems: "center", fontSize: "0.85rem" }}>
          {rachaActual > 0 && <span style={{ color: "#f59e0b" }}>🔥 {rachaActual}</span>}
          {sobresBonus > 0 && (
            <span style={{ background: "#f59e0b", color: "#000", padding: "2px 8px", borderRadius: "10px", fontWeight: "bold", fontSize: "0.75rem" }}>🎁 {sobresBonus}</span>
          )}
        </div>
      </div>

      {/* RACHA */}
      {fase === "idle" && rachaActual > 0 && (
        <div style={{ background: "#1e293b", borderRadius: "12px", padding: "10px 15px", marginBottom: "10px", textAlign: "center", border: "1px solid #334155" }}>
          <span style={{ color: "#f59e0b", fontWeight: "bold" }}>🔥 Racha: {rachaActual} día{rachaActual !== 1 ? "s" : ""}</span>
          <div style={{ display: "flex", justifyContent: "center", gap: "4px", marginTop: "6px" }}>
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} style={{ width: "30px", height: "6px", borderRadius: "3px", background: i < rachaProgreso ? "#f59e0b" : "#334155" }} />
            ))}
          </div>
          <p style={{ fontSize: "0.7rem", color: "#64748b", marginTop: "4px" }}>{rachaProgreso}/5 para sobre bonus 🎁</p>
        </div>
      )}

      {/* MEGA SOBRE PROGRESS */}
      {fase === "idle" && (
        <div style={{
          background: siguienteEsMega
            ? "linear-gradient(135deg, #422006, #1e293b)"
            : "#1e293b",
          borderRadius: "12px", padding: "10px 15px", marginBottom: "15px",
          textAlign: "center",
          border: siguienteEsMega ? "1px solid #fbbf24" : "1px solid #334155",
          ...(siguienteEsMega ? { animation: "megaBorderGlow 2s infinite" } : {})
        }}>
          {siguienteEsMega ? (
            <p style={{ margin: 0, color: "#fbbf24", fontWeight: "bold", fontSize: "0.9rem" }}>
              ⭐ ¡Tu próximo sobre es un MEGA SOBRE! ⭐
            </p>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", marginBottom: "6px" }}>
                <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>⭐ Mega Sobre en</span>
                <span style={{ fontSize: "0.9rem", fontWeight: "bold", color: "#fbbf24" }}>{sobresParaMega}</span>
                <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>sobre{sobresParaMega !== 1 ? "s" : ""}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "center", gap: "3px" }}>
                {Array.from({ length: MEGA_CADA }, (_, i) => (
                  <div key={i} style={{
                    width: `${100 / MEGA_CADA - 1}%`, maxWidth: "14px",
                    height: "5px", borderRadius: "2px",
                    background: i < megaProgreso ? "#fbbf24" : "#334155",
                    transition: "background 0.3s"
                  }} />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {rachaMsg && fase === "resumen" && (
        <div style={{ background: "linear-gradient(135deg, #431407, #1e293b)", borderRadius: "12px", padding: "12px", textAlign: "center", marginBottom: "15px", border: "1px solid #f59e0b", animation: "fadeInUp 0.4s" }}>
          <p style={{ margin: 0, fontWeight: "bold", color: "#fbbf24" }}>{rachaMsg}</p>
        </div>
      )}

      {/* =========== FASE IDLE =========== */}
      {fase === "idle" && (
        <div style={{ textAlign: "center", paddingTop: "5px" }}>
          <h1 style={{ fontSize: "1.8rem", marginBottom: "20px" }}>
            {siguienteEsMega ? "⭐ Mega Sobre ⭐" : "Abrir Sobre"}
          </h1>

          {!puedeAbrir ? (
            <div style={{ textAlign: "center" }}>
              <p style={{ color: "#64748b", fontSize: "1.1rem", marginBottom: "15px" }}>Sin sobres hoy 😴</p>
              <div style={{ background: "#1e293b", borderRadius: "16px", padding: "20px", display: "inline-block", border: "1px solid #334155" }}>
                <p style={{ color: "#94a3b8", fontSize: "0.8rem", marginBottom: "8px" }}>Nuevos sobres en:</p>
                <p style={{ fontSize: "2.5rem", fontWeight: "bold", fontFamily: "monospace", color: "#f59e0b", margin: 0, letterSpacing: "3px" }}>{countdown}</p>
              </div>
            </div>
          ) : (
            <>
              {maxSobresHoy < MAX_SOBRES && (
                <div style={{ background: "linear-gradient(135deg, #1e0a2e, #1e293b)", padding: "10px", borderRadius: "12px", marginBottom: "12px", border: "1px solid #8b5cf6" }}>
                  <p style={{ margin: 0, color: "#a78bfa", fontWeight: "bold", fontSize: "0.85rem" }}>😈 Estás maldecido — solo 1 sobre hoy</p>
                </div>
              )}
              {sobresBonus > 0 && sobresHoy >= maxSobresHoy && (
                <div style={{ background: "linear-gradient(135deg, #431407, #1e293b)", padding: "10px", borderRadius: "12px", marginBottom: "12px", border: "1px solid #f59e0b" }}>
                  <p style={{ margin: 0, color: "#fbbf24", fontWeight: "bold", fontSize: "0.9rem" }}>🎁 Usando sobre bonus ({sobresBonus})</p>
                </div>
              )}
              {sobresRuleta > 0 && sobresHoy >= maxSobresHoy && sobresBonus === 0 && (
                <div style={{ background: "linear-gradient(135deg, #0a1f2e, #1e293b)", padding: "10px", borderRadius: "12px", marginBottom: "12px", border: "1px solid #3b82f6" }}>
                  <p style={{ margin: 0, color: "#60a5fa", fontWeight: "bold", fontSize: "0.9rem" }}>🎰 Usando sobre de ruleta ({sobresRuleta})</p>
                </div>
              )}

              <div style={{ animation: siguienteEsMega ? "megaEntrada 0.8s ease-out" : "sobreEntrada 0.6s ease-out" }}>
                <div style={{ animation: siguienteEsMega ? "megaFloat 3s ease-in-out infinite" : "sobreTemblor 2.5s ease-in-out 0.6s infinite" }}>
                  <div
                    onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}
                    onClick={() => iniciarApertura()}
                    style={{
                      width: siguienteEsMega ? "250px" : "220px",
                      height: siguienteEsMega ? "370px" : "320px",
                      margin: "0 auto", position: "relative",
                      cursor: "pointer", touchAction: "none", userSelect: "none",
                      borderRadius: "18px", overflow: "hidden",
                      boxShadow: siguienteEsMega
                        ? `0 20px 60px rgba(0,0,0,0.7), 0 0 ${30 + dragProgress * 50}px rgba(251,191,36,${0.3 + dragProgress * 0.5})`
                        : `0 15px 50px rgba(0,0,0,0.6), 0 0 ${20 + dragProgress * 40}px rgba(251,191,36,${0.1 + dragProgress * 0.5})`,
                      ...(siguienteEsMega ? { animation: "megaBorderGlow 2s infinite" } : {}),
                    }}
                  >
                    {/* Fondo */}
                    <div style={{
                      position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
                      background: siguienteEsMega
                        ? "linear-gradient(160deg, #422006 0%, #78350f 25%, #92400e 50%, #78350f 75%, #422006 100%)"
                        : "linear-gradient(160deg, #1a1a2e 0%, #16213e 30%, #0f3460 60%, #1a1a2e 100%)",
                    }} />

                    {/* Patrón */}
                    <div style={{
                      position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
                      opacity: siguienteEsMega ? 0.12 : 0.08,
                      backgroundImage: siguienteEsMega
                        ? "repeating-linear-gradient(45deg, transparent, transparent 15px, rgba(251,191,36,0.2) 15px, rgba(251,191,36,0.2) 16px)"
                        : "repeating-linear-gradient(45deg, transparent, transparent 20px, rgba(255,255,255,0.1) 20px, rgba(255,255,255,0.1) 21px)",
                    }} />

                    {/* Línea de corte */}
                    <div style={{
                      position: "absolute", top: siguienteEsMega ? "60px" : "55px",
                      left: "5%", width: "90%", height: 0, zIndex: 5,
                      borderTop: `2px dashed rgba(255,255,255,${0.2 + dragProgress * 0.5})`,
                    }} />

                    {/* Brillo del corte */}
                    {dragProgress > 0 && (
                      <div style={{
                        position: "absolute", top: siguienteEsMega ? "59px" : "54px",
                        left: "5%", width: `${dragProgress * 90}%`, height: "3px",
                        background: "#fbbf24", zIndex: 6, borderRadius: "2px",
                        boxShadow: `0 0 ${10 + dragProgress * 25}px #fbbf24`,
                      }} />
                    )}

                    {/* Tapa */}
                    <div style={{
                      position: "absolute", top: 0, left: 0, right: 0,
                      height: siguienteEsMega ? "61px" : "56px",
                      background: siguienteEsMega
                        ? "linear-gradient(160deg, #422006, #78350f)"
                        : "linear-gradient(160deg, #1a1a2e, #0f3460)",
                      zIndex: 4, transformOrigin: "top center",
                      transform: `perspective(400px) rotateX(${dragProgress * 80}deg)`,
                      transition: dragProgress > 0 ? "none" : "transform 0.3s",
                    }} />

                    {/* Contenido */}
                    <div style={{
                      position: "relative", zIndex: 2, height: "100%",
                      display: "flex", flexDirection: "column",
                      justifyContent: "center", alignItems: "center", padding: "20px",
                    }}>
                      <div style={{
                        width: "50px", height: "1px",
                        background: `linear-gradient(90deg, transparent, ${siguienteEsMega ? "#fbbf24" : "#fbbf24"}, transparent)`,
                        marginBottom: "18px",
                      }} />

                      {/* Logo */}
                      <div style={{
                        width: siguienteEsMega ? "85px" : "70px",
                        height: siguienteEsMega ? "85px" : "70px",
                        borderRadius: "50%",
                        border: `2px solid ${siguienteEsMega ? "rgba(251,191,36,0.7)" : "rgba(251,191,36,0.4)"}`,
                        display: "flex", justifyContent: "center", alignItems: "center",
                        marginBottom: "15px",
                        background: siguienteEsMega
                          ? "radial-gradient(circle, rgba(251,191,36,0.25), transparent)"
                          : "radial-gradient(circle, rgba(251,191,36,0.1), transparent)",
                        boxShadow: siguienteEsMega ? "0 0 30px rgba(251,191,36,0.3)" : "none",
                      }}>
                        <span style={{
                          fontSize: siguienteEsMega ? "2.2rem" : "1.8rem",
                          fontWeight: "bold", color: "#fbbf24", fontFamily: "Georgia, serif",
                        }}>AY</span>
                      </div>

                      {/* Texto MEGA */}
                      {siguienteEsMega && (
                        <span style={{
                          fontSize: "0.75rem", color: "#fbbf24", fontWeight: "bold",
                          letterSpacing: "6px", marginBottom: "6px",
                          textShadow: "0 0 10px rgba(251,191,36,0.5)",
                        }}>⭐ MEGA ⭐</span>
                      )}

                      <span style={{
                        fontSize: "0.6rem",
                        color: siguienteEsMega ? "rgba(251,191,36,0.8)" : "rgba(251,191,36,0.6)",
                        letterSpacing: "5px", textTransform: "uppercase", marginBottom: "4px",
                      }}>ÁLBUM</span>

                      <span style={{
                        fontSize: siguienteEsMega ? "1.7rem" : "1.5rem",
                        fontWeight: "bold", color: "#fefce8",
                        letterSpacing: "6px", fontFamily: "Georgia, serif",
                        textShadow: siguienteEsMega ? "0 0 15px rgba(251,191,36,0.4)" : "none",
                      }}>YEISSY</span>

                      <div style={{
                        width: "50px", height: "1px",
                        background: "linear-gradient(90deg, transparent, #fbbf24, transparent)",
                        marginTop: "18px", marginBottom: "15px",
                      }} />

                      <div style={{
                        padding: "4px 16px", borderRadius: "20px",
                        border: `1px solid ${siguienteEsMega ? "rgba(251,191,36,0.5)" : "rgba(251,191,36,0.2)"}`,
                        background: siguienteEsMega ? "rgba(251,191,36,0.15)" : "rgba(251,191,36,0.05)",
                      }}>
                        <span style={{
                          fontSize: "0.7rem",
                          color: siguienteEsMega ? "rgba(254,243,199,0.8)" : "rgba(254,243,199,0.5)",
                          letterSpacing: "2px",
                        }}>{siguienteEsMega ? "7" : "5"} CROMOS</span>
                      </div>
                    </div>

                    {/* Border */}
                    <div style={{
                      position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
                      borderRadius: "18px",
                      border: `1px solid ${siguienteEsMega ? "rgba(251,191,36,0.4)" : "rgba(251,191,36,0.15)"}`,
                      pointerEvents: "none",
                    }} />
                  </div>
                </div>
              </div>

              <p style={{ color: "#94a3b8", fontSize: "0.9rem", marginTop: "25px", animation: "pulsoSuave 2s infinite" }}>
                ⬆️ Desliza o toca para abrir
              </p>
              <p style={{ color: "#475569", fontSize: "0.75rem", marginTop: "10px" }}>
                ⏰ Sobres se renuevan en {countdown}
              </p>
              {dragProgress > 0 && (
                <div style={{ width: "180px", height: "4px", background: "#1e293b", borderRadius: "2px", margin: "15px auto", overflow: "hidden" }}>
                  <div style={{ width: `${dragProgress * 100}%`, height: "100%", background: dragProgress >= 0.5 ? "#10b981" : "#f59e0b", borderRadius: "2px" }} />
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* =========== ABRIENDO =========== */}
      {fase === "abriendo" && (
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", minHeight: "70vh", position: "relative" }}>
          <div style={{
            width: esMegaSobre ? "250px" : "220px",
            height: esMegaSobre ? "370px" : "320px",
            position: "relative", borderRadius: "18px", overflow: "hidden",
            animation: "sobreAbierto 1.5s ease-in forwards",
          }}>
            <div style={{
              width: "100%", height: "100%",
              background: esMegaSobre
                ? "linear-gradient(160deg, #422006, #78350f, #422006)"
                : "linear-gradient(160deg, #1a1a2e, #0f3460, #1a1a2e)",
              display: "flex", justifyContent: "center", alignItems: "center",
            }}>
              <span style={{ fontSize: "3rem" }}>{esMegaSobre ? "⭐" : "✨"}</span>
            </div>
          </div>
          <div style={{
            position: "absolute", top: "45%", left: "50%",
            width: "150px", height: "150px", borderRadius: "50%",
            background: esMegaSobre
              ? "radial-gradient(circle, rgba(251,191,36,1), transparent)"
              : "radial-gradient(circle, rgba(251,191,36,0.7), transparent)",
            animation: "luzExplosion 1.5s ease-out forwards", pointerEvents: "none"
          }} />
          <p style={{ marginTop: "30px", color: "#f59e0b", fontSize: "1.1rem", animation: "pulsoSuave 0.8s infinite" }}>
            {esMegaSobre ? "⭐ Abriendo MEGA SOBRE... ⭐" : "✨ Abriendo sobre... ✨"}
          </p>
        </div>
      )}

      {/* =========== REVELANDO =========== */}
      {fase === "revelando" && currentCromo && (
        <div
          key={`card-${cardIndex}-${cardFlipped}`}
          style={{
            display: "flex", flexDirection: "column", alignItems: "center", paddingTop: "10px",
            animation: cardFlipped
              ? currentCromo.rareza === "mitica" ? "miticaShake 1s ease-out"
                : currentCromo.rareza === "legendaria" ? "shake 0.6s ease-out" : "none"
              : "none",
          }}
        >
          {/* Mega badge */}
          {esMegaSobre && (
            <div style={{
              background: "linear-gradient(135deg, #f59e0b, #d97706)",
              padding: "3px 12px", borderRadius: "10px", marginBottom: "10px",
              fontSize: "0.7rem", fontWeight: "bold", color: "#000"
            }}>⭐ MEGA SOBRE</div>
          )}
          {esSobreRuleta && (
            <div style={{
              background: "linear-gradient(135deg, #1d4ed8, #1e40af)",
              padding: "3px 12px", borderRadius: "10px", marginBottom: "10px",
              fontSize: "0.7rem", fontWeight: "bold", color: "white"
            }}>🎰 Sobre de Ruleta</div>
          )}

          {/* Progreso */}
          <div style={{ display: "flex", gap: "6px", marginBottom: "15px", animation: "fadeInUp 0.3s" }}>
            {cromosDelSobre.map((_, i) => (
              <div key={i} style={{
                width: i === cardIndex ? "24px" : "8px", height: "8px", borderRadius: "4px",
                background: i < cardIndex ? "#10b981" : i === cardIndex ? "#f59e0b" : "#334155",
                transition: "all 0.3s"
              }} />
            ))}
          </div>
          <p style={{ color: "#94a3b8", fontSize: "0.9rem", marginBottom: "12px" }}>
            Cromo {cardIndex + 1} de {totalEnSobre}
          </p>

          {/* Labels */}
          {cardFlipped && currentCromo.rareza === "mitica" && (
            <div style={{ fontSize: "2rem", fontWeight: "bold", color: "#ef4444", marginBottom: "12px", animation: "miticaTexto 1s ease-out", textShadow: "0 0 40px rgba(239,68,68,0.8)" }}>🔴 M Í T I C A 🔴</div>
          )}
          {cardFlipped && currentCromo.rareza === "legendaria" && (
            <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: "#fbbf24", marginBottom: "12px", animation: "legendarioTexto 0.6s ease-out", textShadow: "0 0 30px rgba(251,191,36,0.5)" }}>⭐ ¡¡LEGENDARIA!! ⭐</div>
          )}
          {cardFlipped && currentCromo.rareza === "rara" && (
            <div style={{ fontSize: "1.3rem", fontWeight: "bold", color: "#60a5fa", marginBottom: "12px", animation: "legendarioTexto 0.5s ease-out" }}>💎 ¡RARA! 💎</div>
          )}
          {cardFlipped && currentCromo.rareza === "comun" && (
            <div style={{ fontSize: "1rem", color: "#94a3b8", marginBottom: "12px", animation: "fadeInUp 0.3s" }}>Común</div>
          )}

          {/* Nuevo/Repe */}
          {cardFlipped && (
            <div style={{
              marginBottom: "10px", padding: "4px 14px", borderRadius: "20px",
              fontSize: "0.8rem", fontWeight: "bold",
              background: currentCromo.rareza === "mitica" ? "#7f1d1d" : currentCromo.esNuevo ? "#059669" : "#dc2626",
              animation: "nuevoTag 0.4s ease-out"
            }}>
              {currentCromo.rareza === "mitica" ? "⚡ ¡¡DESCUBIERTA!!" : currentCromo.esNuevo ? "🆕 ¡NUEVO!" : "🔄 Repetido"}
            </div>
          )}

          {/* CARTA */}
          <div key={cardIndex} className="card-container"
            onClick={!cardFlipped ? flipCard : undefined}
            style={{ width: "240px", height: "340px", margin: "0 auto", cursor: !cardFlipped ? "pointer" : "default", animation: "cartaEntrada 0.5s ease-out" }}
          >
            <div className={`card-inner ${cardFlipped ? "flipped" : ""}`}
              style={{
                transition: currentCromo.rareza === "mitica" ? "transform 2s cubic-bezier(0.4, 0, 0.2, 1)"
                  : currentCromo.rareza === "legendaria" ? "transform 1.2s cubic-bezier(0.4, 0, 0.2, 1)"
                    : currentCromo.rareza === "rara" ? "transform 0.9s cubic-bezier(0.4, 0, 0.2, 1)"
                      : "transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)",
              }}
            >
              {/* Dorso */}
              <div className="card-face card-back" style={{
                border: "2px solid #1e3a5f", boxShadow: "0 8px 35px rgba(0,0,0,0.5)",
                background: "linear-gradient(160deg, #0c1929, #122240, #0a1628)",
              }}>
                <div style={{ width: "88%", height: "90%", borderRadius: "10px", border: "1px solid rgba(251,191,36,0.15)", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", position: "relative", overflow: "hidden" }}>
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, opacity: 0.04, backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 15px, white 15px, white 16px), repeating-linear-gradient(-45deg, transparent, transparent 15px, white 15px, white 16px)" }} />
                  <div style={{ width: "80px", height: "80px", borderRadius: "50%", border: "1.5px solid rgba(251,191,36,0.2)", display: "flex", justifyContent: "center", alignItems: "center", marginBottom: "12px" }}>
                    <div style={{ width: "60px", height: "60px", borderRadius: "50%", border: "1px solid rgba(251,191,36,0.1)", display: "flex", justifyContent: "center", alignItems: "center" }}>
                      <span style={{ fontSize: "1.6rem", fontWeight: "bold", color: "rgba(251,191,36,0.5)", fontFamily: "Georgia, serif" }}>AY</span>
                    </div>
                  </div>
                  <span style={{ fontSize: "0.55rem", color: "rgba(251,191,36,0.3)", letterSpacing: "4px" }}>ÁLBUM</span>
                  <span style={{ fontSize: "0.9rem", color: "rgba(251,191,36,0.4)", letterSpacing: "5px", fontWeight: "bold", fontFamily: "Georgia, serif" }}>YEISSY</span>
                </div>
                <div style={{ position: "absolute", bottom: "15px", fontSize: "0.75rem", color: "rgba(251,191,36,0.25)", animation: "pulsoSuave 1.5s infinite" }}>toca para revelar</div>
              </div>

              {/* Frente */}
              <div className="card-face card-front" style={{
                border: `3px solid ${getBorderColor(currentCromo.rareza)}`,
                background: "#1e293b", boxShadow: "0 8px 35px rgba(0,0,0,0.5)",
                animation: cardFlipped
                  ? currentCromo.rareza === "mitica" ? "miticaGlow 1.5s infinite"
                    : currentCromo.rareza === "legendaria" ? "brilloDorado 1.5s infinite"
                      : currentCromo.rareza === "rara" ? "brilloAzul 2s infinite" : "none"
                  : "none",
              }}>
                <img src={currentCromo.imagen} alt={currentCromo.nombre} style={{ width: "100%", height: "72%", objectFit: "cover", borderRadius: "12px 12px 0 0" }} />
                <div style={{ height: "28%", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: "8px", background: getRarezaBg(currentCromo.rareza) }}>
                  <p style={{ margin: 0, fontWeight: "bold", fontSize: "0.85rem", textAlign: "center" }}>{currentCromo.nombre}</p>
                  <p style={{ margin: "4px 0 0", fontSize: "0.75rem", opacity: 0.8 }}>{getRarezaLabel(currentCromo.rareza)}</p>
                </div>
              </div>
            </div>
          </div>

          {cardFlipped && (
            <button onClick={nextCard} style={{
              marginTop: "25px", padding: "14px 40px", borderRadius: "14px", border: "none",
              background: cardIndex < totalEnSobre - 1
                ? "linear-gradient(135deg, #3b82f6, #2563eb)"
                : "linear-gradient(135deg, #10b981, #059669)",
              color: "white", fontSize: "1rem", fontWeight: "bold", cursor: "pointer", animation: "fadeInUp 0.3s",
            }}>
              {cardIndex < totalEnSobre - 1 ? `Siguiente → (${cardIndex + 2}/${totalEnSobre})` : "Ver resumen"}
            </button>
          )}
        </div>
      )}

      {/* =========== RESUMEN =========== */}
      {fase === "resumen" && (
        <div style={{ animation: "fadeInUp 0.5s" }}>
          <h2 style={{ textAlign: "center", fontSize: "1.6rem", marginBottom: "8px" }}>
            {esMegaSobre ? "⭐ ¡Mega Sobre abierto! ⭐" : "¡Sobre abierto!"}
          </h2>
          <p style={{ textAlign: "center", color: "#94a3b8", marginBottom: "20px", fontSize: "1rem" }}>
            {nuevosCount > 0 && `🆕 ${nuevosCount} nuevo${nuevosCount > 1 ? "s" : ""}`}
            {nuevosCount > 0 && repetidosCount > 0 && " · "}
            {repetidosCount > 0 && `🔄 ${repetidosCount} repetido${repetidosCount > 1 ? "s" : ""}`}
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px", maxWidth: "350px", margin: "0 auto 30px auto" }}>
            {cromosDelSobre.map((cromo, i) => (
              <div key={i} style={{
                borderRadius: "12px", border: `2px solid ${getBorderColor(cromo.rareza)}`,
                overflow: "hidden", background: "#1e293b",
                animation: `fadeInUp 0.4s ease-out ${i * 0.1}s both`, position: "relative",
                ...(cromo.rareza === "mitica" ? { boxShadow: "0 0 20px rgba(239,68,68,0.5)" } : {}),
              }}>
                <img src={cromo.imagen} alt="" style={{ width: "100%", aspectRatio: "1", objectFit: "cover" }} />
                <div style={{ padding: "5px", textAlign: "center", background: getRarezaBg(cromo.rareza) }}>
                  <p style={{ fontSize: "0.55rem", margin: 0, fontWeight: "bold" }}>{cromo.nombre}</p>
                  <p style={{ fontSize: "0.5rem", margin: 0, opacity: 0.8 }}>{getRarezaLabel(cromo.rareza)}</p>
                </div>
                <div style={{
                  position: "absolute", top: "4px", right: "4px", padding: "2px 6px", borderRadius: "8px",
                  fontSize: "0.5rem", fontWeight: "bold",
                  background: cromo.rareza === "mitica" ? "rgba(127,29,29,0.9)" : cromo.esNuevo ? "rgba(5,150,105,0.9)" : "rgba(220,38,38,0.9)"
                }}>
                  {cromo.rareza === "mitica" ? "⚡" : cromo.esNuevo ? "🆕" : "🔄"}
                </div>
              </div>
            ))}
          </div>
          <div style={{ textAlign: "center", display: "flex", gap: "10px", justifyContent: "center", flexWrap: "wrap" }}>
            {puedeAbrir && (
              <button onClick={resetSobre} style={{ padding: "14px 28px", borderRadius: "14px", border: "none", background: "linear-gradient(135deg, #f59e0b, #d97706)", color: "#000", fontWeight: "bold", cursor: "pointer", fontSize: "1rem" }}>Otro sobre 📦</button>
            )}
            <button onClick={() => router.push("/album")} style={{ padding: "14px 28px", borderRadius: "14px", border: "none", background: "linear-gradient(135deg, #3b82f6, #2563eb)", color: "white", fontWeight: "bold", cursor: "pointer", fontSize: "1rem" }}>Ver álbum 📖</button>
          </div>
        </div>
      )}
    </div>
  );
}