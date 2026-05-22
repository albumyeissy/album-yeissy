"use client";
import { useState, useEffect } from "react";
import { auth, db } from "../../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { CROMOS, PAGINAS } from "../../data/cromos";

export default function MazoPage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [misCromos, setMisCromos] = useState([]);
  const [cromoGrande, setCromoGrande] = useState(null);
  const router = useRouter();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        try {
          const snap = await getDoc(doc(db, "usuarios", u.uid));
          if (snap.exists()) setMisCromos(snap.data().cromos || []);
        } catch (err) { console.error(err); }
      } else {
        router.push("/");
      }
      setLoading(false);
    });
    return () => unsub();
  }, [router]);

  const cromosSinPegar = misCromos
    .filter((c) => c.pegado === false)
    .map((c) => ({
      ...c,
      info: CROMOS.find((x) => x.id === c.cromoId),
    }))
    .filter((c) => c.info);

  const cromosRepetidos = misCromos
    .filter((c) => c.cantidad > 1)
    .map((c) => ({
      ...c,
      info: CROMOS.find((x) => x.id === c.cromoId),
      sobrantes: c.cantidad - 1,
    }))
    .filter((c) => c.info);

  const getBorderColor = (r) =>
    r === "legendaria" ? "#fbbf24" : r === "rara" ? "#3b82f6" : "#94a3b8";

  const getRarezaLabel = (r) =>
    r === "legendaria" ? "⭐ Legendaria" : r === "rara" ? "💎 Rara" : "Común";

  const getPaginaNombre = (paginaId) => {
    const p = PAGINAS.find((x) => x.id === paginaId);
    return p ? `${p.emoji} ${p.nombre}` : paginaId;
  };

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh" }}>
        <p style={{ fontSize: "1.5rem" }}>Cargando mazo...</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0f172a", padding: "15px" }}>
      {/* HEADER */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginBottom: "20px"
      }}>
        <button onClick={() => router.push("/album")} style={{
          padding: "8px 16px", borderRadius: "10px", border: "1px solid #475569",
          background: "transparent", color: "#94a3b8", cursor: "pointer"
        }}>
          ← Álbum
        </button>
      </div>

      <h1 style={{ textAlign: "center", fontSize: "1.6rem", marginBottom: "5px" }}>
        📋 Mi Mazo
      </h1>

      {/* TABS */}
      <div style={{
        display: "flex", justifyContent: "center", gap: "10px",
        marginBottom: "20px", marginTop: "15px"
      }}>
        <div style={{
          background: "#1e293b", padding: "10px 20px", borderRadius: "12px",
          textAlign: "center"
        }}>
          <p style={{ fontSize: "1.5rem", fontWeight: "bold", margin: 0 }}>
            {cromosSinPegar.length}
          </p>
          <p style={{ fontSize: "0.75rem", color: "#94a3b8", margin: 0 }}>
            Por pegar
          </p>
        </div>
        <div style={{
          background: "#1e293b", padding: "10px 20px", borderRadius: "12px",
          textAlign: "center"
        }}>
          <p style={{ fontSize: "1.5rem", fontWeight: "bold", margin: 0, color: "#ef4444" }}>
            {cromosRepetidos.reduce((sum, c) => sum + c.sobrantes, 0)}
          </p>
          <p style={{ fontSize: "0.75rem", color: "#94a3b8", margin: 0 }}>
            Repetidos
          </p>
        </div>
      </div>

      {/* CROMOS SIN PEGAR */}
      <h2 style={{ fontSize: "1.1rem", marginBottom: "12px" }}>
        🆕 Cromos por pegar
      </h2>

      {cromosSinPegar.length === 0 ? (
        <div style={{
          background: "#1e293b", padding: "30px", borderRadius: "15px",
          textAlign: "center", marginBottom: "25px"
        }}>
          <p style={{ fontSize: "2rem", marginBottom: "10px" }}>✨</p>
          <p style={{ color: "#94a3b8" }}>
            ¡No tienes cromos sin pegar! Abre más sobres.
          </p>
        </div>
      ) : (
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(3, 1fr)",
          gap: "10px", marginBottom: "25px"
        }}>
          {cromosSinPegar.map((cromo, i) => (
            <div
              key={cromo.cromoId}
              onClick={() => setCromoGrande(cromo)}
              style={{
                borderRadius: "12px",
                border: `2px solid ${getBorderColor(cromo.info.rareza)}`,
                overflow: "hidden", background: "#1e293b",
                cursor: "pointer",
                animation: `stickerEntrada 0.3s ease-out ${i * 0.05}s both`,
              }}
            >
              <img src={cromo.info.imagen} alt="" style={{
                width: "100%", aspectRatio: "1", objectFit: "cover"
              }} />
              <div style={{
                padding: "5px", textAlign: "center",
                background: "rgba(0,0,0,0.5)"
              }}>
                <p style={{ fontSize: "0.55rem", margin: 0, fontWeight: "bold" }}>
                  {cromo.info.nombre}
                </p>
                <p style={{ fontSize: "0.5rem", margin: 0, color: "#94a3b8" }}>
                  {getPaginaNombre(cromo.info.pagina)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CROMOS REPETIDOS */}
      {cromosRepetidos.length > 0 && (
        <>
          <h2 style={{ fontSize: "1.1rem", marginBottom: "12px" }}>
            🔄 Repetidos (para el mercado)
          </h2>
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(3, 1fr)",
            gap: "10px", marginBottom: "25px"
          }}>
            {cromosRepetidos.map((cromo) => (
              <div key={cromo.cromoId} style={{
                borderRadius: "12px",
                border: `2px solid ${getBorderColor(cromo.info.rareza)}`,
                overflow: "hidden", background: "#1e293b",
                position: "relative", opacity: 0.7,
              }}>
                <img src={cromo.info.imagen} alt="" style={{
                  width: "100%", aspectRatio: "1", objectFit: "cover"
                }} />
                <div style={{
                  position: "absolute", top: "5px", right: "5px",
                  background: "#ef4444", borderRadius: "50%",
                  width: "24px", height: "24px",
                  display: "flex", justifyContent: "center", alignItems: "center",
                  fontSize: "0.7rem", fontWeight: "bold"
                }}>
                  x{cromo.sobrantes}
                </div>
                <div style={{
                  padding: "5px", textAlign: "center",
                  background: "rgba(0,0,0,0.5)"
                }}>
                  <p style={{ fontSize: "0.55rem", margin: 0 }}>{cromo.info.nombre}</p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* MODAL - Ver cromo en grande */}
      {cromoGrande && (
        <div
          onClick={() => setCromoGrande(null)}
          style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(0,0,0,0.85)", zIndex: 100,
            display: "flex", flexDirection: "column",
            justifyContent: "center", alignItems: "center",
            padding: "20px",
            animation: "fadeInUp 0.3s"
          }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{
            maxWidth: "320px", width: "100%", textAlign: "center"
          }}>
            <img
              src={cromoGrande.info.imagen}
              alt={cromoGrande.info.nombre}
              style={{
                width: "100%", borderRadius: "16px",
                border: `4px solid ${getBorderColor(cromoGrande.info.rareza)}`,
                boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
                marginBottom: "15px"
              }}
            />
            <h3 style={{ fontSize: "1.2rem", marginBottom: "5px" }}>
              {cromoGrande.info.nombre}
            </h3>
            <p style={{ color: "#94a3b8", fontSize: "0.9rem", marginBottom: "5px" }}>
              {getRarezaLabel(cromoGrande.info.rareza)}
            </p>
            <p style={{ color: "#64748b", fontSize: "0.85rem", marginBottom: "20px" }}>
              Página: {getPaginaNombre(cromoGrande.info.pagina)}
            </p>

            <button
              onClick={() => {
                const pageIndex = PAGINAS.findIndex(
                  (p) => p.id === cromoGrande.info.pagina
                );
                setCromoGrande(null);
                router.push(`/album?page=${pageIndex}`);
              }}
              style={{
                padding: "14px 30px", borderRadius: "14px", border: "none",
                background: "linear-gradient(135deg, #f59e0b, #d97706)",
                color: "#000", fontWeight: "bold", cursor: "pointer",
                fontSize: "1rem", width: "100%", marginBottom: "10px",
                boxShadow: "0 4px 15px rgba(0,0,0,0.3)"
              }}
            >
              📖 Ir a pegar
            </button>
            <button
              onClick={() => setCromoGrande(null)}
              style={{
                padding: "10px 30px", borderRadius: "14px",
                border: "1px solid #475569", background: "transparent",
                color: "#94a3b8", cursor: "pointer", fontSize: "0.9rem",
                width: "100%"
              }}
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}