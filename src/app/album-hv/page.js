"use client";
import { useState, useEffect, useRef } from "react";
import { auth, db } from "../../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { CROMOS, PAGINAS } from "../../data/cromos";
import "../hv.css";
import HvBottomNav from "../HvBottomNav";

// ─── Rareza config (4 niveles) ────────────────────────────────────────────────
const RAREZA = {
  comun:      { label: "COMÚN",      color: "oklch(0.74 0.03 265)", soft: "oklch(0.5 0.04 265)", w: 0 },
  rara:       { label: "RARA",       color: "oklch(0.76 0.15 230)", soft: "oklch(0.5 0.13 230)", w: 1 },
  legendaria: { label: "LEGENDARIA", color: "oklch(0.83 0.13 85)",  soft: "oklch(0.6 0.13 85)",  w: 2 },
  mitica:     { label: "MÍTICA",     color: "oklch(0.68 0.22 18)",  soft: "oklch(0.5 0.2 18)",   w: 3 },
};

const HOY = new Date().toLocaleDateString("en-CA");

// ─── Hook: tilt + posición del foil siguiendo el puntero ─────────────────────
function useHolo(tiltEnabled = true) {
  const ref = useRef(null);

  function onPointerMove(e) {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    el.style.setProperty("--mx", (px * 100).toFixed(1) + "%");
    el.style.setProperty("--my", (py * 100).toFixed(1) + "%");
    el.style.setProperty("--active", "1");
    if (tiltEnabled) {
      el.style.setProperty("--rx", ((py - 0.5) * -15).toFixed(2) + "deg");
      el.style.setProperty("--ry", ((px - 0.5) * 17).toFixed(2) + "deg");
    }
  }

  function onPointerLeave() {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--active", "0");
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
  }

  return { ref, onPointerMove, onPointerLeave };
}

// ─── ProgressRing ─────────────────────────────────────────────────────────────
function ProgressRing({ pct, size = 60, stroke = 6 }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} className="hv-ring">
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke="rgba(255,255,255,.12)" strokeWidth={stroke}
      />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke="var(--accent)" strokeWidth={stroke}
        strokeDasharray={c}
        strokeDashoffset={c * (1 - pct / 100)}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dashoffset .8s cubic-bezier(.4,0,.2,1)" }}
      />
      <text x="50%" y="50%" dy="0.35em" textAnchor="middle" className="hv-ring-t">
        {pct}%
      </text>
    </svg>
  );
}

// ─── RarityChip ───────────────────────────────────────────────────────────────
function RarityChip({ rareza, small }) {
  const R = RAREZA[rareza] ?? RAREZA.comun;
  return (
    <span
      className={"hv-rchip" + (small ? " sm" : "")}
      style={{ "--rc": R.color, "--rs": R.soft }}
    >
      {R.label}
    </span>
  );
}

// ─── Colores de halo para cartas pegadas (distintos del foil de rareza) ──────
const HALO_PEGADA = {
  comun:      { color: "rgba(180,185,210,.55)",  glow: "rgba(180,185,210,.22)" },
  rara:       { color: "rgba(59,130,246,.65)",   glow: "rgba(59,130,246,.18)"  },
  legendaria: { color: "rgba(124,58,237,.7)",    glow: "rgba(124,58,237,.2)"   },
  mitica:     { color: "rgba(220,80,60,.8)",     glow: "rgba(220,80,60,.25)"   },
};

// ─── MiniSlot (cuadrícula del álbum) ─────────────────────────────────────────
function MiniSlot({ card, onClick }) {
  const holo = useHolo(false);
  const R = RAREZA[card.rareza] ?? RAREZA.comun;

  if (!card.owned) {
    return (
      <button className="hv-slot empty" onClick={onClick} style={{ "--rc": R.color }}>
        <b>#{String(card.id).padStart(2, "0")}</b>
        <small>POR CONSEGUIR</small>
      </button>
    );
  }

  // Cartas en el mazo (obtenidas pero NO pegadas): borde cian punteado + badge prominente
  if (!card.pegado) {
    return (
      <button
        className={`hv-slot filled rar-${card.rareza}`}
        ref={holo.ref}
        onPointerMove={holo.onPointerMove}
        onPointerLeave={holo.onPointerLeave}
        onClick={onClick}
        style={{
          "--rc": R.color, "--rs": R.soft,
          outline: "1.5px dashed var(--accent)",
          outlineOffset: "-1px",
          opacity: 0.82,
        }}
      >
        <div className="hv-foil" />
        <span className="hv-slot-num">#{String(card.id).padStart(2, "0")}</span>
        {card.isNew && <span className="hv-new">NUEVO</span>}
        {/* Badge PEGAR destacado */}
        <span style={{
          position: "absolute", top: 0, left: 0, right: 0, zIndex: 5,
          background: "color-mix(in oklch, var(--accent) 70%, rgba(6,18,26,.8))",
          color: "#06121a", fontFamily: "'IBM Plex Mono', monospace",
          fontSize: "8px", fontWeight: 700, textAlign: "center",
          padding: "3px 0", letterSpacing: ".08em", borderRadius: "13px 13px 0 0",
        }}>📌 PEGAR</span>
        {card.dupes > 0 && <span className="hv-dupe">×{card.dupes + 1}</span>}
        <div className="hv-slot-photo" style={{ inset: "20px 0 26px" }}>
          <img src={card.imagen} alt={card.nombre} loading="lazy" />
        </div>
        <div className="hv-slot-foot">
          <span className="hv-slot-name">{card.nombre}</span>
          <i className="hv-slot-rdot" style={{ background: "var(--accent)" }} />
        </div>
      </button>
    );
  }

  // Cartas pegadas: halo sutil de rareza (plateado / azul / púrpura)
  const halo = HALO_PEGADA[card.rareza] ?? HALO_PEGADA.comun;
  return (
    <button
      className={`hv-slot filled rar-${card.rareza}`}
      ref={holo.ref}
      onPointerMove={holo.onPointerMove}
      onPointerLeave={holo.onPointerLeave}
      onClick={onClick}
      style={{
        "--rc": R.color, "--rs": R.soft,
        boxShadow: `inset 0 0 0 1.5px ${halo.color}, 0 0 10px -2px ${halo.glow}`,
      }}
    >
      <div className="hv-foil" />
      <span className="hv-slot-num">#{String(card.id).padStart(2, "0")}</span>
      {card.isNew && <span className="hv-new">NUEVO</span>}
      {card.dupes > 0 && <span className="hv-dupe">×{card.dupes + 1}</span>}
      <div className="hv-slot-photo">
        <img src={card.imagen} alt={card.nombre} loading="lazy" />
      </div>
      <div className="hv-slot-foot">
        <span className="hv-slot-name">{card.nombre}</span>
        <i className="hv-slot-rdot" style={{ background: halo.color }} />
      </div>
    </button>
  );
}

// ─── FullCard (la carta grande: frente + dorso + tilt holo + flip) ────────────
function FullCard({ card, w = 258 }) {
  const [flipped, setFlipped] = useState(false);
  const holo = useHolo(true);
  const R = RAREZA[card.rareza] ?? RAREZA.comun;
  const paginaInfo = PAGINAS.find((p) => p.id === card.pagina);

  return (
    <div
      className={`hv-card-outer rar-${card.rareza}`}
      ref={holo.ref}
      onPointerMove={holo.onPointerMove}
      onPointerLeave={holo.onPointerLeave}
      style={{
        "--rc": R.color,
        "--rs": R.soft,
        width: w,
        height: Math.round(w / 0.7),
      }}
    >
      <div
        className={"hv-card-inner" + (flipped ? " flipped" : "")}
        onClick={() => setFlipped((f) => !f)}
      >
        {/* ── FRENTE ── */}
        <div className="hv-face hv-front">
          <div className="hv-foil" />
          <div className="hv-sheen" />
          <div className="hv-card-top">
            <span className="hv-num">#{String(card.id).padStart(2, "0")}</span>
            <RarityChip rareza={card.rareza} small />
          </div>
          <div className="hv-photo">
            <img src={card.imagen} alt={card.nombre} />
          </div>
          <div className="hv-card-name">{card.nombre}</div>
          <div className="hv-card-sub">
            {paginaInfo ? `${paginaInfo.emoji} ${paginaInfo.nombre}` : card.pagina}
          </div>
        </div>

        {/* ── DORSO ── */}
        <div className="hv-face hv-back">
          <div className="hv-back-grid" />
          <div className="hv-back-logo">ÁLBUM<br />YEISSY</div>
          <div className="hv-back-num">#{String(card.id).padStart(2, "0")}</div>
          <div className="hv-back-name">{card.nombre}</div>
          <RarityChip rareza={card.rareza} />
          {paginaInfo && (
            <div className="hv-back-info">
              {paginaInfo.emoji} {paginaInfo.nombre}
            </div>
          )}
          <div className="hv-back-tag">TEMPORADA 1 · ÁLBUM YEISSY</div>
        </div>
      </div>
    </div>
  );
}

// ─── CardDetail (overlay a pantalla completa) ─────────────────────────────────
function CardDetail({ card, onClose, router }) {
  const R = RAREZA[card.rareza] ?? RAREZA.comun;
  const paginaInfo = PAGINAS.find((p) => p.id === card.pagina);
  const paginaIdx  = PAGINAS.findIndex((p) => p.id === card.pagina);

  // ── CTA según estado ──
  let cta;
  if (!card.owned) {
    cta = (
      <button className="hv-btn ghost" onClick={() => router.push("/mercado")}>
        Buscar cambio · pídela al grupo
      </button>
    );
  } else if (!card.pegado) {
    cta = (
      <button
        className="hv-btn primary"
        onClick={() => { onClose(); router.push(`/album?page=${paginaIdx}`); }}
      >
        📖 Ir a pegar
      </button>
    );
  } else if (card.dupes > 0) {
    cta = (
      <button className="hv-btn primary" onClick={() => router.push("/mercado")}>
        Proponer cambio con esta repe
      </button>
    );
  } else {
    cta = <div className="hv-btn done">✓ Pegada en el álbum</div>;
  }

  // ── Etiqueta de estado ──
  let estado;
  if (!card.owned)      estado = "Te falta";
  else if (!card.pegado) estado = "Por pegar";
  else if (card.dupes > 0) estado = `Tienes ${card.dupes + 1} · ${card.dupes} repe${card.dupes > 1 ? "s" : ""}`;
  else                  estado = "Pegada ✓";

  return (
    <div className="hv-detail" onClick={onClose}>
      <div className="hv-detail-inner" onClick={(e) => e.stopPropagation()}>
        <button className="hv-x" onClick={onClose} aria-label="Cerrar">✕</button>

        <FullCard card={card} w={258} />

        <div className="hv-detail-hint">
          toca la carta para girarla ✦ mueve para ver el holo
        </div>

        <div className="hv-detail-meta">
          <div className="hv-detail-line">
            <span className="hv-dl-k">Página</span>
            <span className="hv-dl-v">
              {paginaInfo ? `${paginaInfo.emoji} ${paginaInfo.nombre}` : card.pagina}
            </span>
          </div>
          <div className="hv-detail-line">
            <span className="hv-dl-k">Rareza</span>
            <span className="hv-dl-v" style={{ color: R.color }}>{R.label}</span>
          </div>
          <div className="hv-detail-line">
            <span className="hv-dl-k">Estado</span>
            <span className="hv-dl-v">{estado}</span>
          </div>
        </div>

        {cta}
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function AlbumHvPage() {
  const [loading,     setLoading]     = useState(true);
  const [misCromos,   setMisCromos]   = useState([]);
  const [filter,      setFilter]      = useState("todos");
  const [detail,      setDetail]      = useState(null);
  const [currentPage, setCurrentPage] = useState(0);
  const scrollRef = useRef(null);
  const router = useRouter();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { router.push("/"); return; }
      try {
        const snap = await getDoc(doc(db, "usuarios", u.uid));
        if (snap.exists()) setMisCromos(snap.data().cromos || []);
      } catch (err) { console.error("[album-hv]", err); }
      setLoading(false);
    });
    return () => unsub();
  }, [router]);

  // ── Construir objetos de carta enriquecidos ──
  const allCards = CROMOS.map((cromo) => {
    const uc = misCromos.find((u) => u.cromoId === cromo.id);
    return {
      ...cromo,
      owned:  (uc?.cantidad || 0) > 0,
      dupes:  Math.max(0, (uc?.cantidad || 0) - 1),
      pegado: uc?.pegado === true,
      isNew:  uc?.fechaObtenido === HOY,
    };
  });

  // ── Stats para los chips ──
  const ownedCount  = allCards.filter((c) => c.owned).length;
  const faltanCount = allCards.filter((c) => !c.owned).length;
  const repesCount  = allCards.filter((c) => c.owned && c.dupes > 0)
                               .reduce((s, c) => s + c.dupes, 0);
  const mazoCount   = allCards.filter((c) => c.owned && !c.pegado).length;
  const pct = allCards.length ? Math.round((ownedCount / allCards.length) * 100) : 0;

  const CHIPS = [
    { k: "todos",  label: "Todos",  n: allCards.length },
    { k: "tengo",  label: "Tengo",  n: ownedCount },
    { k: "mazo",   label: "Mazo",   n: mazoCount  },
    { k: "faltan", label: "Faltan", n: faltanCount },
    { k: "repes",  label: "Repes",  n: repesCount },
  ];

  // ── Función de filtro ──
  const matchFilter = (c) => {
    if (filter === "tengo")  return c.owned;
    if (filter === "mazo")   return c.owned && !c.pegado;
    if (filter === "faltan") return !c.owned;
    if (filter === "repes")  return c.owned && c.dupes > 0;
    return true;
  };

  // ── Carrusel ──
  const visiblePaginas = PAGINAS.filter((p) => !p.oculta ||
    allCards.some((c) => c.pagina === p.id && c.owned));

  const handleScroll = () => {
    const el = scrollRef.current; if (!el) return;
    setCurrentPage(Math.round(el.scrollLeft / el.offsetWidth));
  };

  const goToPage = (idx) => {
    scrollRef.current?.scrollTo({ left: idx * scrollRef.current.offsetWidth, behavior: "smooth" });
  };

  // Deep-link desde mazo (?page=N)
  useEffect(() => {
    if (!loading && scrollRef.current) {
      const p = new URLSearchParams(window.location.search).get("page");
      if (p !== null) {
        const idx = parseInt(p);
        if (!isNaN(idx) && idx >= 0 && idx < visiblePaginas.length) {
          setTimeout(() => goToPage(idx), 300);
        }
      }
    }
  }, [loading]);

  // ── Loading ──
  if (loading) {
    return (
      <div className="hv-app hv-loading">
        <span>Cargando álbum…</span>
      </div>
    );
  }

  return (
    <div className="hv-app" style={{ height: "100dvh", display: "flex", flexDirection: "column" }}>

      {/* ── Header fijo ── */}
      <div className="hv-screen" style={{ flex: "none", paddingBottom: 0 }}>
        <div className="hv-shead">
          <div>
            <div className="hv-kicker">Temporada 1</div>
            <h1 className="hv-h1">Álbum Yeissy</h1>
          </div>
          <ProgressRing pct={pct} />
        </div>

        <div className="hv-progress-row">
          <div className="hv-prog-bar"><i style={{ width: pct + "%" }} /></div>
          <span className="hv-prog-txt">{ownedCount}<em>/{allCards.length}</em></span>
        </div>

        {/* Chips de filtro */}
        <div className="hv-chips">
          {CHIPS.map((chip) => (
            <button key={chip.k}
              className={"hv-chip" + (filter === chip.k ? " on" : "")}
              onClick={() => setFilter(chip.k)}
            >{chip.label} <b>{chip.n}</b></button>
          ))}
        </div>

        {/* Dots de página */}
        <div style={{ display: "flex", justifyContent: "center", gap: 5, padding: "8px 0 4px" }}>
          {visiblePaginas.map((p, i) => (
            <button key={p.id} onClick={() => goToPage(i)} style={{
              width: i === currentPage ? 18 : 6, height: 6,
              borderRadius: 3, border: "none", cursor: "pointer",
              background: i === currentPage ? "var(--accent)" : "var(--line)",
              padding: 0, transition: "all .25s",
            }} />
          ))}
        </div>
      </div>

      {/* ── Carrusel horizontal ── */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        style={{
          flex: 1, display: "flex",
          overflowX: "auto", overflowY: "hidden",
          scrollSnapType: "x mandatory",
          scrollbarWidth: "none", msOverflowStyle: "none",
        }}
      >
        {visiblePaginas.map((pagina) => {
          const pageCards   = allCards.filter((c) => c.pagina === pagina.id && matchFilter(c));
          const pageCromos  = CROMOS.filter((c) => c.pagina === pagina.id);
          const pageOwned   = allCards.filter((c) => c.pagina === pagina.id && c.owned).length;
          const pageTotal   = pageCromos.length;
          // Página completa = todas las cartas pegadas
          const pageComplete = pageCromos.every((c) => {
            const uc = misCromos.find((u) => u.cromoId === c.id);
            return uc && uc.pegado !== false && (uc.cantidad || 0) > 0;
          });
          // Página con blindaje = todas las cartas obtenidas (no necesariamente pegadas)
          const pageShield = !pageComplete && pageCromos.every((c) => {
            const uc = misCromos.find((u) => u.cromoId === c.id);
            return uc && (uc.cantidad || 0) > 0;
          });

          return (
            <div key={pagina.id} style={{
              minWidth: "100%", scrollSnapAlign: "start",
              overflowY: "auto", padding: "0 18px 96px",
              ...(pageComplete ? {
                background: "color-mix(in oklch, oklch(0.83 0.13 85) 4%, var(--bg))",
                boxShadow: "inset 0 0 0 1.5px color-mix(in oklch, oklch(0.83 0.13 85) 18%, transparent)",
              } : pageShield ? {
                background: "color-mix(in oklch, var(--accent) 3%, var(--bg))",
              } : {}),
            }}>
              {/* Cabecera de página con estado */}
              <div className="hv-section-head" style={
                pageComplete ? {
                  background: "color-mix(in oklch, oklch(0.83 0.13 85) 10%, transparent)",
                  border: "1px solid color-mix(in oklch, oklch(0.83 0.13 85) 40%, transparent)",
                  borderRadius: 10, padding: "6px 10px", margin: "16px 0 10px",
                } : pageShield ? {
                  background: "color-mix(in oklch, var(--accent) 6%, transparent)",
                  border: "1px solid color-mix(in oklch, var(--accent) 25%, transparent)",
                  borderRadius: 10, padding: "6px 10px", margin: "16px 0 10px",
                } : {}
              }>
                <span className="hv-section-emoji">{pagina.emoji}</span>
                <span className="hv-section-name">{pagina.oculta ? "???" : pagina.nombre}</span>
                {pageComplete && <span style={{ fontSize: 13, color: "oklch(0.83 0.13 85)" }}>✦ COMPLETA</span>}
                {pageShield  && <span style={{ fontSize: 11, color: "var(--accent)" }}>🛡️</span>}
                <span className="hv-section-count">{pageOwned}/{pageTotal}</span>
              </div>
              {pageCards.length > 0 ? (
                <div className="hv-grid">
                  {pageCards.map((card) => (
                    <MiniSlot key={card.id} card={card} onClick={() => setDetail(card)} />
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: "center", padding: "40px 0", color: "var(--muted)", fontSize: 13 }}>
                  Nada con este filtro en esta página
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Overlay detalle ── */}
      {detail && (
        <CardDetail card={detail} onClose={() => setDetail(null)} router={router} />
      )}

      <HvBottomNav />
    </div>
  );
}
