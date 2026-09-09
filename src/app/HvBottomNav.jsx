"use client";
import { usePathname, useRouter } from "next/navigation";

// SVGs sacados directamente de hv-app.jsx del prototipo HoloVault
function NavIcon({ name, active }) {
  const s  = active ? "var(--accent)" : "rgba(235,238,255,.55)";
  const sw = 2;

  if (name === "feed") return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <rect x="3"  y="4"  width="18" height="5" rx="1.5" stroke={s} strokeWidth={sw}/>
      <rect x="3"  y="12" width="18" height="5" rx="1.5" stroke={s} strokeWidth={sw}/>
      <circle cx="6.5" cy="6.5"  r="0.6" fill={s}/>
      <circle cx="6.5" cy="14.5" r="0.6" fill={s}/>
    </svg>
  );

  if (name === "album") return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <rect x="3"  y="3"  width="7" height="8" rx="1.5" stroke={s} strokeWidth={sw}/>
      <rect x="14" y="3"  width="7" height="8" rx="1.5" stroke={s} strokeWidth={sw}/>
      <rect x="3"  y="14" width="7" height="7" rx="1.5" stroke={s} strokeWidth={sw}/>
      <rect x="14" y="14" width="7" height="7" rx="1.5" stroke={s} strokeWidth={sw}/>
    </svg>
  );

  if (name === "conseguir") return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <rect x="4" y="3" width="16" height="18" rx="2.5" stroke={s} strokeWidth={sw}/>
      <path d="M4 8h16" stroke={s} strokeWidth={sw}/>
      <circle cx="12" cy="14.5" r="2.2" stroke={s} strokeWidth={sw}/>
    </svg>
  );

  if (name === "cambios") return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M5 9h13l-3-3M19 15H6l3 3"
        stroke={s} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );

  // perfil (default)
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8" r="4" stroke={s} strokeWidth={sw}/>
      <path d="M4.5 20a7.5 7.5 0 0115 0"
        stroke={s} strokeWidth={sw} strokeLinecap="round"/>
    </svg>
  );
}

export default function HvBottomNav() {
  const router   = useRouter();
  const pathname = usePathname();

  const go   = (href) => router.push(href);
  const isOn = (href) => pathname === href || pathname.startsWith(href + "/");

  return (
    <nav className="hv-nav" aria-label="Navegación principal">

      {/* Grupo */}
      <button
        className={"hv-nav-btn" + (isOn("/feed-hv") ? " on" : "")}
        onClick={() => go("/feed-hv")}
      >
        <NavIcon name="feed" active={isOn("/feed-hv")} />
        <span>Grupo</span>
      </button>

      {/* Álbum */}
      <button
        className={"hv-nav-btn" + (isOn("/album-hv") ? " on" : "")}
        onClick={() => go("/album-hv")}
      >
        <NavIcon name="album" active={isOn("/album-hv")} />
        <span>Álbum</span>
      </button>

      {/* FAB central — Conseguir (elevado -22px) */}
      <button
        className={"hv-nav-btn center" + (isOn("/conseguir-hv") ? " on" : "")}
        onClick={() => go("/conseguir-hv")}
        aria-label="Conseguir"
      >
        <span className="hv-nav-fab">
          <NavIcon name="conseguir" active />
        </span>
        <span>Conseguir</span>
      </button>

      {/* Cambios */}
      <button
        className={"hv-nav-btn" + (isOn("/mercado-hv") ? " on" : "")}
        onClick={() => go("/mercado-hv")}
      >
        <NavIcon name="cambios" active={isOn("/mercado-hv")} />
        <span>Cambios</span>
      </button>

      {/* Perfil */}
      <button
        className={"hv-nav-btn" + (isOn("/perfil-hv") ? " on" : "")}
        onClick={() => go("/perfil-hv")}
      >
        <NavIcon name="perfil" active={isOn("/perfil-hv")} />
        <span>Perfil</span>
      </button>

    </nav>
  );
}
