"use client";
import { useState, useEffect } from "react";
import { auth, db } from "../../lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc, getDocs, collection } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { CROMOS } from "../../data/cromos";
import "../hv.css";
import HvBottomNav from "../HvBottomNav";

const TOTAL = CROMOS.length;

const RAREZA_W = { mitica: 3, legendaria: 2, rara: 1, comun: 0 };
const RAREZA_COLOR = {
  legendaria: "oklch(0.83 0.13 85)",
  mitica:     "oklch(0.68 0.22 18)",
  rara:       "oklch(0.76 0.15 230)",
  comun:      "oklch(0.74 0.03 265)",
};

function nameToHue(name = "") {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) & 0xffff;
  return h % 360;
}
function initials(name = "") {
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

export default function PerfilHvPage() {
  const [loading, setLoading] = useState(true);
  const [datos,   setDatos]   = useState(null);
  const [rank,    setRank]    = useState(null);   // posición en el ranking (1-based)
  const router = useRouter();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { router.push("/"); return; }
      try {
        const [snap, usersSnap] = await Promise.all([
          getDoc(doc(db, "usuarios", u.uid)),
          getDocs(collection(db, "usuarios")),
        ]);

        const d = snap.exists() ? snap.data() : {};
        const nombre = d.nombre || u.email?.split("@")[0] || "Jugador";

        // Stats propias
        const cromos       = d.cromos || [];
        const pegados      = cromos.filter(c => c.pegado !== false).length;
        const cromosUnicos = new Set(cromos.filter(c => (c.cantidad || 0) > 0).map(c => c.cromoId)).size;
        const repes        = cromos.reduce((s, c) => s + Math.max(0, (c.cantidad || 0) - 1), 0);
        const legendarias  = cromos.filter(c => {
          const info = CROMOS.find(x => x.id === c.cromoId);
          return (c.cantidad > 0) && (info?.rareza === "legendaria" || info?.rareza === "mitica");
        }).length;
        const pct = Math.round((pegados / TOTAL) * 100);

        // Mejores cartas (top 3 por rareza)
        const ownedIds = new Set(cromos.filter(c => (c.cantidad || 0) > 0).map(c => c.cromoId));
        const bestCards = CROMOS
          .filter(c => ownedIds.has(c.id))
          .sort((a, b) => (RAREZA_W[b.rareza] ?? 0) - (RAREZA_W[a.rareza] ?? 0))
          .slice(0, 3);

        // Posición ranking
        const rankArr = [];
        usersSnap.forEach(ud => {
          const ud_ = ud.data();
          const pg = (ud_.cromos || []).filter(c => c.pegado !== false).length;
          rankArr.push({ uid: ud.id, pegados: pg });
        });
        rankArr.sort((a, b) => b.pegados - a.pegados);
        const pos = rankArr.findIndex(r => r.uid === u.uid) + 1;

        setDatos({
          uid: u.uid, nombre, email: u.email,
          monedas:       d.monedas       ?? 50,
          sobresAbiertos: d.totalSobresAbiertos ?? 0,
          rachaActual:   d.rachaActual   ?? 0,
          pegados, cromosUnicos, repes, legendarias, pct, bestCards,
        });
        setRank(pos || null);

      } catch (err) { console.error("[perfil-hv]", err); }
      setLoading(false);
    });
    return () => unsub();
  }, [router]);

  const handleSignOut = async () => {
    await signOut(auth);
    router.push("/");
  };

  if (loading) {
    return (
      <div className="hv-app hv-loading">
        <span>Cargando perfil…</span>
      </div>
    );
  }

  if (!datos) return null;

  const hue = nameToHue(datos.nombre);

  const TILES = [
    { k: "Completado",     v: datos.pct + "%" },
    { k: "Cromos",         v: `${datos.cromosUnicos}/${TOTAL}` },
    { k: "Repetidas",      v: datos.repes },
    { k: "Legendarias",    v: datos.legendarias },
    { k: "Sobres abiertos", v: datos.sobresAbiertos },
    { k: "Racha",          v: datos.rachaActual > 0 ? `${datos.rachaActual}d 🔥` : "—" },
  ];

  return (
    <div className="hv-app hv-page">
      <div className="hv-content">
      <div className="hv-screen">

        {/* ── Header ── */}
        <div className="hv-shead" style={{ paddingTop: 16 }}>
          <div>
            <div className="hv-kicker">Mi perfil</div>
            <h1 className="hv-h1">{datos.nombre}</h1>
          </div>
          {/* Monedas */}
          <div className="hv-coin-pill">
            <span className="hv-coin-icon">◉</span>
            {datos.monedas}
          </div>
        </div>

        {/* ── Tarjeta de perfil ── */}
        <div className="hv-profile-card">
          <div className="hv-prof-av" style={{ "--h": hue }}>
            {initials(datos.nombre)}
          </div>
          <div className="hv-prof-info">
            <div className="hv-prof-name">{datos.nombre}</div>
            <div className="hv-prof-sub">{datos.email}</div>
            {rank && (
              <div className="hv-prof-rank">
                {rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `#${rank}`}
                {" "}del grupo · Temporada 1
              </div>
            )}
          </div>
        </div>

        {/* ── Stats tiles ── */}
        <div className="hv-tiles">
          {TILES.map(t => (
            <div key={t.k} className="hv-tile">
              <div className="hv-tile-v">{t.v}</div>
              <div className="hv-tile-k">{t.k}</div>
            </div>
          ))}
        </div>

        {/* ── Mejores cartas ── */}
        {datos.bestCards.length > 0 && (
          <>
            <div className="hv-section-label">Tus mejores cartas</div>
            <div className="hv-best">
              {datos.bestCards.map(c => (
                <div
                  key={c.id}
                  className="hv-best-card"
                  style={{
                    "--rc": RAREZA_COLOR[c.rareza] ?? RAREZA_COLOR.comun,
                  }}
                >
                  <img
                    src={c.imagen}
                    alt={c.nombre}
                    className="hv-best-img"
                    loading="lazy"
                  />
                  <div className="hv-best-name">{c.nombre}</div>
                  <span
                    className="hv-rchip sm"
                    style={{ "--rc": RAREZA_COLOR[c.rareza] ?? RAREZA_COLOR.comun }}
                  >
                    {c.rareza === "legendaria" ? "LEGENDARIA"
                      : c.rareza === "mitica"  ? "MÍTICA"
                      : c.rareza === "rara"    ? "RARA"
                      : "COMÚN"}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── Cerrar sesión ── */}
        <button
          className="hv-btn ghost"
          onClick={handleSignOut}
          style={{ marginTop: 28 }}
        >
          Cerrar sesión
        </button>

      </div>
      </div>

      <HvBottomNav />
    </div>
  );
}
