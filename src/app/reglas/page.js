"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const SECCIONES = [
  {
    id: "cromos",
    emoji: "🃏",
    titulo: "Los Cromos",
    subtitulo: "Tipos, rarezas y probabilidades",
    color: "#3b82f6",
    contenido: () => (
      <div>
        <p style={{ color: "#94a3b8", fontSize: "0.85rem", marginBottom: "16px" }}>
          El álbum tiene <strong style={{ color: "white" }}>~124 cromos</strong> repartidos en cuatro categorías:
        </p>

        {[
          { label: "Personas", desc: "JC, Coke, Sergio, Juanma, Robert y Noel", cantidad: "6 × 11 = 66", color: "#3b82f6" },
          { label: "Viajes", desc: "Lugares visitados juntos", cantidad: "4 × 8 = 32", color: "#8b5cf6" },
          { label: "Especiales", desc: "Momentos y objetos únicos", cantidad: "25", color: "#f59e0b" },
          { label: "La Mítica 🔴", desc: "Una sola carta, oculta, secreta", cantidad: "1", color: "#ef4444" },
        ].map((cat) => (
          <div key={cat.label} style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "10px 12px", borderRadius: "10px", marginBottom: "8px",
            background: "rgba(255,255,255,0.04)", border: `1px solid ${cat.color}33`,
          }}>
            <div>
              <p style={{ margin: 0, fontWeight: "bold", fontSize: "0.88rem", color: cat.color }}>{cat.label}</p>
              <p style={{ margin: "2px 0 0", fontSize: "0.75rem", color: "#64748b" }}>{cat.desc}</p>
            </div>
            <span style={{
              fontSize: "0.78rem", fontWeight: "bold", color: cat.color,
              background: `${cat.color}22`, padding: "4px 10px", borderRadius: "8px",
            }}>{cat.cantidad}</span>
          </div>
        ))}

        <p style={{ color: "#94a3b8", fontSize: "0.85rem", margin: "18px 0 10px", fontWeight: "bold" }}>
          Rarezas y probabilidades
        </p>

        {[
          { emoji: "📄", label: "Común",     normal: "~81%", mega: "~67%", color: "#64748b" },
          { emoji: "💎", label: "Rara",       normal: "~16%", mega: "~27%", color: "#3b82f6" },
          { emoji: "⭐", label: "Legendaria", normal: "~3%",  mega: "~6%",  color: "#fbbf24" },
          { emoji: "🔴", label: "Mítica",     normal: "0.5%", mega: "—",    color: "#ef4444" },
        ].map((r) => (
          <div key={r.label} style={{
            display: "grid", gridTemplateColumns: "1fr 80px 80px",
            alignItems: "center", padding: "9px 12px", borderRadius: "9px",
            marginBottom: "6px", background: "rgba(255,255,255,0.03)",
          }}>
            <span style={{ fontSize: "0.85rem", color: r.color, fontWeight: "bold" }}>
              {r.emoji} {r.label}
            </span>
            <span style={{ textAlign: "center", fontSize: "0.78rem", color: "#94a3b8" }}>{r.normal}</span>
            <span style={{ textAlign: "center", fontSize: "0.78rem", color: "#f59e0b" }}>{r.mega}</span>
          </div>
        ))}
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 80px 80px",
          padding: "4px 12px", marginBottom: "8px",
        }}>
          <span style={{ fontSize: "0.68rem", color: "#475569" }}>Rareza</span>
          <span style={{ textAlign: "center", fontSize: "0.68rem", color: "#475569" }}>Sobre normal</span>
          <span style={{ textAlign: "center", fontSize: "0.68rem", color: "#f59e0b" }}>Mega sobre</span>
        </div>

        <div style={{
          background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)",
          borderRadius: "10px", padding: "10px 12px", marginTop: "8px",
        }}>
          <p style={{ margin: 0, fontSize: "0.8rem", color: "#fca5a5" }}>
            🔴 <strong>La carta Mítica</strong> es única: solo puedes tenerla <strong>una vez</strong>. Al conseguirla desbloqueas una página secreta del álbum.
          </p>
        </div>
      </div>
    ),
  },

  {
    id: "sobres",
    emoji: "📦",
    titulo: "Abrir Sobres",
    subtitulo: "Sobres diarios, mega sobre y bonus",
    color: "#10b981",
    contenido: () => (
      <div>
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "16px",
        }}>
          {[
            { emoji: "📦", valor: "2", desc: "sobres gratis al día", color: "#10b981" },
            { emoji: "🃏", valor: "5", desc: "cromos por sobre normal", color: "#3b82f6" },
            { emoji: "⭐", valor: "7", desc: "cromos en el mega sobre", color: "#fbbf24" },
            { emoji: "🔄", valor: "15", desc: "sobres para el siguiente mega", color: "#8b5cf6" },
          ].map((s) => (
            <div key={s.desc} style={{
              background: "rgba(255,255,255,0.04)", borderRadius: "12px",
              padding: "14px 12px", textAlign: "center", border: `1px solid ${s.color}33`,
            }}>
              <p style={{ margin: 0, fontSize: "2rem" }}>{s.emoji}</p>
              <p style={{ margin: "4px 0 2px", fontSize: "1.6rem", fontWeight: "bold", color: s.color }}>{s.valor}</p>
              <p style={{ margin: 0, fontSize: "0.72rem", color: "#64748b", lineHeight: 1.3 }}>{s.desc}</p>
            </div>
          ))}
        </div>

        <p style={{ color: "#94a3b8", fontSize: "0.85rem", marginBottom: "10px", fontWeight: "bold" }}>
          ¿Cómo se abre un sobre?
        </p>
        <p style={{ color: "#64748b", fontSize: "0.82rem", marginBottom: "14px", lineHeight: 1.5 }}>
          Arrastra hacia arriba sobre la imagen del sobre o tócalo directamente. Los sobres se renuevan cada día a <strong style={{ color: "white" }}>medianoche</strong>.
        </p>

        <div style={{
          background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.3)",
          borderRadius: "10px", padding: "12px",
        }}>
          <p style={{ margin: "0 0 4px", fontWeight: "bold", color: "#fbbf24", fontSize: "0.88rem" }}>
            ⭐ Mega Sobre
          </p>
          <p style={{ margin: 0, fontSize: "0.8rem", color: "#fcd34d", lineHeight: 1.5 }}>
            Cada 15 sobres abiertos en total, el siguiente es un Mega Sobre: da <strong>7 cromos</strong> con mejores probabilidades de raras y legendarias.
          </p>
        </div>

        <div style={{
          background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.25)",
          borderRadius: "10px", padding: "12px", marginTop: "10px",
        }}>
          <p style={{ margin: "0 0 4px", fontWeight: "bold", color: "#10b981", fontSize: "0.88rem" }}>
            🎁 Sobres extra
          </p>
          <p style={{ margin: 0, fontSize: "0.8rem", color: "#6ee7b7", lineHeight: 1.5 }}>
            Además de los 2 diarios, puedes acumular sobres extra por la <strong>racha</strong>, la <strong>ruleta</strong> o comprándolos en la <strong>tienda</strong>. Se usan después de los gratuitos.
          </p>
        </div>
      </div>
    ),
  },

  {
    id: "racha",
    emoji: "🔥",
    titulo: "La Racha",
    subtitulo: "Bonus por días consecutivos",
    color: "#f59e0b",
    contenido: () => (
      <div>
        <p style={{ color: "#94a3b8", fontSize: "0.85rem", marginBottom: "16px", lineHeight: 1.5 }}>
          Si abres al menos <strong style={{ color: "white" }}>1 sobre al día</strong> de forma consecutiva, mantienes una racha activa.
        </p>

        <div style={{
          background: "linear-gradient(135deg, rgba(245,158,11,0.12), rgba(251,191,36,0.05))",
          border: "1px solid rgba(245,158,11,0.3)", borderRadius: "12px",
          padding: "16px", marginBottom: "14px", textAlign: "center",
        }}>
          <p style={{ margin: "0 0 6px", fontSize: "2rem" }}>🎁</p>
          <p style={{ margin: 0, fontWeight: "bold", color: "#fbbf24", fontSize: "1rem" }}>
            Cada 5 días de racha
          </p>
          <p style={{ margin: "4px 0 0", color: "#fcd34d", fontSize: "0.85rem" }}>
            recibes <strong>+1 sobre bonus</strong>
          </p>
        </div>

        {[
          { title: "¿Qué pasa si un día no abres?", text: "La racha se rompe y vuelve a 1 cuando retomes al día siguiente.", emoji: "💔", color: "#ef4444" },
          { title: "Protección de racha 🛡️", text: "Comprable en la Tienda por 15 monedas. Activa para el día siguiente — si ese día no abres sobres, la racha no se rompe. También anula una maldición de racha.", emoji: "🛡️", color: "#10b981" },
          { title: "Maldición de racha 😈", text: "Si alguien te maldice desde la Ruleta, mañana solo podrás abrir 1 sobre en lugar de 2.", emoji: "😈", color: "#8b5cf6" },
        ].map((item) => (
          <div key={item.title} style={{
            background: "rgba(255,255,255,0.03)", border: `1px solid ${item.color}33`,
            borderRadius: "10px", padding: "12px", marginBottom: "8px",
            display: "flex", gap: "12px", alignItems: "flex-start",
          }}>
            <span style={{ fontSize: "1.4rem", flexShrink: 0 }}>{item.emoji}</span>
            <div>
              <p style={{ margin: "0 0 4px", fontWeight: "bold", color: item.color, fontSize: "0.85rem" }}>{item.title}</p>
              <p style={{ margin: 0, color: "#64748b", fontSize: "0.8rem", lineHeight: 1.5 }}>{item.text}</p>
            </div>
          </div>
        ))}
      </div>
    ),
  },

  {
    id: "album",
    emoji: "📖",
    titulo: "El Álbum",
    subtitulo: "Colecciona y pega tus cromos",
    color: "#8b5cf6",
    contenido: () => (
      <div>
        <p style={{ color: "#94a3b8", fontSize: "0.85rem", marginBottom: "14px", lineHeight: 1.5 }}>
          El álbum muestra todas las páginas con los huecos para cada cromo.
        </p>

        {[
          { emoji: "⬜", label: "Sin obtener", desc: "Silueta en gris — aún no tienes esta carta.", color: "#475569" },
          { emoji: "🟦", label: "Obtenida, sin pegar", desc: "La tienes en tu mazo pero no la has colocado todavía.", color: "#3b82f6" },
          { emoji: "✅", label: "Pegada", desc: "Colocada en el álbum. Queda fija en esa posición.", color: "#10b981" },
        ].map((s) => (
          <div key={s.label} style={{
            display: "flex", gap: "12px", alignItems: "center",
            padding: "10px 12px", borderRadius: "10px", marginBottom: "8px",
            background: "rgba(255,255,255,0.03)", border: `1px solid ${s.color}33`,
          }}>
            <span style={{ fontSize: "1.5rem" }}>{s.emoji}</span>
            <div>
              <p style={{ margin: 0, fontWeight: "bold", color: s.color, fontSize: "0.85rem" }}>{s.label}</p>
              <p style={{ margin: "2px 0 0", color: "#64748b", fontSize: "0.78rem" }}>{s.desc}</p>
            </div>
          </div>
        ))}

        <div style={{
          background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)",
          borderRadius: "10px", padding: "12px", marginTop: "8px",
        }}>
          <p style={{ margin: 0, fontSize: "0.8rem", color: "#fca5a5", lineHeight: 1.5 }}>
            🔴 La <strong>página de la carta Mítica</strong> está oculta para todos hasta que alguien la consiga.
          </p>
        </div>
      </div>
    ),
  },

  {
    id: "tortura",
    emoji: "😈",
    titulo: "La Tortura Diaria",
    subtitulo: "Sorteo compartido + minijuego para ganar un sobre",
    color: "#ef4444",
    contenido: () => (
      <div>
        <p style={{ color: "#94a3b8", fontSize: "0.85rem", marginBottom: "14px", lineHeight: 1.5 }}>
          Cada día, el primer jugador que entre en la sección de Tortura debe <strong style={{ color: "white" }}>girar la ruleta</strong> para sortear qué tortura le toca a <strong style={{ color: "white" }}>todo el grupo</strong>.
        </p>

        <div style={{
          background: "linear-gradient(135deg, rgba(239,68,68,0.10), rgba(239,68,68,0.04))",
          border: "1px solid rgba(239,68,68,0.3)", borderRadius: "12px",
          padding: "14px", marginBottom: "16px",
        }}>
          <p style={{ margin: "0 0 8px", fontWeight: "bold", color: "#ef4444", fontSize: "0.88rem" }}>
            🎰 ¿Cómo funciona el sorteo?
          </p>
          <p style={{ margin: 0, fontSize: "0.8rem", color: "#fca5a5", lineHeight: 1.6 }}>
            Al entrar, si nadie ha girado aún, verás la pantalla de sorteo. Al pulsar <em>"Girar la ruleta"</em>, una animación elige aleatoriamente una de las 6 torturas — probabilidad igual para todas. El resultado se guarda y <strong>todos los jugadores</strong> verán y jugarán esa misma tortura hasta la siguiente medianoche.
          </p>
        </div>

        <p style={{ color: "#94a3b8", fontSize: "0.85rem", margin: "0 0 10px", fontWeight: "bold" }}>
          Las 6 torturas disponibles
        </p>

        {[
          { emoji: "🔢", nombre: "El Contador",  desc: "500 taps sin parar. Si tardas más de 3 s en un tap, vuelves a 0.",                                  oferta: 200 },
          { emoji: "🌀", nombre: "La Espera",    desc: "Mantén el botón pulsado 3 minutos seguidos. Si lo sueltas, vuelves a 0.",                           oferta: 60  },
          { emoji: "📝", nombre: "El Texto",     desc: "Copia un texto exacto sin errores. Tienes 3 intentos y no puedes pegar.",                           oferta: null },
          { emoji: "⚡", nombre: "El Reflejo",   desc: "Un botón aparece al azar durante 1 segundo. Tócalo 25 veces. 3 fallos = game over.",                 oferta: 12  },
          { emoji: "🧮", nombre: "El Cálculo",   desc: "20 operaciones aritméticas con 4 segundos cada una. Sin teclado. 3 errores = game over.",            oferta: 10  },
          { emoji: "🎯", nombre: "La Puntería",  desc: "Un círculo rebota y se acelera con cada acierto. Tócalo 20 veces. 3 fallos = game over.",            oferta: 10  },
        ].map((t) => (
          <div key={t.nombre} style={{
            background: "rgba(255,255,255,0.03)", border: "1px solid #1e293b",
            borderRadius: "10px", padding: "10px 12px", marginBottom: "7px",
            display: "flex", gap: "10px", alignItems: "flex-start",
          }}>
            <span style={{ fontSize: "1.4rem", flexShrink: 0 }}>{t.emoji}</span>
            <div>
              <p style={{ margin: 0, fontWeight: "bold", color: "white", fontSize: "0.85rem" }}>{t.nombre}</p>
              <p style={{ margin: "2px 0 0", color: "#64748b", fontSize: "0.78rem", lineHeight: 1.4 }}>{t.desc}</p>
              {t.oferta !== null && (
                <p style={{ margin: "3px 0 0", color: "#f59e0b", fontSize: "0.72rem" }}>
                  💡 A mitad ({t.oferta}) te ofrecen rendirte por 2 cromos
                </p>
              )}
            </div>
          </div>
        ))}

        <div style={{
          background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.25)",
          borderRadius: "10px", padding: "12px", marginTop: "10px",
        }}>
          <p style={{ margin: "0 0 4px", fontWeight: "bold", color: "#10b981", fontSize: "0.88rem" }}>
            🏆 Premio / Rendición
          </p>
          <p style={{ margin: 0, fontSize: "0.8rem", color: "#6ee7b7", lineHeight: 1.5 }}>
            Completar la tortura → <strong>1 sobre bonus</strong>.
            Rendirte → <strong>2 cromos de consolación</strong>.
            Solo se puede hacer una vez al día.
          </p>
        </div>
      </div>
    ),
  },

  {
    id: "ruleta",
    emoji: "🎰",
    titulo: "La Ruleta Rusa",
    subtitulo: "1 tirada al día, 7 sectores",
    color: "#ef4444",
    contenido: () => (
      <div>
        <p style={{ color: "#94a3b8", fontSize: "0.85rem", marginBottom: "14px", lineHeight: 1.5 }}>
          Una vez al día puedes girar la ruleta. Hay 7 resultados posibles:
        </p>

        {[
          { emoji: "📦", label: "Sobre gratis",     prob: "20%", desc: "Recibes un sobre extra acumulable.",                                                       color: "#10b981" },
          { emoji: "🃏", label: "Robar común",      prob: "20%", desc: "Eliges un jugador y le robas una carta común aleatoria (puede ser única).",                color: "#64748b" },
          { emoji: "💎", label: "Robar rara",       prob: "15%", desc: "Igual pero con una carta rara.",                                                           color: "#3b82f6" },
          { emoji: "⭐", label: "Robar legendaria", prob: "5%",  desc: "Igual pero con una legendaria. Riesgo alto.",                                              color: "#fbbf24" },
          { emoji: "🔥", label: "La Quema",         prob: "17%", desc: "Se destruye aleatoriamente una de tus cartas pegadas. Si no tienes ninguna, te libras.",   color: "#f97316" },
          { emoji: "😈", label: "La Maldición",     prob: "11%", desc: "Eliges un jugador: mañana solo podrá abrir 1 sobre. Curable con la tienda.",               color: "#8b5cf6" },
          { emoji: "💀", label: "Perdedor",         prob: "12%", desc: "No pasa nada. Solo mala suerte.",                                                          color: "#475569" },
        ].map((s) => (
          <div key={s.label} style={{
            display: "grid", gridTemplateColumns: "auto 1fr auto",
            gap: "10px", alignItems: "center",
            padding: "10px 12px", borderRadius: "10px", marginBottom: "7px",
            background: "rgba(255,255,255,0.03)", border: `1px solid ${s.color}33`,
          }}>
            <span style={{ fontSize: "1.4rem" }}>{s.emoji}</span>
            <div>
              <p style={{ margin: 0, fontWeight: "bold", color: s.color, fontSize: "0.83rem" }}>{s.label}</p>
              <p style={{ margin: "2px 0 0", color: "#64748b", fontSize: "0.76rem", lineHeight: 1.4 }}>{s.desc}</p>
            </div>
            <span style={{
              fontSize: "0.72rem", fontWeight: "bold", color: s.color,
              background: `${s.color}22`, padding: "3px 8px", borderRadius: "6px",
              whiteSpace: "nowrap",
            }}>{s.prob}</span>
          </div>
        ))}
      </div>
    ),
  },

  {
    id: "mercado",
    emoji: "🏷️",
    titulo: "El Mercado",
    subtitulo: "Intercambia cartas con otros jugadores",
    color: "#f59e0b",
    contenido: () => (
      <div>
        <p style={{ color: "#94a3b8", fontSize: "0.85rem", marginBottom: "14px", lineHeight: 1.5 }}>
          Solo puedes vender u ofertar cartas que tengas <strong style={{ color: "white" }}>repetidas</strong>.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "16px" }}>
          {[
            { emoji: "🏷️", titulo: "Ventas", items: ["1 venta activa al día", "Dura 24 horas", "1 intercambio al día como vendedor"] , color: "#f59e0b" },
            { emoji: "💰", titulo: "Ofertas", items: ["3 ofertas al día", "Editables mientras estén activas", "1 intercambio al día como ofertante"], color: "#3b82f6" },
          ].map((col) => (
            <div key={col.titulo} style={{
              background: `${col.color}11`, border: `1px solid ${col.color}44`,
              borderRadius: "12px", padding: "12px",
            }}>
              <p style={{ margin: "0 0 10px", fontWeight: "bold", color: col.color, fontSize: "0.88rem" }}>
                {col.emoji} {col.titulo}
              </p>
              {col.items.map((item) => (
                <p key={item} style={{ margin: "0 0 5px", fontSize: "0.78rem", color: "#94a3b8", display: "flex", gap: "6px" }}>
                  <span style={{ color: col.color, flexShrink: 0 }}>·</span> {item}
                </p>
              ))}
            </div>
          ))}
        </div>

        <p style={{ color: "#94a3b8", fontSize: "0.85rem", margin: "0 0 10px", fontWeight: "bold" }}>
          Mínimos para hacer una oferta válida
        </p>
        {[
          { want: "📄 Común",      min: "1 común",                              color: "#64748b" },
          { want: "💎 Rara",       min: "2 comunes  ·  ó  ·  1 rara",           color: "#3b82f6" },
          { want: "⭐ Legendaria", min: "3 comunes  ·  ó  ·  2 raras  ·  ó  ·  1 legendaria", color: "#fbbf24" },
        ].map((r) => (
          <div key={r.want} style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "9px 12px", borderRadius: "9px", marginBottom: "7px",
            background: "rgba(255,255,255,0.03)",
          }}>
            <span style={{ fontWeight: "bold", color: r.color, fontSize: "0.83rem" }}>{r.want}</span>
            <span style={{ color: "#64748b", fontSize: "0.76rem", textAlign: "right", maxWidth: "55%" }}>{r.min}</span>
          </div>
        ))}

        <div style={{
          background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.25)",
          borderRadius: "10px", padding: "12px", marginTop: "10px",
        }}>
          <p style={{ margin: "0 0 6px", fontWeight: "bold", color: "#a5b4fc", fontSize: "0.85rem" }}>
            ⚡ Cancelación automática
          </p>
          <p style={{ margin: 0, fontSize: "0.78rem", color: "#818cf8", lineHeight: 1.5 }}>
            Si te aceptan una oferta, tus otras ofertas activas se eliminan automáticamente. Si también tenías en venta la carta que acabas de entregar y ya no te queda repetida, esa venta también desaparece.
          </p>
        </div>
      </div>
    ),
  },

  {
    id: "tienda",
    emoji: "🏪",
    titulo: "La Tienda",
    subtitulo: "Monedas e ítems especiales",
    color: "#fbbf24",
    contenido: () => (
      <div>
        <p style={{ color: "#94a3b8", fontSize: "0.85rem", marginBottom: "14px", lineHeight: 1.5 }}>
          Gana <strong style={{ color: "white" }}>monedas</strong> vendiendo cartas repetidas y gástalas en ventajas.
        </p>

        <p style={{ color: "#94a3b8", fontSize: "0.83rem", margin: "0 0 8px", fontWeight: "bold" }}>
          💰 Valor de venta de cartas
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px", marginBottom: "18px" }}>
          {[
            { emoji: "📄", label: "Común",     coins: "1",  color: "#64748b" },
            { emoji: "💎", label: "Rara",       coins: "4",  color: "#3b82f6" },
            { emoji: "⭐", label: "Legendaria", coins: "8",  color: "#fbbf24" },
          ].map((c) => (
            <div key={c.label} style={{
              background: "rgba(255,255,255,0.04)", borderRadius: "10px",
              padding: "12px 8px", textAlign: "center", border: `1px solid ${c.color}33`,
            }}>
              <p style={{ margin: 0, fontSize: "1.4rem" }}>{c.emoji}</p>
              <p style={{ margin: "4px 0 2px", fontWeight: "bold", color: c.color, fontSize: "0.82rem" }}>{c.label}</p>
              <p style={{ margin: 0, color: "#fbbf24", fontSize: "0.9rem", fontWeight: "bold" }}>{c.coins} 💰</p>
            </div>
          ))}
        </div>

        <p style={{ color: "#94a3b8", fontSize: "0.83rem", margin: "0 0 10px", fontWeight: "bold" }}>
          🛒 Ítems disponibles <span style={{ color: "#475569", fontWeight: "normal" }}>(máx. 3 compras/día)</span>
        </p>
        {[
          { emoji: "📦", nombre: "Sobre extra",          precio: 20, desc: "Un sobre adicional para usar cuando quieras.",                                                     color: "#10b981" },
          { emoji: "🛡️", nombre: "Protección de racha",  precio: 15, desc: "Mañana no perderás la racha aunque no abras sobres. También cancela maldiciones.",               color: "#3b82f6" },
          { emoji: "🎯", nombre: "Robo común/rara",      precio: 30, desc: "Ves las cartas comunes y raras de un jugador y robas una.",                                       color: "#f97316" },
          { emoji: "⭐", nombre: "Robo legendaria",      precio: 35, desc: "Igual pero solo con legendarias.",                                                                 color: "#fbbf24" },
          { emoji: "💀", nombre: "Cancelar maldición",   precio: 12, desc: "Elimina la maldición activa sobre ti.",                                                           color: "#8b5cf6" },
          { emoji: "👁️", nombre: "Espiar colección",     precio: 10, desc: "Ves todas las cartas de un jugador, incluyendo repetidas.",                                       color: "#ec4899" },
        ].map((item) => (
          <div key={item.nombre} style={{
            display: "flex", gap: "12px", alignItems: "center",
            padding: "10px 12px", borderRadius: "10px", marginBottom: "7px",
            background: "rgba(255,255,255,0.03)", border: `1px solid ${item.color}33`,
          }}>
            <span style={{ fontSize: "1.4rem", flexShrink: 0 }}>{item.emoji}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontWeight: "bold", color: item.color, fontSize: "0.83rem" }}>{item.nombre}</p>
              <p style={{ margin: "2px 0 0", color: "#64748b", fontSize: "0.75rem", lineHeight: 1.4 }}>{item.desc}</p>
            </div>
            <span style={{
              flexShrink: 0, fontSize: "0.8rem", fontWeight: "bold", color: "#fbbf24",
              background: "rgba(251,191,36,0.12)", padding: "4px 9px", borderRadius: "8px",
            }}>{item.precio} 💰</span>
          </div>
        ))}

        <p style={{ margin: "14px 0 0", fontSize: "0.78rem", color: "#475569", textAlign: "center" }}>
          Los jugadores empiezan con <strong style={{ color: "#fbbf24" }}>50 monedas</strong> al registrarse.
        </p>
      </div>
    ),
  },

  {
    id: "limites",
    emoji: "📋",
    titulo: "Límites diarios",
    subtitulo: "Resumen de lo que puedes hacer cada día",
    color: "#94a3b8",
    contenido: () => (
      <div>
        <p style={{ color: "#64748b", fontSize: "0.82rem", marginBottom: "14px" }}>
          Todos los contadores se reinician a <strong style={{ color: "white" }}>medianoche</strong>.
        </p>
        {[
          { emoji: "📦", accion: "Sobres gratuitos",              limite: "2 / día",    color: "#10b981" },
          { emoji: "😈", accion: "Tortura diaria",                limite: "1 / día",    color: "#ef4444" },
          { emoji: "🎰", accion: "Girar la ruleta",               limite: "1 / día",    color: "#dc2626" },
          { emoji: "🏷️", accion: "Poner carta en venta",          limite: "1 / día",    color: "#f59e0b" },
          { emoji: "💰", accion: "Hacer ofertas",                  limite: "3 / día",    color: "#3b82f6" },
          { emoji: "🤝", accion: "Intercambio como vendedor",      limite: "1 / día",    color: "#f59e0b" },
          { emoji: "🤝", accion: "Intercambio como ofertante",     limite: "1 / día",    color: "#3b82f6" },
          { emoji: "🛒", accion: "Compras en la tienda",           limite: "3 / día",    color: "#fbbf24" },
        ].map((row) => (
          <div key={row.accion} style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "10px 12px", borderRadius: "9px", marginBottom: "6px",
            background: "rgba(255,255,255,0.03)",
          }}>
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <span style={{ fontSize: "1.1rem" }}>{row.emoji}</span>
              <span style={{ fontSize: "0.82rem", color: "#94a3b8" }}>{row.accion}</span>
            </div>
            <span style={{
              fontSize: "0.78rem", fontWeight: "bold", color: row.color,
              background: `${row.color}22`, padding: "3px 10px", borderRadius: "7px",
            }}>{row.limite}</span>
          </div>
        ))}
      </div>
    ),
  },
];

export default function ReglasPage() {
  const router = useRouter();
  const [abierto, setAbierto] = useState(null);

  const toggle = (id) => setAbierto((prev) => (prev === id ? null : id));

  return (
    <div style={{ minHeight: "100vh", background: "#0f172a", color: "white" }}>
      <style>{`
        @keyframes fadeInDown {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes expandSection {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Header */}
      <div style={{
        background: "#1e293b", padding: "14px 16px 12px",
        borderBottom: "1px solid #334155",
        position: "sticky", top: 0, zIndex: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button onClick={() => router.back()} style={{
            padding: "6px 14px", borderRadius: "8px",
            border: "1px solid #475569", background: "transparent",
            color: "#94a3b8", cursor: "pointer", fontSize: "0.85rem",
          }}>← Volver</button>
          <div>
            <h1 style={{ margin: 0, fontSize: "1.1rem", fontWeight: "bold" }}>📘 Reglas del juego</h1>
            <p style={{ margin: 0, fontSize: "0.72rem", color: "#475569" }}>Pulsa cada sección para expandirla</p>
          </div>
        </div>
      </div>

      {/* Secciones */}
      <div style={{ padding: "16px", maxWidth: "500px", margin: "0 auto" }}>
        {SECCIONES.map((sec) => {
          const isOpen = abierto === sec.id;
          return (
            <div key={sec.id} style={{
              borderRadius: "14px", marginBottom: "10px", overflow: "hidden",
              border: isOpen ? `1px solid ${sec.color}55` : "1px solid #1e293b",
              background: isOpen ? "#0f172a" : "#1e293b",
              transition: "border-color 0.2s, background 0.2s",
            }}>
              {/* Cabecera clickable */}
              <button
                onClick={() => toggle(sec.id)}
                style={{
                  width: "100%", padding: "15px 16px",
                  display: "flex", alignItems: "center", gap: "13px",
                  background: "transparent", border: "none",
                  color: "white", cursor: "pointer", textAlign: "left",
                }}
              >
                <div style={{
                  width: "42px", height: "42px", borderRadius: "12px", flexShrink: 0,
                  background: `${sec.color}22`, border: `1px solid ${sec.color}44`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "1.3rem",
                }}>
                  {sec.emoji}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontWeight: "bold", fontSize: "0.95rem", color: isOpen ? sec.color : "white" }}>
                    {sec.titulo}
                  </p>
                  <p style={{ margin: "2px 0 0", fontSize: "0.72rem", color: "#475569", lineHeight: 1.3 }}>
                    {sec.subtitulo}
                  </p>
                </div>
                <span style={{
                  color: isOpen ? sec.color : "#334155",
                  fontSize: "1.1rem", flexShrink: 0, transition: "transform 0.2s",
                  transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                }}>
                  ⌄
                </span>
              </button>

              {/* Contenido expandible */}
              {isOpen && (
                <div style={{
                  padding: "0 16px 16px",
                  animation: "expandSection 0.2s ease-out",
                }}>
                  <div style={{ height: "1px", background: `${sec.color}33`, marginBottom: "14px" }} />
                  {sec.contenido()}
                </div>
              )}
            </div>
          );
        })}

        {/* Footer */}
        <div style={{
          textAlign: "center", padding: "24px 16px 8px",
          color: "#334155", fontSize: "0.75rem",
        }}>
          Album Yeissy · Temporada 2026
        </div>
      </div>
    </div>
  );
}
