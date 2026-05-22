"use client";
import { useState, useEffect, useRef } from "react";
import { auth, db } from "../../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { CROMOS } from "../../data/cromos";
import { addFeedEvent } from "../../lib/feedHelper";

const TORTURAS = [
  // { id: "video", nombre: "El Video", emoji: "🎬", descripcion: "Aguanta el video entero sin salir" },
  { id: "contador", nombre: "El Contador", emoji: "🔢", descripcion: "Pulsa 500 veces sin parar" },
  { id: "espera", nombre: "La Espera", emoji: "🌀", descripcion: "Mantén pulsado 3 minutos" },
  { id: "texto", nombre: "El Texto", emoji: "📝", descripcion: "Escribe el texto sin errores" },
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

  // Video states
  const [videoTime, setVideoTime] = useState(0);
  const [videoDuration] = useState(180);
  const [videoOferta, setVideoOferta] = useState(false);
  const videoRef = useRef(null);
  const videoIntervalRef = useRef(null);

  // Contador states
  const [contadorTaps, setContadorTaps] = useState(0);
  const [contadorLastTap, setContadorLastTap] = useState(Date.now());
  const [contadorOferta, setContadorOferta] = useState(false);
  const contadorTimeoutRef = useRef(null);
  const contadorOfertaMostradaRef = useRef(false);
  const darPremioGuardRef = useRef(false);

  // Espera states
  const [esperaTime, setEsperaTime] = useState(0);
  const [esperaPulsado, setEsperaPulsado] = useState(false);
  const [esperaOferta, setEsperaOferta] = useState(false);
  const esperaIntervalRef = useRef(null);

  // Texto states
  const [textoObjetivo, setTextoObjetivo] = useState("");
  const [textoInput, setTextoInput] = useState("");
  const [textoIntentos, setTextoIntentos] = useState(3);
  const [textoError, setTextoError] = useState(false);

  const router = useRouter();
  const HOY = new Date().toISOString().split("T")[0];

  // Determinar tortura del día
  useEffect(() => {
    const dayOfYear = Math.floor(
      (Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000
    );
    const torturaIndex = dayOfYear % TORTURAS.length;
    setTorturaHoy(TORTURAS[torturaIndex]);
    setTextoObjetivo(TEXTOS_TORTURA[dayOfYear % TEXTOS_TORTURA.length]);
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
            setYaHechaHoy(data.fechaTortura === HOY);
          } else {
            setDatosUsuario({ cromos: [] });
          }
        } catch (err) { setDatosUsuario({ cromos: [] }); }
      } else { router.push("/"); }
      setLoading(false);
    });
    return () => unsub();
  }, [router, HOY]);

  // Cleanup intervals
  useEffect(() => {
    return () => {
      if (videoIntervalRef.current) clearInterval(videoIntervalRef.current);
      if (contadorTimeoutRef.current) clearTimeout(contadorTimeoutRef.current);
      if (esperaIntervalRef.current) clearInterval(esperaIntervalRef.current);
    };
  }, []);

  // Contador: reset si no toca en 3 seg
  useEffect(() => {
    if (fase !== "jugando" || torturaHoy?.id !== "contador") return;
    if (contadorTimeoutRef.current) clearTimeout(contadorTimeoutRef.current);
    contadorTimeoutRef.current = setTimeout(() => {
      if (contadorTaps > 0 && contadorTaps < 500 && !contadorOferta) {
        setContadorTaps(0);
      }
    }, 3000);
  }, [contadorTaps, fase, torturaHoy, contadorOferta]);

  // === HELPERS ===
  const seleccionarCromosAleatorios = (cantidad) => {
    const cromos = [];
    for (let i = 0; i < cantidad; i++) {
      const roll = Math.random() * 100;
      const rareza = roll < 1 ? "legendaria" : roll < 15 ? "rara" : "comun";
      const pool = CROMOS.filter((c) => c.rareza === rareza);
      if (pool.length > 0) {
        cromos.push(pool[Math.floor(Math.random() * pool.length)]);
      }
    }
    return cromos;
  };

  const darPremio = async (tipo) => {
    let cromos;
    if (tipo === "sobre") {
      cromos = seleccionarCromosAleatorios(5);
      setPremio("sobre");
    } else {
      cromos = seleccionarCromosAleatorios(2);
      setPremio("cromos");
    }
    setCromosGanados(cromos);

    // Guardar en Firebase
    const cromosActuales = datosUsuario?.cromos || [];
    const cromosActualizados = [...cromosActuales];
    cromos.forEach((cromo) => {
      const existing = cromosActualizados.find((c) => c.cromoId === cromo.id);
      if (existing) existing.cantidad += 1;
      else cromosActualizados.push({ cromoId: cromo.id, cantidad: 1, fechaObtenido: HOY, pegado: false });
    });

    try {
      await setDoc(doc(db, "usuarios", user.uid), {
        cromos: cromosActualizados,
        fechaTortura: HOY,
      }, { merge: true });

      addFeedEvent({
        type: "racha",
        userName: datosUsuario?.nombre || datosUsuario?.email,
        details: `🎬 Ha sobrevivido a "${torturaHoy.nombre}" y ganado ${tipo === "sobre" ? "un sobre completo" : "2 cromos"}`,
      });
    } catch (err) { console.error(err); }

    setDatosUsuario({ ...datosUsuario, cromos: cromosActualizados });
    setYaHechaHoy(true);
    setFase("premio");
  };

  const rendirse = async (darCromos = true) => {
    if (darCromos) {
      await darPremio("cromos");
    } else {
      try {
        await setDoc(doc(db, "usuarios", user.uid), {
          fechaTortura: HOY,
        }, { merge: true });
      } catch (err) { console.error(err); }
      setYaHechaHoy(true);
      setFase("intro");
    }
  };

  // === VIDEO ===
  const startVideo = () => {
    setFase("jugando");
    setVideoTime(0);
    setVideoOferta(false);
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
    }
    videoIntervalRef.current = setInterval(() => {
      setVideoTime((prev) => {
        const next = prev + 1;
        if (next >= 60 && !videoOferta) setVideoOferta(true);
        if (next >= videoDuration) {
          clearInterval(videoIntervalRef.current);
          darPremio("sobre");
        }
        return next;
      });
    }, 1000);
  };

  const videoRendirse = () => {
    clearInterval(videoIntervalRef.current);
    if (videoRef.current) videoRef.current.pause();
    rendirse(true);
  };

  const videoContinuar = () => {
    setVideoOferta(false);
    if (videoRef.current) videoRef.current.play().catch(() => {});
  };

  // === CONTADOR ===
  const startContador = () => {
    setFase("jugando");
    setContadorTaps(0);
    setContadorOferta(false);
    contadorOfertaMostradaRef.current = false;
    darPremioGuardRef.current = false;
  };

  const handleTap = () => {
    if (contadorOferta) return;
    const newTaps = contadorTaps + 1;
    setContadorTaps(newTaps);
    setContadorLastTap(Date.now());

    if (newTaps >= 200 && !contadorOfertaMostradaRef.current) {
      contadorOfertaMostradaRef.current = true;
      setContadorOferta(true);
    }
    if (newTaps >= 500 && !darPremioGuardRef.current) {
      darPremioGuardRef.current = true;
      darPremio("sobre");
    }
  };

  // === ESPERA ===
  const startEspera = () => {
    setFase("jugando");
    setEsperaTime(0);
    setEsperaPulsado(false);
    setEsperaOferta(false);
  };

  const esperaDown = () => {
    setEsperaPulsado(true);
    esperaIntervalRef.current = setInterval(() => {
      setEsperaTime((prev) => {
        const next = prev + 1;
        if (next >= 60 && !esperaOferta) setEsperaOferta(true);
        if (next >= 180) {
          clearInterval(esperaIntervalRef.current);
          darPremio("sobre");
        }
        return next;
      });
    }, 1000);
  };

  const esperaUp = () => {
    setEsperaPulsado(false);
    clearInterval(esperaIntervalRef.current);
    if (esperaTime < 180 && !esperaOferta) {
      setEsperaTime(0);
    }
  };

  // === TEXTO ===
  const startTexto = () => {
    setFase("jugando");
    setTextoInput("");
    setTextoError(false);
  };

  const handleTextoSubmit = () => {
    if (textoInput.trim() === textoObjetivo.trim()) {
      darPremio("sobre");
    } else {
      const remaining = textoIntentos - 1;
      setTextoIntentos(remaining);
      setTextoError(true);
      setTextoInput("");
      setTimeout(() => setTextoError(false), 2000);
      if (remaining <= 0) {
        rendirse(false);
      }
    }
  };

  // === RENDER HELPERS ===
  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const getBorderColor = (r) =>
    r === "legendaria" ? "#fbbf24" : r === "rara" ? "#3b82f6" : "#94a3b8";
  const getRarezaLabel = (r) =>
    r === "legendaria" ? "⭐ LEGENDARIA" : r === "rara" ? "💎 RARA" : "Común";
  const getRarezaBg = (r) =>
    r === "legendaria" ? "linear-gradient(135deg, #f59e0b, #d97706)"
      : r === "rara" ? "linear-gradient(135deg, #3b82f6, #2563eb)"
        : "linear-gradient(135deg, #475569, #334155)";

  if (loading || !torturaHoy) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh" }}>
        <p style={{ fontSize: "1.5rem" }}>Cargando...</p>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100vh", background: "#0f172a", padding: "20px",
      overflow: "hidden", position: "relative"
    }}>
      {/* HEADER */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginBottom: "20px"
      }}>
        <button onClick={() => router.push("/album")} style={{
          padding: "8px 16px", borderRadius: "10px", border: "1px solid #475569",
          background: "transparent", color: "#94a3b8", cursor: "pointer"
        }}>← Álbum</button>
      </div>

      {/* =========== YA HECHA HOY =========== */}
      {yaHechaHoy && fase !== "premio" && (
        <div style={{ textAlign: "center", paddingTop: "30px" }}>
          <p style={{ fontSize: "3.5rem", marginBottom: "10px" }}>😈</p>
          <h2 style={{ fontSize: "1.5rem", marginBottom: "6px", color: "#ef4444" }}>
            Ya has sufrido suficiente
          </h2>
          <p style={{ color: "#64748b", fontSize: "0.9rem", fontStyle: "italic", marginBottom: "30px" }}>
            ¿De verdad crees que puedes con más?
          </p>
          <div style={{
            background: "linear-gradient(145deg, #1e293b, #0f172a)",
            borderRadius: "16px", padding: "24px",
            border: "1px solid #334155",
            maxWidth: "280px", margin: "0 auto",
            boxShadow: "0 0 30px rgba(239,68,68,0.05)",
          }}>
            <p style={{ color: "#64748b", fontSize: "0.8rem", marginBottom: "10px", letterSpacing: "1px" }}>
              EL PRÓXIMO SUFRIMIENTO EN
            </p>
            <p style={{
              fontSize: "2.8rem", fontWeight: "bold", fontFamily: "monospace",
              color: "#ef4444", margin: 0, letterSpacing: "4px",
            }}>
              {countdown}
            </p>
            <p style={{ color: "#334155", fontSize: "0.7rem", marginTop: "14px", fontStyle: "italic" }}>
              ...si es que te atreves a volver
            </p>
          </div>
        </div>
      )}

      {/* =========== INTRO =========== */}
      {!yaHechaHoy && fase === "intro" && (
        <div style={{ textAlign: "center", paddingTop: "20px" }}>
          <h1 style={{ fontSize: "2rem", marginBottom: "5px" }}>
            😈 La Tortura del Día
          </h1>
          <p style={{ color: "#64748b", marginBottom: "30px", fontSize: "0.9rem" }}>
            Sufre para ganar cromos extra
          </p>

          {/* Tarjeta de tortura */}
          <div style={{
            background: "linear-gradient(145deg, #1e293b, #0f172a)",
            borderRadius: "20px", padding: "30px", maxWidth: "350px",
            margin: "0 auto 25px", border: "1px solid #334155",
            boxShadow: "0 10px 30px rgba(0,0,0,0.3)"
          }}>
            <span style={{ fontSize: "3.5rem" }}>{torturaHoy.emoji}</span>
            <h2 style={{ fontSize: "1.5rem", margin: "15px 0 8px" }}>
              {torturaHoy.nombre}
            </h2>
            <p style={{ color: "#94a3b8", fontSize: "0.9rem", marginBottom: "20px" }}>
              {torturaHoy.descripcion}
            </p>

            <div style={{
              background: "#0f172a", borderRadius: "12px",
              padding: "12px", marginBottom: "20px"
            }}>
              <div style={{
                display: "flex", justifyContent: "space-around"
              }}>
                <div style={{ textAlign: "center" }}>
                  <p style={{ color: "#f59e0b", fontSize: "0.75rem", margin: 0 }}>Rendirte</p>
                  <p style={{ fontWeight: "bold", fontSize: "1.1rem", margin: "4px 0 0" }}>2 cromos</p>
                </div>
                <div style={{
                  width: "1px", background: "#334155"
                }} />
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
              }}
              style={{
                width: "100%", padding: "16px", borderRadius: "14px",
                border: "none", fontSize: "1.1rem", fontWeight: "bold",
                cursor: "pointer", color: "white",
                background: "linear-gradient(135deg, #ef4444, #dc2626)",
                boxShadow: "0 4px 15px rgba(239,68,68,0.3)"
              }}
            >
              😈 Empezar tortura
            </button>
          </div>
        </div>
      )}

      {/* =========== VIDEO =========== */}
      {fase === "jugando" && torturaHoy.id === "video" && (
        <div style={{ textAlign: "center" }}>
          <h2 style={{ fontSize: "1.3rem", marginBottom: "15px" }}>
            🎬 Aguanta el video
          </h2>

          {/* Video player */}
          <div style={{
            maxWidth: "400px", margin: "0 auto", borderRadius: "16px",
            overflow: "hidden", border: "2px solid #334155", marginBottom: "15px"
          }}>
            <video
              ref={videoRef}
              src="/videos/tortura01.mp4"
              style={{ width: "100%", display: "block" }}
              playsInline
              autoPlay
              onEnded={() => darPremio("sobre")}
            />
          </div>

          {/* Progress */}
          <div style={{
            maxWidth: "400px", margin: "0 auto 10px"
          }}>
            <div style={{
              display: "flex", justifyContent: "space-between",
              fontSize: "0.85rem", color: "#94a3b8", marginBottom: "5px"
            }}>
              <span>{formatTime(videoTime)}</span>
              <span>{formatTime(videoDuration)}</span>
            </div>
            <div style={{
              width: "100%", height: "8px", background: "#1e293b",
              borderRadius: "4px", overflow: "hidden"
            }}>
              <div style={{
                width: `${(videoTime / videoDuration) * 100}%`,
                height: "100%",
                background: videoTime < 60 ? "#ef4444"
                  : videoTime < 120 ? "#f59e0b" : "#10b981",
                borderRadius: "4px", transition: "width 1s linear"
              }} />
            </div>
          </div>

          <p style={{
            color: videoTime < 60 ? "#ef4444" : "#f59e0b",
            fontSize: "0.85rem", marginBottom: "15px"
          }}>
            {videoTime < 60
              ? `Aguanta ${60 - videoTime}s más para 2 cromos...`
              : `¡Sigue! Faltan ${videoDuration - videoTime}s para el sobre completo`
            }
          </p>

          {/* Oferta de rendición */}
          {videoOferta && (
            <div style={{
              background: "#1e293b", borderRadius: "16px", padding: "20px",
              maxWidth: "350px", margin: "0 auto", border: "1px solid #f59e0b",
              animation: "fadeInUp 0.3s"
            }}>
              <p style={{ fontWeight: "bold", fontSize: "1.1rem", marginBottom: "15px" }}>
                ¿Rendirte ya?
              </p>
              <div style={{ display: "flex", gap: "10px" }}>
                <button onClick={videoRendirse} style={{
                  flex: 1, padding: "12px", borderRadius: "10px", border: "none",
                  background: "#f59e0b", color: "#000", fontWeight: "bold",
                  cursor: "pointer", fontSize: "0.9rem"
                }}>
                  😮‍💨 Rendirme (2 cromos)
                </button>
                <button onClick={videoContinuar} style={{
                  flex: 1, padding: "12px", borderRadius: "10px", border: "none",
                  background: "#10b981", color: "white", fontWeight: "bold",
                  cursor: "pointer", fontSize: "0.9rem"
                }}>
                  💪 Aguantar ({formatTime(videoDuration - videoTime)})
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =========== CONTADOR =========== */}
      {fase === "jugando" && torturaHoy.id === "contador" && (
        <div style={{ textAlign: "center" }}>
          <h2 style={{ fontSize: "1.3rem", marginBottom: "10px" }}>
            🔢 Pulsa 500 veces
          </h2>
          <p style={{ color: "#ef4444", fontSize: "0.75rem", marginBottom: "20px" }}>
            ⚠️ Si dejas de pulsar 3 segundos → vuelve a 0
          </p>

          {/* Contador grande */}
          <p style={{
            fontSize: "4rem", fontWeight: "bold", marginBottom: "5px",
            color: contadorTaps >= 400 ? "#10b981"
              : contadorTaps >= 200 ? "#f59e0b" : "#ef4444",
            fontFamily: "monospace"
          }}>
            {contadorTaps}
          </p>
          <p style={{ color: "#64748b", fontSize: "0.85rem", marginBottom: "20px" }}>
            / 500
          </p>

          {/* Barra */}
          <div style={{
            width: "80%", maxWidth: "300px", height: "12px",
            background: "#1e293b", borderRadius: "6px",
            margin: "0 auto 25px", overflow: "hidden"
          }}>
            <div style={{
              width: `${(contadorTaps / 500) * 100}%`, height: "100%",
              background: contadorTaps >= 400 ? "#10b981"
                : contadorTaps >= 200 ? "#f59e0b" : "#ef4444",
              borderRadius: "6px", transition: "width 0.1s"
            }} />
          </div>

          {/* Oferta a los 200 */}
          {contadorOferta && (
            <div style={{
              background: "#1e293b", borderRadius: "16px", padding: "20px",
              maxWidth: "350px", margin: "0 auto 20px", border: "1px solid #f59e0b",
              animation: "fadeInUp 0.3s"
            }}>
              <p style={{ fontWeight: "bold", marginBottom: "15px" }}>
                200 taps. ¿Rendirte?
              </p>
              <div style={{ display: "flex", gap: "10px" }}>
                <button onClick={() => rendirse(true)} style={{
                  flex: 1, padding: "12px", borderRadius: "10px", border: "none",
                  background: "#f59e0b", color: "#000", fontWeight: "bold", cursor: "pointer"
                }}>
                  😮‍💨 2 cromos
                </button>
                <button onClick={() => setContadorOferta(false)} style={{
                  flex: 1, padding: "12px", borderRadius: "10px", border: "none",
                  background: "#10b981", color: "white", fontWeight: "bold", cursor: "pointer"
                }}>
                  💪 Seguir (faltan {500 - contadorTaps})
                </button>
              </div>
            </div>
          )}

          {/* Botón TAP */}
          {!contadorOferta && (
            <button onClick={handleTap} style={{
              width: "180px", height: "180px", borderRadius: "50%",
              border: "none", fontSize: "1.3rem", fontWeight: "bold",
              cursor: "pointer", color: "white",
              background: "linear-gradient(145deg, #ef4444, #dc2626)",
              boxShadow: "0 8px 25px rgba(239,68,68,0.4)",
              transform: "scale(1)",
              transition: "transform 0.05s",
              userSelect: "none",
              WebkitUserSelect: "none",
            }}
              onMouseDown={(e) => e.target.style.transform = "scale(0.92)"}
              onMouseUp={(e) => e.target.style.transform = "scale(1)"}
              onTouchStart={(e) => e.target.style.transform = "scale(0.92)"}
              onTouchEnd={(e) => e.target.style.transform = "scale(1)"}
            >
              TAP
            </button>
          )}
        </div>
      )}

      {/* =========== ESPERA =========== */}
      {fase === "jugando" && torturaHoy.id === "espera" && (
        <div style={{ textAlign: "center" }}>
          <h2 style={{ fontSize: "1.3rem", marginBottom: "10px" }}>
            🌀 Mantén pulsado
          </h2>
          <p style={{ color: "#ef4444", fontSize: "0.75rem", marginBottom: "20px" }}>
            ⚠️ Si levantas el dedo → vuelve a 0
          </p>

          {/* Timer */}
          <p style={{
            fontSize: "3.5rem", fontWeight: "bold", marginBottom: "5px",
            fontFamily: "monospace",
            color: esperaTime >= 120 ? "#10b981"
              : esperaTime >= 60 ? "#f59e0b" : "#ef4444"
          }}>
            {formatTime(esperaTime)}
          </p>
          <p style={{ color: "#64748b", fontSize: "0.85rem", marginBottom: "20px" }}>
            / {formatTime(180)}
          </p>

          {/* Barra */}
          <div style={{
            width: "80%", maxWidth: "300px", height: "12px",
            background: "#1e293b", borderRadius: "6px",
            margin: "0 auto 25px", overflow: "hidden"
          }}>
            <div style={{
              width: `${(esperaTime / 180) * 100}%`, height: "100%",
              background: esperaTime >= 120 ? "#10b981"
                : esperaTime >= 60 ? "#f59e0b" : "#ef4444",
              borderRadius: "6px", transition: "width 1s linear"
            }} />
          </div>

          {/* Oferta al minuto */}
          {esperaOferta && !esperaPulsado && (
            <div style={{
              background: "#1e293b", borderRadius: "16px", padding: "20px",
              maxWidth: "350px", margin: "0 auto 20px", border: "1px solid #f59e0b",
              animation: "fadeInUp 0.3s"
            }}>
              <p style={{ fontWeight: "bold", marginBottom: "15px" }}>
                1 minuto aguantando. ¿Rendirte?
              </p>
              <div style={{ display: "flex", gap: "10px" }}>
                <button onClick={() => rendirse(true)} style={{
                  flex: 1, padding: "12px", borderRadius: "10px", border: "none",
                  background: "#f59e0b", color: "#000", fontWeight: "bold", cursor: "pointer"
                }}>
                  😮‍💨 2 cromos
                </button>
                <button onClick={() => { setEsperaOferta(false); }} style={{
                  flex: 1, padding: "12px", borderRadius: "10px", border: "none",
                  background: "#10b981", color: "white", fontWeight: "bold", cursor: "pointer"
                }}>
                  💪 Seguir
                </button>
              </div>
            </div>
          )}

          {/* Botón HOLD */}
          {!(esperaOferta && !esperaPulsado) && (
            <button
              onMouseDown={esperaDown} onMouseUp={esperaUp} onMouseLeave={esperaUp}
              onTouchStart={esperaDown} onTouchEnd={esperaUp}
              style={{
                width: "180px", height: "180px", borderRadius: "50%",
                border: "none", fontSize: "1.1rem", fontWeight: "bold",
                cursor: "pointer", color: "white",
                background: esperaPulsado
                  ? "linear-gradient(145deg, #10b981, #059669)"
                  : "linear-gradient(145deg, #ef4444, #dc2626)",
                boxShadow: esperaPulsado
                  ? "0 0 30px rgba(16,185,129,0.5)"
                  : "0 8px 25px rgba(239,68,68,0.4)",
                transition: "all 0.2s",
                userSelect: "none", WebkitUserSelect: "none",
              }}
            >
              {esperaPulsado ? "AGUANTA..." : "PULSA Y MANTÉN"}
            </button>
          )}

          {!esperaPulsado && esperaTime > 0 && !esperaOferta && (
            <p style={{ color: "#ef4444", fontSize: "1rem", marginTop: "15px", animation: "shake 0.5s" }}>
              ¡Has soltado! Vuelve a empezar 😈
            </p>
          )}
        </div>
      )}

      {/* =========== TEXTO =========== */}
      {fase === "jugando" && torturaHoy.id === "texto" && (
        <div style={{ maxWidth: "500px", margin: "0 auto" }}>
          <h2 style={{ fontSize: "1.3rem", marginBottom: "10px", textAlign: "center" }}>
            📝 Copia el texto exacto
          </h2>
          <p style={{ color: "#64748b", fontSize: "0.75rem", textAlign: "center", marginBottom: "15px" }}>
            Intentos restantes: {"❤️".repeat(textoIntentos)}{"🖤".repeat(3 - textoIntentos)}
          </p>

          {/* Texto a copiar */}
          <div style={{
            background: "#1e293b", borderRadius: "12px", padding: "15px",
            marginBottom: "15px", border: "1px solid #334155",
            fontSize: "0.85rem", lineHeight: 1.6, color: "#e2e8f0",
            userSelect: "none", WebkitUserSelect: "none"
          }}>
            {textoObjetivo}
          </div>

          {/* Input */}
          <textarea
            value={textoInput}
            onChange={(e) => setTextoInput(e.target.value)}
            onPaste={(e) => e.preventDefault()}
            placeholder="Escribe el texto aquí... (copiar y pegar bloqueado)"
            style={{
              width: "100%", minHeight: "150px", padding: "15px",
              borderRadius: "12px", border: textoError ? "2px solid #ef4444" : "1px solid #334155",
              background: "#0f172a", color: "white", fontSize: "0.85rem",
              lineHeight: 1.6, resize: "vertical",
              fontFamily: "Arial, sans-serif"
            }}
          />

          {textoError && (
            <p style={{ color: "#ef4444", textAlign: "center", marginTop: "8px", animation: "shake 0.5s" }}>
              ❌ No coincide. Intentos restantes: {textoIntentos}
            </p>
          )}

          <div style={{ display: "flex", gap: "10px", marginTop: "15px" }}>
            <button onClick={() => rendirse(true)} style={{
              flex: 1, padding: "14px", borderRadius: "12px", border: "none",
              background: "#f59e0b", color: "#000", fontWeight: "bold", cursor: "pointer"
            }}>
              😮‍💨 Rendirme (2 cromos)
            </button>
            <button onClick={handleTextoSubmit} style={{
              flex: 1, padding: "14px", borderRadius: "12px", border: "none",
              background: "#10b981", color: "white", fontWeight: "bold", cursor: "pointer"
            }}>
              ✅ Comprobar
            </button>
          </div>
        </div>
      )}

      {/* =========== PREMIO =========== */}
      {fase === "premio" && (
        <div style={{ textAlign: "center", animation: "fadeInUp 0.5s" }}>
          <p style={{ fontSize: "3rem", marginBottom: "10px" }}>
            {premio === "sobre" ? "🎉" : "😮‍💨"}
          </p>
          <h2 style={{ fontSize: "1.5rem", marginBottom: "8px" }}>
            {premio === "sobre" ? "¡HAS SOBREVIVIDO!" : "Te has rendido..."}
          </h2>
          <p style={{ color: "#94a3b8", marginBottom: "25px" }}>
            {premio === "sobre"
              ? "Has ganado un sobre completo (5 cromos)"
              : "Has ganado 2 cromos de consolación"
            }
          </p>

          {/* Cromos ganados */}
          <div style={{
            display: "grid",
            gridTemplateColumns: `repeat(${Math.min(cromosGanados.length, 3)}, 1fr)`,
            gap: "10px", maxWidth: "350px",
            margin: "0 auto 30px"
          }}>
            {cromosGanados.map((cromo, i) => (
              <div key={i} style={{
                borderRadius: "12px",
                border: `2px solid ${getBorderColor(cromo.rareza)}`,
                overflow: "hidden", background: "#1e293b",
                animation: `fadeInUp 0.4s ease-out ${i * 0.1}s both`
              }}>
                <img src={cromo.imagen} alt="" style={{
                  width: "100%", aspectRatio: "1", objectFit: "cover"
                }} />
                <div style={{
                  padding: "5px", textAlign: "center",
                  background: getRarezaBg(cromo.rareza)
                }}>
                  <p style={{ fontSize: "0.5rem", margin: 0, fontWeight: "bold" }}>
                    {cromo.nombre}
                  </p>
                  <p style={{ fontSize: "0.45rem", margin: 0, opacity: 0.8 }}>
                    {getRarezaLabel(cromo.rareza)}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <button onClick={() => router.push("/album")} style={{
            padding: "14px 30px", borderRadius: "14px", border: "none",
            background: "linear-gradient(135deg, #3b82f6, #2563eb)",
            color: "white", fontWeight: "bold", cursor: "pointer", fontSize: "1rem"
          }}>
            Ver álbum 📖
          </button>
        </div>
      )}
    </div>
  );
}