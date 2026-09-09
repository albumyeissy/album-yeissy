"use client";
import { useState, useEffect, useRef } from "react";
import { auth, db } from "../../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc, runTransaction } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { CROMOS } from "../../data/cromos";
import { addFeedEvent } from "../../lib/feedHelper";
import "../hv.css";
import HvBottomNav from "../HvBottomNav";

const TORTURAS = [
  { id: "contador", nombre: "El Contador", emoji: "🔢", descripcion: "Pulsa 500 veces sin parar",                          color: "#ef4444" },
  { id: "espera",   nombre: "La Espera",   emoji: "🌀", descripcion: "Mantén pulsado 3 minutos",                           color: "#3b82f6" },
  { id: "texto",    nombre: "El Texto",    emoji: "📝", descripcion: "Escribe el texto sin errores",                       color: "#8b5cf6" },
  { id: "reflejo",  nombre: "El Reflejo",  emoji: "⚡", descripcion: "Toca el botón antes de que desaparezca · 25 veces", color: "#f59e0b" },
  { id: "calculo",  nombre: "El Cálculo",  emoji: "🧮", descripcion: "Resuelve 20 operaciones en 10 segundos cada una",   color: "#10b981" },
  { id: "punteria", nombre: "La Puntería", emoji: "🎯", descripcion: "Toca el círculo en movimiento · 20 veces",          color: "#ec4899" },
];

const TEXTOS_TORTURA = [
  "Yo declaro solemnemente que soy el peor jugador de este grupo y que todos mis amigos son superiores a mí en absolutamente todos los aspectos de la vida. Reconozco que mis cromos son basura comparados con los suyos y que nunca completaré este álbum porque soy un desastre total y absoluto. Firmo esta declaración bajo juramento sabiendo que todos se reirán de mí.",
  "Por la presente certifico que soy un completo inútil abriendo sobres y que la suerte me odia profundamente. Cada vez que abro un sobre me salen repetidos porque el universo conspira contra mí. Mis amigos tienen mejor gusto eligiendo cromos y yo debería dedicarme a otra cosa. Este texto es mi penitencia y la acepto con resignación.",
  "Queridos compañeros del álbum, escribo estas líneas para confesar que soy el eslabón más débil del grupo. Mis repetidos son tantos que podría empapelar una habitación entera con ellos. No merezco las legendarias que tengo y probablemente las conseguí de pura chiripa. Prometo seguir sufriendo estas torturas porque necesito desesperadamente más cromos.",
];

export default function TorturaHvPage() {
  const [user,            setUser]            = useState(null);
  const [loading,         setLoading]         = useState(true);
  const [datosUsuario,    setDatosUsuario]    = useState(null);
  const [yaHechaHoy,      setYaHechaHoy]      = useState(false);
  const [torturaHoy,      setTorturaHoy]      = useState(null);
  const [fase,            setFase]            = useState("intro");
  const [premio,          setPremio]          = useState(null);
  const [cromosGanados,   setCromosGanados]   = useState([]);
  const [countdown,       setCountdown]       = useState("");
  const [sorteoPendiente, setSorteoPendiente] = useState(true);
  const [sorteoFase,      setSorteoFase]      = useState("esperando");
  const [sorteoActual,    setSorteoActual]    = useState(0);
  const sorteoTimeoutsRef = useRef([]);

  // ── Contador ──
  const [contadorTaps,    setContadorTaps]    = useState(0);
  const [contadorOferta,  setContadorOferta]  = useState(false);
  const contadorTimeoutRef           = useRef(null);
  const contadorTapsRef              = useRef(0);
  const contadorOfertaMostradaRef    = useRef(false);
  const darPremioGuardRef            = useRef(false);

  // ── Espera ──
  const [esperaTime,      setEsperaTime]      = useState(0);
  const [esperaPulsado,   setEsperaPulsado]   = useState(false);
  const [esperaOferta,    setEsperaOferta]    = useState(false);
  const esperaIntervalRef = useRef(null);

  // ── Texto ──
  const [textoObjetivo,   setTextoObjetivo]   = useState("");
  const [textoInput,      setTextoInput]      = useState("");
  const [textoIntentos,   setTextoIntentos]   = useState(3);
  const [textoError,      setTextoError]      = useState(false);
  const [textoErrorDetalle, setTextoErrorDetalle] = useState("");

  // ── Reflejo ──
  const [reflejoHits,     setReflejoHits]     = useState(0);
  const [reflejoFallos,   setReflejoFallos]   = useState(0);
  const [reflejoPos,      setReflejoPos]      = useState(null);
  const [reflejoOferta,   setReflejoOferta]   = useState(false);
  const reflejoHitsRef              = useRef(0);
  const reflejoFallosRef            = useRef(0);
  const reflejoTimeoutRef           = useRef(null);
  const reflejoRoundRef             = useRef(0);
  const darPremioGuardRefReflejo    = useRef(false);
  const mostrarObjetivoReflejoRef   = useRef(null);

  // ── Cálculo ──
  const [calculoPregunta, setCalculoPregunta] = useState(0);
  const [calculoErrores,  setCalculoErrores]  = useState(0);
  const [calculoRespuesta,setCalculoRespuesta]= useState("");
  const [calculoQuestion, setCalculoQuestion] = useState(null);
  const [calculoTimer,    setCalculoTimer]    = useState(10);
  const [calculoOferta,   setCalculoOferta]   = useState(false);
  const [calculoFlashError, setCalculoFlashError] = useState(false);
  const calculoErroresRef           = useRef(0);
  const calculoPreguntaRef          = useRef(0);
  const calculoTimerIntervalRef     = useRef(null);
  const handleCalculoTimeoutRef     = useRef(null);
  const generarNuevaPreguntaRef     = useRef(null);
  const darPremioGuardRefCalculo    = useRef(false);

  // ── Puntería ──
  const [punteriaHits,    setPunteriaHits]    = useState(0);
  const [punteriaFallos,  setPunteriaFallos]  = useState(0);
  const [punteriaOferta,  setPunteriaOferta]  = useState(false);
  const [punteriaPos,     setPunteriaPos]     = useState({ x: 128, y: 148 });
  const punteriaHitsRef             = useRef(0);
  const punteriaFallosRef           = useRef(0);
  const punteriaPosRef              = useRef({ x: 128, y: 148 });
  const punteriaVelRef              = useRef({ vx: 3.5, vy: 2.5 });
  const punteriaIntervalRef         = useRef(null);
  const darPremioGuardRefPunteria   = useRef(false);

  const router = useRouter();
  const HOY = new Date().toLocaleDateString("en-CA");

  // ── Countdown ──
  useEffect(() => {
    const update = () => {
      const now = new Date(), tom = new Date(now);
      tom.setDate(tom.getDate() + 1); tom.setHours(0, 0, 0, 0);
      const diff = tom - now;
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setCountdown(`${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`);
    };
    update(); const iv = setInterval(update, 1000); return () => clearInterval(iv);
  }, []);

  // ── Auth + carga ──
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { router.push("/"); return; }
      setUser(u);
      try {
        const [userSnap, configSnap] = await Promise.all([
          getDoc(doc(db, "usuarios", u.uid)),
          getDoc(doc(db, "config", "torturaDelDia")),
        ]);
        if (userSnap.exists()) {
          const data = userSnap.data(); setDatosUsuario(data); setYaHechaHoy(data.fechaTortura === HOY);
        } else { setDatosUsuario({ cromos: [] }); }
        const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
        setTextoObjetivo(TEXTOS_TORTURA[dayOfYear % TEXTOS_TORTURA.length]);
        if (configSnap.exists() && configSnap.data().fecha === HOY && configSnap.data().torturaId) {
          const tortura = TORTURAS.find(t => t.id === configSnap.data().torturaId);
          if (tortura) { setTorturaHoy(tortura); setSorteoPendiente(false); }
          else setSorteoPendiente(true);
        } else { setSorteoPendiente(true); }
      } catch { setDatosUsuario({ cromos: [] }); setSorteoPendiente(true); }
      setLoading(false);
    });
    return () => unsub();
  }, [router]);

  // ── Cleanup ──
  useEffect(() => () => {
    sorteoTimeoutsRef.current.forEach(clearTimeout);
    if (esperaIntervalRef.current) clearInterval(esperaIntervalRef.current);
    if (contadorTimeoutRef.current) clearTimeout(contadorTimeoutRef.current);
    if (reflejoTimeoutRef.current) clearTimeout(reflejoTimeoutRef.current);
    if (calculoTimerIntervalRef.current) clearInterval(calculoTimerIntervalRef.current);
    if (punteriaIntervalRef.current) clearInterval(punteriaIntervalRef.current);
  }, []);

  // ── Contador reset inactividad ──
  useEffect(() => {
    if (fase !== "jugando" || torturaHoy?.id !== "contador") return;
    if (contadorTimeoutRef.current) clearTimeout(contadorTimeoutRef.current);
    contadorTimeoutRef.current = setTimeout(() => {
      if (contadorTapsRef.current > 0 && contadorTapsRef.current < 500 && !contadorOfertaMostradaRef.current) {
        contadorTapsRef.current = 0; setContadorTaps(0);
      }
    }, 3000);
  }, [contadorTaps, fase, torturaHoy]);

  // ── Cálculo timer ──
  useEffect(() => {
    if (fase !== "jugando" || torturaHoy?.id !== "calculo" || calculoOferta) return;
    if (calculoTimerIntervalRef.current) clearInterval(calculoTimerIntervalRef.current);
    setCalculoTimer(10);
    const iv = setInterval(() => {
      setCalculoTimer(t => {
        if (t <= 1) { clearInterval(iv); setTimeout(() => handleCalculoTimeoutRef.current?.(), 0); return 0; }
        return t - 1;
      });
    }, 1000);
    calculoTimerIntervalRef.current = iv;
    return () => clearInterval(iv);
  }, [calculoPregunta, fase, torturaHoy?.id, calculoOferta]);

  // === SORTEO ===
  const determinarTorturaFirestore = async () => {
    const configRef = doc(db, "config", "torturaDelDia");
    let ganadorId = null;
    try {
      await runTransaction(db, async tx => {
        const snap = await tx.get(configRef);
        if (snap.exists() && snap.data().fecha === HOY && snap.data().torturaId) {
          ganadorId = snap.data().torturaId; return;
        }
        const idx = Math.floor(Math.random() * TORTURAS.length);
        ganadorId = TORTURAS[idx].id;
        tx.set(configRef, { fecha: HOY, torturaId: ganadorId, seleccionadaEn: new Date().toISOString() });
      });
    } catch { ganadorId = TORTURAS[Math.floor(Math.random() * TORTURAS.length)].id; }
    return ganadorId;
  };

  const iniciarSorteo = async () => {
    setSorteoFase("girando");
    const ganadorId = await determinarTorturaFirestore();
    const ganadorIndex = TORTURAS.findIndex(t => t.id === ganadorId);
    const TOTAL = 18;
    const secuencia = Array.from({ length: TOTAL }, (_, i) => i % TORTURAS.length);
    secuencia[TOTAL - 1] = ganadorIndex;
    const MIN_DELAY = 65, MAX_DELAY = 480;
    let totalDelay = 0;
    sorteoTimeoutsRef.current.forEach(clearTimeout); sorteoTimeoutsRef.current = [];
    secuencia.forEach((idx, i) => {
      const progress = i / (TOTAL - 1);
      const delay = Math.round(MIN_DELAY + (MAX_DELAY - MIN_DELAY) * Math.pow(progress, 2));
      totalDelay += delay;
      const t = setTimeout(() => {
        setSorteoActual(idx);
        if (i === TOTAL - 1) {
          setTorturaHoy(TORTURAS[ganadorIndex]);
          const t2 = setTimeout(() => {
            setSorteoFase("revelado");
            const t3 = setTimeout(() => setSorteoPendiente(false), 2800);
            sorteoTimeoutsRef.current.push(t3);
          }, 300);
          sorteoTimeoutsRef.current.push(t2);
        }
      }, totalDelay);
      sorteoTimeoutsRef.current.push(t);
    });
  };

  // === HELPERS ===
  const seleccionarCromosAleatorios = (cantidad) => {
    const cromos = [];
    for (let i = 0; i < cantidad; i++) {
      const roll = Math.random() * 100;
      const rareza = roll < 1 ? "legendaria" : roll < 15 ? "rara" : "comun";
      const pool = CROMOS.filter(c => c.rareza === rareza);
      if (pool.length > 0) cromos.push(pool[Math.floor(Math.random() * pool.length)]);
    }
    return cromos;
  };

  const darPremio = async (tipo) => {
    let freshSobresBonus = datosUsuario?.sobresBonus || 0;
    let freshMonedas = datosUsuario?.monedas ?? 50;
    const monedasPremio = tipo === "sobre" ? 10 : 5;
    try {
      await runTransaction(db, async tx => {
        const userRef = doc(db, "usuarios", user.uid);
        const snap = await tx.get(userRef);
        if (!snap.exists()) throw new Error("no-data");
        const d = snap.data();
        if (d.fechaTortura === HOY) throw new Error("ya-hecha");
        freshSobresBonus = d.sobresBonus || 0; freshMonedas = d.monedas ?? 50;
        tx.set(userRef, { fechaTortura: HOY }, { merge: true });
      });
    } catch (err) {
      if (err.message === "ya-hecha") { setYaHechaHoy(true); setFase("intro"); }
      return;
    }
    if (tipo === "sobre") {
      const nuevoBonus = freshSobresBonus + 1;
      const nuevasMonedas = freshMonedas + monedasPremio;
      try {
        await setDoc(doc(db, "usuarios", user.uid), { sobresBonus: nuevoBonus, monedas: nuevasMonedas }, { merge: true });
        addFeedEvent({ type: "racha", userName: datosUsuario?.nombre, details: `😈 Ha sobrevivido a "${torturaHoy?.nombre}" y ganado un sobre + 10🪙` });
      } catch { /* ignore */ }
      setDatosUsuario({ ...datosUsuario, sobresBonus: nuevoBonus, monedas: nuevasMonedas });
      setPremio("sobre"); setYaHechaHoy(true); setFase("premio");
    } else {
      const nuevasMonedas = freshMonedas + monedasPremio;
      const cromos = seleccionarCromosAleatorios(2);
      const cromosActuales = datosUsuario?.cromos || [];
      const cromosActualizados = [...cromosActuales];
      cromos.forEach(cromo => {
        const existing = cromosActualizados.find(c => c.cromoId === cromo.id);
        if (existing) existing.cantidad += 1;
        else cromosActualizados.push({ cromoId: cromo.id, cantidad: 1, fechaObtenido: HOY, pegado: false });
      });
      try {
        await setDoc(doc(db, "usuarios", user.uid), { cromos: cromosActualizados, monedas: nuevasMonedas }, { merge: true });
        addFeedEvent({ type: "racha", userName: datosUsuario?.nombre, details: `😮‍💨 Se rindió en "${torturaHoy?.nombre}" y recibió 2 cromos + 5🪙` });
      } catch { /* ignore */ }
      setDatosUsuario({ ...datosUsuario, cromos: cromosActualizados, monedas: nuevasMonedas });
      setCromosGanados(cromos); setPremio("cromos"); setYaHechaHoy(true); setFase("premio");
    }
  };

  const rendirse = async (darCromos = true) => {
    if (darCromos) { await darPremio("cromos"); }
    else {
      try { await setDoc(doc(db, "usuarios", user.uid), { fechaTortura: HOY }, { merge: true }); } catch { /* ignore */ }
      setYaHechaHoy(true); setFase("intro");
    }
  };

  // === CONTADOR ===
  const startContador = () => { setFase("jugando"); setContadorTaps(0); setContadorOferta(false); contadorTapsRef.current = 0; contadorOfertaMostradaRef.current = false; darPremioGuardRef.current = false; };
  const handleTap = () => {
    if (contadorOferta) return;
    contadorTapsRef.current += 1; const newTaps = contadorTapsRef.current; setContadorTaps(newTaps);
    if (newTaps >= 200 && !contadorOfertaMostradaRef.current) { contadorOfertaMostradaRef.current = true; setContadorOferta(true); }
    if (newTaps >= 500 && !darPremioGuardRef.current) { darPremioGuardRef.current = true; darPremio("sobre"); }
  };

  // === ESPERA ===
  const startEspera = () => { setFase("jugando"); setEsperaTime(0); setEsperaPulsado(false); setEsperaOferta(false); };
  const esperaDown = () => {
    setEsperaPulsado(true);
    esperaIntervalRef.current = setInterval(() => {
      setEsperaTime(prev => {
        const next = prev + 1;
        if (next >= 60 && !esperaOferta) setEsperaOferta(true);
        if (next >= 180) { clearInterval(esperaIntervalRef.current); darPremio("sobre"); }
        return next;
      });
    }, 1000);
  };
  const esperaUp = () => {
    setEsperaPulsado(false); clearInterval(esperaIntervalRef.current);
    if (esperaTime < 180 && !esperaOferta) setEsperaTime(0);
  };

  // === TEXTO ===
  const startTexto = () => { setFase("jugando"); setTextoInput(""); setTextoError(false); setTextoErrorDetalle(""); };
  const normalizarTexto = s => s.trim().replace(/\s+/g, " ").replace(/['']/g, "'").replace(/[""]/g, '"');
  const handleTextoSubmit = () => {
    const objetivo = normalizarTexto(textoObjetivo), escrito = normalizarTexto(textoInput);
    if (escrito === objetivo) { darPremio("sobre"); return; }
    let pos = 0;
    const minLen = Math.min(objetivo.length, escrito.length);
    while (pos < minLen && objetivo[pos] === escrito[pos]) pos++;
    let detalle;
    if (!escrito.length) { detalle = "No has escrito nada."; }
    else if (pos >= objetivo.length) { detalle = `Texto demasiado largo: escribiste ${escrito.length} caracteres, el original tiene ${objetivo.length}.`; }
    else if (pos >= escrito.length) { detalle = `Texto incompleto: escribiste ${escrito.length} de ${objetivo.length} caracteres.`; }
    else {
      const ctx = 18, start = Math.max(0, pos - ctx);
      const snipObj = (start > 0 ? "…" : "") + objetivo.slice(start, Math.min(objetivo.length, pos + ctx)) + (pos + ctx < objetivo.length ? "…" : "");
      const snipEsc = (start > 0 ? "…" : "") + escrito.slice(start, Math.min(escrito.length, pos + ctx)) + (pos + ctx < escrito.length ? "…" : "");
      detalle = `Posición ${pos + 1} → esperado: «${snipObj}» · escrito: «${snipEsc}»`;
    }
    const remaining = textoIntentos - 1;
    setTextoIntentos(remaining); setTextoError(true); setTextoErrorDetalle(detalle);
    if (remaining <= 0) rendirse(false);
  };

  // === REFLEJO ===
  mostrarObjetivoReflejoRef.current = () => {
    const x = Math.floor(Math.random() * (280)), y = Math.floor(Math.random() * (300));
    setReflejoPos({ x, y });
    const round = reflejoRoundRef.current + 1; reflejoRoundRef.current = round;
    reflejoTimeoutRef.current = setTimeout(() => {
      if (reflejoRoundRef.current !== round) return;
      setReflejoPos(null);
      const fallos = reflejoFallosRef.current + 1; reflejoFallosRef.current = fallos; setReflejoFallos(fallos);
      if (fallos >= 3) { rendirse(false); return; }
      setTimeout(() => mostrarObjetivoReflejoRef.current?.(), 700);
    }, 1000);
  };
  const startReflejo = () => {
    setFase("jugando"); reflejoHitsRef.current = 0; reflejoFallosRef.current = 0;
    setReflejoHits(0); setReflejoFallos(0); setReflejoOferta(false); setReflejoPos(null);
    reflejoRoundRef.current = 0; darPremioGuardRefReflejo.current = false;
    setTimeout(() => mostrarObjetivoReflejoRef.current?.(), 800);
  };
  const handleReflejoTap = e => {
    e.stopPropagation();
    if (reflejoPos === null) return;
    if (reflejoTimeoutRef.current) clearTimeout(reflejoTimeoutRef.current);
    reflejoRoundRef.current += 1; setReflejoPos(null);
    const hits = reflejoHitsRef.current + 1; reflejoHitsRef.current = hits; setReflejoHits(hits);
    if (hits >= 25 && !darPremioGuardRefReflejo.current) { darPremioGuardRefReflejo.current = true; darPremio("sobre"); return; }
    if (hits === 12) { setReflejoOferta(true); return; }
    setTimeout(() => mostrarObjetivoReflejoRef.current?.(), 450);
  };

  // === CÁLCULO ===
  generarNuevaPreguntaRef.current = () => {
    const ops = ["+", "-", "×"];
    let texto, resultado, attempts = 0;
    do {
      const op = ops[Math.floor(Math.random() * 3)];
      if (op === "+") { const a = Math.floor(Math.random() * 49) + 1, b = Math.floor(Math.random() * 49) + 1; resultado = a + b; texto = `${a} + ${b}`; }
      else if (op === "-") { const a = Math.floor(Math.random() * 49) + 20, b = Math.floor(Math.random() * (a - 1)) + 1; resultado = a - b; texto = `${a} − ${b}`; }
      else { const a = Math.floor(Math.random() * 9) + 2, b = Math.floor(Math.random() * 9) + 2; resultado = a * b; texto = `${a} × ${b}`; }
      attempts++;
    } while ((resultado < 1 || resultado > 99) && attempts < 20);
    setCalculoQuestion({ texto, resultado }); setCalculoRespuesta(""); setCalculoFlashError(false);
  };
  handleCalculoTimeoutRef.current = () => {
    const errs = calculoErroresRef.current + 1; calculoErroresRef.current = errs; setCalculoErrores(errs);
    setCalculoFlashError(true); setTimeout(() => setCalculoFlashError(false), 600);
    if (errs >= 3) { if (calculoTimerIntervalRef.current) clearInterval(calculoTimerIntervalRef.current); rendirse(false); return; }
    const next = calculoPreguntaRef.current + 1; calculoPreguntaRef.current = next; setCalculoPregunta(next); generarNuevaPreguntaRef.current?.();
  };
  const startCalculo = () => {
    setFase("jugando"); calculoErroresRef.current = 0; calculoPreguntaRef.current = 0;
    setCalculoErrores(0); setCalculoPregunta(0); setCalculoOferta(false); setCalculoFlashError(false);
    darPremioGuardRefCalculo.current = false; generarNuevaPreguntaRef.current?.();
  };
  const handleCalculoSubmit = () => {
    if (!calculoQuestion || calculoRespuesta === "") return;
    if (calculoTimerIntervalRef.current) clearInterval(calculoTimerIntervalRef.current);
    const esCorrecta = parseInt(calculoRespuesta, 10) === calculoQuestion.resultado;
    if (!esCorrecta) {
      const errs = calculoErroresRef.current + 1; calculoErroresRef.current = errs; setCalculoErrores(errs);
      setCalculoFlashError(true); setTimeout(() => setCalculoFlashError(false), 600);
      if (errs >= 3) { rendirse(false); return; }
    }
    const next = calculoPreguntaRef.current + 1; calculoPreguntaRef.current = next;
    if (next >= 20 && !darPremioGuardRefCalculo.current) { darPremioGuardRefCalculo.current = true; darPremio("sobre"); return; }
    if (next === 10 && !calculoOferta) { setCalculoPregunta(next); setCalculoOferta(true); generarNuevaPreguntaRef.current?.(); return; }
    setCalculoPregunta(next); generarNuevaPreguntaRef.current?.();
  };

  // === PUNTERÍA ===
  const startPunteria = () => {
    setFase("jugando"); punteriaHitsRef.current = 0; punteriaFallosRef.current = 0;
    setPunteriaHits(0); setPunteriaFallos(0); setPunteriaOferta(false); darPremioGuardRefPunteria.current = false;
    const startPos = { x: 128, y: 158 };
    punteriaPosRef.current = startPos; punteriaVelRef.current = { vx: 3.5, vy: 2.5 }; setPunteriaPos(startPos);
    if (punteriaIntervalRef.current) clearInterval(punteriaIntervalRef.current);
    punteriaIntervalRef.current = setInterval(() => {
      const CONTAINER_W = 320, CONTAINER_H = 360, TARGET = 64;
      const { x, y } = punteriaPosRef.current; let { vx, vy } = punteriaVelRef.current;
      let nx = x + vx, ny = y + vy;
      if (nx <= 0) { nx = 0; vx = Math.abs(vx); } if (nx >= CONTAINER_W - TARGET) { nx = CONTAINER_W - TARGET; vx = -Math.abs(vx); }
      if (ny <= 0) { ny = 0; vy = Math.abs(vy); } if (ny >= CONTAINER_H - TARGET) { ny = CONTAINER_H - TARGET; vy = -Math.abs(vy); }
      punteriaPosRef.current = { x: nx, y: ny }; punteriaVelRef.current = { vx, vy }; setPunteriaPos({ x: nx, y: ny });
    }, 40);
  };
  const handleDianaTap = e => {
    e.stopPropagation(); if (punteriaOferta) return;
    const hits = punteriaHitsRef.current + 1; punteriaHitsRef.current = hits; setPunteriaHits(hits);
    const vel = punteriaVelRef.current; const speed = Math.hypot(vel.vx, vel.vy);
    const ratio = Math.min(speed * 1.07, 14) / speed;
    punteriaVelRef.current = { vx: vel.vx * ratio, vy: vel.vy * ratio };
    if (hits >= 20 && !darPremioGuardRefPunteria.current) { darPremioGuardRefPunteria.current = true; clearInterval(punteriaIntervalRef.current); darPremio("sobre"); return; }
    if (hits === 10) { clearInterval(punteriaIntervalRef.current); setPunteriaOferta(true); }
  };
  const handleAreaTap = () => {
    if (punteriaOferta) return;
    const fallos = punteriaFallosRef.current + 1; punteriaFallosRef.current = fallos; setPunteriaFallos(fallos);
    if (fallos >= 3) { clearInterval(punteriaIntervalRef.current); rendirse(false); }
  };

  const formatTime = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  const startGame = () => {
    const id = torturaHoy?.id;
    if      (id === "contador") startContador();
    else if (id === "espera")   startEspera();
    else if (id === "texto")    startTexto();
    else if (id === "reflejo")  startReflejo();
    else if (id === "calculo")  startCalculo();
    else if (id === "punteria") startPunteria();
  };

  if (loading) return <div className="hv-app hv-loading"><span>Cargando…</span></div>;

  const torturaActualSorteo = TORTURAS[sorteoActual];

  return (
    <div className="hv-app hv-page">
      <div className="hv-content">
        <div className="hv-screen">

          {/* ── Header ── */}
          <div className="hv-shead" style={{ paddingTop: 16 }}>
            <div>
              <div className="hv-kicker">Álbum Yeissy</div>
              <h1 className="hv-h1">😈 Tortura</h1>
            </div>
            <button className="hv-x" onClick={() => router.push("/conseguir-hv")} style={{ marginTop: 10 }}>✕</button>
          </div>

          {/* ════ SORTEO PENDIENTE ════ */}
          {sorteoPendiente && !yaHechaHoy && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, paddingTop: 12 }}>

              {sorteoFase === "esperando" && (
                <>
                  <p style={{ fontSize: "3rem", margin: 0 }}>🎰</p>
                  <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: ".18em", color: "var(--muted)", textAlign: "center" }}>
                    NADIE HA GIRADO HOY
                  </p>
                  <p style={{ fontSize: 13, color: "var(--muted)", textAlign: "center", maxWidth: 260 }}>
                    El primero en girar elige la tortura para todos los jugadores.
                  </p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", maxWidth: 320 }}>
                    {TORTURAS.map(t => (
                      <div key={t.id} style={{
                        background: `${t.color}18`, border: `1px solid ${t.color}44`,
                        borderRadius: 10, padding: "6px 12px", fontSize: 12, color: t.color, fontWeight: 700,
                      }}>{t.emoji} {t.nombre}</div>
                    ))}
                  </div>
                  <button className="hv-btn primary" style={{ maxWidth: 280, marginTop: 8 }} onClick={iniciarSorteo}>
                    🎰 Girar la ruleta
                  </button>
                </>
              )}

              {sorteoFase === "girando" && (
                <>
                  <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: ".18em", color: "var(--accent)", animation: "tapPulse .8s infinite" }}>
                    SORTEANDO…
                  </p>
                  <div key={sorteoActual} style={{
                    background: "linear-gradient(145deg, var(--surface), var(--bg))",
                    borderRadius: 18, padding: "28px 24px", maxWidth: 260, width: "100%",
                    border: `1.5px solid ${torturaActualSorteo.color}`,
                    boxShadow: `0 0 28px -6px ${torturaActualSorteo.color}`,
                    textAlign: "center", animation: "burstIn .1s ease",
                  }}>
                    <p style={{ fontSize: "3.5rem", margin: "0 0 8px" }}>{torturaActualSorteo.emoji}</p>
                    <p style={{ fontFamily: "var(--head-font)", fontWeight: 700, fontSize: 18, color: torturaActualSorteo.color, margin: "0 0 6px" }}>
                      {torturaActualSorteo.nombre}
                    </p>
                    <p style={{ fontSize: 11, color: "var(--muted)", margin: 0 }}>{torturaActualSorteo.descripcion}</p>
                  </div>
                </>
              )}

              {sorteoFase === "revelado" && torturaHoy && (
                <>
                  <p style={{ fontFamily: "var(--head-font)", fontWeight: 700, fontSize: 14, color: "oklch(0.83 0.13 85)", letterSpacing: ".2em" }}>
                    ✨ ¡HA SALIDO! ✨
                  </p>
                  <div style={{
                    background: "linear-gradient(145deg, var(--surface), var(--bg))",
                    borderRadius: 20, padding: "32px 24px", maxWidth: 280, width: "100%",
                    border: `2px solid ${torturaHoy.color}`,
                    boxShadow: `0 0 50px -8px ${torturaHoy.color}`,
                    textAlign: "center",
                  }}>
                    <p style={{ fontSize: "4rem", margin: "0 0 10px" }}>{torturaHoy.emoji}</p>
                    <p style={{ fontFamily: "var(--head-font)", fontWeight: 700, fontSize: 22, color: torturaHoy.color, margin: "0 0 8px" }}>
                      {torturaHoy.nombre}
                    </p>
                    <p style={{ fontSize: 12, color: "var(--muted)", margin: 0 }}>{torturaHoy.descripcion}</p>
                  </div>
                  <p style={{ fontSize: 11, color: "var(--muted)", fontStyle: "italic" }}>Preparando la tortura…</p>
                </>
              )}
            </div>
          )}

          {/* ════ YA HECHA HOY ════ */}
          {yaHechaHoy && fase !== "premio" && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, paddingTop: 20, textAlign: "center" }}>
              <p style={{ fontSize: "3rem", margin: 0 }}>😈</p>
              <h2 style={{ fontFamily: "var(--head-font)", fontWeight: 700, fontSize: 22, color: "#ef4444", margin: 0 }}>
                Ya has sufrido suficiente
              </h2>
              <p style={{ fontSize: 13, color: "var(--muted)", fontStyle: "italic" }}>¿De verdad crees que puedes con más?</p>
              <div style={{
                background: "var(--bg2)", border: "1px solid var(--line)",
                borderRadius: 16, padding: "24px 20px", width: "100%", maxWidth: 280,
              }}>
                <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: ".12em", color: "var(--muted)", marginBottom: 10 }}>
                  PRÓXIMO SUFRIMIENTO EN
                </p>
                <p style={{ fontFamily: "var(--head-font)", fontSize: 32, fontWeight: 700, color: "#ef4444", margin: 0, letterSpacing: ".1em" }}>
                  {countdown}
                </p>
              </div>
            </div>
          )}

          {/* ════ INTRO ════ */}
          {!yaHechaHoy && !sorteoPendiente && fase === "intro" && torturaHoy && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, paddingTop: 12 }}>
              <div style={{
                width: "100%", background: "linear-gradient(145deg, var(--surface), var(--bg2))",
                borderRadius: 20, padding: "28px 20px", border: `1.5px solid ${torturaHoy.color}`,
                boxShadow: `0 0 30px -10px ${torturaHoy.color}`, textAlign: "center",
              }}>
                <span style={{ fontSize: "3.5rem" }}>{torturaHoy.emoji}</span>
                <h2 style={{ fontFamily: "var(--head-font)", fontWeight: 700, fontSize: 22, margin: "14px 0 8px" }}>
                  {torturaHoy.nombre}
                </h2>
                <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 20 }}>{torturaHoy.descripcion}</p>

                {/* Premio split */}
                <div style={{
                  background: "var(--bg)", borderRadius: 12, padding: "12px 16px",
                  display: "flex", justifyContent: "space-around", marginBottom: 20,
                }}>
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

                <button className="hv-btn primary" onClick={startGame}>😈 Empezar tortura</button>
              </div>
            </div>
          )}

          {/* ════ CONTADOR ════ */}
          {fase === "jugando" && torturaHoy?.id === "contador" && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, paddingTop: 8 }}>
              <div className="hv-shead" style={{ width: "100%", padding: 0 }}>
                <div>
                  <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: ".14em", color: "var(--muted)", margin: 0 }}>🔢 EL CONTADOR</p>
                  <p style={{ fontSize: 11, color: "var(--muted)", margin: "4px 0 0" }}>⚠️ Si paras 3s vuelve a 0</p>
                </div>
              </div>
              <p style={{
                fontFamily: "var(--head-font)", fontWeight: 700, fontSize: 64, margin: 0, lineHeight: 1,
                color: contadorTaps >= 400 ? "#10b981" : contadorTaps >= 200 ? "#f59e0b" : "#ef4444",
              }}>{contadorTaps}</p>
              <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: "var(--muted)", margin: 0 }}>/ 500</p>
              <div style={{ width: "100%", height: 10, background: "var(--bg2)", borderRadius: 99, overflow: "hidden", boxShadow: "inset 0 0 0 1px var(--line)" }}>
                <div style={{
                  width: `${(contadorTaps / 500) * 100}%`, height: "100%", borderRadius: 99, transition: "width .1s",
                  background: contadorTaps >= 400 ? "#10b981" : contadorTaps >= 200 ? "#f59e0b" : "#ef4444",
                }} />
              </div>
              {contadorOferta ? (
                <div style={{ width: "100%", background: "var(--bg2)", borderRadius: 14, padding: 16, border: "1px solid #f59e0b" }}>
                  <p style={{ fontWeight: 700, fontSize: 14, textAlign: "center", marginBottom: 12 }}>200 taps. ¿Te rindes?</p>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button className="hv-btn ghost" style={{ flex: 1 }} onClick={() => rendirse(true)}>😮‍💨 2 cromos +5🪙</button>
                    <button className="hv-btn primary" style={{ flex: 1 }} onClick={() => setContadorOferta(false)}>💪 Seguir ({500 - contadorTaps})</button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={handleTap}
                  style={{
                    width: 180, height: 180, borderRadius: "50%", border: "none",
                    fontFamily: "var(--head-font)", fontWeight: 700, fontSize: 22,
                    cursor: "pointer", color: "#06121a", background: "#ef4444",
                    boxShadow: "0 8px 28px -4px rgba(239,68,68,.55)",
                    userSelect: "none", WebkitUserSelect: "none", flexShrink: 0,
                  }}
                  onPointerDown={e => e.currentTarget.style.transform = "scale(.92)"}
                  onPointerUp={e => e.currentTarget.style.transform = "scale(1)"}
                >TAP</button>
              )}
            </div>
          )}

          {/* ════ ESPERA ════ */}
          {fase === "jugando" && torturaHoy?.id === "espera" && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, paddingTop: 8 }}>
              <div style={{ textAlign: "center" }}>
                <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: ".14em", color: "var(--muted)", margin: 0 }}>🌀 LA ESPERA</p>
                <p style={{ fontSize: 11, color: "var(--muted)", margin: "4px 0 0" }}>⚠️ Si sueltas vuelve a 0</p>
              </div>
              <p style={{
                fontFamily: "var(--head-font)", fontWeight: 700, fontSize: 52, margin: 0, lineHeight: 1,
                color: esperaTime >= 120 ? "#10b981" : esperaTime >= 60 ? "#f59e0b" : "#ef4444",
              }}>{formatTime(esperaTime)}</p>
              <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: "var(--muted)", margin: 0 }}>/ {formatTime(180)}</p>
              <div style={{ width: "100%", height: 10, background: "var(--bg2)", borderRadius: 99, overflow: "hidden", boxShadow: "inset 0 0 0 1px var(--line)" }}>
                <div style={{
                  width: `${(esperaTime / 180) * 100}%`, height: "100%", borderRadius: 99, transition: "width 1s linear",
                  background: esperaTime >= 120 ? "#10b981" : esperaTime >= 60 ? "#f59e0b" : "#ef4444",
                }} />
              </div>
              {esperaOferta && !esperaPulsado && (
                <div style={{ width: "100%", background: "var(--bg2)", borderRadius: 14, padding: 16, border: "1px solid #f59e0b" }}>
                  <p style={{ fontWeight: 700, fontSize: 14, textAlign: "center", marginBottom: 12 }}>1 minuto aguantado. ¿Te rindes?</p>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button className="hv-btn ghost" style={{ flex: 1 }} onClick={() => rendirse(true)}>😮‍💨 2 cromos +5🪙</button>
                    <button className="hv-btn primary" style={{ flex: 1 }} onClick={() => setEsperaOferta(false)}>💪 Seguir</button>
                  </div>
                </div>
              )}
              {!(esperaOferta && !esperaPulsado) && (
                <button
                  onPointerDown={esperaDown} onPointerUp={esperaUp} onPointerLeave={esperaUp}
                  style={{
                    width: 180, height: 180, borderRadius: "50%", border: "none",
                    fontFamily: "var(--head-font)", fontWeight: 700, fontSize: 16,
                    cursor: "pointer", color: esperaPulsado ? "#06121a" : "var(--text)",
                    background: esperaPulsado ? "#10b981" : "var(--surface)",
                    boxShadow: esperaPulsado ? "0 0 30px rgba(16,185,129,.5)" : "inset 0 0 0 1.5px var(--line)",
                    transition: "all .2s", userSelect: "none", WebkitUserSelect: "none", flexShrink: 0,
                  }}
                >{esperaPulsado ? "AGUANTA…" : "PULSA Y\nMANTÉN"}</button>
              )}
              {!esperaPulsado && esperaTime > 0 && !esperaOferta && (
                <p style={{ color: "#ef4444", fontSize: 13, fontWeight: 700, textAlign: "center" }}>¡Has soltado! Vuelve a empezar 😈</p>
              )}
            </div>
          )}

          {/* ════ TEXTO ════ */}
          {fase === "jugando" && torturaHoy?.id === "texto" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingTop: 8 }}>
              <div style={{ textAlign: "center" }}>
                <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: ".14em", color: "var(--muted)", margin: 0 }}>📝 EL TEXTO</p>
                <p style={{ fontSize: 12, color: "var(--muted)", margin: "4px 0 0" }}>
                  {"❤️".repeat(textoIntentos)}{"🖤".repeat(3 - textoIntentos)} · Copiar/pegar bloqueado
                </p>
              </div>
              <div style={{
                background: "var(--bg2)", borderRadius: 12, padding: 14,
                border: "1px solid var(--line)", fontSize: 12, lineHeight: 1.6,
                color: "var(--text)", userSelect: "none", WebkitUserSelect: "none",
              }}>{textoObjetivo}</div>
              <textarea
                value={textoInput}
                onChange={e => { setTextoInput(e.target.value); if (textoError) { setTextoError(false); setTextoErrorDetalle(""); } }}
                onPaste={e => e.preventDefault()}
                placeholder="Escribe el texto aquí…"
                style={{
                  width: "100%", minHeight: 140, padding: 14, borderRadius: 12,
                  border: `1.5px solid ${textoError ? "#ef4444" : "var(--line)"}`,
                  background: "var(--bg)", color: "var(--text)", fontSize: 12,
                  lineHeight: 1.6, resize: "vertical", fontFamily: "inherit",
                  boxSizing: "border-box",
                }}
              />
              {textoError && (
                <div style={{ background: "var(--bg2)", borderRadius: 10, padding: "10px 14px", border: "1px solid #ef4444" }}>
                  <p style={{ color: "#ef4444", margin: 0, fontWeight: 700, fontSize: 12 }}>❌ {textoErrorDetalle}</p>
                  {textoIntentos > 0 && <p style={{ color: "var(--muted)", fontSize: 11, margin: "4px 0 0" }}>{textoIntentos} intento{textoIntentos !== 1 ? "s" : ""} restante{textoIntentos !== 1 ? "s" : ""}</p>}
                </div>
              )}
              <div style={{ display: "flex", gap: 10 }}>
                <button className="hv-btn ghost" style={{ flex: 1 }} onClick={() => rendirse(true)}>😮‍💨 Rendirme</button>
                <button className="hv-btn primary" style={{ flex: 1 }} onClick={handleTextoSubmit}>✅ Comprobar</button>
              </div>
            </div>
          )}

          {/* ════ REFLEJO ════ */}
          {fase === "jugando" && torturaHoy?.id === "reflejo" && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, paddingTop: 8 }}>
              <div style={{ textAlign: "center" }}>
                <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: ".14em", color: "var(--muted)", margin: 0 }}>⚡ EL REFLEJO</p>
                <p style={{ fontSize: 12, color: "var(--muted)", margin: "4px 0 0" }}>
                  {reflejoHits}/25 hits · 3 fallos = game over · Fallos: {"❤️".repeat(3 - Math.min(reflejoFallos, 3))}{"🖤".repeat(Math.min(reflejoFallos, 3))}
                </p>
              </div>
              {reflejoOferta ? (
                <div style={{ width: "100%", background: "var(--bg2)", borderRadius: 14, padding: 16, border: "1px solid #f59e0b" }}>
                  <p style={{ fontWeight: 700, fontSize: 14, textAlign: "center", marginBottom: 12 }}>12 taps. ¿Te rindes?</p>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button className="hv-btn ghost" style={{ flex: 1 }} onClick={() => rendirse(true)}>😮‍💨 2 cromos +5🪙</button>
                    <button className="hv-btn primary" style={{ flex: 1 }} onClick={() => { setReflejoOferta(false); setTimeout(() => mostrarObjetivoReflejoRef.current?.(), 400); }}>💪 Seguir</button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={handleAreaTap}
                  style={{
                    width: "100%", maxWidth: 320, height: 320,
                    background: "var(--bg2)", borderRadius: 16, position: "relative",
                    border: "1.5px solid var(--line)", overflow: "hidden", cursor: "crosshair",
                    touchAction: "none",
                  }}
                >
                  {reflejoPos ? (
                    <button
                      onClick={handleReflejoTap}
                      style={{
                        position: "absolute", left: reflejoPos.x, top: reflejoPos.y,
                        width: 64, height: 64, borderRadius: "50%", border: "none",
                        background: "#f59e0b", color: "#06121a", fontWeight: 700, fontSize: 22,
                        cursor: "pointer", boxShadow: "0 0 20px rgba(245,158,11,.7)",
                        touchAction: "none",
                        animation: "tapPulse .8s ease-out",
                      }}
                    >⚡</button>
                  ) : (
                    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "var(--muted)", letterSpacing: ".1em" }}>Espera…</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ════ CÁLCULO ════ */}
          {fase === "jugando" && torturaHoy?.id === "calculo" && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, paddingTop: 8 }}>
              <div style={{ textAlign: "center" }}>
                <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: ".14em", color: "var(--muted)", margin: 0 }}>🧮 EL CÁLCULO</p>
                <p style={{ fontSize: 12, color: "var(--muted)", margin: "4px 0 0" }}>
                  {calculoPregunta}/20 · Errores: {"❤️".repeat(3 - Math.min(calculoErrores, 3))}{"🖤".repeat(Math.min(calculoErrores, 3))} · ⏱ {calculoTimer}s
                </p>
              </div>
              {calculoOferta ? (
                <div style={{ width: "100%", background: "var(--bg2)", borderRadius: 14, padding: 16, border: "1px solid #f59e0b" }}>
                  <p style={{ fontWeight: 700, fontSize: 14, textAlign: "center", marginBottom: 12 }}>Mitad hecha. ¿Te rindes?</p>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button className="hv-btn ghost" style={{ flex: 1 }} onClick={() => rendirse(true)}>😮‍💨 2 cromos +5🪙</button>
                    <button className="hv-btn primary" style={{ flex: 1 }} onClick={() => { setCalculoOferta(false); }}>💪 Seguir</button>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{
                    width: "100%", background: calculoFlashError ? "color-mix(in oklch, #ef4444 15%, var(--bg2))" : "var(--bg2)",
                    borderRadius: 14, padding: "20px 14px", textAlign: "center",
                    border: `1.5px solid ${calculoFlashError ? "#ef4444" : "var(--line)"}`, transition: "all .15s",
                  }}>
                    <p style={{ fontFamily: "var(--head-font)", fontWeight: 700, fontSize: 36, margin: 0 }}>
                      {calculoQuestion?.texto ?? ""}
                    </p>
                    <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, fontSize: 28, margin: "10px 0 0", color: "var(--accent)", minHeight: 40 }}>
                      {calculoRespuesta || "…"}
                    </p>
                  </div>
                  {/* Numpad */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, width: "100%", maxWidth: 240 }}>
                    {[["7","8","9"],["4","5","6"],["1","2","3"],["⌫","0","✓"]].flat().map(k => (
                      <button key={k}
                        onClick={() => {
                          if (k === "⌫") setCalculoRespuesta(p => p.slice(0, -1));
                          else if (k === "✓") handleCalculoSubmit();
                          else setCalculoRespuesta(p => p.length >= 3 ? p : p + k);
                        }}
                        style={{
                          padding: "16px 8px", borderRadius: 10, border: "1px solid var(--line)",
                          background: k === "✓" ? "var(--accent)" : "var(--bg2)",
                          color: k === "✓" ? "#06121a" : "var(--text)",
                          fontFamily: "var(--head-font)", fontWeight: 700, fontSize: 18, cursor: "pointer",
                        }}
                      >{k}</button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ════ PUNTERÍA ════ */}
          {fase === "jugando" && torturaHoy?.id === "punteria" && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, paddingTop: 8 }}>
              <div style={{ textAlign: "center" }}>
                <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: ".14em", color: "var(--muted)", margin: 0 }}>🎯 LA PUNTERÍA</p>
                <p style={{ fontSize: 12, color: "var(--muted)", margin: "4px 0 0" }}>
                  {punteriaHits}/20 hits · Fallos: {"❤️".repeat(3 - Math.min(punteriaFallos, 3))}{"🖤".repeat(Math.min(punteriaFallos, 3))}
                </p>
              </div>
              {punteriaOferta ? (
                <div style={{ width: "100%", background: "var(--bg2)", borderRadius: 14, padding: 16, border: "1px solid #f59e0b" }}>
                  <p style={{ fontWeight: 700, fontSize: 14, textAlign: "center", marginBottom: 12 }}>10 hits. ¿Te rindes?</p>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button className="hv-btn ghost" style={{ flex: 1 }} onClick={() => rendirse(true)}>😮‍💨 2 cromos +5🪙</button>
                    <button className="hv-btn primary" style={{ flex: 1 }} onClick={() => { setPunteriaOferta(false); startPunteria(); }}>💪 Seguir</button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={handleAreaTap}
                  style={{
                    width: "100%", maxWidth: 320, height: 320,
                    background: "var(--bg2)", borderRadius: 16, position: "relative",
                    border: "1.5px solid var(--line)", overflow: "hidden",
                    cursor: "crosshair", touchAction: "none",
                  }}
                >
                  <button
                    onClick={handleDianaTap}
                    style={{
                      position: "absolute", left: punteriaPos.x, top: punteriaPos.y,
                      width: 64, height: 64, borderRadius: "50%", border: "none",
                      background: "#ec4899", color: "#06121a", fontWeight: 700, fontSize: 22,
                      cursor: "pointer", boxShadow: "0 0 20px rgba(236,72,153,.6)",
                      touchAction: "none",
                    }}
                  >🎯</button>
                </div>
              )}
            </div>
          )}

          {/* ════ PREMIO ════ */}
          {fase === "premio" && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, paddingTop: 12 }}>
              <p style={{ fontFamily: "var(--head-font)", fontWeight: 700, fontSize: 32, margin: 0 }}>
                {premio === "sobre" ? "🎉" : "😮‍💨"}
              </p>
              <h2 style={{ fontFamily: "var(--head-font)", fontWeight: 700, fontSize: 22, margin: 0, textAlign: "center" }}>
                {premio === "sobre" ? "¡Tortura superada!" : "Te has rendido"}
              </h2>
              <p style={{ fontSize: 13, color: "var(--muted)", textAlign: "center" }}>
                {premio === "sobre" ? "Has ganado un sobre bonus + 10🪙" : "Recibes 2 cromos aleatorios + 5🪙"}
              </p>
              {premio === "cromos" && cromosGanados.length > 0 && (
                <div className="hv-loot">
                  {cromosGanados.map((c, i) => (
                    <div key={i} className="hv-loot-card" style={{ "--rc": c.rareza === "legendaria" ? "oklch(0.83 0.13 85)" : c.rareza === "rara" ? "oklch(0.76 0.15 230)" : "oklch(0.74 0.03 265)" }}>
                      <img src={c.imagen} alt={c.nombre} className="hv-loot-img" />
                      <div className="hv-loot-name">{c.nombre}</div>
                    </div>
                  ))}
                </div>
              )}
              <button className="hv-btn primary" onClick={() => router.push("/sobre-hv")}>
                {premio === "sobre" ? "Abrir sobre 📦" : "Ver cromos 👀"}
              </button>
              <button className="hv-btn ghost" onClick={() => router.push("/conseguir-hv")}>
                Volver
              </button>
            </div>
          )}

          <div className="hv-screen-pad" />
        </div>
      </div>
      <HvBottomNav />
    </div>
  );
}
