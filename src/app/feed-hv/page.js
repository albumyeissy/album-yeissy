"use client";
import { useState, useEffect } from "react";
import { auth, db } from "../../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, getDocs, collection } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { CROMOS } from "../../data/cromos";
import "../hv.css";
import HvBottomNav from "../HvBottomNav";

const TOTAL = CROMOS.length;

// ─── Hue consistente a partir del nombre ─────────────────────────────────────
function nameToHue(name = "") {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) & 0xffff;
  return h % 360;
}

// ─── Iniciales (máx. 2 chars) ─────────────────────────────────────────────────
function initials(name = "") {
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

// ─── Tiempo relativo ──────────────────────────────────────────────────────────
function timeAgo(ts) {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "ahora";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

// ─── Rareza → colores para el chip ────────────────────────────────────────────
const RAREZA_COLOR = {
  legendaria: "oklch(0.83 0.13 85)",
  mitica:     "oklch(0.68 0.22 18)",
  rara:       "oklch(0.76 0.15 230)",
  comun:      "oklch(0.74 0.03 265)",
};

// ─── Chip derecho por tipo de evento ─────────────────────────────────────────
function FeedChip({ type, rareza }) {
  if (type === "legendaria") {
    return (
      <div
        className="hv-feed-chip card"
        style={{ "--rc": RAREZA_COLOR.legendaria }}
        title="Legendaria"
      >⭐</div>
    );
  }
  if (type === "mitica") {
    return (
      <div
        className="hv-feed-chip card"
        style={{ "--rc": RAREZA_COLOR.mitica }}
        title="Mítica"
      >⚡</div>
    );
  }
  const MAP = {
    racha:             { icon: "🔥", title: "Racha" },
    intercambio:       { icon: "⇄",  title: "Intercambio" },
    robo:              { icon: "🎯", title: "Robo" },
    pagina_completada: { icon: "✓",  title: "Página completa" },
  };
  const def = MAP[type] ?? { icon: "◉", title: "" };
  return (
    <div className="hv-feed-chip" title={def.title}
      style={{ fontSize: type === "intercambio" ? "1rem" : undefined }}>
      {def.icon}
    </div>
  );
}

// ─── Avatar circular ──────────────────────────────────────────────────────────
function Avatar({ name, size = 40, fontSize = 13, className = "hv-feed-av" }) {
  const hue = nameToHue(name);
  return (
    <div className={className} style={{ "--h": hue, width: size, height: size, fontSize }}>
      {initials(name)}
    </div>
  );
}

// ─── Fila del feed ────────────────────────────────────────────────────────────
function FeedItem({ ev }) {
  return (
    <div className="hv-feed-item">
      <Avatar name={ev.userName} />
      <div className="hv-feed-body">
        <div className="hv-feed-text">
          <strong>{ev.userName}</strong>{" "}
          {ev.details}
        </div>
        {ev.timestamp && (
          <div className="hv-feed-time">{timeAgo(ev.timestamp)}</div>
        )}
      </div>
      <FeedChip type={ev.type} rareza={ev.rareza} />
    </div>
  );
}

// ─── Podio (top 3) ────────────────────────────────────────────────────────────
// Orden visual: 2º · 1º · 3º
function Podium({ top3, myUid }) {
  const BAR_H   = { 0: 96, 1: 128, 2: 76 };  // índice visual (2, 1, 3)
  const VISUAL  = [top3[1], top3[0], top3[2]].filter(Boolean);
  const PLACES  = [2, 1, 3];

  return (
    <div className="hv-podium">
      {VISUAL.map((p, vi) => {
        const place = PLACES[vi];
        const isMe  = p.uid === myUid;
        return (
          <div key={p.uid} className={`hv-pod p${place}${isMe ? " me" : ""}`}>
            <div className="hv-pod-av" style={{ "--h": nameToHue(p.nombre) }}>
              {initials(p.nombre)}
              {place === 1 && <span className="hv-pod-crown">♛</span>}
            </div>
            <div className="hv-pod-name">
              {p.nombre}{isMe ? " · tú" : ""}
            </div>
            <div className="hv-pod-bar" style={{ height: BAR_H[vi] }}>
              <span className="hv-pod-pct">{p.porcentaje}%</span>
              <span className="hv-pod-place">{place}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Ranking completo ─────────────────────────────────────────────────────────
function RankingBody({ jugadores, myUid }) {
  if (!jugadores.length) {
    return (
      <div className="hv-feed-empty">
        <span className="hv-feed-empty-icon">🏆</span>
        <span>Cargando ranking…</span>
      </div>
    );
  }

  const top3 = jugadores.slice(0, 3);
  const rest  = jugadores.slice(3);

  return (
    <>
      <Podium top3={top3} myUid={myUid} />
      <div className="hv-rank-list">
        {rest.map((p, i) => {
          const isMe = p.uid === myUid;
          return (
            <div key={p.uid} className={`hv-rank-row${isMe ? " me" : ""}`}>
              <span className="hv-rank-pos">{i + 4}</span>
              <div className="hv-rank-av" style={{ "--h": nameToHue(p.nombre) }}>
                {initials(p.nombre)}
              </div>
              <div className="hv-rank-mid">
                <div className="hv-rank-name">
                  {p.nombre}{isMe ? " · tú" : ""}
                </div>
                <div className="hv-rank-bar">
                  <i style={{ width: p.porcentaje + "%" }} />
                </div>
              </div>
              <div className="hv-rank-stats">
                <b>{p.porcentaje}%</b>
                <small>{p.cromosUnicos} ✦</small>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function FeedHvPage() {
  const [loading,   setLoading]   = useState(true);
  const [myUid,     setMyUid]     = useState(null);
  const [monedas,   setMonedas]   = useState(0);
  const [events,    setEvents]    = useState([]);
  const [jugadores, setJugadores] = useState([]);
  const [tab,       setTab]       = useState("actividad"); // "actividad" | "ranking"
  const router = useRouter();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { router.push("/"); return; }
      setMyUid(u.uid);

      try {
        const [userSnap, feedSnap, usersSnap] = await Promise.all([
          getDoc(doc(db, "usuarios", u.uid)),
          getDocs(collection(db, "feed")),
          getDocs(collection(db, "usuarios")),
        ]);

        // Monedas
        if (userSnap.exists()) {
          setMonedas(userSnap.data().monedas ?? 50);
        }

        // Feed events
        const list = [];
        feedSnap.forEach((d) => list.push({ id: d.id, ...d.data() }));
        list.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        setEvents(list.slice(0, 60));

        // Ranking
        const rank = [];
        usersSnap.forEach((d) => {
          const data  = d.data();
          const pegados     = (data.cromos || []).filter((c) => c.pegado !== false).length;
          const cromosUnicos = new Set((data.cromos || [])
            .filter((c) => (c.cantidad || 0) > 0)
            .map((c) => c.cromoId)).size;
          rank.push({
            uid: d.id,
            nombre: data.nombre || data.email?.split("@")[0] || "???",
            pegados,
            cromosUnicos,
            porcentaje: Math.round((pegados / TOTAL) * 100),
          });
        });
        rank.sort((a, b) => b.pegados - a.pegados || b.cromosUnicos - a.cromosUnicos);
        setJugadores(rank);

      } catch (err) { console.error("[feed-hv]", err); }

      setLoading(false);
    });
    return () => unsub();
  }, [router]);

  if (loading) {
    return (
      <div className="hv-app hv-loading">
        <span>Cargando…</span>
      </div>
    );
  }

  return (
    <div className="hv-app hv-page">
      <div className="hv-content">
      <div className="hv-screen">

        {/* ── Header ── */}
        <div className="hv-shead" style={{ paddingTop: 16 }}>
          <div>
            <div className="hv-kicker">Álbum Yeissy</div>
            <h1 className="hv-h1">El grupo</h1>
          </div>
          {/* Coin pill */}
          <div className="hv-coin-pill">
            <span className="hv-coin-icon">◉</span>
            {monedas}
          </div>
        </div>

        {/* ── Segmented control ── */}
        <div className="hv-seg">
          <button
            className={"hv-seg-btn" + (tab === "actividad" ? " on" : "")}
            onClick={() => setTab("actividad")}
          >
            Actividad
            {tab === "actividad" && events.length > 0 && (
              <span className="hv-seg-badge">{events.length}</span>
            )}
          </button>
          <button
            className={"hv-seg-btn" + (tab === "ranking" ? " on" : "")}
            onClick={() => setTab("ranking")}
          >
            Ranking
          </button>
        </div>

        {/* ── Tab: Actividad ── */}
        {tab === "actividad" && (
          events.length === 0 ? (
            <div className="hv-feed-empty">
              <span className="hv-feed-empty-icon">📭</span>
              <span>Aún no hay actividad del grupo</span>
            </div>
          ) : (
            <div className="hv-feed-list">
              {events.map((ev) => (
                <FeedItem key={ev.id} ev={ev} />
              ))}
            </div>
          )
        )}

        {/* ── Tab: Ranking ── */}
        {tab === "ranking" && (
          <RankingBody jugadores={jugadores} myUid={myUid} />
        )}

      </div>
      </div>

      <HvBottomNav />
    </div>
  );
}
