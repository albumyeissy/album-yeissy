"use client";
import { useState, useEffect, useRef } from "react";
import { auth, db } from "../../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc, runTransaction } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { CROMOS } from "../../data/cromos";
import { addFeedEvent } from "../../lib/feedHelper";

// Cada tortura tiene un color identificativo que se usa en el sorteo
const TORTURAS = [
  { id: "contador", nombre: "El Contador", emoji: "🔢", descripcion: "Pulsa 500 veces sin parar",                           color: "#ef4444" },
  { id: "espera",   nombre: "La Espera",   emoji: "🌀", descripcion: "Mantén pulsado 3 minutos",                            color: "#3b82f6" },
  { id: "texto",    nombre: "El Texto",    emoji: "📝", descripcion: "Escribe el texto sin errores",                        color: "#8b5cf6" },
  { id: "reflejo",  nombre: "El Reflejo",  emoji: "⚡", descripcion: "Toca el botón antes de que desaparezca · 25 veces",  color: "#f59e0b" },
  { id: "calculo",  nombre: "El Cálculo",  emoji: "🧮", descripcion: "Resuelve 20 operaciones en 4 segundos cada una",     color: "#10b981" },
  { id: "punteria", nombre: "La Puntería", emoji: "🎯", descripcion: "Toca el círculo en movimiento · 20 veces",           color: "#ec4899" },
];

const TEXTOS_TORTURA = [
  "Yo declaro solemnemente que soy el peor jugador de este grupo y que todos mis amigos son superiores a mí en absolutamente todos los aspectos de la vida. Reconozco que mis cromos son basura comparados con los suyos y que nunca completaré este álbum porque soy un desastre total y absoluto. Firmo esta declaración bajo juramento sabiendo que todos se reirán de mí.",
  "Por la presente certifico que soy un completo inútil abriendo sobres y que la suerte me odia profundamente. Cada vez que abro un sobre me salen repetidos porque el universo conspira contra mí. Mis amigos tienen mejor gusto eligiendo cromos y yo debería dedicarme a otra cosa. Este texto es mi penitencia y la acepto con resignación.",
  "Queridos compañeros del álbum, escribo estas líneas para confesar que soy el eslabón más débil del grupo. Mis repetidos son tantos que podría empapelar una habitación entera con ellos. No merezco las legendarias que tengo y probablemente las conseguí de pura chiripa. Prometo seguir sufriendo estas torturas porque necesito desesperadamente más cromos.",
];

export default function TorturaPage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [datosUsuario, setDatosUsuario] = useState(null);
  const [yaHechaHoy, setYaHechaHoy] = useState(false);
  const [torturaHoy, setTorturaHoy] = useState(null);
  const [fase, setFase] = useState("intro");
  const [premio, setPremio] = useState(null);
  const [cromosGanados, setCromosGanados] = useState([]);
  const [countdown, setCountdown] = useState("");

  // ── Sorteo diario (compartido entre todos los jugadores) ─────────
  // sorteoPendiente = true mientras nadie haya girado la ruleta hoy
  const [sorteoPendiente, setSorteoPendiente] = useState(true);
  // "esperando" → jugador ve el botón "Girar"
  // "girando"   → animación en curso
  // "revelado"  → resultado visible antes de pasar al intro
  const [sorteoFase, setSorteoFase] = useState("esperando");
  const [sorteoActual, setSorteoActual] = useState(0); // índice mostrado durante el giro
  const sorteoTimeoutsRef = useRef([]); // cleanup al desmontar

  useEffect(() => {
    const update = () => {
      const now = new Date();
      const tom = new Date(now);
      tom.setDate(tom.getDate() + 1);
      tom.setHours(0, 0, 0, 0);
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

  // ── Video states ─────────────────────────────────────────────────
  const [videoTime, setVideoTime] = useState(0);
  const [videoDuration] = useState(180);
  const [videoOferta, setVideoOferta] = useState(false);
  const videoRef = useRef(null);
  const videoIntervalRef = useRef(null);

  // ── Contador states ──────────────────────────────────────────────
  const [contadorTaps, setContadorTaps] = useState(0);
  const [contadorOferta, setContadorOferta] = useState(false);
  const contadorTimeoutRef = useRef(null);
  const contadorTapsRef = useRef(0);
  const contadorOfertaMostradaRef = useRef(false);
  const darPremioGuardRef = useRef(false);

  // ── Espera states ────────────────────────────────────────────────
  const [esperaTime, setEsperaTime] = useState(0);
  const [esperaPulsado, setEsperaPulsado] = useState(false);
  const [esperaOferta, setEsperaOferta] = useState(false);
  const esperaIntervalRef = useRef(null);

  // ── Texto states ─────────────────────────────────────────────────
  const [textoObjetivo, setTextoObjetivo] = useState("");
  const [textoInput, setTextoInput] = useState("");
  const [textoIntentos, setTextoIntentos] = useState(3);
  const [textoError, setTextoError] = useState(false);
  const [textoErrorDetalle, setTextoErrorDetalle] = useState("");

  // ── Reflejo states ───────────────────────────────────────────────
  const [reflejoHits, setReflejoHits] = useState(0);
  const [reflejoFallos, setReflejoFallos] = useState(0);
  const [reflejoPos, setReflejoPos] = useState(null);
  const [reflejoOferta, setReflejoOferta] = useState(false);
  const reflejoHitsRef = useRef(0);
  const reflejoFallosRef = useRef(0);
  const reflejoTimeoutRef = useRef(null);
  const reflejoRoundRef = useRef(0);
  const darPremioGuardRefReflejo = useRef(false);
  const mostrarObjetivoReflejoRef = useRef(null);

  // ── Cálculo states ───────────────────────────────────────────────
  const [calculoPregunta, setCalculoPregunta] = useState(0);
  const [calculoErrores, setCalculoErrores] = useState(0);
  const [calculoRespuesta, setCalculoRespuesta] = useState("");
  const [calculoQuestion, setCalculoQuestion] = useState(null);
  const [calculoTimer, setCalculoTimer] = useState(4);
  const [calculoOferta, setCalculoOferta] = useState(false);
  const [calculoFlashError, setCalculoFlashError] = useState(false);
  const calculoErroresRef = useRef(0);
  const calculoPreguntaRef = useRef(0);
  const calculoTimerIntervalRef = useRef(null);
  const handleCalculoTimeoutRef = useRef(null);
  const generarNuevaPreguntaRef = useRef(null);
  const darPremioGuardRefCalculo = useRef(false);

  // ── Puntería states ──────────────────────────────────────────────
  const [punteriaHits, setPunteriaHits] = useState(0);
  const [punteriaFallos, setPunteriaFallos] = useState(0);
  const [punteriaOferta, setPunteriaOferta] = useState(false);
  const [punteriaPos, setPunteriaPos] = useState({ x: 128, y: 148 });
  const punteriaHitsRef = useRef(0);
  const punteriaFallosRef = useRef(0);
  const punteriaPosRef = useRef({ x: 128, y: 148 });
  const punteriaVelRef = useRef({ vx: 3.5, vy: 2.5 });
  const punteriaIntervalRef = useRef(null);
  const darPremioGuardRefPunteria = useRef(false);

  const router = useRouter();
  const HOY = new Date().toLocaleDateString("en-CA");

  // Carga inicial: auth + datos de usuario + tortura del día
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        try {
          const [userSnap, configSnap] = await Promise.all([
            getDoc(doc(db, "usuarios", u.uid)),
            getDoc(doc(db, "config", "torturaDelDia")),
          ]);

          if (userSnap.exists()) {
            const data = userSnap.data();
            setDatosUsuario(data);
            setYaHechaHoy(data.fechaTortura === HOY);
          } else {
            setDatosUsuario({ cromos: [] });
          }

          // Texto del día (para la tortura "El Texto")
          const dayOfYear = Math.floor(
            (Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000
          );
          setTextoObjetivo(TEXTOS_TORTURA[dayOfYear % TEXTOS_TORTURA.length]);

          // ¿Ya se sorteó la tortura hoy?
          if (configSnap.exists() && configSnap.data().fecha === HOY && configSnap.data().torturaId) {
            const tortura = TORTURAS.find((t) => t.id === configSnap.data().torturaId);
            if (tortura) {
              setTorturaHoy(tortura);
              setSorteoPendiente(false);
            } else {
              setSorteoPendiente(true); // id desconocido, volver a sortear
            }
          } else {
            setSorteoPendiente(true); // nadie ha girado hoy
          }
        } catch (err) {
          setDatosUsuario({ cromos: [] });
          setSorteoPendiente(true);
        }
      } else {
        router.push("/");
      }
      setLoading(false);
    });
    return () => unsub();
  }, [router, HOY]);

  // Cleanup al desmontar
  useEffect(() => {
    return () => {
      sorteoTimeoutsRef.current.forEach(clearTimeout);
      if (videoIntervalRef.current) clearInterval(videoIntervalRef.current);
      if (contadorTimeoutRef.current) clearTimeout(contadorTimeoutRef.current);
      if (esperaIntervalRef.current) clearInterval(esperaIntervalRef.current);
      if (reflejoTimeoutRef.current) clearTimeout(reflejoTimeoutRef.current);
      if (calculoTimerIntervalRef.current) clearInterval(calculoTimerIntervalRef.current);
      if (punteriaIntervalRef.current) clearInterval(punteriaIntervalRef.current);
    };
  }, []);

  // Contador reset a los 3s de inactividad
  useEffect(() => {
    if (fase !== "jugando" || torturaHoy?.id !== "contador") return;
    if (contadorTimeoutRef.current) clearTimeout(contadorTimeoutRef.current);
    contadorTimeoutRef.current = setTimeout(() => {
      const taps = contadorTapsRef.current;
      if (taps > 0 && taps < 500 && !contadorOfertaMostradaRef.current) {
        contadorTapsRef.current = 0;
        setContadorTaps(0);
      }
    }, 3000);
  }, [contadorTaps, fase, torturaHoy]);

  // Cálculo: timer se reinicia con cada nueva pregunta
  useEffect(() => {
    if (fase !== "jugando" || torturaHoy?.id !== "calculo" || calculoOferta) return;
    if (calculoTimerIntervalRef.current) clearInterval(calculoTimerIntervalRef.current);
    setCalculoTimer(4);
    const iv = setInterval(() => {
      setCalculoTimer((t) => {
        if (t <= 1) {
          clearInterval(iv);
          setTimeout(() => handleCalculoTimeoutRef.current?.(), 0);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    calculoTimerIntervalRef.current = iv;
    return () => clearInterval(iv);
  }, [calculoPregunta, fase, torturaHoy?.id, calculoOferta]);

  // === SORTEO ===
  /**
   * Obtiene (o determina) la tortura del día de forma atómica.
   * Si ya fue seleccionada por otro jugador hoy, devuelve la misma.
   * Si somos los primeros, elegimos una aleatoria y la guardamos.
   */
  const determinarTorturaFirestore = async () => {
    const configRef = doc(db, "config", "torturaDelDia");
    let ganadorId = null;
    try {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(configRef);
        if (snap.exists() && snap.data().fecha === HOY && snap.data().torturaId) {
          // Ya elegida por otro jugador
          ganadorId = snap.data().torturaId;
          return;
        }
        // Somos los primeros: elegimos aleatoriamente
        const idx = Math.floor(Math.random() * TORTURAS.length);
        ganadorId = TORTURAS[idx].id;
        tx.set(configRef, {
          fecha: HOY,
          torturaId: ganadorId,
          seleccionadaEn: new Date().toISOString(),
        });
      });
    } catch (err) {
      console.error("Error en sorteo:", err);
      // Fallback local si Firestore falla
      ganadorId = TORTURAS[Math.floor(Math.random() * TORTURAS.length)].id;
    }
    return ganadorId;
  };

  const iniciarSorteo = async () => {
    setSorteoFase("girando");

    // Determinar ganador (rápido, < 500ms normalmente)
    const ganadorId = await determinarTorturaFirestore();
    const ganadorIndex = TORTURAS.findIndex((t) => t.id === ganadorId);

    // Secuencia de índices: giro rápido que frena y aterriza en el ganador
    const TOTAL = 18;
    const secuencia = [];
    for (let i = 0; i < TOTAL; i++) {
      secuencia.push(i % TORTURAS.length);
    }
    secuencia[TOTAL - 1] = ganadorIndex; // el último siempre es el ganador

    // Retrasos con deceleración cuadrática: rápido al principio, lento al final
    // Duración total ≈ 3 segundos
    const MIN_DELAY = 65;
    const MAX_DELAY = 480;
    let totalDelay = 0;
    sorteoTimeoutsRef.current.forEach(clearTimeout);
    sorteoTimeoutsRef.current = [];

    secuencia.forEach((idx, i) => {
      const progress = i / (TOTAL - 1);
      const delay = Math.round(MIN_DELAY + (MAX_DELAY - MIN_DELAY) * Math.pow(progress, 2));
      totalDelay += delay;

      const t = setTimeout(() => {
        setSorteoActual(idx);

        if (i === TOTAL - 1) {
          // Aterrizaje: esperar 300ms y mostrar el revelado
          const ganadorTortura = TORTURAS[ganadorIndex];
          setTorturaHoy(ganadorTortura);

          const t2 = setTimeout(() => {
            setSorteoFase("revelado");
            // Auto-pasar al intro tras 2.8s
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
      const pool = CROMOS.filter((c) => c.rareza === rareza);
      if (pool.length > 0) cromos.push(pool[Math.floor(Math.random() * pool.length)]);
    }
    return cromos;
  };

  const darPremio = async (tipo) => {
    let freshSobresBonus = datosUsuario?.sobresBonus || 0;
    try {
      await runTransaction(db, async (transaction) => {
        const userRef = doc(db, "usuarios", user.uid);
        const snap = await transaction.get(userRef);
        if (!snap.exists()) throw new Error("no-data");
        const d = snap.data();
        if (d.fechaTortura === HOY) throw new Error("ya-hecha");
        freshSobresBonus = d.sobresBonus || 0;
        transaction.set(userRef, { fechaTortura: HOY }, { merge: true });
      });
    } catch (err) {
      if (err.message === "ya-hecha") { setYaHechaHoy(true); setFase("intro"); }
      return;
    }

    if (tipo === "sobre") {
      const nuevoBonus = freshSobresBonus + 1;
      try {
        await setDoc(doc(db, "usuarios", user.uid), { sobresBonus: nuevoBonus }, { merge: true });
        addFeedEvent({
          type: "racha",
          userName: datosUsuario?.nombre || datosUsuario?.email,
          details: `😈 Ha sobrevivido a "${torturaHoy?.nombre}" y ganado un sobre de tortura`,
        });
      } catch (err) { console.error(err); }
      setDatosUsuario({ ...datosUsuario, sobresBonus: nuevoBonus });
      setPremio("sobre"); setYaHechaHoy(true); setFase("premio");
    } else {
      const cromos = seleccionarCromosAleatorios(2);
      setPremio("cromos"); setCromosGanados(cromos);
      const cromosActuales = datosUsuario?.cromos || [];
      const cromosActualizados = [...cromosActuales];
      cromos.forEach((cromo) => {
        const existing = cromosActualizados.find((c) => c.cromoId === cromo.id);
        if (existing) existing.cantidad += 1;
        else cromosActualizados.push({ cromoId: cromo.id, cantidad: 1, fechaObtenido: HOY, pegado: false });
      });
      try {
        await setDoc(doc(db, "usuarios", user.uid), { cromos: cromosActualizados }, { merge: true });
        addFeedEvent({
          type: "racha",
          userName: datosUsuario?.nombre || datosUsuario?.email,
          details: `😮‍💨 Se ha rendido en "${torturaHoy?.nombre}" y recibido 2 cromos de consolación`,
        });
      } catch (err) { console.error(err); }
      setDatosUsuario({ ...datosUsuario, cromos: cromosActualizados });
      setYaHechaHoy(true); setFase("premio");
    }
  };

  const rendirse = async (darCromos = true) => {
    if (darCromos) {
      await darPremio("cromos");
    } else {
      try {
        await setDoc(doc(db, "usuarios", user.uid), { fechaTortura: HOY }, { merge: true });
      } catch (err) { console.error(err); }
      setYaHechaHoy(true); setFase("intro");
    }
  };

  // === VIDEO ===
  const startVideo = () => {
    setFase("jugando"); setVideoTime(0); setVideoOferta(false);
    if (videoRef.current) { videoRef.current.currentTime = 0; videoRef.current.play().catch(() => {}); }
    videoIntervalRef.current = setInterval(() => {
      setVideoTime((prev) => {
        const next = prev + 1;
        if (next >= 60 && !videoOferta) setVideoOferta(true);
        if (next >= videoDuration) { clearInterval(videoIntervalRef.current); darPremio("sobre"); }
        return next;
      });
    }, 1000);
  };
  const videoRendirse = () => { clearInterval(videoIntervalRef.current); if (videoRef.current) videoRef.current.pause(); rendirse(true); };
  const videoContinuar = () => { setVideoOferta(false); if (videoRef.current) videoRef.current.play().catch(() => {}); };

  // === CONTADOR ===
  const startContador = () => {
    setFase("jugando"); setContadorTaps(0); setContadorOferta(false);
    contadorTapsRef.current = 0; contadorOfertaMostradaRef.current = false; darPremioGuardRef.current = false;
  };
  const handleTap = () => {
    if (contadorOferta) return;
    contadorTapsRef.current += 1;
    const newTaps = contadorTapsRef.current;
    setContadorTaps(newTaps);
    if (newTaps >= 200 && !contadorOfertaMostradaRef.current) { contadorOfertaMostradaRef.current = true; setContadorOferta(true); }
    if (newTaps >= 500 && !darPremioGuardRef.current) { darPremioGuardRef.current = true; darPremio("sobre"); }
  };

  // === ESPERA ===
  const startEspera = () => { setFase("jugando"); setEsperaTime(0); setEsperaPulsado(false); setEsperaOferta(false); };
  const esperaDown = () => {
    setEsperaPulsado(true);
    esperaIntervalRef.current = setInterval(() => {
      setEsperaTime((prev) => {
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
  const normalizarTexto = (s) => s.trim().replace(/\s+/g, " ").replace(/['']/g, "'").replace(/[""]/g, '"');
  const handleTextoSubmit = () => {
    const objetivo = normalizarTexto(textoObjetivo);
    const escrito = normalizarTexto(textoInput);
    if (escrito === objetivo) { darPremio("sobre"); return; }
    let pos = 0;
    const minLen = Math.min(objetivo.length, escrito.length);
    while (pos < minLen && objetivo[pos] === escrito[pos]) pos++;
    let detalle;
    if (escrito.length === 0) { detalle = "No has escrito nada."; }
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
    const CONTAINER_W = 320, CONTAINER_H = 390, BTN = 76;
    const x = Math.floor(Math.random() * (CONTAINER_W - BTN));
    const y = Math.floor(Math.random() * (CONTAINER_H - BTN));
    setReflejoPos({ x, y });
    const round = reflejoRoundRef.current + 1;
    reflejoRoundRef.current = round;
    reflejoTimeoutRef.current = setTimeout(() => {
      if (reflejoRoundRef.current !== round) return;
      setReflejoPos(null);
      const fallos = reflejoFallosRef.current + 1;
      reflejoFallosRef.current = fallos; setReflejoFallos(fallos);
      if (fallos >= 3) { rendirse(false); return; }
      setTimeout(() => mostrarObjetivoReflejoRef.current?.(), 700);
    }, 1000);
  };
  const startReflejo = () => {
    setFase("jugando");
    reflejoHitsRef.current = 0; reflejoFallosRef.current = 0;
    setReflejoHits(0); setReflejoFallos(0); setReflejoOferta(false); setReflejoPos(null);
    reflejoRoundRef.current = 0; darPremioGuardRefReflejo.current = false;
    setTimeout(() => mostrarObjetivoReflejoRef.current?.(), 800);
  };
  const handleReflejoTap = (e) => {
    e.stopPropagation();
    if (reflejoPos === null) return;
    if (reflejoTimeoutRef.current) clearTimeout(reflejoTimeoutRef.current);
    reflejoRoundRef.current += 1; setReflejoPos(null);
    const hits = reflejoHitsRef.current + 1;
    reflejoHitsRef.current = hits; setReflejoHits(hits);
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
      if (op === "+") {
        const a = Math.floor(Math.random() * 49) + 1, b = Math.floor(Math.random() * 49) + 1;
        resultado = a + b; texto = `${a} + ${b}`;
      } else if (op === "-") {
        const a = Math.floor(Math.random() * 49) + 20, b = Math.floor(Math.random() * (a - 1)) + 1;
        resultado = a - b; texto = `${a} − ${b}`;
      } else {
        const a = Math.floor(Math.random() * 9) + 2, b = Math.floor(Math.random() * 9) + 2;
        resultado = a * b; texto = `${a} × ${b}`;
      }
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
  const handleCalculoDigit = (d) => setCalculoRespuesta((prev) => (prev.length >= 3 ? prev : prev + d));
  const handleCalculoDelete = () => setCalculoRespuesta((prev) => prev.slice(0, -1));
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
      const CONTAINER_W = 320, CONTAINER_H = 390, TARGET = 64;
      const { x, y } = punteriaPosRef.current; let { vx, vy } = punteriaVelRef.current;
      let nx = x + vx, ny = y + vy;
      if (nx <= 0) { nx = 0; vx = Math.abs(vx); } if (nx >= CONTAINER_W - TARGET) { nx = CONTAINER_W - TARGET; vx = -Math.abs(vx); }
      if (ny <= 0) { ny = 0; vy = Math.abs(vy); } if (ny >= CONTAINER_H - TARGET) { ny = CONTAINER_H - TARGET; vy = -Math.abs(vy); }
      punteriaPosRef.current = { x: nx, y: ny }; punteriaVelRef.current = { vx, vy }; setPunteriaPos({ x: nx, y: ny });
    }, 40);
  };
  const handleDianaTap = (e) => {
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

  // === RENDER HELPERS ===
  const formatTime = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
  const getBorderColor = (r) => r === "legendaria" ? "#fbbf24" : r === "rara" ? "#3b82f6" : "#94a3b8";
  const getRarezaBg = (r) => r === "legendaria" ? "linear-gradient(135deg, #f59e0b, #d97706)" : r === "rara" ? "linear-gradient(135deg, #3b82f6, #2563eb)" : "linear-gradient(135deg, #475569, #334155)";

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", background: "#0f172a" }}>
        <p style={{ fontSize: "1.5rem", color: "white" }}>Cargando...</p>
      </div>
    );
  }

  const NUMPAD = [["7","8","9"],["4","5","6"],["1","2","3"],["⌫","0","✓"]];
  const torturaActualSorteo = TORTURAS[sorteoActual];

  return (
    <div style={{ minHeight: "100vh", background: "#0f172a", padding: "20px", overflow: "hidden", position: "relative" }}>
      <style>{`
        @keyframes reflejoClock {
          0%   { background-color: #10b981; box-shadow: 0 0 24px 4px rgba(16,185,129,0.8); }
          55%  { background-color: #f59e0b; box-shadow: 0 0 24px 4px rgba(245,158,11,0.7); }
          85%  { background-color: #ef4444; box-shadow: 0 0 24px 4px rgba(239,68,68,0.7); }
          100% { background-color: #7f1d1d; box-shadow: 0 0 8px 2px rgba(239,68,68,0.2); transform: scale(0.88); }
        }
        @keyframes punteriaPulse {
          0%, 100% { transform: scale(1); }
          50%       { transform: scale(1.12); }
        }
        @keyframes sorteoCardFlash {
          0%   { transform: scale(1.08); opacity: 0.7; }
          100% { transform: scale(1);    opacity: 1; }
        }
        @keyframes sorteoRevelado {
          0%   { transform: scale(0.75); opacity: 0; }
          65%  { transform: scale(1.05); }
          100% { transform: scale(1);    opacity: 1; }
        }
        @keyframes sorteoGlow {
          0%, 100% { box-shadow: 0 0 20px rgba(239,68,68,0.4); }
          50%       { box-shadow: 0 0 50px rgba(239,68,68,0.9), 0 0 80px rgba(239,68,68,0.3); }
        }
      `}</style>

      {/* HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <button onClick={() => router.push("/album")} style={{
          padding: "8px 16px", borderRadius: "10px", border: "1px solid #475569",
          background: "transparent", color: "#94a3b8", cursor: "pointer"
        }}>← Álbum</button>
      </div>

      {/* =========== SORTEO PENDIENTE =========== */}
      {sorteoPendiente && !yaHechaHoy && (
        <div style={{ textAlign: "center", paddingTop: "10px" }}>

          {/* --- Esperando que alguien gire --- */}
          {sorteoFase === "esperando" && (
            <>
              <p style={{ fontSize: "3.5rem", marginBottom: "8px" }}>🎰</p>
              <h1 style={{ fontSize: "1.6rem", marginBottom: "6px" }}>Tortura del Día</h1>
              <p style={{ color: "#64748b", fontSize: "0.88rem", marginBottom: "6px" }}>
                Nadie ha girado la ruleta hoy todavía.
              </p>
              <p style={{ color: "#475569", fontSize: "0.78rem", marginBottom: "32px", fontStyle: "italic" }}>
                El primero en girar elige la tortura para todos los jugadores.
              </p>

              {/* Vista previa de las torturas disponibles */}
              <div style={{
                display: "flex", justifyContent: "center", gap: "8px",
                flexWrap: "wrap", maxWidth: "340px", margin: "0 auto 32px",
              }}>
                {TORTURAS.map((t) => (
                  <div key={t.id} style={{
                    background: `${t.color}18`, border: `1px solid ${t.color}44`,
                    borderRadius: "10px", padding: "8px 12px",
                    fontSize: "0.8rem", color: t.color, fontWeight: "bold",
                  }}>
                    {t.emoji} {t.nombre}
                  </div>
                ))}
              </div>

              <button
                onClick={iniciarSorteo}
                style={{
                  width: "100%", maxWidth: "320px", padding: "18px", borderRadius: "16px",
                  border: "none", fontSize: "1.15rem", fontWeight: "bold",
                  cursor: "pointer", color: "white",
                  background: "linear-gradient(135deg, #ef4444, #dc2626)",
                  boxShadow: "0 4px 20px rgba(239,68,68,0.4)",
                }}
              >
                🎰 Girar la ruleta
              </button>
              <p style={{ color: "#334155", fontSize: "0.7rem", marginTop: "14px", fontStyle: "italic" }}>
                Probabilidad igual para todas las torturas
              </p>
            </>
          )}

          {/* --- Animación girando --- */}
          {sorteoFase === "girando" && (
            <>
              <p style={{ color: "#94a3b8", fontSize: "0.9rem", marginBottom: "20px", letterSpacing: "2px" }}>
                SORTEANDO...
              </p>

              {/* Tarjeta que cambia rápidamente */}
              <div
                key={sorteoActual}
                style={{
                  background: "linear-gradient(145deg, #1e293b, #0f172a)",
                  borderRadius: "20px", padding: "30px 24px",
                  maxWidth: "260px", margin: "0 auto",
                  border: `2px solid ${torturaActualSorteo.color}`,
                  boxShadow: `0 0 30px ${torturaActualSorteo.color}44`,
                  animation: "sorteoCardFlash 0.12s ease-out",
                  textAlign: "center",
                }}
              >
                <p style={{ fontSize: "4rem", margin: "0 0 10px" }}>{torturaActualSorteo.emoji}</p>
                <p style={{ fontSize: "1.2rem", fontWeight: "bold", margin: "0 0 6px", color: torturaActualSorteo.color }}>
                  {torturaActualSorteo.nombre}
                </p>
                <p style={{ fontSize: "0.72rem", color: "#475569", margin: 0, lineHeight: 1.4 }}>
                  {torturaActualSorteo.descripcion}
                </p>
              </div>

              {/* Indicador de velocidad */}
              <div style={{ display: "flex", justifyContent: "center", gap: "6px", marginTop: "24px" }}>
                {[0, 1, 2, 3, 4].map((i) => (
                  <div key={i} style={{
                    width: 8, height: 8, borderRadius: "50%",
                    background: i === sorteoActual % 5 ? "#ef4444" : "#1e293b",
                    border: "1px solid #334155",
                    transition: "background 0.08s",
                  }} />
                ))}
              </div>
            </>
          )}

          {/* --- Resultado revelado --- */}
          {sorteoFase === "revelado" && torturaHoy && (
            <>
              <p style={{ fontSize: "1rem", color: "#f59e0b", marginBottom: "16px", letterSpacing: "3px", fontWeight: "bold" }}>
                ✨ ¡HA SALIDO! ✨
              </p>

              <div style={{
                background: "linear-gradient(145deg, #1e293b, #0f172a)",
                borderRadius: "22px", padding: "32px 24px",
                maxWidth: "280px", margin: "0 auto 20px",
                border: `2px solid ${torturaHoy.color}`,
                animation: "sorteoRevelado 0.5s ease-out, sorteoGlow 2s ease-in-out infinite 0.5s",
                textAlign: "center",
              }}>
                <p style={{ fontSize: "5rem", margin: "0 0 12px" }}>{torturaHoy.emoji}</p>
                <p style={{ fontSize: "1.6rem", fontWeight: "bold", margin: "0 0 8px", color: torturaHoy.color }}>
                  {torturaHoy.nombre}
                </p>
                <p style={{ fontSize: "0.8rem", color: "#64748b", margin: 0, lineHeight: 1.5 }}>
                  {torturaHoy.descripcion}
                </p>
              </div>

              <p style={{ color: "#475569", fontSize: "0.78rem", fontStyle: "italic" }}>
                Preparando la tortura...
              </p>
            </>
          )}
        </div>
      )}

      {/* =========== YA HECHA HOY =========== */}
      {yaHechaHoy && fase !== "premio" && (
        <div style={{ textAlign: "center", paddingTop: "30px" }}>
          <p style={{ fontSize: "3.5rem", marginBottom: "10px" }}>😈</p>
          <h2 style={{ fontSize: "1.5rem", marginBottom: "6px", color: "#ef4444" }}>Ya has sufrido suficiente</h2>
          <p style={{ color: "#64748b", fontSize: "0.9rem", fontStyle: "italic", marginBottom: "30px" }}>¿De verdad crees que puedes con más?</p>
          <div style={{ background: "linear-gradient(145deg, #1e293b, #0f172a)", borderRadius: "16px", padding: "24px", border: "1px solid #334155", maxWidth: "280px", margin: "0 auto" }}>
            <p style={{ color: "#64748b", fontSize: "0.8rem", marginBottom: "10px", letterSpacing: "1px" }}>EL PRÓXIMO SUFRIMIENTO EN</p>
            <p style={{ fontSize: "2.8rem", fontWeight: "bold", fontFamily: "monospace", color: "#ef4444", margin: 0, letterSpacing: "4px" }}>{countdown}</p>
            <p style={{ color: "#334155", fontSize: "0.7rem", marginTop: "14px", fontStyle: "italic" }}>...si es que te atreves a volver</p>
          </div>
        </div>
      )}

      {/* =========== INTRO =========== */}
      {!yaHechaHoy && !sorteoPendiente && fase === "intro" && torturaHoy && (
        <div style={{ textAlign: "center", paddingTop: "20px" }}>
          <h1 style={{ fontSize: "2rem", marginBottom: "5px" }}>😈 La Tortura del Día</h1>
          <p style={{ color: "#64748b", marginBottom: "30px", fontSize: "0.9rem" }}>Sufre para ganar cromos extra</p>

          <div style={{ background: "linear-gradient(145deg, #1e293b, #0f172a)", borderRadius: "20px", padding: "30px", maxWidth: "350px", margin: "0 auto 25px", border: "1px solid #334155", boxShadow: "0 10px 30px rgba(0,0,0,0.3)" }}>
            <span style={{ fontSize: "3.5rem" }}>{torturaHoy.emoji}</span>
            <h2 style={{ fontSize: "1.5rem", margin: "15px 0 8px" }}>{torturaHoy.nombre}</h2>
            <p style={{ color: "#94a3b8", fontSize: "0.9rem", marginBottom: "20px" }}>{torturaHoy.descripcion}</p>
            <div style={{ background: "#0f172a", borderRadius: "12px", padding: "12px", marginBottom: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-around" }}>
                <div style={{ textAlign: "center" }}>
                  <p style={{ color: "#f59e0b", fontSize: "0.75rem", margin: 0 }}>Rendirte</p>
                  <p style={{ fontWeight: "bold", fontSize: "1.1rem", margin: "4px 0 0" }}>2 cromos</p>
                </div>
                <div style={{ width: "1px", background: "#334155" }} />
                <div style={{ textAlign: "center" }}>
                  <p style={{ color: "#10b981", fontSize: "0.75rem", margin: 0 }}>Completar</p>
                  <p style={{ fontWeight: "bold", fontSize: "1.1rem", margin: "4px 0 0" }}>1 sobre</p>
                </div>
              </div>
            </div>
            <button
              onClick={() => {
                if (torturaHoy.id === "video") startVideo();
                else if (torturaHoy.id === "contador") startContador();
                else if (torturaHoy.id === "espera") startEspera();
                else if (torturaHoy.id === "texto") startTexto();
                else if (torturaHoy.id === "reflejo") startReflejo();
                else if (torturaHoy.id === "calculo") startCalculo();
                else if (torturaHoy.id === "punteria") startPunteria();
              }}
              style={{ width: "100%", padding: "16px", borderRadius: "14px", border: "none", fontSize: "1.1rem", fontWeight: "bold", cursor: "pointer", color: "white", background: "linear-gradient(135deg, #ef4444, #dc2626)", boxShadow: "0 4px 15px rgba(239,68,68,0.3)" }}
            >😈 Empezar tortura</button>
          </div>
        </div>
      )}

      {/* =========== VIDEO =========== */}
      {fase === "jugando" && torturaHoy?.id === "video" && (
        <div style={{ textAlign: "center" }}>
          <h2 style={{ fontSize: "1.3rem", marginBottom: "15px" }}>🎬 Aguanta el video</h2>
          <div style={{ maxWidth: "400px", margin: "0 auto", borderRadius: "16px", overflow: "hidden", border: "2px solid #334155", marginBottom: "15px" }}>
            <video ref={videoRef} src="/videos/tortura01.mp4" style={{ width: "100%", display: "block" }} playsInline autoPlay onEnded={() => darPremio("sobre")} />
          </div>
          <div style={{ maxWidth: "400px", margin: "0 auto 10px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", color: "#94a3b8", marginBottom: "5px" }}><span>{formatTime(videoTime)}</span><span>{formatTime(videoDuration)}</span></div>
            <div style={{ width: "100%", height: "8px", background: "#1e293b", borderRadius: "4px", overflow: "hidden" }}>
              <div style={{ width: `${(videoTime / videoDuration) * 100}%`, height: "100%", background: videoTime < 60 ? "#ef4444" : videoTime < 120 ? "#f59e0b" : "#10b981", borderRadius: "4px", transition: "width 1s linear" }} />
            </div>
          </div>
          {videoOferta && (
            <div style={{ background: "#1e293b", borderRadius: "16px", padding: "20px", maxWidth: "350px", margin: "0 auto", border: "1px solid #f59e0b", animation: "fadeInUp 0.3s" }}>
              <p style={{ fontWeight: "bold", fontSize: "1.1rem", marginBottom: "15px" }}>¿Rendirte ya?</p>
              <div style={{ display: "flex", gap: "10px" }}>
                <button onClick={videoRendirse} style={{ flex: 1, padding: "12px", borderRadius: "10px", border: "none", background: "#f59e0b", color: "#000", fontWeight: "bold", cursor: "pointer" }}>😮‍💨 Rendirme (2 cromos)</button>
                <button onClick={videoContinuar} style={{ flex: 1, padding: "12px", borderRadius: "10px", border: "none", background: "#10b981", color: "white", fontWeight: "bold", cursor: "pointer" }}>💪 Aguantar ({formatTime(videoDuration - videoTime)})</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =========== CONTADOR =========== */}
      {fase === "jugando" && torturaHoy?.id === "contador" && (
        <div style={{ textAlign: "center" }}>
          <h2 style={{ fontSize: "1.3rem", marginBottom: "10px" }}>🔢 Pulsa 500 veces</h2>
          <p style={{ color: "#ef4444", fontSize: "0.75rem", marginBottom: "20px" }}>⚠️ Si dejas de pulsar 3 segundos → vuelve a 0</p>
          <p style={{ fontSize: "4rem", fontWeight: "bold", marginBottom: "5px", color: contadorTaps >= 400 ? "#10b981" : contadorTaps >= 200 ? "#f59e0b" : "#ef4444", fontFamily: "monospace" }}>{contadorTaps}</p>
          <p style={{ color: "#64748b", fontSize: "0.85rem", marginBottom: "20px" }}>/ 500</p>
          <div style={{ width: "80%", maxWidth: "300px", height: "12px", background: "#1e293b", borderRadius: "6px", margin: "0 auto 25px", overflow: "hidden" }}>
            <div style={{ width: `${(contadorTaps / 500) * 100}%`, height: "100%", background: contadorTaps >= 400 ? "#10b981" : contadorTaps >= 200 ? "#f59e0b" : "#ef4444", borderRadius: "6px", transition: "width 0.1s" }} />
          </div>
          {contadorOferta && (
            <div style={{ background: "#1e293b", borderRadius: "16px", padding: "20px", maxWidth: "350px", margin: "0 auto 20px", border: "1px solid #f59e0b", animation: "fadeInUp 0.3s" }}>
              <p style={{ fontWeight: "bold", marginBottom: "15px" }}>200 taps. ¿Rendirte?</p>
              <div style={{ display: "flex", gap: "10px" }}>
                <button onClick={() => rendirse(true)} style={{ flex: 1, padding: "12px", borderRadius: "10px", border: "none", background: "#f59e0b", color: "#000", fontWeight: "bold", cursor: "pointer" }}>😮‍💨 2 cromos</button>
                <button onClick={() => setContadorOferta(false)} style={{ flex: 1, padding: "12px", borderRadius: "10px", border: "none", background: "#10b981", color: "white", fontWeight: "bold", cursor: "pointer" }}>💪 Seguir (faltan {500 - contadorTaps})</button>
              </div>
            </div>
          )}
          {!contadorOferta && (
            <button onClick={handleTap} style={{ width: "180px", height: "180px", borderRadius: "50%", border: "none", fontSize: "1.3rem", fontWeight: "bold", cursor: "pointer", color: "white", background: "linear-gradient(145deg, #ef4444, #dc2626)", boxShadow: "0 8px 25px rgba(239,68,68,0.4)", userSelect: "none", WebkitUserSelect: "none" }}
              onMouseDown={(e) => e.currentTarget.style.transform = "scale(0.92)"} onMouseUp={(e) => e.currentTarget.style.transform = "scale(1)"}
              onTouchStart={(e) => e.currentTarget.style.transform = "scale(0.92)"} onTouchEnd={(e) => e.currentTarget.style.transform = "scale(1)"}>TAP</button>
          )}
        </div>
      )}

      {/* =========== ESPERA =========== */}
      {fase === "jugando" && torturaHoy?.id === "espera" && (
        <div style={{ textAlign: "center" }}>
          <h2 style={{ fontSize: "1.3rem", marginBottom: "10px" }}>🌀 Mantén pulsado</h2>
          <p style={{ color: "#ef4444", fontSize: "0.75rem", marginBottom: "20px" }}>⚠️ Si levantas el dedo → vuelve a 0</p>
          <p style={{ fontSize: "3.5rem", fontWeight: "bold", marginBottom: "5px", fontFamily: "monospace", color: esperaTime >= 120 ? "#10b981" : esperaTime >= 60 ? "#f59e0b" : "#ef4444" }}>{formatTime(esperaTime)}</p>
          <p style={{ color: "#64748b", fontSize: "0.85rem", marginBottom: "20px" }}>/ {formatTime(180)}</p>
          <div style={{ width: "80%", maxWidth: "300px", height: "12px", background: "#1e293b", borderRadius: "6px", margin: "0 auto 25px", overflow: "hidden" }}>
            <div style={{ width: `${(esperaTime / 180) * 100}%`, height: "100%", background: esperaTime >= 120 ? "#10b981" : esperaTime >= 60 ? "#f59e0b" : "#ef4444", borderRadius: "6px", transition: "width 1s linear" }} />
          </div>
          {esperaOferta && !esperaPulsado && (
            <div style={{ background: "#1e293b", borderRadius: "16px", padding: "20px", maxWidth: "350px", margin: "0 auto 20px", border: "1px solid #f59e0b", animation: "fadeInUp 0.3s" }}>
              <p style={{ fontWeight: "bold", marginBottom: "15px" }}>1 minuto aguantando. ¿Rendirte?</p>
              <div style={{ display: "flex", gap: "10px" }}>
                <button onClick={() => rendirse(true)} style={{ flex: 1, padding: "12px", borderRadius: "10px", border: "none", background: "#f59e0b", color: "#000", fontWeight: "bold", cursor: "pointer" }}>😮‍💨 2 cromos</button>
                <button onClick={() => setEsperaOferta(false)} style={{ flex: 1, padding: "12px", borderRadius: "10px", border: "none", background: "#10b981", color: "white", fontWeight: "bold", cursor: "pointer" }}>💪 Seguir</button>
              </div>
            </div>
          )}
          {!(esperaOferta && !esperaPulsado) && (
            <button onMouseDown={esperaDown} onMouseUp={esperaUp} onMouseLeave={esperaUp} onTouchStart={esperaDown} onTouchEnd={esperaUp}
              style={{ width: "180px", height: "180px", borderRadius: "50%", border: "none", fontSize: "1.1rem", fontWeight: "bold", cursor: "pointer", color: "white", background: esperaPulsado ? "linear-gradient(145deg, #10b981, #059669)" : "linear-gradient(145deg, #ef4444, #dc2626)", boxShadow: esperaPulsado ? "0 0 30px rgba(16,185,129,0.5)" : "0 8px 25px rgba(239,68,68,0.4)", transition: "all 0.2s", userSelect: "none", WebkitUserSelect: "none" }}>
              {esperaPulsado ? "AGUANTA..." : "PULSA Y MANTÉN"}
            </button>
          )}
          {!esperaPulsado && esperaTime > 0 && !esperaOferta && (
            <p style={{ color: "#ef4444", fontSize: "1rem", marginTop: "15px", animation: "shake 0.5s" }}>¡Has soltado! Vuelve a empezar 😈</p>
          )}
        </div>
      )}

      {/* =========== TEXTO =========== */}
      {fase === "jugando" && torturaHoy?.id === "texto" && (
        <div style={{ maxWidth: "500px", margin: "0 auto" }}>
          <h2 style={{ fontSize: "1.3rem", marginBottom: "10px", textAlign: "center" }}>📝 Copia el texto exacto</h2>
          <p style={{ color: "#64748b", fontSize: "0.75rem", textAlign: "center", marginBottom: "15px" }}>Intentos restantes: {"❤️".repeat(textoIntentos)}{"🖤".repeat(3 - textoIntentos)}</p>
          <div style={{ background: "#1e293b", borderRadius: "12px", padding: "15px", marginBottom: "15px", border: "1px solid #334155", fontSize: "0.85rem", lineHeight: 1.6, color: "#e2e8f0", userSelect: "none", WebkitUserSelect: "none" }}>{textoObjetivo}</div>
          <textarea value={textoInput} onChange={(e) => { setTextoInput(e.target.value); if (textoError) { setTextoError(false); setTextoErrorDetalle(""); } }} onPaste={(e) => e.preventDefault()}
            placeholder="Escribe el texto aquí... (copiar y pegar bloqueado)"
            style={{ width: "100%", minHeight: "150px", padding: "15px", borderRadius: "12px", border: textoError ? "2px solid #ef4444" : "1px solid #334155", background: "#0f172a", color: "white", fontSize: "0.85rem", lineHeight: 1.6, resize: "vertical", fontFamily: "Arial, sans-serif" }} />
          {textoError && (
            <div style={{ background: "#1e1a2e", borderRadius: "10px", padding: "12px 14px", marginTop: "10px", border: "1px solid #ef4444", animation: "shake 0.5s" }}>
              <p style={{ color: "#ef4444", margin: "0 0 4px", fontWeight: "bold", fontSize: "0.9rem" }}>❌ {textoErrorDetalle}</p>
              {textoIntentos > 0 && <p style={{ color: "#94a3b8", fontSize: "0.78rem", margin: 0 }}>Puedes corregirlo arriba · {textoIntentos} intento{textoIntentos !== 1 ? "s" : ""} restante{textoIntentos !== 1 ? "s" : ""}</p>}
            </div>
          )}
          <div style={{ display: "flex", gap: "10px", marginTop: "15px" }}>
            <button onClick={() => rendirse(true)} style={{ flex: 1, padding: "14px", borderRadius: "12px", border: "none", background: "#f59e0b", color: "#000", fontWeight: "bold", cursor: "pointer" }}>😮‍💨 Rendirme (2 cromos)</button>
            <button onClick={handleTextoSubmit} style={{ flex: 1, padding: "14px", borderRadius: "12px", border: "none", background: "#10b981", color: "white", fontWeight: "bold", cursor: "pointer" }}>✅ Comprobar</button>
          </div>
        </div>
      )}

      {/* =========== REFLEJO =========== */}
      {fase === "jugando" && torturaHoy?.id === "reflejo" && (
        <div style={{ textAlign: "center" }}>
          <h2 style={{ fontSize: "1.3rem", marginBottom: "6px" }}>⚡ Toca el botón</h2>
          <p style={{ color: "#64748b", fontSize: "0.75rem", marginBottom: "10px" }}>1 segundo · 3 fallos = game over</p>
          <div style={{ display: "flex", justifyContent: "center", gap: "24px", marginBottom: "16px" }}>
            <div style={{ textAlign: "center" }}>
              <p style={{ color: "#10b981", fontSize: "0.7rem", margin: "0 0 2px", letterSpacing: "1px" }}>REFLEJOS</p>
              <p style={{ fontFamily: "monospace", fontSize: "1.6rem", fontWeight: "bold", margin: 0 }}>{reflejoHits}<span style={{ color: "#334155" }}>/25</span></p>
            </div>
            <div style={{ textAlign: "center" }}>
              <p style={{ color: "#ef4444", fontSize: "0.7rem", margin: "0 0 2px", letterSpacing: "1px" }}>FALLOS</p>
              <p style={{ fontFamily: "monospace", fontSize: "1.6rem", fontWeight: "bold", margin: 0, color: reflejoFallos > 0 ? "#ef4444" : "white" }}>{reflejoFallos}<span style={{ color: "#334155" }}>/3</span></p>
            </div>
          </div>
          {reflejoOferta && (
            <div style={{ background: "#1e293b", borderRadius: "16px", padding: "20px", maxWidth: "350px", margin: "0 auto 16px", border: "1px solid #f59e0b", animation: "fadeInUp 0.3s" }}>
              <p style={{ fontWeight: "bold", marginBottom: "6px" }}>12 reflejos. ¿Rendirte?</p>
              <p style={{ color: "#64748b", fontSize: "0.8rem", marginBottom: "15px" }}>Faltan {25 - reflejoHits} para el sobre completo</p>
              <div style={{ display: "flex", gap: "10px" }}>
                <button onClick={() => rendirse(true)} style={{ flex: 1, padding: "12px", borderRadius: "10px", border: "none", background: "#f59e0b", color: "#000", fontWeight: "bold", cursor: "pointer" }}>😮‍💨 2 cromos</button>
                <button onClick={() => { setReflejoOferta(false); setTimeout(() => mostrarObjetivoReflejoRef.current?.(), 400); }} style={{ flex: 1, padding: "12px", borderRadius: "10px", border: "none", background: "#10b981", color: "white", fontWeight: "bold", cursor: "pointer" }}>💪 Seguir</button>
              </div>
            </div>
          )}
          {!reflejoOferta && (
            <div style={{ position: "relative", width: "320px", height: "390px", margin: "0 auto", background: "linear-gradient(145deg, #1e293b, #0f172a)", borderRadius: "20px", border: "1px solid #334155", overflow: "hidden" }}>
              {reflejoPos ? (
                <button onClick={handleReflejoTap} style={{ position: "absolute", left: reflejoPos.x, top: reflejoPos.y, width: 76, height: 76, borderRadius: "50%", border: "3px solid rgba(255,255,255,0.2)", fontSize: "1.8rem", cursor: "pointer", color: "white", animation: "reflejoClock 1s linear forwards", touchAction: "manipulation", userSelect: "none", WebkitUserSelect: "none" }}>⚡</button>
              ) : (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#334155", fontSize: "0.9rem", fontStyle: "italic" }}>Prepárate...</div>
              )}
            </div>
          )}
          <p style={{ marginTop: "14px", fontSize: "1.3rem", letterSpacing: "4px" }}>{"❤️".repeat(3 - reflejoFallos)}{"🖤".repeat(reflejoFallos)}</p>
        </div>
      )}

      {/* =========== CÁLCULO =========== */}
      {fase === "jugando" && torturaHoy?.id === "calculo" && (
        <div style={{ textAlign: "center", maxWidth: "360px", margin: "0 auto" }}>
          <h2 style={{ fontSize: "1.3rem", marginBottom: "4px" }}>🧮 ¿Cuánto es?</h2>
          <p style={{ color: "#64748b", fontSize: "0.75rem", marginBottom: "12px" }}>4 segundos · 3 errores = game over</p>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
            <p style={{ color: "#64748b", fontSize: "0.8rem", margin: 0 }}>Pregunta <span style={{ color: "white", fontWeight: "bold" }}>{calculoPregunta + 1}</span>/20</p>
            <p style={{ fontSize: "1.1rem", margin: 0, letterSpacing: "3px" }}>{"❤️".repeat(3 - calculoErrores)}{"🖤".repeat(calculoErrores)}</p>
          </div>
          <div style={{ width: "100%", height: "6px", background: "#1e293b", borderRadius: "3px", marginBottom: "20px", overflow: "hidden" }}>
            <div style={{ width: `${(calculoPregunta / 20) * 100}%`, height: "100%", background: "linear-gradient(90deg, #3b82f6, #10b981)", borderRadius: "3px", transition: "width 0.3s" }} />
          </div>
          {calculoOferta && (
            <div style={{ background: "#1e293b", borderRadius: "16px", padding: "20px", border: "1px solid #f59e0b", animation: "fadeInUp 0.3s", marginBottom: "16px" }}>
              <p style={{ fontWeight: "bold", marginBottom: "6px" }}>10 preguntas resueltas. ¿Rendirte?</p>
              <p style={{ color: "#64748b", fontSize: "0.8rem", marginBottom: "15px" }}>Quedan 10 para el sobre completo</p>
              <div style={{ display: "flex", gap: "10px" }}>
                <button onClick={() => rendirse(true)} style={{ flex: 1, padding: "12px", borderRadius: "10px", border: "none", background: "#f59e0b", color: "#000", fontWeight: "bold", cursor: "pointer" }}>😮‍💨 2 cromos</button>
                <button onClick={() => setCalculoOferta(false)} style={{ flex: 1, padding: "12px", borderRadius: "10px", border: "none", background: "#10b981", color: "white", fontWeight: "bold", cursor: "pointer" }}>💪 Seguir</button>
              </div>
            </div>
          )}
          {!calculoOferta && calculoQuestion && (
            <>
              <div style={{ display: "flex", justifyContent: "center", gap: "8px", marginBottom: "18px" }}>
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} style={{ width: 14, height: 14, borderRadius: "50%", background: i <= calculoTimer ? (calculoTimer <= 1 ? "#ef4444" : calculoTimer <= 2 ? "#f59e0b" : "#10b981") : "#1e293b", border: "2px solid #334155", transition: "background 0.3s" }} />
                ))}
              </div>
              <div style={{ background: calculoFlashError ? "linear-gradient(145deg, #3f1f1f, #1e293b)" : "linear-gradient(145deg, #1e293b, #0f172a)", borderRadius: "20px", padding: "28px 20px", border: calculoFlashError ? "2px solid #ef4444" : "1px solid #334155", marginBottom: "20px", transition: "all 0.2s", animation: calculoFlashError ? "shake 0.4s" : "none" }}>
                <p style={{ fontSize: "2.2rem", fontWeight: "bold", margin: "0 0 8px", fontFamily: "monospace", letterSpacing: "2px" }}>{calculoQuestion.texto}</p>
                <p style={{ color: "#64748b", fontSize: "0.8rem", margin: 0 }}>= ?</p>
              </div>
              <div style={{ background: "#0f172a", borderRadius: "14px", padding: "16px", marginBottom: "16px", border: "1px solid #334155", fontSize: "2.8rem", fontWeight: "bold", fontFamily: "monospace", minHeight: "72px", display: "flex", alignItems: "center", justifyContent: "center", color: calculoRespuesta ? "white" : "#334155", letterSpacing: "6px" }}>
                {calculoRespuesta || "—"}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
                {NUMPAD.map((row, ri) => row.map((key, ci) => (
                  <button key={`${ri}-${ci}`} onClick={() => { if (key === "⌫") handleCalculoDelete(); else if (key === "✓") handleCalculoSubmit(); else handleCalculoDigit(key); }}
                    style={{ padding: "18px 0", borderRadius: "12px", border: "1px solid #334155", background: key === "✓" ? "linear-gradient(135deg, #10b981, #059669)" : key === "⌫" ? "linear-gradient(135deg, #374151, #1f2937)" : "#1e293b", color: "white", fontSize: key === "✓" || key === "⌫" ? "1.3rem" : "1.5rem", fontWeight: "bold", cursor: "pointer", fontFamily: "monospace", touchAction: "manipulation" }}>{key}</button>
                )))}
              </div>
            </>
          )}
        </div>
      )}

      {/* =========== PUNTERÍA =========== */}
      {fase === "jugando" && torturaHoy?.id === "punteria" && (
        <div style={{ textAlign: "center" }}>
          <h2 style={{ fontSize: "1.3rem", marginBottom: "6px" }}>🎯 Toca el círculo</h2>
          <p style={{ color: "#64748b", fontSize: "0.75rem", marginBottom: "10px" }}>Cada acierto lo acelera · 3 fallos = game over</p>
          <div style={{ display: "flex", justifyContent: "center", gap: "24px", marginBottom: "14px" }}>
            <div style={{ textAlign: "center" }}>
              <p style={{ color: "#10b981", fontSize: "0.7rem", margin: "0 0 2px", letterSpacing: "1px" }}>ACIERTOS</p>
              <p style={{ fontFamily: "monospace", fontSize: "1.6rem", fontWeight: "bold", margin: 0 }}>{punteriaHits}<span style={{ color: "#334155" }}>/20</span></p>
            </div>
            <div style={{ textAlign: "center" }}>
              <p style={{ color: "#ef4444", fontSize: "0.7rem", margin: "0 0 2px", letterSpacing: "1px" }}>FALLOS</p>
              <p style={{ fontFamily: "monospace", fontSize: "1.6rem", fontWeight: "bold", margin: 0, color: punteriaFallos > 0 ? "#ef4444" : "white" }}>{punteriaFallos}<span style={{ color: "#334155" }}>/3</span></p>
            </div>
          </div>
          {punteriaOferta && (
            <div style={{ background: "#1e293b", borderRadius: "16px", padding: "20px", maxWidth: "350px", margin: "0 auto 14px", border: "1px solid #f59e0b", animation: "fadeInUp 0.3s" }}>
              <p style={{ fontWeight: "bold", marginBottom: "6px" }}>10 aciertos. ¿Rendirte?</p>
              <p style={{ color: "#64748b", fontSize: "0.8rem", marginBottom: "15px" }}>Faltan {20 - punteriaHits} para el sobre completo</p>
              <div style={{ display: "flex", gap: "10px" }}>
                <button onClick={() => rendirse(true)} style={{ flex: 1, padding: "12px", borderRadius: "10px", border: "none", background: "#f59e0b", color: "#000", fontWeight: "bold", cursor: "pointer" }}>😮‍💨 2 cromos</button>
                <button onClick={() => {
                  setPunteriaOferta(false);
                  if (punteriaIntervalRef.current) clearInterval(punteriaIntervalRef.current);
                  punteriaIntervalRef.current = setInterval(() => {
                    const CONTAINER_W = 320, CONTAINER_H = 390, TARGET = 64;
                    const { x, y } = punteriaPosRef.current; let { vx, vy } = punteriaVelRef.current;
                    let nx = x + vx, ny = y + vy;
                    if (nx <= 0) { nx = 0; vx = Math.abs(vx); } if (nx >= CONTAINER_W - TARGET) { nx = CONTAINER_W - TARGET; vx = -Math.abs(vx); }
                    if (ny <= 0) { ny = 0; vy = Math.abs(vy); } if (ny >= CONTAINER_H - TARGET) { ny = CONTAINER_H - TARGET; vy = -Math.abs(vy); }
                    punteriaPosRef.current = { x: nx, y: ny }; punteriaVelRef.current = { vx, vy }; setPunteriaPos({ x: nx, y: ny });
                  }, 40);
                }} style={{ flex: 1, padding: "12px", borderRadius: "10px", border: "none", background: "#10b981", color: "white", fontWeight: "bold", cursor: "pointer" }}>💪 Seguir</button>
              </div>
            </div>
          )}
          {!punteriaOferta && (
            <div onClick={handleAreaTap} style={{ position: "relative", width: "320px", height: "390px", margin: "0 auto", background: "linear-gradient(145deg, #1e293b, #0f172a)", borderRadius: "20px", border: "1px solid #334155", overflow: "hidden", cursor: "pointer", touchAction: "manipulation" }}>
              <div onClick={handleDianaTap} style={{ position: "absolute", left: punteriaPos.x, top: punteriaPos.y, width: 64, height: 64, borderRadius: "50%", background: "radial-gradient(circle at 35% 35%, #ef4444, #dc2626 50%, #991b1b)", border: "3px solid rgba(255,255,255,0.25)", cursor: "pointer", animation: "punteriaPulse 0.8s ease-in-out infinite", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.4rem", userSelect: "none", WebkitUserSelect: "none", touchAction: "manipulation", boxShadow: "0 0 20px rgba(239,68,68,0.6)" }}>🎯</div>
            </div>
          )}
          <p style={{ marginTop: "14px", fontSize: "1.3rem", letterSpacing: "4px" }}>{"❤️".repeat(3 - punteriaFallos)}{"🖤".repeat(punteriaFallos)}</p>
        </div>
      )}

      {/* =========== PREMIO =========== */}
      {fase === "premio" && (
        <div style={{ textAlign: "center", animation: "fadeInUp 0.5s" }}>
          {premio === "sobre" ? (
            <>
              <div style={{ fontSize: "5rem", marginBottom: "16px", animation: "pulsoSuave 1.5s ease-in-out infinite" }}>📦</div>
              <h2 style={{ fontSize: "1.6rem", marginBottom: "8px", color: "#f59e0b" }}>¡LO HAS CONSEGUIDO!</h2>
              <p style={{ color: "#94a3b8", marginBottom: "6px" }}>Has ganado un sobre completo de tortura</p>
              <p style={{ color: "#64748b", fontSize: "0.8rem", marginBottom: "32px" }}>Ábrelo cuando quieras desde la pantalla de sobres</p>
              <button onClick={() => router.push("/abrir-sobre")} style={{ padding: "16px", borderRadius: "14px", border: "none", background: "linear-gradient(135deg, #f59e0b, #d97706)", color: "#000", fontWeight: "bold", cursor: "pointer", fontSize: "1.1rem", boxShadow: "0 4px 20px rgba(245,158,11,0.4)", width: "100%", marginBottom: "10px" }}>📦 Abrir sobre ahora</button>
              <button onClick={() => router.push("/album")} style={{ padding: "12px", borderRadius: "14px", border: "1px solid #334155", background: "transparent", color: "#64748b", cursor: "pointer", fontSize: "0.9rem", width: "100%" }}>Volver al álbum</button>
            </>
          ) : (
            <>
              <p style={{ fontSize: "3rem", marginBottom: "10px" }}>😮‍💨</p>
              <h2 style={{ fontSize: "1.5rem", marginBottom: "8px" }}>Te has rendido...</h2>
              <p style={{ color: "#94a3b8", marginBottom: "25px" }}>Has ganado 2 cromos de consolación</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "10px", maxWidth: "220px", margin: "0 auto 30px" }}>
                {cromosGanados.map((cromo, i) => (
                  <div key={i} style={{ borderRadius: "12px", border: `2px solid ${getBorderColor(cromo.rareza)}`, overflow: "hidden", background: "#1e293b", animation: `fadeInUp 0.4s ease-out ${i * 0.15}s both` }}>
                    <img src={cromo.imagen} alt="" style={{ width: "100%", aspectRatio: "1", objectFit: "cover" }} />
                    <div style={{ padding: "5px", textAlign: "center", background: getRarezaBg(cromo.rareza) }}>
                      <p style={{ fontSize: "0.5rem", margin: 0, fontWeight: "bold" }}>{cromo.nombre}</p>
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={() => router.push("/album")} style={{ padding: "14px 30px", borderRadius: "14px", border: "none", background: "linear-gradient(135deg, #3b82f6, #2563eb)", color: "white", fontWeight: "bold", cursor: "pointer", fontSize: "1rem", width: "100%" }}>Ver álbum 📖</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
