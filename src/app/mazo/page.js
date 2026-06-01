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

  // ── Filtros ──────────────────────────────────────────────────────────────────
  const [filtroPage, setFiltroPage] = useState(null); // null = todas las páginas
  const [ordenRep, setOrdenRep] = useState("rareza"); // "rareza" | "pagina" | "cantidad"

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

  // ── Datos derivados ──────────────────────────────────────────────────────────
  const cromosSinPegar = misCromos
    .filter((c) => c.pegado === false)
    .map((c) => ({ ...c, info: CROMOS.find((x) => x.id === c.cromoId) }))
    .filter((c) => c.info);

  const cromosRepetidos = misCromos
    .filter((c) => c.cantidad > 1)
    .map((c) => ({ ...c, info: CROMOS.find((x) => x.id === c.cromoId), sobrantes: c.cantidad - 1 }))
    .filter((c) => c.info);

  // Páginas que tienen al menos una carta (para los chips de filtro)
  const paginasConCartas = PAGINAS.filter(
    (p) => !p.oculta && (
      cromosRepetidos.some((c) => c.info.pagina === p.id) ||
      cromosSinPegar.some((c) => c.info.pagina === p.id)
    )
  );

  // Aplicar filtro de página
  const sinPegarFiltrados = cromosSinPegar
    .filter((c) => !filtroPage || c.info.pagina === filtroPage);

  const ORDEN_RAREZA = { mitica: 3, legendaria: 2, rara: 1, comun: 0 };

  const repetidosFiltrados = cromosRepetidos
    .filter((c) => !filtroPage || c.info.pagina === filtroPage)
    .sort((a, b) => {
      if (ordenRep === "cantidad") return b.sobrantes - a.sobrantes;
      if (ordenRep === "rareza")   return ORDEN_RAREZA[b.info.rareza] - ORDEN_RAREZA[a.info.rareza];
      // "pagina": por índice de PAGINAS, luego por id de cromo
      const piA = PAGINAS.findIndex((p) => p.id === a.info.pagina);
      const piB = PAGINAS.findIndex((p) => p.id === b.info.pagina);
      return piA !== piB ? piA - piB : a.cromoId - b.cromoId;
    });

  // Agrupados por página (para el modo "pagina")
  const repetidosPorPagina = () => {
    const groups = {};
    repetidosFiltrados.forEach((c) => {
      if (!groups[c.info.pagina]) groups[c.info.pagina] = [];
      groups[c.info.pagina].push(c);
    });
    return PAGINAS.filter((p) => groups[p.id]).map((p) => ({ pagina: p, cromos: groups[p.id] }));
  };

  // ── Helpers UI ───────────────────────────────────────────────────────────────
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <button onClick={() => router.push("/album")} style={{
          padding: "8px 16px", borderRadius: "10px", border: "1px solid #475569",
          background: "transparent", color: "#94a3b8", cursor: "pointer",
        }}>← Álbum</button>
      </div>

      <h1 style={{ textAlign: "center", fontSize: "1.6rem", marginBottom: "5px" }}>📋 Mi Mazo</h1>

      {/* STATS */}
      <div style={{ display: "flex", justifyContent: "center", gap: "10px", marginBottom: "18px", marginTop: "15px" }}>
        <div style={{ background: "#1e293b", padding: "10px 20px", borderRadius: "12px", textAlign: "center" }}>
          <p style={{ fontSize: "1.5rem", fontWeight: "bold", margin: 0 }}>{cromosSinPegar.length}</p>
          <p style={{ fontSize: "0.75rem", color: "#94a3b8", margin: 0 }}>Por pegar</p>
        </div>
        <div style={{ background: "#1e293b", padding: "10px 20px", borderRadius: "12px", textAlign: "center" }}>
          <p style={{ fontSize: "1.5rem", fontWeight: "bold", margin: 0, color: "#ef4444" }}>
            {cromosRepetidos.reduce((sum, c) => sum + c.sobrantes, 0)}
          </p>
          <p style={{ fontSize: "0.75rem", color: "#94a3b8", margin: 0 }}>Repetidos</p>
        </div>
      </div>

      {/* ── FILTRO POR PÁGINA ─────────────────────────────────────────────────── */}
      {paginasConCartas.length > 1 && (
        <div style={{
          overflowX: "auto", display: "flex", gap: "6px",
          marginBottom: "18px", paddingBottom: "4px",
          scrollbarWidth: "none",
        }}>
          {/* Chip "Todas" */}
          <button
            onClick={() => setFiltroPage(null)}
            style={{
              flexShrink: 0, padding: "5px 14px", borderRadius: "20px",
              border: "none", cursor: "pointer", fontSize: "0.78rem", fontWeight: "bold",
              background: !filtroPage ? "#3b82f6" : "#1e293b",
              color: !filtroPage ? "white" : "#94a3b8",
              transition: "all 0.15s",
            }}
          >Todas</button>

          {paginasConCartas.map((p) => {
            const activa = filtroPage === p.id;
            const repCount = cromosRepetidos.filter((c) => c.info.pagina === p.id).length;
            return (
              <button
                key={p.id}
                onClick={() => setFiltroPage(activa ? null : p.id)}
                style={{
                  flexShrink: 0, padding: "5px 12px", borderRadius: "20px",
                  border: "none", cursor: "pointer", fontSize: "0.78rem", fontWeight: "bold",
                  background: activa ? "#3b82f6" : "#1e293b",
                  color: activa ? "white" : "#94a3b8",
                  transition: "all 0.15s",
                  display: "flex", alignItems: "center", gap: "4px",
                }}
              >
                <span>{p.emoji}</span>
                <span>{p.nombre}</span>
                {repCount > 0 && (
                  <span style={{
                    background: activa ? "rgba(255,255,255,0.25)" : "rgba(239,68,68,0.2)",
                    color: activa ? "white" : "#ef4444",
                    borderRadius: "10px", padding: "0 5px", fontSize: "0.65rem",
                  }}>{repCount}</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* ── CROMOS SIN PEGAR ─────────────────────────────────────────────────── */}
      <h2 style={{ fontSize: "1.1rem", marginBottom: "12px" }}>
        🆕 Cromos por pegar
        {filtroPage && <span style={{ fontSize: "0.75rem", fontWeight: "normal", color: "#64748b", marginLeft: "8px" }}>
          ({sinPegarFiltrados.length} de {cromosSinPegar.length})
        </span>}
      </h2>

      {sinPegarFiltrados.length === 0 ? (
        <div style={{ background: "#1e293b", padding: "30px", borderRadius: "15px", textAlign: "center", marginBottom: "25px" }}>
          <p style={{ fontSize: "2rem", marginBottom: "10px" }}>✨</p>
          <p style={{ color: "#94a3b8" }}>
            {filtroPage ? "No hay cromos sin pegar en esta página." : "¡No tienes cromos sin pegar! Abre más sobres."}
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px", marginBottom: "25px" }}>
          {sinPegarFiltrados.map((cromo, i) => (
            <div
              key={cromo.cromoId}
              onClick={() => setCromoGrande(cromo)}
              style={{
                borderRadius: "12px", border: `2px solid ${getBorderColor(cromo.info.rareza)}`,
                overflow: "hidden", background: "#1e293b", cursor: "pointer",
                animation: `stickerEntrada 0.3s ease-out ${i * 0.05}s both`,
              }}
            >
              <img src={cromo.info.imagen} alt="" style={{ width: "100%", aspectRatio: "1", objectFit: "cover" }} />
              <div style={{ padding: "5px", textAlign: "center", background: "rgba(0,0,0,0.5)" }}>
                <p style={{ fontSize: "0.55rem", margin: 0, fontWeight: "bold" }}>{cromo.info.nombre}</p>
                <p style={{ fontSize: "0.5rem", margin: 0, color: "#94a3b8" }}>{getPaginaNombre(cromo.info.pagina)}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── CROMOS REPETIDOS ─────────────────────────────────────────────────── */}
      {cromosRepetidos.length > 0 && (
        <>
          {/* Cabecera + sort */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
            <h2 style={{ fontSize: "1.1rem", margin: 0 }}>
              🔄 Repetidos
              {filtroPage && <span style={{ fontSize: "0.75rem", fontWeight: "normal", color: "#64748b", marginLeft: "8px" }}>
                ({repetidosFiltrados.length} de {cromosRepetidos.length})
              </span>}
            </h2>

            {/* Sort buttons */}
            <div style={{ display: "flex", gap: "4px" }}>
              {[
                { id: "rareza",   label: "⭐ Rareza" },
                { id: "pagina",   label: "📄 Página" },
                { id: "cantidad", label: "🔢 Copias" },
              ].map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setOrdenRep(opt.id)}
                  style={{
                    padding: "4px 9px", borderRadius: "8px", border: "none",
                    cursor: "pointer", fontSize: "0.68rem", fontWeight: "bold",
                    background: ordenRep === opt.id ? "#3b82f6" : "#1e293b",
                    color: ordenRep === opt.id ? "white" : "#64748b",
                    transition: "all 0.15s",
                  }}
                >{opt.label}</button>
              ))}
            </div>
          </div>

          {repetidosFiltrados.length === 0 ? (
            <div style={{ background: "#1e293b", padding: "20px", borderRadius: "12px", textAlign: "center", color: "#64748b" }}>
              No hay repetidos en esta página.
            </div>
          ) : ordenRep === "pagina" ? (
            /* ── Agrupados por página ── */
            <div style={{ marginBottom: "25px" }}>
              {repetidosPorPagina().map(({ pagina, cromos }) => (
                <div key={pagina.id} style={{ marginBottom: "18px" }}>
                  <div style={{
                    display: "flex", alignItems: "center", gap: "6px",
                    marginBottom: "8px",
                    borderLeft: "3px solid #3b82f6", paddingLeft: "10px",
                  }}>
                    <span style={{ fontSize: "1rem" }}>{pagina.emoji}</span>
                    <span style={{ fontSize: "0.88rem", fontWeight: "bold", color: "#94a3b8" }}>{pagina.nombre}</span>
                    <span style={{ fontSize: "0.72rem", color: "#475569" }}>
                      · {cromos.length} carta{cromos.length !== 1 ? "s" : ""}
                      · {cromos.reduce((s, c) => s + c.sobrantes, 0)} sobrante{cromos.reduce((s, c) => s + c.sobrantes, 0) !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
                    {cromos.map((cromo) => (
                      <RepetidoCard key={cromo.cromoId} cromo={cromo} getBorderColor={getBorderColor} showPage={false} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* ── Lista plana (rareza / cantidad) ── */
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px", marginBottom: "25px" }}>
              {repetidosFiltrados.map((cromo) => (
                <RepetidoCard key={cromo.cromoId} cromo={cromo} getBorderColor={getBorderColor} showPage={!filtroPage} />
              ))}
            </div>
          )}
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
            justifyContent: "center", alignItems: "center", padding: "20px",
            animation: "fadeInUp 0.3s",
          }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ maxWidth: "320px", width: "100%", textAlign: "center" }}>
            <img
              src={cromoGrande.info.imagen}
              alt={cromoGrande.info.nombre}
              style={{
                width: "100%", borderRadius: "16px",
                border: `4px solid ${getBorderColor(cromoGrande.info.rareza)}`,
                boxShadow: "0 10px 40px rgba(0,0,0,0.5)", marginBottom: "15px",
              }}
            />
            <h3 style={{ fontSize: "1.2rem", marginBottom: "5px" }}>{cromoGrande.info.nombre}</h3>
            <p style={{ color: "#94a3b8", fontSize: "0.9rem", marginBottom: "5px" }}>{getRarezaLabel(cromoGrande.info.rareza)}</p>
            <p style={{ color: "#64748b", fontSize: "0.85rem", marginBottom: "20px" }}>
              Página: {getPaginaNombre(cromoGrande.info.pagina)}
            </p>
            <button
              onClick={() => {
                const pageIndex = PAGINAS.findIndex((p) => p.id === cromoGrande.info.pagina);
                setCromoGrande(null);
                router.push(`/album?page=${pageIndex}`);
              }}
              style={{
                padding: "14px 30px", borderRadius: "14px", border: "none",
                background: "linear-gradient(135deg, #f59e0b, #d97706)",
                color: "#000", fontWeight: "bold", cursor: "pointer",
                fontSize: "1rem", width: "100%", marginBottom: "10px",
                boxShadow: "0 4px 15px rgba(0,0,0,0.3)",
              }}
            >📖 Ir a pegar</button>
            <button
              onClick={() => setCromoGrande(null)}
              style={{
                padding: "10px 30px", borderRadius: "14px",
                border: "1px solid #475569", background: "transparent",
                color: "#94a3b8", cursor: "pointer", fontSize: "0.9rem", width: "100%",
              }}
            >Cerrar</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Componente de carta repetida ─────────────────────────────────────────────
function RepetidoCard({ cromo, getBorderColor, showPage }) {
  const paginaObj = showPage ? PAGINAS.find((x) => x.id === cromo.info.pagina) : null;
  const pagina = paginaObj ? `${paginaObj.emoji} ${paginaObj.nombre}` : null;

  return (
    <div style={{
      borderRadius: "12px", border: `2px solid ${getBorderColor(cromo.info.rareza)}`,
      overflow: "hidden", background: "#1e293b",
      position: "relative", opacity: 0.85,
    }}>
      <img src={cromo.info.imagen} alt="" style={{ width: "100%", aspectRatio: "1", objectFit: "cover" }} />
      {/* Badge cantidad */}
      <div style={{
        position: "absolute", top: "5px", right: "5px",
        background: "#ef4444", borderRadius: "50%",
        width: "22px", height: "22px",
        display: "flex", justifyContent: "center", alignItems: "center",
        fontSize: "0.65rem", fontWeight: "bold", color: "white",
      }}>×{cromo.sobrantes}</div>
      <div style={{ padding: "4px 5px", textAlign: "center", background: "rgba(0,0,0,0.55)" }}>
        <p style={{ fontSize: "0.52rem", margin: 0, fontWeight: "bold", color: "white" }}>{cromo.info.nombre}</p>
        {pagina && <p style={{ fontSize: "0.46rem", margin: "1px 0 0", color: "#94a3b8" }}>{pagina}</p>}
      </div>
    </div>
  );
}
