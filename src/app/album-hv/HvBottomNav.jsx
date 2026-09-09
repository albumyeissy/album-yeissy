"use client";
import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";

// ─── Iconos SVG ───────────────────────────────────────────────────────────────
const IconGrupo = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="8.5" cy="7" r="3.5"/>
    <path d="M2 20v-1a6 6 0 0 1 6-6h1"/>
    <circle cx="17" cy="7" r="3.5"/>
    <path d="M22 20v-1a6 6 0 0 0-6-6h-1"/>
  </svg>
);

const IconAlbum = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3"  y="3"  width="7" height="9" rx="2"/>
    <rect x="14" y="3"  width="7" height="9" rx="2"/>
    <rect x="3"  y="15" width="7" height="6" rx="2"/>
    <rect x="14" y="15" width="7" height="6" rx="2"/>
  </svg>
);

const IconCambios = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7 17V5m0 0L3 9m4-4 4 4"/>
    <path d="M17 7v12m0 0 4-4m-4 4-4-4"/>
  </svg>
);

const IconPerfil = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="4"/>
    <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/>
  </svg>
);

const IconFab = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2 14.1 8.4H21L15.4 12.3 17.6 18.7 12 14.8 6.4 18.7 8.6 12.3 3 8.4H9.9L12 2Z"/>
  </svg>
);

// ─── Hub overlay: Sobres · Ruleta · Tienda ────────────────────────────────────
const HUB_OPTIONS = [
  {
    id:    "sobres",
    emoji: "📦",
    label: "Sobres",
    desc:  "Abre sobres y consigue nuevas cartas",
    href:  "/abrir-sobre",
    color: "var(--accent)",
  },
  {
    id:    "ruleta",
    emoji: "◉",
    label: "Ruleta",
    desc:  "1 giro gratis al día · gana monedas y cartas",
    href:  "/ruleta",
    color: "oklch(0.72 0.2 300)",
  },
  {
    id:    "tienda",
    emoji: "🏪",
    label: "Tienda",
    desc:  "Compra sobres, robos y más con monedas",
    href:  "/tienda",
    color: "oklch(0.83 0.13 85)",
  },
];

function GetHub({ onClose }) {
  const router = useRouter();
  const [closing, setClosing] = useState(false);

  const close = () => {
    setClosing(true);
    setTimeout(onClose, 240);
  };

  const go = (href) => {
    setClosing(true);
    setTimeout(() => { onClose(); router.push(href); }, 240);
  };

  return (
    <div
      className={"hv-hub-backdrop" + (closing ? " closing" : "")}
      onClick={close}
    >
      <div
        className={"hv-hub-sheet" + (closing ? " closing" : "")}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="hv-hub-handle" />
        <p className="hv-hub-kicker">CONSEGUIR</p>

        <div className="hv-hub-options">
          {HUB_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              className="hv-hub-option"
              onClick={() => go(opt.href)}
              style={{ "--oc": opt.color }}
            >
              <span className="hv-hub-opt-emoji">{opt.emoji}</span>
              <div className="hv-hub-opt-text">
                <span className="hv-hub-opt-label">{opt.label}</span>
                <span className="hv-hub-opt-desc">{opt.desc}</span>
              </div>
              <span className="hv-hub-opt-arrow">›</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Barra de navegación inferior ────────────────────────────────────────────
const TAB_L = [
  { id: "grupo",   label: "Grupo",   Icon: IconGrupo,   href: "/feed"    },
  { id: "album",   label: "Álbum",   Icon: IconAlbum,   href: "/album-hv"},
];
const TAB_R = [
  { id: "cambios", label: "Cambios", Icon: IconCambios, href: "/mercado" },
  { id: "perfil",  label: "Perfil",  Icon: IconPerfil,  href: "/"        },
];

export default function HvBottomNav() {
  const [hubOpen, setHubOpen] = useState(false);
  const router   = useRouter();
  const pathname = usePathname();

  return (
    <>
      <nav className="hv-nav">
        {TAB_L.map(({ id, label, Icon, href }) => (
          <button
            key={id}
            className={"hv-nav-item" + (pathname === href ? " active" : "")}
            onClick={() => router.push(href)}
          >
            <Icon />
            <span>{label}</span>
          </button>
        ))}

        {/* Slot central — FAB elevado */}
        <div className="hv-nav-fab-slot">
          <button className="hv-nav-fab" onClick={() => setHubOpen(true)}>
            <IconFab />
          </button>
          <span className="hv-nav-fab-label">Conseguir</span>
        </div>

        {TAB_R.map(({ id, label, Icon, href }) => (
          <button
            key={id}
            className={"hv-nav-item" + (pathname === href ? " active" : "")}
            onClick={() => router.push(href)}
          >
            <Icon />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      {hubOpen && <GetHub onClose={() => setHubOpen(false)} />}
    </>
  );
}
