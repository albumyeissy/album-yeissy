"use client";
import { useState, useEffect } from "react";
import { auth, db } from "../../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  doc, getDoc, getDocs, collection, runTransaction, setDoc,
} from "firebase/firestore";
import { useRouter } from "next/navigation";
import { CROMOS } from "../../data/cromos";
import { addFeedEvent } from "../../lib/feedHelper";
import { getFeatures, isTiendaAvailable } from "../../lib/featuresHelper";

const TIENDA_RELEASE = new Date("2026-05-28T00:00:00");

// ─── Economía ─────────────────────────────────────────────────────────────────
const PRECIO_VENTA = { legendaria: 8, rara: 4, comun: 1, mitica: 0 };
const MAX_COMPRAS = 3;

const ITEMS = [
  { id: "sobre",            emoji: "📦", nombre: "Sobre extra",           precio: 20, requiereJugador: false, desc: "Consigue un sobre adicional hoy." },
  { id: "proteccion",       emoji: "🛡️", nombre: "Protección de racha",   precio: 15, requiereJugador: false, desc: "Mañana no perderás la racha aunque no abras sobres (también anula maldiciones de racha)." },
  { id: "robo_cr",          emoji: "🎯", nombre: "Robo común/rara",        precio: 30, requiereJugador: true,  desc: "Elige un jugador, ve sus cartas comunes y raras (sin saber si son únicas) y roba una." },
  { id: "robo_leg",         emoji: "⭐", nombre: "Robo legendaria",        precio: 35, requiereJugador: true,  desc: "Elige un jugador, ve sus legendarias (sin saber si son únicas) y roba una." },
  { id: "cancelar_maldicion", emoji: "💀", nombre: "Cancelar maldición",  precio: 12, requiereJugador: false, desc: "Elimina la maldición activa sobre ti." },
  { id: "espiar",           emoji: "👁️", nombre: "Espiar colección",      precio: 10, requiereJugador: true,  desc: "Ve todas las cartas de un jugador, incluidas repetidas. Solo un uso." },
];

const RAREZA_ORDER = { mitica: 3, legendaria: 2, rara: 1, comun: 0 };

export default function TiendaPage() {
  const [user, setUser]           = useState(null);
  const [loading, setLoading]     = useState(true);
  const [bloqueada, setBloqueada] = useState(false);
  const [countdown, setCountdown] = useState("");
  const [misDatos, setMisDatos]   = useState(null);
  const [monedas, setMonedas]     = useState(0);
  const [comprasHoy, setComprasHoy] = useState(0);
  const [tab, setTab]             = useState("tienda"); // "tienda" | "vender"

  // Flujo de compra
  const [fase, setFase]           = useState(null);
  // null | "confirmar" | "jugador" | "carta_robo" | "espiar_resultado" | "ok"
  const [itemActual, setItemActual] = useState(null);
  const [jugadores, setJugadores] = useState([]);
  const [jugadorObj, setJugadorObj] = useState(null);
  const [cartasVictima, setCartasVictima] = useState([]);
  const [cartaRobada, setCartaRobada] = useState(null);
  const [espiarResultado, setEspiarResultado] = useState(null);
  const [okMsg, setOkMsg]         = useState("");
  const [error, setError]         = useState("");
  const [loadingAccion, setLoadingAccion] = useState(false);

  // Vender
  const [cantVenta, setCantVenta] = useState({});

  const router = useRouter();
  const HOY = new Date().toLocaleDateString("en-CA");

  const getManana = () => {
    const d = new Date(); d.setDate(d.getDate() + 1);
    return d.toLocaleDateString("en-CA");
  };

  // ── Countdown (sólo visible cuando bloqueada) ────────────────────────────────
  useEffect(() => {
    const update = () => {
      const diff = TIENDA_RELEASE - new Date();
      if (diff <= 0) { setCountdown("00:00:00"); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setCountdown(
        `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
      );
    };
    update();
    const iv = setInterval(update, 1000);
    return () => clearInterval(iv);
  }, []);

  // ── Carga inicial ────────────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { router.push("/"); return; }
      setUser(u);
      try {
        const [snap, feats] = await Promise.all([
          getDoc(doc(db, "usuarios", u.uid)),
          getFeatures(),
        ]);
        if (!isTiendaAvailable(feats)) {
          setBloqueada(true);
          setLoading(false);
          return;
        }
        if (snap.exists()) {
          const d = snap.data();
          // Monedas: inicializar a 50 si undefined
          let coins = d.monedas;
          if (coins === undefined) {
            coins = 50;
            setDoc(doc(db, "usuarios", u.uid), { monedas: 50 }, { merge: true });
          }
          setMonedas(coins);
          setComprasHoy(d.fechaUltimaCompra === HOY ? (d.comprasHoy || 0) : 0);
          setMisDatos(d);
        }
      } catch (err) { console.error(err); }
      setLoading(false);
    });
    return () => unsub();
  }, [router, HOY]);

  // ── Cargar jugadores (para selección) ───────────────────────────────────────
  const cargarJugadores = async () => {
    if (jugadores.length > 0) return;
    try {
      const snap = await getDocs(collection(db, "usuarios"));
      const lista = [];
      snap.forEach((d) => {
        if (d.id !== user.uid) lista.push({ id: d.id, ...d.data() });
      });
      setJugadores(lista);
    } catch (err) { console.error(err); }
  };

  // ── Iniciar compra ───────────────────────────────────────────────────────────
  const iniciarCompra = (item) => {
    setError("");
    setItemActual(item);
    setFase("confirmar");
  };

  const confirmarCompra = async () => {
    if (!itemActual) return;
    if (itemActual.requiereJugador) {
      await cargarJugadores();
      setFase("jugador");
      return;
    }
    await ejecutarCompra(itemActual, null, null);
  };

  // ── Seleccionar jugador ─────────────────────────────────────────────────────
  const seleccionarJugador = async (jug) => {
    setJugadorObj(jug);
    if (itemActual.id === "espiar") {
      // Mostrar colección directamente tras pagar
      await ejecutarCompra(itemActual, jug, null);
      return;
    }
    // robo_cr / robo_leg: cargar cartas de la víctima
    setLoadingAccion(true);
    try {
      const snap = await getDoc(doc(db, "usuarios", jug.id));
      const datos = snap.exists() ? snap.data() : {};
      const cromos = datos.cromos || [];
      const rarezaFiltro = itemActual.id === "robo_leg"
        ? ["legendaria"]
        : ["comun", "rara"];
      // Solo cartas que tiene (cantidad > 0), sin revelar si son únicas
      const filtradas = cromos
        .filter((c) => c.cantidad > 0 && rarezaFiltro.includes(
          CROMOS.find((x) => x.id === c.cromoId)?.rareza
        ))
        .map((c) => {
          const info = CROMOS.find((x) => x.id === c.cromoId);
          return { cromoId: c.cromoId, nombre: info?.nombre || "?", imagen: info?.imagen, rareza: info?.rareza };
        })
        .sort((a, b) => (RAREZA_ORDER[b.rareza] || 0) - (RAREZA_ORDER[a.rareza] || 0));
      setCartasVictima(filtradas);
      setFase("carta_robo");
    } catch (err) { setError("Error cargando cartas."); }
    setLoadingAccion(false);
  };

  // ── Ejecutar compra atómica ─────────────────────────────────────────────────
  const ejecutarCompra = async (item, jugador, cartaId) => {
    setLoadingAccion(true);
    setError("");
    try {
      await runTransaction(db, async (tx) => {
        const miRef = doc(db, "usuarios", user.uid);
        const miSnap = await tx.get(miRef);
        if (!miSnap.exists()) throw new Error("no-data");
        const d = miSnap.data();

        // Verificar monedas y límite de compras
        const coinsActuales = d.monedas ?? 50;
        const comprasActuales = d.fechaUltimaCompra === HOY ? (d.comprasHoy || 0) : 0;
        if (coinsActuales < item.precio) throw new Error("sin-monedas");
        if (comprasActuales >= MAX_COMPRAS) throw new Error("limite");

        const nuevasMonedas = coinsActuales - item.precio;
        const nuevasCompras = comprasActuales + 1;

        // ── Acciones por item ────────────────────────────────────────────────
        if (item.id === "sobre") {
          tx.set(miRef, {
            monedas: nuevasMonedas,
            sobresBonus: (d.sobresBonus || 0) + 1,
            comprasHoy: nuevasCompras,
            fechaUltimaCompra: HOY,
          }, { merge: true });

        } else if (item.id === "proteccion") {
          tx.set(miRef, {
            monedas: nuevasMonedas,
            rachaProtegidaFecha: getManana(),
            comprasHoy: nuevasCompras,
            fechaUltimaCompra: HOY,
          }, { merge: true });

        } else if (item.id === "cancelar_maldicion") {
          const updates = {
            monedas: nuevasMonedas,
            comprasHoy: nuevasCompras,
            fechaUltimaCompra: HOY,
          };
          if (d.fechaMaldicion) updates.fechaMaldicion = null;
          tx.set(miRef, updates, { merge: true });

        } else if (item.id === "espiar") {
          // Pagar y cargar la colección (lectura ya disponible en jugador.cromos)
          tx.set(miRef, {
            monedas: nuevasMonedas,
            comprasHoy: nuevasCompras,
            fechaUltimaCompra: HOY,
          }, { merge: true });
          // El resultado lo cargamos fuera de la transacción (ya tenemos los datos del jugador)

        } else if (item.id === "robo_cr" || item.id === "robo_leg") {
          if (!jugador || !cartaId) throw new Error("faltan-datos");
          const victimaRef = doc(db, "usuarios", jugador.id);
          const victimaSnap = await tx.get(victimaRef);
          if (!victimaSnap.exists()) throw new Error("victima-no-encontrada");
          const vd = victimaSnap.data();
          const cromosVictima = vd.cromos || [];

          // Verificar que la víctima aún tiene la carta
          const idx = cromosVictima.findIndex((c) => c.cromoId === cartaId);
          if (idx === -1 || cromosVictima[idx].cantidad < 1)
            throw new Error("carta-no-disponible");

          // Quitar de víctima (borrar si cantidad llega a 0)
          const nuevasCromosVictima = cromosVictima
            .map((c) => c.cromoId === cartaId ? { ...c, cantidad: c.cantidad - 1 } : c)
            .filter((c) => c.cantidad > 0);

          // Añadir a comprador
          const misCromos = d.cromos || [];
          const existing = misCromos.find((c) => c.cromoId === cartaId);
          const misCromosActualizados = existing
            ? misCromos.map((c) => c.cromoId === cartaId ? { ...c, cantidad: c.cantidad + 1 } : c)
            : [...misCromos, { cromoId: cartaId, cantidad: 1, fechaObtenido: HOY, pegado: false }];

          tx.set(victimaRef, { cromos: nuevasCromosVictima }, { merge: true });
          tx.set(miRef, {
            monedas: nuevasMonedas,
            cromos: misCromosActualizados,
            comprasHoy: nuevasCompras,
            fechaUltimaCompra: HOY,
          }, { merge: true });
        }
      });

      // ── Post-transacción: actualizar estado local ────────────────────────
      setMonedas((prev) => prev - item.precio);
      setComprasHoy((prev) => prev + 1);
      setMisDatos((prev) => ({ ...prev, monedas: monedas - item.precio }));

      if (item.id === "sobre") {
        setOkMsg("📦 ¡Sobre bonus añadido! Ábrelo en la pantalla de sobres.");
        setFase("ok");
      } else if (item.id === "proteccion") {
        setOkMsg("🛡️ Racha protegida para mañana.");
        setFase("ok");
      } else if (item.id === "cancelar_maldicion") {
        setOkMsg("💀 ¡Maldición cancelada!");
        setFase("ok");
      } else if (item.id === "espiar") {
        // Mostrar colección del jugador
        const cromosJug = jugador.cromos || [];
        const resultado = cromosJug
          .filter((c) => c.cantidad > 0)
          .map((c) => {
            const info = CROMOS.find((x) => x.id === c.cromoId);
            return { ...c, nombre: info?.nombre || "?", imagen: info?.imagen, rareza: info?.rareza || "comun" };
          })
          .sort((a, b) => (RAREZA_ORDER[b.rareza] || 0) - (RAREZA_ORDER[a.rareza] || 0));
        setEspiarResultado(resultado);
        setFase("espiar_resultado");
      } else if (item.id === "robo_cr" || item.id === "robo_leg") {
        const info = CROMOS.find((x) => x.id === cartaId);
        setCartaRobada(info);
        setOkMsg(`🎉 ¡Has robado "${info?.nombre}"!`);
        setFase("ok");
        addFeedEvent({
          type: "robo",
          userName: misDatos?.nombre || user.email,
          details: `Ha robado una carta a ${jugador.nombre || jugador.email}`,
        });
      }
    } catch (err) {
      const msg = {
        "sin-monedas": "No tienes suficientes monedas.",
        "limite": `Límite de ${MAX_COMPRAS} compras diarias alcanzado.`,
        "carta-no-disponible": "Esa carta ya no está disponible.",
        "faltan-datos": "Error interno.",
        "victima-no-encontrada": "El jugador no existe.",
      }[err.message] || "Error al procesar la compra.";
      setError(msg);
      setFase("confirmar");
    }
    setLoadingAccion(false);
  };

  // ── Vender cartas ────────────────────────────────────────────────────────────
  const monedasPorVenta = () => {
    let total = 0;
    Object.entries(cantVenta).forEach(([id, cant]) => {
      const info = CROMOS.find((c) => c.id === parseInt(id));
      total += (PRECIO_VENTA[info?.rareza] || 0) * cant;
    });
    return total;
  };

  const ejecutarVenta = async () => {
    const entradas = Object.entries(cantVenta).filter(([, v]) => v > 0);
    if (entradas.length === 0) return;
    setLoadingAccion(true);
    setError("");
    try {
      await runTransaction(db, async (tx) => {
        const miRef = doc(db, "usuarios", user.uid);
        const miSnap = await tx.get(miRef);
        if (!miSnap.exists()) throw new Error("no-data");
        const d = miSnap.data();
        const cromosActuales = d.cromos || [];
        let ganancias = 0;
        const cromosActualizados = cromosActuales.map((c) => {
          const vender = cantVenta[c.cromoId] || 0;
          if (vender === 0) return c;
          const info = CROMOS.find((x) => x.id === c.cromoId);
          ganancias += (PRECIO_VENTA[info?.rareza] || 0) * vender;
          return { ...c, cantidad: c.cantidad - vender };
        }).filter((c) => c.cantidad > 0);

        tx.set(miRef, {
          cromos: cromosActualizados,
          monedas: (d.monedas ?? 50) + ganancias,
        }, { merge: true });
      });
      const ganadas = monedasPorVenta();
      setMonedas((prev) => prev + ganadas);
      setMisDatos((prev) => {
        const cromosActualizados = (prev.cromos || [])
          .map((c) => ({ ...c, cantidad: c.cantidad - (cantVenta[c.cromoId] || 0) }))
          .filter((c) => c.cantidad > 0);
        return { ...prev, cromos: cromosActualizados };
      });
      setCantVenta({});
      setOkMsg(`💰 ¡Vendido! +${ganadas}🪙`);
      setFase("ok");
      setTab("tienda");
    } catch (err) {
      setError("Error al vender. Inténtalo de nuevo.");
    }
    setLoadingAccion(false);
  };

  // ── Helpers UI ───────────────────────────────────────────────────────────────
  const cerrarFlujo = () => {
    setFase(null);
    setItemActual(null);
    setJugadorObj(null);
    setCartasVictima([]);
    setCartaRobada(null);
    setEspiarResultado(null);
    setOkMsg("");
    setError("");
  };

  const getBorderColor = (r) =>
    r === "legendaria" ? "#fbbf24" : r === "rara" ? "#3b82f6" : r === "mitica" ? "#ef4444" : "#94a3b8";

  // Repetidas vendibles (cantidad > 1, no mitica)
  const repetidas = (misDatos?.cromos || [])
    .filter((c) => {
      const info = CROMOS.find((x) => x.id === c.cromoId);
      return c.cantidad > 1 && info?.rareza !== "mitica";
    })
    .map((c) => {
      const info = CROMOS.find((x) => x.id === c.cromoId);
      return { ...c, nombre: info?.nombre || "?", imagen: info?.imagen, rareza: info?.rareza || "comun" };
    })
    .sort((a, b) => (RAREZA_ORDER[b.rareza] || 0) - (RAREZA_ORDER[a.rareza] || 0));

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", background: "#0f172a" }}>
        <p style={{ fontSize: "1.4rem", color: "white" }}>Cargando tienda...</p>
      </div>
    );
  }

  // ── Pantalla de bloqueada ────────────────────────────────────────────────────
  if (bloqueada) {
    return (
      <div style={{ minHeight: "100vh", background: "#0f172a", color: "white", padding: "20px" }}>
        <style>{`
          @keyframes fadeInUp { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:translateY(0)} }
          @keyframes cdPulse  { 0%,100%{color:#94a3b8} 50%{color:#f59e0b} }
        `}</style>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "28px" }}>
          <button
            onClick={() => router.push("/album")}
            style={{ padding: "8px 16px", borderRadius: "10px", border: "1px solid #475569", background: "transparent", color: "#94a3b8", cursor: "pointer" }}
          >← Álbum</button>
          <h1 style={{ margin: 0, fontSize: "1.4rem" }}>🏪 Tienda</h1>
        </div>
        <div style={{ textAlign: "center", animation: "fadeInUp 0.5s" }}>
          <div style={{ fontSize: "5rem", marginBottom: "16px" }}>🔒</div>
          <h2 style={{ fontSize: "1.5rem", marginBottom: "8px" }}>Próximamente</h2>
          <p style={{ color: "#64748b", marginBottom: "28px", lineHeight: 1.6 }}>
            La tienda abrirá el<br />
            <strong style={{ color: "#94a3b8" }}>jueves 28 de mayo a las 00:00</strong>
          </p>
          <div style={{
            background: "#1e293b", borderRadius: "16px",
            padding: "20px 28px", display: "inline-block",
            border: "1px solid #334155", marginBottom: "36px",
          }}>
            <p style={{ color: "#64748b", fontSize: "0.8rem", marginBottom: "8px" }}>Disponible en:</p>
            <p style={{
              fontSize: "2.6rem", fontWeight: "bold", fontFamily: "monospace",
              margin: 0, letterSpacing: "3px", animation: "cdPulse 2s infinite",
            }}>{countdown}</p>
          </div>
          <p style={{ color: "#475569", fontSize: "0.75rem", marginBottom: "10px", letterSpacing: "1px" }}>QUÉ ENCONTRARÁS</p>
          <div style={{ maxWidth: "290px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "6px" }}>
            {ITEMS.map((it) => (
              <div key={it.id} style={{
                display: "flex", alignItems: "center", gap: "10px",
                padding: "9px 14px", background: "#1e293b",
                borderRadius: "10px", border: "1px solid #334155",
              }}>
                <span style={{ fontSize: "1.3rem" }}>{it.emoji}</span>
                <span style={{ fontSize: "0.85rem", color: "#94a3b8", flex: 1, textAlign: "left" }}>{it.nombre}</span>
                <span style={{ fontSize: "0.75rem", color: "#f59e0b", fontWeight: "bold" }}>{it.precio} 🪙</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0f172a", padding: "0 0 40px" }}>

      {/* HEADER */}
      <div style={{ background: "#1e293b", padding: "14px 16px", borderBottom: "1px solid #334155", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <button onClick={() => router.push("/album")} style={{ padding: "8px 14px", borderRadius: "10px", border: "1px solid #475569", background: "transparent", color: "#94a3b8", cursor: "pointer", fontSize: "0.85rem" }}>← Álbum</button>
          <h1 style={{ margin: 0, fontSize: "1.1rem", fontWeight: "bold" }}>🏪 Tienda</h1>
          <div style={{ background: "#0f172a", borderRadius: "10px", padding: "6px 12px", border: "1px solid #334155" }}>
            <span style={{ color: "#fbbf24", fontWeight: "bold", fontSize: "0.9rem" }}>{monedas}🪙</span>
          </div>
        </div>
        {/* Compras restantes */}
        <div style={{ marginTop: "8px", display: "flex", alignItems: "center", gap: "6px", justifyContent: "center" }}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ width: "28px", height: "6px", borderRadius: "3px", background: i < comprasHoy ? "#334155" : "#10b981", transition: "background 0.3s" }} />
          ))}
          <span style={{ color: "#64748b", fontSize: "0.7rem", marginLeft: "4px" }}>
            {MAX_COMPRAS - comprasHoy} compra{MAX_COMPRAS - comprasHoy !== 1 ? "s" : ""} restante{MAX_COMPRAS - comprasHoy !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* TABS */}
      <div style={{ display: "flex", borderBottom: "1px solid #334155", background: "#1e293b" }}>
        {[{ id: "tienda", label: "🛒 Tienda" }, { id: "vender", label: "💰 Vender" }].map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, padding: "10px", border: "none", cursor: "pointer", fontSize: "0.9rem", fontWeight: tab === t.id ? "bold" : "normal",
            background: tab === t.id ? "#0f172a" : "transparent",
            color: tab === t.id ? "#f59e0b" : "#64748b",
            borderBottom: tab === t.id ? "2px solid #f59e0b" : "2px solid transparent",
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── TAB TIENDA ── */}
      {tab === "tienda" && (
        <div style={{ padding: "16px" }}>
          {comprasHoy >= MAX_COMPRAS && (
            <div style={{ background: "linear-gradient(135deg, #1c1917, #1e293b)", border: "1px solid #78716c", borderRadius: "12px", padding: "10px 14px", marginBottom: "14px", textAlign: "center" }}>
              <p style={{ margin: 0, color: "#a8a29e", fontSize: "0.85rem" }}>Ya hiciste tus 3 compras de hoy. ¡Vuelve mañana!</p>
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {ITEMS.map((item) => (
              <button key={item.id} onClick={() => comprasHoy < MAX_COMPRAS && iniciarCompra(item)} disabled={comprasHoy >= MAX_COMPRAS} style={{
                display: "flex", alignItems: "center", gap: "14px",
                background: "#1e293b", border: "1px solid #334155",
                borderRadius: "14px", padding: "14px", cursor: comprasHoy < MAX_COMPRAS ? "pointer" : "not-allowed",
                opacity: comprasHoy >= MAX_COMPRAS ? 0.5 : 1, textAlign: "left", color: "white",
              }}>
                <span style={{ fontSize: "2rem", flexShrink: 0 }}>{item.emoji}</span>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: "0 0 3px", fontWeight: "bold", fontSize: "0.95rem" }}>{item.nombre}</p>
                  <p style={{ margin: 0, fontSize: "0.75rem", color: "#64748b" }}>{item.desc}</p>
                </div>
                <div style={{ background: "#0f172a", borderRadius: "8px", padding: "6px 10px", flexShrink: 0, border: "1px solid #334155" }}>
                  <span style={{ color: "#fbbf24", fontWeight: "bold", fontSize: "0.85rem" }}>{item.precio}🪙</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB VENDER ── */}
      {tab === "vender" && (
        <div style={{ padding: "16px" }}>
          {repetidas.length === 0 ? (
            <div style={{ textAlign: "center", paddingTop: "40px" }}>
              <p style={{ fontSize: "2rem" }}>😅</p>
              <p style={{ color: "#64748b" }}>No tienes cartas repetidas para vender.</p>
            </div>
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <p style={{ margin: 0, color: "#94a3b8", fontSize: "0.85rem" }}>{repetidas.length} carta{repetidas.length !== 1 ? "s" : ""} repetida{repetidas.length !== 1 ? "s" : ""}</p>
                <div style={{ background: "#0f172a", borderRadius: "8px", padding: "6px 12px", border: "1px solid #334155" }}>
                  <span style={{ color: "#fbbf24", fontWeight: "bold" }}>+{monedasPorVenta()}🪙</span>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "16px" }}>
                {repetidas.map((c) => {
                  const max = c.cantidad - 1; // mínimo 1 se queda
                  const sel = cantVenta[c.cromoId] || 0;
                  return (
                    <div key={c.cromoId} style={{ display: "flex", alignItems: "center", gap: "10px", background: "#1e293b", borderRadius: "12px", padding: "10px 12px", border: `1px solid ${getBorderColor(c.rareza)}30` }}>
                      <img src={c.imagen} alt="" style={{ width: "44px", height: "44px", borderRadius: "8px", objectFit: "cover", border: `1px solid ${getBorderColor(c.rareza)}` }} />
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: "0 0 2px", fontWeight: "bold", fontSize: "0.85rem" }}>{c.nombre}</p>
                        <p style={{ margin: 0, fontSize: "0.72rem", color: "#64748b" }}>
                          {PRECIO_VENTA[c.rareza]}🪙 c/u · tienes ×{c.cantidad}
                        </p>
                      </div>
                      {/* Selector cantidad */}
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <button onClick={() => setCantVenta((p) => ({ ...p, [c.cromoId]: Math.max(0, (p[c.cromoId] || 0) - 1) }))} style={{ width: "28px", height: "28px", borderRadius: "50%", border: "1px solid #475569", background: "#0f172a", color: "white", cursor: "pointer", fontSize: "1rem", display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
                        <span style={{ width: "20px", textAlign: "center", fontWeight: "bold" }}>{sel}</span>
                        <button onClick={() => setCantVenta((p) => ({ ...p, [c.cromoId]: Math.min(max, (p[c.cromoId] || 0) + 1) }))} style={{ width: "28px", height: "28px", borderRadius: "50%", border: "1px solid #475569", background: "#0f172a", color: "white", cursor: "pointer", fontSize: "1rem", display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <button onClick={ejecutarVenta} disabled={monedasPorVenta() === 0 || loadingAccion} style={{
                width: "100%", padding: "14px", borderRadius: "14px", border: "none",
                background: monedasPorVenta() > 0 ? "linear-gradient(135deg, #f59e0b, #d97706)" : "#334155",
                color: monedasPorVenta() > 0 ? "#000" : "#64748b",
                fontWeight: "bold", fontSize: "1rem", cursor: monedasPorVenta() > 0 ? "pointer" : "not-allowed",
              }}>
                {loadingAccion ? "Vendiendo..." : `Vender por ${monedasPorVenta()}🪙`}
              </button>
            </>
          )}
        </div>
      )}

      {/* ── MODALES DE COMPRA ── */}
      {fase && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.8)", zIndex: 200, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={fase === "ok" || fase === "espiar_resultado" ? cerrarFlujo : undefined}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#1e293b", borderRadius: "20px 20px 0 0", padding: "20px 20px 36px", width: "100%", maxWidth: "480px", maxHeight: "85vh", overflowY: "auto", border: "1px solid #334155", borderBottom: "none" }}>

            {/* Confirmar compra */}
            {fase === "confirmar" && itemActual && (
              <>
                <h2 style={{ textAlign: "center", fontSize: "1.1rem", marginBottom: "6px" }}>{itemActual.emoji} {itemActual.nombre}</h2>
                <p style={{ textAlign: "center", color: "#94a3b8", fontSize: "0.85rem", marginBottom: "20px" }}>{itemActual.desc}</p>
                {error && <p style={{ color: "#f87171", textAlign: "center", fontSize: "0.85rem", marginBottom: "12px" }}>{error}</p>}
                <div style={{ background: "#0f172a", borderRadius: "12px", padding: "14px", textAlign: "center", marginBottom: "20px" }}>
                  <p style={{ margin: 0, fontSize: "1.2rem", fontWeight: "bold", color: "#fbbf24" }}>{itemActual.precio}🪙</p>
                  <p style={{ margin: "4px 0 0", fontSize: "0.75rem", color: "#64748b" }}>Tendrás: {monedas - itemActual.precio}🪙</p>
                </div>
                {monedas < itemActual.precio && <p style={{ color: "#f87171", textAlign: "center", fontSize: "0.85rem" }}>No tienes suficientes monedas.</p>}
                <div style={{ display: "flex", gap: "10px" }}>
                  <button onClick={cerrarFlujo} style={{ flex: 1, padding: "12px", borderRadius: "10px", border: "1px solid #334155", background: "transparent", color: "#94a3b8", cursor: "pointer" }}>Cancelar</button>
                  <button onClick={confirmarCompra} disabled={monedas < itemActual.precio || loadingAccion} style={{ flex: 1, padding: "12px", borderRadius: "10px", border: "none", background: monedas >= itemActual.precio ? "linear-gradient(135deg, #f59e0b, #d97706)" : "#334155", color: monedas >= itemActual.precio ? "#000" : "#64748b", fontWeight: "bold", cursor: monedas >= itemActual.precio ? "pointer" : "not-allowed" }}>
                    {loadingAccion ? "..." : "Comprar"}
                  </button>
                </div>
              </>
            )}

            {/* Seleccionar jugador */}
            {fase === "jugador" && (
              <>
                <h2 style={{ textAlign: "center", fontSize: "1rem", marginBottom: "4px" }}>¿A quién?</h2>
                <p style={{ textAlign: "center", color: "#64748b", fontSize: "0.8rem", marginBottom: "16px" }}>{itemActual?.emoji} {itemActual?.nombre}</p>
                {jugadores.length === 0 && <p style={{ textAlign: "center", color: "#64748b" }}>Cargando jugadores...</p>}
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {jugadores.map((j) => (
                    <button key={j.id} onClick={() => seleccionarJugador(j)} disabled={loadingAccion} style={{ display: "flex", alignItems: "center", gap: "12px", background: "#0f172a", border: "1px solid #334155", borderRadius: "12px", padding: "12px", cursor: "pointer", color: "white" }}>
                      <span style={{ fontSize: "1.5rem" }}>👤</span>
                      <span style={{ fontWeight: "bold" }}>{j.nombre || j.email}</span>
                    </button>
                  ))}
                </div>
                <button onClick={cerrarFlujo} style={{ width: "100%", marginTop: "14px", padding: "12px", borderRadius: "10px", border: "1px solid #334155", background: "transparent", color: "#94a3b8", cursor: "pointer" }}>Cancelar</button>
              </>
            )}

            {/* Seleccionar carta a robar */}
            {fase === "carta_robo" && (
              <>
                <h2 style={{ textAlign: "center", fontSize: "1rem", marginBottom: "4px" }}>Elige una carta para robar</h2>
                <p style={{ textAlign: "center", color: "#64748b", fontSize: "0.8rem", marginBottom: "16px" }}>de {jugadorObj?.nombre || jugadorObj?.email}</p>
                {error && <p style={{ color: "#f87171", textAlign: "center", fontSize: "0.85rem" }}>{error}</p>}
                {cartasVictima.length === 0 ? (
                  <p style={{ textAlign: "center", color: "#64748b" }}>Este jugador no tiene cartas de ese tipo.</p>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px", marginBottom: "14px" }}>
                    {cartasVictima.map((c) => (
                      <button key={c.cromoId} onClick={() => ejecutarCompra(itemActual, jugadorObj, c.cromoId)} disabled={loadingAccion} style={{ background: "#0f172a", border: `2px solid ${getBorderColor(c.rareza)}`, borderRadius: "10px", padding: "4px", cursor: "pointer", overflow: "hidden" }}>
                        <img src={c.imagen} alt="" style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: "7px" }} />
                        <p style={{ margin: "4px 0 0", fontSize: "0.6rem", color: "white", textAlign: "center", lineHeight: 1.2 }}>{c.nombre}</p>
                      </button>
                    ))}
                  </div>
                )}
                <button onClick={cerrarFlujo} style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #334155", background: "transparent", color: "#94a3b8", cursor: "pointer" }}>Cancelar</button>
              </>
            )}

            {/* Espiar resultado */}
            {fase === "espiar_resultado" && espiarResultado && (
              <>
                <h2 style={{ textAlign: "center", fontSize: "1rem", marginBottom: "4px" }}>👁️ Colección de {jugadorObj?.nombre || jugadorObj?.email}</h2>
                <p style={{ textAlign: "center", color: "#64748b", fontSize: "0.8rem", marginBottom: "16px" }}>{espiarResultado.length} carta{espiarResultado.length !== 1 ? "s" : ""}</p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px", marginBottom: "16px" }}>
                  {espiarResultado.map((c, i) => (
                    <div key={i} style={{ background: "#0f172a", border: `2px solid ${getBorderColor(c.rareza)}`, borderRadius: "10px", padding: "4px", position: "relative", overflow: "hidden" }}>
                      <img src={c.imagen} alt="" style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: "7px" }} />
                      <p style={{ margin: "3px 0 0", fontSize: "0.58rem", color: "white", textAlign: "center", lineHeight: 1.2 }}>{c.nombre}</p>
                      {c.cantidad > 1 && (
                        <div style={{ position: "absolute", top: "4px", right: "4px", background: "#ef4444", borderRadius: "50%", width: "18px", height: "18px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.55rem", fontWeight: "bold" }}>×{c.cantidad}</div>
                      )}
                    </div>
                  ))}
                </div>
                <button onClick={cerrarFlujo} style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "none", background: "linear-gradient(135deg, #3b82f6, #2563eb)", color: "white", fontWeight: "bold", cursor: "pointer" }}>Cerrar</button>
              </>
            )}

            {/* OK */}
            {fase === "ok" && (
              <div style={{ textAlign: "center", padding: "10px 0" }}>
                {cartaRobada && (
                  <div style={{ marginBottom: "16px" }}>
                    <img src={cartaRobada.imagen} alt="" style={{ width: "120px", height: "120px", objectFit: "cover", borderRadius: "12px", border: `3px solid ${getBorderColor(cartaRobada.rareza)}` }} />
                  </div>
                )}
                <p style={{ fontSize: "1.5rem", marginBottom: "8px" }}>✅</p>
                <p style={{ fontWeight: "bold", fontSize: "1rem", marginBottom: "20px" }}>{okMsg}</p>
                <button onClick={cerrarFlujo} style={{ padding: "12px 32px", borderRadius: "10px", border: "none", background: "linear-gradient(135deg, #10b981, #059669)", color: "white", fontWeight: "bold", cursor: "pointer", fontSize: "1rem" }}>¡Perfecto!</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
