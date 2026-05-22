"use client";
import { useState, useEffect, useRef } from "react";
import { auth, db } from "../../lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { PAGINAS, CROMOS } from "../../data/cromos";
import { addFeedEvent } from "../../lib/feedHelper";

export default function AlbumPage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [misCromos, setMisCromos] = useState([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [pegandoCromo, setPegandoCromo] = useState(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [paginaCompletada, setPaginaCompletada] = useState(null);
  const scrollRef = useRef(null);
  const [miNombre, setMiNombre] = useState("");
  const [rachaActual, setRachaActual] = useState(0);
  const router = useRouter();
  const [previewCromo, setPreviewCromo] = useState(null);
  const [previewFlipped, setPreviewFlipped] = useState(false);
  const longPressRef = useRef(null);
  const longPressActivatedRef = useRef(false);

  const getRotation = (id) => ((id * 7 + 3) % 11 - 5) * 0.7;

  const tieneMitica = () => misCromos.some((c) => {
    const info = CROMOS.find((x) => x.id === c.cromoId);
    return info?.rareza === "mitica";
  });
  const visiblePaginas = PAGINAS.filter((p) => !p.oculta || tieneMitica());

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        try {
          const snap = await getDoc(doc(db, "usuarios", u.uid));
          if (snap.exists()) {
            const data = snap.data();
            setMisCromos(data.cromos || []);
            setMiNombre(data.nombre || data.email || "");
            const fecha = data.fechaUltimaApertura || "";
            const hoy = new Date().toISOString().split("T")[0];
            const ayer = new Date(Date.now() - 86400000).toISOString().split("T")[0];
            if (fecha === hoy || fecha === ayer) {
              setRachaActual(data.rachaActual || 0);
            }
          }
        } catch (err) { console.error(err); }
      } else {
        router.push("/");
      }
      setLoading(false);
    });
    return () => unsub();
  }, [router]);

  // Auto-scroll desde mazo
  useEffect(() => {
    if (!loading && scrollRef.current) {
      const params = new URLSearchParams(window.location.search);
      const pageParam = params.get("page");
      if (pageParam !== null) {
        const idx = parseInt(pageParam);
        if (!isNaN(idx) && idx >= 0 && idx < visiblePaginas.length) {
          setTimeout(() => {
            scrollRef.current.scrollTo({
              left: idx * scrollRef.current.offsetWidth,
              behavior: "smooth",
            });
          }, 300);
        }
      }
    }
  }, [loading]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const page = Math.round(el.scrollLeft / el.offsetWidth);
    setCurrentPage(page);
  };

  const goToPage = (idx) => {
    scrollRef.current?.scrollTo({
      left: idx * scrollRef.current.offsetWidth,
      behavior: "smooth",
    });
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/");
  };

  // === Helpers ===
  const estaPegado = (cromoId) => {
    const mio = misCromos.find((c) => c.cromoId === cromoId);
    if (!mio) return false;
    return mio.pegado !== false;
  };

  const enMazo = (cromoId) => {
    const mio = misCromos.find((c) => c.cromoId === cromoId);
    return mio && mio.pegado === false;
  };

  const cromosSinPegar = misCromos.filter((c) => c.pegado === false).length;

  const totalPegados = misCromos.filter((c) => c.pegado !== false && c.cantidad >= 1).length;
  const idsObtenidos = misCromos.filter((c) => c.pegado !== false).map((c) => c.cromoId);
  const totalCromos = CROMOS.filter((c) => c.rareza !== "mitica").length;
  const porcentaje = Math.round((totalPegados / totalCromos) * 100);

  const getBorderColor = (r) =>
    r === "legendaria" ? "#fbbf24" : r === "rara" ? "#3b82f6" : "#94a3b8";

  const getRarezaLabel = (r) =>
    r === "legendaria" ? "⭐" : r === "rara" ? "💎" : "";

  const getRarezaBg = (r) =>
    r === "legendaria" ? "linear-gradient(135deg, #f59e0b, #d97706)"
      : r === "rara" ? "linear-gradient(135deg, #3b82f6, #2563eb)"
        : "linear-gradient(135deg, #475569, #334155)";

  const startLongPress = (cromo) => {
    longPressRef.current = setTimeout(() => {
      longPressActivatedRef.current = true;
      if (navigator.vibrate) navigator.vibrate(30);
      setPreviewCromo(cromo);
      setPreviewFlipped(false);
      setTimeout(() => setPreviewFlipped(true), 150);
    }, 450);
  };

  const cancelLongPress = () => {
    if (longPressRef.current) {
      clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
  };

  const closePreview = () => {
    setPreviewCromo(null);
    setPreviewFlipped(false);
  };

  // === PEGAR CROMO ===
  const pegarCromo = async (cromoId) => {
    const cromoInfo = CROMOS.find((c) => c.id === cromoId);
    if (!cromoInfo) return;

    setPegandoCromo(cromoInfo);

    // Actualizar datos locales
    const updated = misCromos.map((c) => {
      if (c.cromoId === cromoId) return { ...c, pegado: true };
      return c;
    });

    // Esperar animación
    await new Promise((r) => setTimeout(r, 900));
    setMisCromos(updated);
    setPegandoCromo(null);

    // Comprobar si la página está completa
    const paginaId = cromoInfo.pagina;
    const cromosDePagina = CROMOS.filter((c) => c.pagina === paginaId);
    const todosPegados = cromosDePagina.every((c) => {
      const mio = updated.find((m) => m.cromoId === c.id);
      return mio && mio.pegado !== false;
    });

    if (todosPegados) {
      setPaginaCompletada(paginaId);
      addFeedEvent({
        type: "pagina_completada",
        userName: miNombre,
        details: `¡Ha completado la página ${PAGINAS.find(p => p.id === paginaId)?.emoji} ${PAGINAS.find(p => p.id === paginaId)?.nombre}!`,
      });
      setShowConfetti(true);
      setTimeout(() => {
        setShowConfetti(false);
        setPaginaCompletada(null);
      }, 3500);
    }

    // Guardar en Firebase
    try {
      setDoc(doc(db, "usuarios", user.uid), { cromos: updated }, { merge: true });
    } catch (err) { console.error(err); }
  };

  // === Confetti ===
  const confettiPieces = Array.from({ length: 40 }, (_, i) => ({
    left: Math.random() * 100,
    delay: Math.random() * 1.5,
    duration: 2 + Math.random() * 2,
    color: ["#fbbf24", "#ef4444", "#10b981", "#3b82f6", "#8b5cf6", "#f59e0b", "#ec4899"][i % 7],
    size: 6 + Math.random() * 8,
    rotation: Math.random() * 360,
  }));

  if (loading) {
    return (
      <div style={{
        display: "flex", justifyContent: "center", alignItems: "center",
        minHeight: "100vh"
      }}>
        <p style={{ fontSize: "1.5rem" }}>Cargando álbum...</p>
      </div>
    );
  }

  const paginaActual = visiblePaginas[currentPage] || PAGINAS[0];

  return (
    <div style={{ minHeight: "100vh", background: "#0f172a", overflow: "hidden" }}>
      <style>{`
        @keyframes previewFadeIn { from { opacity: 0; } to { opacity: 1; } }
        .preview-inner {
          width: 100%; height: 100%; position: relative;
          transform-style: preserve-3d;
          transition: transform 0.8s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .preview-inner.flipped { transform: rotateY(0deg); }
        .preview-inner:not(.flipped) { transform: rotateY(180deg); }
        .preview-face {
          position: absolute; top: 0; left: 0; right: 0; bottom: 0;
          backface-visibility: hidden; -webkit-backface-visibility: hidden;
          border-radius: 18px; overflow: hidden;
        }
        .preview-back { transform: rotateY(180deg); }
      `}</style>
      {/* === HEADER === */}
      <header style={{
        background: "#1e293b", padding: "12px 15px",
        borderBottom: "2px solid #334155"
      }}>
        <div style={{
          display: "flex", justifyContent: "space-between",
          alignItems: "center", marginBottom: "8px"
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <h1 style={{ fontSize: "1.2rem", margin: 0, letterSpacing: "1px" }}>
                Album Yeissy
              </h1>
              {rachaActual > 0 && (
                <span style={{
                  fontSize: "0.8rem", color: "#f59e0b",
                  background: "#1e293b", padding: "2px 6px",
                  borderRadius: "8px"
                }}>🔥{rachaActual}</span>
              )}
            </div>
            <p style={{ color: "#94a3b8", fontSize: "0.75rem", margin: 0 }}>
              {totalPegados}/{totalCromos} pegados ({porcentaje}%)
            </p>
          </div>
          <button onClick={handleLogout} style={{
            padding: "6px 12px", borderRadius: "8px", border: "1px solid #475569",
            background: "transparent", color: "#64748b", cursor: "pointer",
            fontSize: "0.75rem"
          }}>
            Salir
          </button>
        </div>

        {/* Barra de progreso */}
        <div style={{
          width: "100%", height: "6px", background: "#0f172a",
          borderRadius: "3px", marginBottom: "10px", overflow: "hidden"
        }}>
          <div style={{
            width: `${porcentaje}%`, height: "100%",
            background: "linear-gradient(90deg, #3b82f6, #10b981)",
            borderRadius: "3px", transition: "width 0.5s"
          }} />
        </div>

        {/* Botones de navegación */}
        <div style={{ display: "flex", gap: "6px" }}>
          <button onClick={() => router.push("/mazo")} style={{
            flex: 1, padding: "8px", borderRadius: "10px", border: "none",
            background: cromosSinPegar > 0 ? "#f59e0b" : "#334155",
            color: cromosSinPegar > 0 ? "#000" : "#94a3b8",
            fontWeight: "bold", cursor: "pointer", fontSize: "0.8rem",
            position: "relative"
          }}>
            📋 Mazo
            {cromosSinPegar > 0 && (
              <span style={{
                position: "absolute", top: "-5px", right: "-5px",
                background: "#ef4444", color: "white", borderRadius: "50%",
                width: "20px", height: "20px", fontSize: "0.65rem",
                display: "flex", justifyContent: "center", alignItems: "center",
                fontWeight: "bold"
              }}>
                {cromosSinPegar}
              </span>
            )}
          </button>
          <button onClick={() => router.push("/abrir-sobre")} style={{
            flex: 1, padding: "8px", borderRadius: "10px", border: "none",
            background: "#334155", color: "white",
            fontWeight: "bold", cursor: "pointer", fontSize: "0.8rem"
          }}>
            📦 Sobre
          </button>
          <button onClick={() => router.push("/mercado")} style={{
            flex: 1, padding: "8px", borderRadius: "10px", border: "none",
            background: "#334155", color: "white",
            fontWeight: "bold", cursor: "pointer", fontSize: "0.8rem"
          }}>
            🔄 Mercado
          </button>
          <button onClick={() => router.push("/tortura")} style={{
            padding: "8px 12px", borderRadius: "10px", border: "none",
            background: "#334155", color: "white",
            fontWeight: "bold", cursor: "pointer", fontSize: "0.8rem"
          }}>
            💰
          </button>
          <button onClick={() => router.push("/ranking")} style={{
            padding: "8px 12px", borderRadius: "10px", border: "none",
            background: "#334155", color: "white",
            fontWeight: "bold", cursor: "pointer", fontSize: "0.8rem"
          }}>
            🏆
          </button>
          <button onClick={() => router.push("/feed")} style={{
            padding: "8px 12px", borderRadius: "10px", border: "none",
            background: "#334155", color: "white",
            fontWeight: "bold", cursor: "pointer", fontSize: "0.8rem"
          }}>
            📢
          </button>
        </div>
      </header>

      {/* === CAROUSEL === */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="album-scroll"
        style={{
          display: "flex",
          overflowX: "auto",
          scrollSnapType: "x mandatory",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {visiblePaginas.map((pagina, pageIdx) => {
          const cromosPage = CROMOS.filter((c) => c.pagina === pagina.id);
          const pegadosPage = cromosPage.filter((c) => estaPegado(c.id)).length;
          const completaPage = pegadosPage === cromosPage.length && cromosPage.length > 0;

          return (
            <div
              key={pagina.id}
              style={{
                minWidth: "100%",
                scrollSnapAlign: "start",
                padding: "20px 15px 100px 15px",
              }}
            >
              {/* Título de página */}
              <div style={{
                textAlign: "center", marginBottom: "20px",
              }}>
                <span style={{ fontSize: "2.5rem" }}>{pagina.emoji}</span>
                <h2 style={{
                  fontSize: "1.4rem", margin: "8px 0 4px",
                  letterSpacing: "1px"
                }}>
                  {pagina.nombre}
                  {completaPage && " ✅"}
                </h2>
                <p style={{ color: "#64748b", fontSize: "0.85rem" }}>
                  {pegadosPage}/{cromosPage.length} cromos pegados
                </p>
              </div>

              {/* Fondo de "página de álbum" */}
              <div style={{
                background: "linear-gradient(145deg, #1a1f2e, #161b28)",
                borderRadius: "20px",
                padding: "18px",
                border: "1px solid #2a3040",
                boxShadow: "inset 0 2px 10px rgba(0,0,0,0.3), 0 5px 20px rgba(0,0,0,0.2)",
              }}>
                {/* Grid de cromos estilo pegatina */}
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: "14px",
                  maxWidth: "400px",
                  margin: "0 auto"
                }}>
                  {cromosPage.map((cromo) => {
                    const pegado = estaPegado(cromo.id);
                    const disponible = enMazo(cromo.id);
                    const rotation = getRotation(cromo.id);
                    const mio = misCromos.find((c) => c.cromoId === cromo.id);
                    const cantidad = mio ? mio.cantidad : 0;

                    return (
                      <div
                        key={cromo.id}
                        onClick={() => {
                          if (longPressActivatedRef.current) {
                            longPressActivatedRef.current = false;
                            return;
                          }
                          disponible && pegarCromo(cromo.id);
                        }}
                        onTouchStart={(e) => { if (pegado || disponible) { e.preventDefault(); startLongPress(cromo); } }}
                        onTouchEnd={cancelLongPress}
                        onTouchMove={cancelLongPress}
                        onMouseDown={() => (pegado || disponible) && startLongPress(cromo)}
                        onMouseUp={cancelLongPress}
                        onMouseLeave={cancelLongPress}
                        onContextMenu={(e) => e.preventDefault()}
                        style={{
                          aspectRatio: "1",
                          borderRadius: "10px",
                          position: "relative",
                          cursor: disponible ? "pointer" : "default",
                          transform: pegado ? `rotate(${rotation}deg)` : "none",
                          transition: "transform 0.3s",
                          ...(disponible ? {
                            animation: "glowPulse 1.5s infinite",
                            border: "3px solid rgba(251,191,36,0.5)",
                            borderRadius: "12px",
                          } : pegado ? {
                            border: `3px solid ${getBorderColor(cromo.rareza)}`,
                            boxShadow: `3px 3px 8px rgba(0,0,0,0.4), 
                              0 0 ${cromo.rareza === "legendaria" ? "15px rgba(251,191,36,0.3)" : "0px transparent"}`,
                          } : {
                            border: "3px dashed #2a3040",
                          }),
                          background: pegado || disponible ? "#1e293b" : "rgba(15,23,42,0.5)",
                          overflow: "hidden",
                          WebkitTouchCallout: "none",
                          userSelect: "none",
                          WebkitUserSelect: "none",
                        }}
                      >
                        {pegado ? (
                          <>
                            {/* Cromo pegado */}
                            <img
                              src={cromo.imagen}
                              alt={cromo.nombre}
                              draggable={false}
                              style={{
                                width: "100%", height: "100%",
                                objectFit: "cover", borderRadius: "7px",
                                pointerEvents: "none",
                                WebkitTouchCallout: "none",
                              }}
                            />
                            {/* Nombre */}
                            <div style={{
                              position: "absolute", bottom: 0, width: "100%",
                              background: "linear-gradient(transparent, rgba(0,0,0,0.8))",
                              padding: "15px 4px 4px",
                              textAlign: "center"
                            }}>
                              <span style={{ fontSize: "0.6rem", fontWeight: "bold" }}>
                                {cromo.nombre}
                              </span>
                            </div>
                            {/* Rareza icon */}
                            {cromo.rareza !== "comun" && (
                              <div style={{
                                position: "absolute", top: "3px", left: "3px",
                                fontSize: "0.7rem"
                              }}>
                                {getRarezaLabel(cromo.rareza)}
                              </div>
                            )}
                            {/* Repetidos badge */}
                            {cantidad > 1 && (
                              <div style={{
                                position: "absolute", top: "3px", right: "3px",
                                background: "#ef4444", borderRadius: "50%",
                                width: "20px", height: "20px",
                                display: "flex", justifyContent: "center", alignItems: "center",
                                fontSize: "0.6rem", fontWeight: "bold"
                              }}>
                                x{cantidad}
                              </div>
                            )}
                            {/* Shimmer para legendarias */}
                            {cromo.rareza === "legendaria" && (
                              <div style={{
                                position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
                                overflow: "hidden", borderRadius: "7px", pointerEvents: "none"
                              }}>
                                <div style={{
                                  position: "absolute",
                                  top: 0, width: "30%", height: "100%",
                                  background: "linear-gradient(90deg, transparent, rgba(251,191,36,0.15), transparent)",
                                  animation: "legendarioShimmer 3s linear infinite",
                                }} />
                              </div>
                            )}
                          </>
                        ) : disponible ? (
                          <>
                            {/* Hueco disponible para pegar */}
                            <div style={{
                              width: "100%", height: "100%",
                              display: "flex", flexDirection: "column",
                              justifyContent: "center", alignItems: "center",
                              background: "rgba(251,191,36,0.05)",
                            }}>
                              <span style={{
                                fontSize: "1.5rem", marginBottom: "4px",
                                animation: "pulsoSuave 1s infinite"
                              }}>👆</span>
                              <span style={{
                                fontSize: "0.6rem", color: "#fbbf24",
                                fontWeight: "bold"
                              }}>
                                ¡Pegar!
                              </span>
                            </div>
                          </>
                        ) : (
                          <>
                            {/* Hueco vacío */}
                            <div style={{
                              width: "100%", height: "100%",
                              display: "flex", flexDirection: "column",
                              justifyContent: "center", alignItems: "center",
                            }}>
                              <span style={{ fontSize: "1.5rem", opacity: 0.15 }}>❓</span>
                              <span style={{
                                fontSize: "0.6rem", color: "#334155", marginTop: "3px"
                              }}>
                                #{cromo.id}
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>

{/* === FLECHAS PC === */}
      <button
        onClick={() => goToPage(Math.max(0, currentPage - 1))}
        style={{
          position: "fixed",
          left: "10px",
          top: "50%",
          transform: "translateY(-50%)",
          zIndex: 20,
          width: "44px",
          height: "44px",
          borderRadius: "50%",
          border: "1px solid #334155",
          background: "rgba(30,41,59,0.9)",
          color: currentPage === 0 ? "#334155" : "#94a3b8",
          fontSize: "1.2rem",
          cursor: currentPage === 0 ? "default" : "pointer",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          backdropFilter: "blur(10px)",
        }}
      >
        ←
      </button>
      <button
        onClick={() => goToPage(Math.min(visiblePaginas.length - 1, currentPage + 1))}
        style={{
          position: "fixed",
          right: "10px",
          top: "50%",
          transform: "translateY(-50%)",
          zIndex: 20,
          width: "44px",
          height: "44px",
          borderRadius: "50%",
          border: "1px solid #334155",
          background: "rgba(30,41,59,0.9)",
          color: currentPage === visiblePaginas.length - 1 ? "#334155" : "#94a3b8",
          fontSize: "1.2rem",
          cursor: currentPage === visiblePaginas.length - 1 ? "default" : "pointer",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          backdropFilter: "blur(10px)",
        }}
      >
        →
      </button>

      {/* === PAGE DOTS === */}
      <div style={{
        position: "fixed", bottom: "15px", left: 0, right: 0,
        display: "flex", justifyContent: "center", gap: "6px",
        zIndex: 20, padding: "10px",
      }}>
        <div style={{
          display: "flex", gap: "6px",
          background: "rgba(15,23,42,0.9)",
          padding: "8px 14px",
          borderRadius: "20px",
          backdropFilter: "blur(10px)",
          border: "1px solid #334155"
        }}>
          {visiblePaginas.map((p, idx) => {
            const cromosP = CROMOS.filter((c) => c.pagina === p.id);
            const pegadosP = cromosP.filter((c) => estaPegado(c.id)).length;
            const completaP = pegadosP === cromosP.length && cromosP.length > 0;

            return (
              <button
                key={p.id}
                onClick={() => goToPage(idx)}
                style={{
                  width: currentPage === idx ? "24px" : "8px",
                  height: "8px",
                  borderRadius: "4px",
                  border: "none",
                  cursor: "pointer",
                  transition: "all 0.3s",
                  background: completaP
                    ? "#10b981"
                    : currentPage === idx
                      ? "#f59e0b"
                      : "#475569",
                }}
                title={p.nombre}
              />
            );
          })}
        </div>
      </div>

      {/* === ANIMACIÓN DE PEGADO === */}
      {pegandoCromo && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.5)",
          zIndex: 80,
          display: "flex", justifyContent: "center", alignItems: "center",
          pointerEvents: "none"
        }}>
          <div style={{
            width: "200px", height: "200px",
            borderRadius: "15px",
            overflow: "hidden",
            border: `4px solid ${getBorderColor(pegandoCromo.rareza)}`,
            animation: "pegadoAnim 0.9s ease-out forwards",
            boxShadow: "0 10px 40px rgba(0,0,0,0.5)"
          }}>
            <img
              src={pegandoCromo.imagen}
              alt={pegandoCromo.nombre}
              style={{
                width: "100%", height: "100%", objectFit: "cover"
              }}
            />
          </div>
          {/* Flash */}
          <div style={{
            position: "absolute",
            width: "300px", height: "300px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(255,255,255,0.3), transparent 70%)",
            animation: "pegadoFlash 0.8s ease-out forwards",
            pointerEvents: "none"
          }} />
        </div>
      )}

      {/* === CONFETTI === */}
      {showConfetti && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          zIndex: 90, pointerEvents: "none", overflow: "hidden"
        }}>
          {confettiPieces.map((piece, i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                left: `${piece.left}%`,
                top: "-20px",
                width: `${piece.size}px`,
                height: `${piece.size * 0.6}px`,
                background: piece.color,
                borderRadius: "2px",
                animation: `confettiFall ${piece.duration}s ease-in ${piece.delay}s forwards`,
                transform: `rotate(${piece.rotation}deg)`,
              }}
            />
          ))}
          {/* Texto de página completada */}
          {paginaCompletada && (
            <div style={{
              position: "absolute", top: "30%", left: 0, right: 0,
              textAlign: "center",
              animation: "paginaCompletaTexto 0.6s ease-out",
            }}>
              <p style={{
                fontSize: "2rem", fontWeight: "bold",
                textShadow: "0 4px 20px rgba(0,0,0,0.5)",
                marginBottom: "10px"
              }}>
                🎉 ¡PÁGINA COMPLETADA! 🎉
              </p>
              <p style={{
                fontSize: "1.2rem", color: "#fbbf24",
                textShadow: "0 2px 10px rgba(0,0,0,0.5)"
              }}>
                {PAGINAS.find((p) => p.id === paginaCompletada)?.emoji}{" "}
                {PAGINAS.find((p) => p.id === paginaCompletada)?.nombre}
              </p>
            </div>
          )}
        </div>
      )}

      {/* === PREVIEW CROMO === */}
      {previewCromo && (
        <div
          onClick={closePreview}
          style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(0,0,0,0.88)", zIndex: 100,
            display: "flex", flexDirection: "column",
            justifyContent: "center", alignItems: "center",
            backdropFilter: "blur(6px)",
            animation: "previewFadeIn 0.2s ease-out",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ perspective: "1000px", width: "260px", height: "370px" }}
          >
            <div className={`preview-inner ${previewFlipped ? "flipped" : ""}`}>
              {/* Dorso */}
              <div className="preview-face preview-back" style={{
                background: "linear-gradient(160deg, #0c1929, #122240, #0a1628)",
                border: "2px solid #1e3a5f",
                display: "flex", flexDirection: "column",
                justifyContent: "center", alignItems: "center",
              }}>
                <div style={{ width: "80px", height: "80px", borderRadius: "50%", border: "1.5px solid rgba(251,191,36,0.2)", display: "flex", justifyContent: "center", alignItems: "center", marginBottom: "12px" }}>
                  <div style={{ width: "60px", height: "60px", borderRadius: "50%", border: "1px solid rgba(251,191,36,0.1)", display: "flex", justifyContent: "center", alignItems: "center" }}>
                    <span style={{ fontSize: "1.6rem", fontWeight: "bold", color: "rgba(251,191,36,0.5)", fontFamily: "Georgia, serif" }}>AY</span>
                  </div>
                </div>
                <span style={{ fontSize: "0.55rem", color: "rgba(251,191,36,0.3)", letterSpacing: "4px" }}>ÁLBUM</span>
                <span style={{ fontSize: "0.9rem", color: "rgba(251,191,36,0.4)", letterSpacing: "5px", fontWeight: "bold", fontFamily: "Georgia, serif" }}>YEISSY</span>
              </div>

              {/* Frente */}
              <div className="preview-face" style={{
                border: `3px solid ${getBorderColor(previewCromo.rareza)}`,
                background: "#1e293b",
                boxShadow: previewCromo.rareza === "legendaria"
                  ? "0 0 40px rgba(251,191,36,0.5), 0 20px 60px rgba(0,0,0,0.7)"
                  : previewCromo.rareza === "rara"
                    ? "0 0 25px rgba(59,130,246,0.4), 0 20px 60px rgba(0,0,0,0.7)"
                    : "0 20px 60px rgba(0,0,0,0.7)",
              }}>
                <img
                  src={previewCromo.imagen}
                  alt={previewCromo.nombre}
                  style={{ width: "100%", height: "72%", objectFit: "cover" }}
                />
                <div style={{
                  height: "28%",
                  display: "flex", flexDirection: "column",
                  justifyContent: "center", alignItems: "center",
                  padding: "10px",
                  background: getRarezaBg(previewCromo.rareza),
                }}>
                  <p style={{ margin: 0, fontWeight: "bold", fontSize: "1rem", textAlign: "center" }}>
                    {previewCromo.nombre}
                  </p>
                  <p style={{ margin: "4px 0 0", fontSize: "0.8rem", opacity: 0.9 }}>
                    {previewCromo.rareza === "legendaria" ? "⭐ LEGENDARIA"
                      : previewCromo.rareza === "rara" ? "💎 RARA"
                      : previewCromo.rareza === "mitica" ? "🔴 MÍTICA"
                      : "Común"}
                  </p>
                </div>
              </div>
            </div>
          </div>
          <p style={{ marginTop: "30px", color: "#475569", fontSize: "0.8rem" }}>
            Toca para cerrar
          </p>
        </div>
      )}
    </div>
  );
}