"use client";
import { useState, useEffect } from "react";
import { auth, db } from "../../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  doc, getDoc, collection, getDocs,
  runTransaction, deleteDoc,
} from "firebase/firestore";
import { useRouter } from "next/navigation";
import { CROMOS } from "../../data/cromos";
import { addFeedEvent } from "../../lib/feedHelper";

// ── Mínimos de oferta por rareza de la carta deseada ──────────────────────────
const MINIMOS = {
  legendaria: [
    { rarezas: { comun: 3 },      label: "3 Comunes 📄" },
    { rarezas: { rara: 2 },       label: "2 Raras 💎" },
    { rarezas: { legendaria: 1 }, label: "1 Legendaria ⭐" },
  ],
  rara: [
    { rarezas: { comun: 2 }, label: "2 Comunes 📄" },
    { rarezas: { rara: 1 },  label: "1 Rara 💎" },
  ],
  comun: [
    { rarezas: { comun: 1 }, label: "1 Común 📄" },
  ],
};

export default function MercadoPage() {
  const [user,          setUser]          = useState(null);
  const [dataLoaded,    setDataLoaded]    = useState(false);
  const [tab,           setTab]           = useState("mercado");
  const [misDatos,      setMisDatos]      = useState(null);
  const [ventas,        setVentas]        = useState([]);
  const [mensaje,       setMensaje]       = useState("");
  const [mensajeTipo,   setMensajeTipo]   = useState("");

  // Vender tab
  const [cromoAVender, setCromoAVender] = useState(null);

  // Hacer oferta / editar oferta (overlay dentro de la tab Mercado)
  const [ventaSeleccionada,  setVentaSeleccionada]  = useState(null);
  const [cromosOferta,       setCromosOferta]       = useState([]);
  const [vendedorCromos,     setVendedorCromos]     = useState(null); // inventario del vendedor
  const [vendedorCargando,   setVendedorCargando]   = useState(false);
  const [estaEditando,       setEstaEditando]       = useState(false); // true = editar oferta existente

  // Modal "Ver y aceptar ofertas" (solo para el vendedor)
  const [ventaVerOfertas, setVentaVerOfertas] = useState(null);

  // Historial
  const [historial,       setHistorial]       = useState([]);
  const [historialLoaded, setHistorialLoaded] = useState(false);

  const router = useRouter();
  const HOY = new Date().toLocaleDateString("en-CA");

  // ── Auth + carga inicial ────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) { setUser(u); await loadData(u.uid); }
      else    { router.push("/"); }
    });
    return () => unsub();
  }, [router]);

  const loadData = async (uid) => {
    try {
      const [userSnap, ventasSnap] = await Promise.all([
        getDoc(doc(db, "usuarios", uid)),
        getDocs(collection(db, "ventas")),
      ]);

      setMisDatos(userSnap.exists()
        ? { uid, ...userSnap.data() }
        : { uid, cromos: [] }
      );

      const ahora = new Date();
      const activas = [];
      ventasSnap.forEach((d) => {
        const data = { id: d.id, ...d.data() };
        if (new Date(data.fechaExpiracion) > ahora) activas.push(data);
      });
      setVentas(activas);
    } catch (err) {
      console.error("[Mercado] loadData:", err);
    }
    setDataLoaded(true);
  };

  const loadHistorial = async () => {
    if (historialLoaded) return;
    try {
      const snap = await getDocs(collection(db, "feed"));
      const trades = [];
      snap.forEach((d) => {
        const data = { id: d.id, ...d.data() };
        if (data.type === "intercambio") trades.push(data);
      });
      trades.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      setHistorial(trades);
      setHistorialLoaded(true);
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    if (tab === "historial" && user) loadHistorial();
  }, [tab, user]);

  // Cargar inventario del vendedor cuando se abre el panel de oferta
  useEffect(() => {
    if (!ventaSeleccionada) { setVendedorCromos(null); return; }
    setVendedorCargando(true);
    getDoc(doc(db, "usuarios", ventaSeleccionada.vendedorId))
      .then((snap) => setVendedorCromos(snap.exists() ? snap.data().cromos || [] : []))
      .catch(() => setVendedorCromos([]))
      .finally(() => setVendedorCargando(false));
  }, [ventaSeleccionada]);

  // ── Helpers de UI ───────────────────────────────────────────────────────────
  const showMsg = (text, tipo = "") => {
    setMensaje(text); setMensajeTipo(tipo);
    setTimeout(() => setMensaje(""), 4000);
  };

  const getCromoInfo  = (id) => CROMOS.find((c) => c.id === id);
  const getBorder     = (r)  => r === "legendaria" ? "#fbbf24" : r === "rara" ? "#3b82f6" : "#64748b";
  const getRarezaEmoji = (r) => r === "legendaria" ? "⭐" : r === "rara" ? "💎" : "📄";

  const timeAgo = (ts) => {
    const diff = Date.now() - new Date(ts).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1)  return "ahora mismo";
    if (m < 60) return `hace ${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `hace ${h}h`;
    return `hace ${Math.floor(h / 24)}d`;
  };

  const horasRestantes = (fechaExpiracion) =>
    Math.max(0, Math.round((new Date(fechaExpiracion) - Date.now()) / 3600000));

  // ── Estado derivado ─────────────────────────────────────────────────────────
  // Slots diarios — se marcan en el doc del usuario con fechaUltimaVenta / fechaUltimaOferta
  const yaVendiHoy  = misDatos?.fechaUltimaVenta  === HOY;
  const yaOfertHoy  = misDatos?.fechaUltimaOferta === HOY;

  const misVentas   = ventas.filter((v) => v.vendedorId === user?.uid);

  // Repetidos disponibles: cantidad > 1 y no comprometidos en mis ventas activas
  const getMisRepetidos = () => {
    if (!misDatos?.cromos) return [];
    const enVenta = new Set(misVentas.map((v) => v.cromoId));
    return misDatos.cromos
      .filter((c) => c.cantidad > 1 && !enVenta.has(c.cromoId))
      .map((c) => ({ ...c, info: getCromoInfo(c.cromoId), sobrantes: c.cantidad - 1 }))
      .filter((c) => c.info);
  };

  const tieneCromo = (cromoId) =>
    misDatos?.cromos?.some((c) => c.cromoId === cromoId && c.cantidad > 0) ?? false;

  const cumpleMinimo = (rareza, ids) => {
    if (!ids.length) return false;
    const conteo = {};
    ids.forEach((id) => {
      const info = getCromoInfo(id);
      if (info) conteo[info.rareza] = (conteo[info.rareza] || 0) + 1;
    });
    return MINIMOS[rareza].some((min) =>
      Object.entries(min.rarezas).every(([r, n]) => (conteo[r] || 0) >= n)
    );
  };

  const toggleOferta = (id) =>
    setCromosOferta((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  // ── Acción: Poner en venta ──────────────────────────────────────────────────
  // Usa runTransaction para marcar el slot atómicamente al crear la venta.
  const ponerEnVenta = async () => {
    if (!cromoAVender) return;
    const info = getCromoInfo(cromoAVender);
    if (!info) return;

    try {
      await runTransaction(db, async (tx) => {
        const userRef  = doc(db, "usuarios", user.uid);
        const userSnap = await tx.get(userRef);
        const datos    = userSnap.data() || {};

        if (datos.fechaUltimaVenta === HOY) throw new Error("ya-vendiste-hoy");

        const ventaRef = doc(collection(db, "ventas"));
        const ahora    = new Date();
        const exp      = new Date(ahora.getTime() + 24 * 60 * 60 * 1000);

        tx.set(ventaRef, {
          vendedorId:     user.uid,
          vendedorNombre: misDatos.nombre || misDatos.email || "Jugador",
          cromoId:        cromoAVender,
          cromoNombre:    info.nombre,
          cromoRareza:    info.rareza,
          cromoImagen:    info.imagen,
          ofertas:        [],
          fechaCreacion:  ahora.toISOString(),
          fechaExpiracion: exp.toISOString(),
        });
        tx.set(userRef, { fechaUltimaVenta: HOY }, { merge: true });
      });

      setCromoAVender(null);
      setTab("mercado");
      showMsg("✅ Carta puesta en el mercado (24h)", "success");
      await loadData(user.uid);
    } catch (err) {
      if (err.message === "ya-vendiste-hoy")
        showMsg("❌ Ya has puesto una carta a la venta hoy", "error");
      else { showMsg("❌ Error al poner en venta", "error"); console.error(err); }
    }
  };

  // ── Acción: Hacer oferta ────────────────────────────────────────────────────
  // Verifica slot diario + unicidad de oferta por usuario de forma atómica.
  const hacerOferta = async () => {
    if (!ventaSeleccionada || !cromosOferta.length) return;
    if (!cumpleMinimo(ventaSeleccionada.cromoRareza, cromosOferta)) return;

    try {
      await runTransaction(db, async (tx) => {
        const userRef   = doc(db, "usuarios", user.uid);
        const ventaRef  = doc(db, "ventas", ventaSeleccionada.id);

        // Reads (deben ir antes de cualquier write en una transacción)
        const userSnap  = await tx.get(userRef);
        const ventaSnap = await tx.get(ventaRef);

        const datos = userSnap.data() || {};
        if (datos.fechaUltimaOferta === HOY) throw new Error("ya-ofert-hoy");

        if (!ventaSnap.exists())                           throw new Error("venta-no-existe");
        const ventaData = ventaSnap.data();
        if (new Date() > new Date(ventaData.fechaExpiracion)) throw new Error("venta-expirada");

        const yaOferto = (ventaData.ofertas || []).some((o) => o.ofertanteId === user.uid);
        if (yaOferto) throw new Error("ya-ofert-aqui");

        const nuevaOferta = {
          ofertanteId:     user.uid,
          ofertanteNombre: misDatos.nombre || misDatos.email || "Jugador",
          cromos: cromosOferta.map((id) => {
            const inf = getCromoInfo(id);
            return { cromoId: id, nombre: inf.nombre, rareza: inf.rareza, imagen: inf.imagen };
          }),
          fecha: new Date().toISOString(),
        };

        tx.set(userRef, { fechaUltimaOferta: HOY }, { merge: true });
        tx.update(ventaRef, { ofertas: [...(ventaData.ofertas || []), nuevaOferta] });
      });

      setVentaSeleccionada(null);
      setCromosOferta([]);
      setTab("mercado");
      showMsg("✅ Oferta enviada", "success");
      await loadData(user.uid);
    } catch (err) {
      const msgs = {
        "ya-ofert-hoy":    "❌ Ya has hecho una oferta hoy",
        "venta-no-existe": "❌ Esta venta ya no existe",
        "venta-expirada":  "❌ Esta venta ha caducado",
        "ya-ofert-aqui":   "❌ Ya tienes una oferta en esta venta",
      };
      showMsg(msgs[err.message] || "❌ Error al enviar la oferta", "error");
      if (!msgs[err.message]) console.error(err);
    }
  };

  // ── Acción: Guardar edición de oferta existente ────────────────────────────
  // No consume slot (ya está usado). Solo reemplaza los cromos de la oferta.
  const guardarEdicionOferta = async () => {
    if (!ventaSeleccionada || !cromosOferta.length) return;
    if (!cumpleMinimo(ventaSeleccionada.cromoRareza, cromosOferta)) return;

    try {
      await runTransaction(db, async (tx) => {
        const ventaRef  = doc(db, "ventas", ventaSeleccionada.id);
        const ventaSnap = await tx.get(ventaRef);

        if (!ventaSnap.exists()) throw new Error("venta-no-existe");
        const ventaData = ventaSnap.data();
        if (new Date() > new Date(ventaData.fechaExpiracion)) throw new Error("venta-expirada");

        // Reemplazar los cromos de la oferta del usuario (identificada por ofertanteId)
        const ofertasActualizadas = (ventaData.ofertas || []).map((o) => {
          if (o.ofertanteId !== user.uid) return o;
          return {
            ...o,
            cromos: cromosOferta.map((id) => {
              const inf = getCromoInfo(id);
              return { cromoId: id, nombre: inf.nombre, rareza: inf.rareza, imagen: inf.imagen };
            }),
            fechaEdicion: new Date().toISOString(),
          };
        });

        tx.update(ventaRef, { ofertas: ofertasActualizadas });
      });

      setVentaSeleccionada(null);
      setCromosOferta([]);
      setEstaEditando(false);
      setTab("mis-ofertas");
      showMsg("✅ Oferta actualizada", "success");
      await loadData(user.uid);
    } catch (err) {
      const msgs = {
        "venta-no-existe": "❌ Esta venta ya no existe",
        "venta-expirada":  "❌ Esta venta ha caducado",
      };
      showMsg(msgs[err.message] || "❌ Error al actualizar la oferta", "error");
      if (!msgs[err.message]) console.error(err);
    }
  };

  // ── Acción: Aceptar oferta ──────────────────────────────────────────────────
  // Intercambio atómico: verifica stock de ambas partes, ejecuta y borra la venta.
  const aceptarOferta = async (oferta) => {
    try {
      await runTransaction(db, async (tx) => {
        const ventaRef    = doc(db, "ventas", ventaVerOfertas.id);
        const vendedorRef = doc(db, "usuarios", user.uid);
        const compradorRef = doc(db, "usuarios", oferta.ofertanteId);

        // Reads
        const ventaSnap     = await tx.get(ventaRef);
        const vendedorSnap  = await tx.get(vendedorRef);
        const compradorSnap = await tx.get(compradorRef);

        if (!ventaSnap.exists()) throw new Error("venta-no-existe");
        if (!vendedorSnap.exists() || !compradorSnap.exists()) throw new Error("usuario-no-existe");

        const ventaData    = ventaSnap.data();
        const vendCromos   = vendedorSnap.data().cromos.map((c) => ({ ...c }));
        const comprCromos  = compradorSnap.data().cromos.map((c) => ({ ...c }));

        // Verificar que el vendedor aún tiene la carta (necesita ≥2: 1 que se queda + 1 que da)
        const vendTiene = vendCromos.find((c) => c.cromoId === ventaData.cromoId);
        if (!vendTiene || vendTiene.cantidad < 2) throw new Error("vendedor-sin-carta");

        // Verificar que el comprador aún tiene las cartas ofertadas (≥2 de cada una)
        for (const c of oferta.cromos) {
          const comprTiene = comprCromos.find((x) => x.cromoId === c.cromoId);
          if (!comprTiene || comprTiene.cantidad < 2)
            throw new Error(`comprador-sin:${c.nombre}`);
        }

        // ── Ejecutar el intercambio ──────────────────────────────────────────
        // Vendedor: entrega su carta, recibe las ofertadas
        vendTiene.cantidad -= 1;
        oferta.cromos.forEach((c) => {
          const ex = vendCromos.find((x) => x.cromoId === c.cromoId);
          if (ex) ex.cantidad += 1;
          else vendCromos.push({ cromoId: c.cromoId, cantidad: 1, fechaObtenido: HOY, pegado: false });
        });

        // Comprador: entrega las ofertadas, recibe la del vendedor
        oferta.cromos.forEach((c) => {
          comprCromos.find((x) => x.cromoId === c.cromoId).cantidad -= 1;
        });
        const comprGana = comprCromos.find((x) => x.cromoId === ventaData.cromoId);
        if (comprGana) comprGana.cantidad += 1;
        else comprCromos.push({ cromoId: ventaData.cromoId, cantidad: 1, fechaObtenido: HOY, pegado: false });

        // Writes
        tx.update(vendedorRef,  { cromos: vendCromos });
        tx.update(compradorRef, { cromos: comprCromos });
        tx.delete(ventaRef);
      });

      addFeedEvent({
        type:     "intercambio",
        userName: misDatos.nombre || misDatos.email,
        details:  `🤝 Intercambió ${ventaVerOfertas.cromoNombre} con ${oferta.ofertanteNombre} a cambio de ${oferta.cromos.map((c) => c.nombre).join(", ")}`,
      });

      setVentaVerOfertas(null);
      showMsg("🎉 ¡Intercambio completado!", "success");
      await loadData(user.uid);
    } catch (err) {
      if (err.message.startsWith("comprador-sin:")) {
        const nombre = err.message.split(":")[1];
        showMsg(`❌ ${oferta.ofertanteNombre} ya no tiene "${nombre}" de sobra`, "error");
      } else {
        const msgs = {
          "venta-no-existe":    "❌ Esta venta ya no existe",
          "usuario-no-existe":  "❌ Usuario no encontrado",
          "vendedor-sin-carta": "❌ Ya no tienes esa carta de sobra",
        };
        showMsg(msgs[err.message] || "❌ Error al aceptar la oferta", "error");
        if (!msgs[err.message]) console.error(err);
      }
    }
  };

  // ── Acción: Retirar venta propia ────────────────────────────────────────────
  // El slot del día queda consumido igualmente.
  const retirarVenta = async (ventaId) => {
    try {
      await deleteDoc(doc(db, "ventas", ventaId));
      showMsg("Carta retirada del mercado");
      await loadData(user.uid);
    } catch (err) { showMsg("❌ Error al retirar", "error"); }
  };

  // ── Acción: Cancelar mi oferta ──────────────────────────────────────────────
  // El slot del día queda consumido igualmente.
  const cancelarMiOferta = async (venta) => {
    try {
      await runTransaction(db, async (tx) => {
        const ventaRef  = doc(db, "ventas", venta.id);
        const ventaSnap = await tx.get(ventaRef);
        if (!ventaSnap.exists()) return; // ya no existe, está bien
        const ofertasFiltradas = (ventaSnap.data().ofertas || []).filter(
          (o) => o.ofertanteId !== user.uid
        );
        tx.update(ventaRef, { ofertas: ofertasFiltradas });
      });
      showMsg("Oferta cancelada");
      await loadData(user.uid);
    } catch (err) { showMsg("❌ Error al cancelar", "error"); }
  };

  // ── Acción: Ver ofertas recibidas (refresca desde Firestore) ────────────────
  const verOfertas = async (venta) => {
    try {
      const snap = await getDoc(doc(db, "ventas", venta.id));
      if (snap.exists()) setVentaVerOfertas({ id: snap.id, ...snap.data() });
      else { showMsg("Esta venta ya no existe"); await loadData(user.uid); }
    } catch (err) {
      setVentaVerOfertas(venta); // fallback a datos cacheados
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: "#0f172a" }}>
      <style>{`
        @keyframes shimmer   { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        @keyframes fadeInUp  { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `}</style>

      {/* ── HEADER ── */}
      <div style={{ background: "#1e293b", padding: "12px 15px", borderBottom: "1px solid #334155" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
          <button onClick={() => router.push("/album")} style={{
            padding: "6px 14px", borderRadius: "8px", border: "1px solid #475569",
            background: "transparent", color: "#94a3b8", cursor: "pointer", fontSize: "0.85rem",
          }}>← Álbum</button>

          {/* Pills de estado de los dos slots */}
          <div style={{ display: "flex", gap: "6px" }}>
            <span style={{
              fontSize: "0.68rem", fontWeight: "bold", padding: "3px 9px", borderRadius: "6px",
              background: yaVendiHoy ? "rgba(239,68,68,0.15)" : "rgba(16,185,129,0.15)",
              color:      yaVendiHoy ? "#ef4444"              : "#10b981",
            }}>
              🏷️ {yaVendiHoy ? "Venta usada" : "1 venta libre"}
            </span>
            <span style={{
              fontSize: "0.68rem", fontWeight: "bold", padding: "3px 9px", borderRadius: "6px",
              background: yaOfertHoy ? "rgba(239,68,68,0.15)" : "rgba(245,158,11,0.15)",
              color:      yaOfertHoy ? "#ef4444"              : "#f59e0b",
            }}>
              💰 {yaOfertHoy ? "Oferta usada" : "1 oferta libre"}
            </span>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: "4px" }}>
          {[
            { id: "mercado",    label: "🏷️ Mercado" },
            { id: "vender",     label: "📦 Vender" },
            { id: "mis-ofertas", label: "📤 Mis ofertas" },
            { id: "historial",  label: "📜" },
          ].map((t) => (
            <button key={t.id} onClick={() => {
              setTab(t.id);
              setVentaSeleccionada(null); setCromosOferta([]); setVentaVerOfertas(null);
            }} style={{
              flex:       t.id === "historial" ? "none" : 1,
              padding:    "8px 10px", borderRadius: "10px", border: "none",
              background: tab === t.id ? "#3b82f6" : "transparent",
              color:      tab === t.id ? "white"   : "#94a3b8",
              cursor:     "pointer", fontSize: "0.8rem",
              fontWeight: tab === t.id ? "bold"    : "normal",
            }}>{t.label}</button>
          ))}
        </div>
      </div>

      {/* Toast */}
      {mensaje && (
        <div style={{
          margin: "10px 15px 0", padding: "10px 15px", borderRadius: "10px",
          background: mensajeTipo === "success" ? "#064e3b" : mensajeTipo === "error" ? "#7f1d1d" : "#334155",
          fontSize: "0.85rem", textAlign: "center", animation: "fadeInUp 0.3s",
        }}>{mensaje}</div>
      )}

      <div style={{ padding: "15px" }}>

        {/* Skeleton de carga */}
        {!dataLoaded && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {[1, 2, 3].map((i) => (
              <div key={i} style={{
                height: "80px", borderRadius: "16px",
                background: "linear-gradient(90deg, #1e293b 25%, #334155 50%, #1e293b 75%)",
                backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite",
              }} />
            ))}
          </div>
        )}

        {/* ════════════════════════════════════════
            TAB: MERCADO
        ════════════════════════════════════════ */}
        {dataLoaded && tab === "mercado" && !ventaSeleccionada && (
          <div>
            {ventas.length === 0 ? (
              <div style={{ textAlign: "center", padding: "50px 20px", color: "#64748b" }}>
                <p style={{ fontSize: "3rem", marginBottom: "12px" }}>🏷️</p>
                <p style={{ marginBottom: "6px" }}>No hay cartas en el mercado</p>
                <p style={{ fontSize: "0.85rem" }}>¡Sé el primero en poner una!</p>
              </div>
            ) : (
              ventas.map((venta) => {
                const esMia      = venta.vendedorId === user?.uid;
                const numOfertas = (venta.ofertas || []).length;
                const tengoOfer  = (venta.ofertas || []).some((o) => o.ofertanteId === user?.uid);
                const miCantidad = !esMia
                  ? (misDatos?.cromos?.find((c) => c.cromoId === venta.cromoId)?.cantidad || 0)
                  : null;

                return (
                  <div key={venta.id} style={{
                    background:    esMia ? "#1e3a5f" : "#1e293b",
                    borderRadius:  "16px", padding: "15px", marginBottom: "10px",
                    border: esMia ? "1px solid #3b82f6" : "1px solid #334155",
                  }}>
                    {/* Cabecera de la carta */}
                    <div style={{ display: "flex", gap: "12px", alignItems: "center", marginBottom: "10px" }}>
                      <img src={venta.cromoImagen} alt="" style={{
                        width: "60px", height: "60px", borderRadius: "10px",
                        objectFit: "cover", border: `2px solid ${getBorder(venta.cromoRareza)}`,
                        flexShrink: 0,
                      }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontWeight: "bold", fontSize: "0.9rem" }}>
                          {venta.cromoNombre}
                        </p>
                        <p style={{ margin: "2px 0 0", fontSize: "0.75rem", color: "#94a3b8" }}>
                          {getRarezaEmoji(venta.cromoRareza)} de {venta.vendedorNombre}
                        </p>
                        {miCantidad !== null && (
                          <span style={{
                            display: "inline-block", fontSize: "0.65rem", marginTop: "4px",
                            padding: "1px 7px", borderRadius: "5px",
                            background: miCantidad === 0 ? "rgba(16,185,129,0.12)" : "rgba(100,116,139,0.1)",
                            color:      miCantidad === 0 ? "#10b981"               : "#64748b",
                          }}>
                            {miCantidad === 0 ? "✨ Nueva para ti" : `Ya tienes ${miCantidad}`}
                          </span>
                        )}
                        <div style={{ display: "flex", gap: "10px", marginTop: "4px" }}>
                          <span style={{ fontSize: "0.7rem", color: numOfertas > 0 ? "#f59e0b" : "#64748b" }}>
                            🔥 {numOfertas} oferta{numOfertas !== 1 ? "s" : ""}
                          </span>
                          <span style={{ fontSize: "0.7rem", color: "#64748b" }}>
                            ⏰ {horasRestantes(venta.fechaExpiracion)}h
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Botones según rol */}
                    {esMia ? (
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button onClick={() => verOfertas(venta)} style={{
                          flex: 1, padding: "10px", borderRadius: "10px", border: "none",
                          background: numOfertas > 0 ? "#10b981" : "#334155",
                          color: "white", fontWeight: "bold", cursor: "pointer", fontSize: "0.8rem",
                        }}>
                          {numOfertas > 0
                            ? `📥 Ver ${numOfertas} oferta${numOfertas !== 1 ? "s" : ""}`
                            : "📥 Sin ofertas aún"}
                        </button>
                        <button onClick={() => retirarVenta(venta.id)} style={{
                          padding: "10px 14px", borderRadius: "10px",
                          border: "1px solid #334155", background: "transparent",
                          color: "#64748b", cursor: "pointer", fontSize: "0.8rem",
                        }}>🗑️</button>
                      </div>
                    ) : tengoOfer ? (
                      <div style={{
                        padding: "10px", borderRadius: "10px", textAlign: "center",
                        background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)",
                        fontSize: "0.8rem", color: "#f59e0b",
                      }}>⏳ Tu oferta está pendiente</div>
                    ) : (
                      <button
                        onClick={() => {
                          if (yaOfertHoy) { showMsg("❌ Ya has hecho una oferta hoy", "error"); return; }
                          setVentaSeleccionada(venta); setCromosOferta([]);
                        }}
                        style={{
                          width: "100%", padding: "10px", borderRadius: "10px", border: "none",
                          background: yaOfertHoy
                            ? "#334155"
                            : "linear-gradient(135deg, #f59e0b, #d97706)",
                          color:  yaOfertHoy ? "#64748b" : "#000",
                          fontWeight: "bold",
                          cursor: yaOfertHoy ? "not-allowed" : "pointer",
                          fontSize: "0.85rem",
                        }}
                      >
                        {yaOfertHoy ? "🔒 Oferta usada hoy" : "💰 Hacer oferta"}
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ════════════════════════════════════════
            OVERLAY: HACER OFERTA
        ════════════════════════════════════════ */}
        {dataLoaded && tab === "mercado" && ventaSeleccionada && (
          <div>
            <button onClick={() => {
              setVentaSeleccionada(null); setCromosOferta([]); setEstaEditando(false);
              if (estaEditando) setTab("mis-ofertas");
            }} style={{
              padding: "6px 14px", borderRadius: "8px", border: "1px solid #475569",
              background: "transparent", color: "#94a3b8", cursor: "pointer",
              marginBottom: "15px", fontSize: "0.85rem",
            }}>← {estaEditando ? "Cancelar edición" : "Volver"}</button>

            {/* Carta objetivo */}
            <div style={{
              background: "#1e293b", borderRadius: "16px", padding: "20px",
              textAlign: "center", marginBottom: "15px",
              border: `2px solid ${getBorder(ventaSeleccionada.cromoRareza)}`,
            }}>
              <p style={{ fontSize: "0.8rem", color: "#94a3b8", marginBottom: "10px" }}>
                {estaEditando ? "Editando tu oferta a" : "Quieres conseguir de"} {ventaSeleccionada.vendedorNombre}:
              </p>
              <img src={ventaSeleccionada.cromoImagen} alt="" style={{
                width: "80px", height: "80px", borderRadius: "12px", objectFit: "cover",
                border: `3px solid ${getBorder(ventaSeleccionada.cromoRareza)}`,
              }} />
              <p style={{ fontWeight: "bold", marginTop: "8px", fontSize: "0.95rem" }}>
                {ventaSeleccionada.cromoNombre}
              </p>
              <p style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "4px" }}>
                Mínimo: {MINIMOS[ventaSeleccionada.cromoRareza].map((m) => m.label).join(" · ")}
              </p>
            </div>

            {/* Grid de repetidos disponibles */}
            <p style={{ fontSize: "0.9rem", fontWeight: "bold", marginBottom: "4px" }}>
              Elige cartas para ofrecer:
            </p>
            <p style={{ fontSize: "0.75rem", color: "#64748b", marginBottom: "12px" }}>
              Solo tus cartas repetidas · puedes superar el mínimo
            </p>

            {getMisRepetidos().length === 0 ? (
              <p style={{ color: "#64748b", textAlign: "center", padding: "20px" }}>
                No tienes cartas repetidas disponibles
              </p>
            ) : vendedorCargando ? (
              <div style={{ textAlign: "center", padding: "20px", color: "#64748b", fontSize: "0.85rem" }}>
                Cargando inventario del vendedor…
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px", marginBottom: "20px" }}>
                {getMisRepetidos().map((cromo) => {
                  const sel = cromosOferta.includes(cromo.cromoId);

                  // ¿Qué cantidad tiene el vendedor de esta carta?
                  const vendCantidad = vendedorCromos
                    ? (vendedorCromos.find((c) => c.cromoId === cromo.cromoId)?.cantidad || 0)
                    : null;

                  // Badge: solo visible si tenemos los datos del vendedor
                  const badge = vendedorCromos === null ? null
                    : vendCantidad === 0
                      ? { label: "✨ Le interesa", bg: "#065f46", color: "#6ee7b7" }
                      : vendCantidad === 1
                        ? { label: "Ya la tiene",  bg: "#1e293b", color: "#64748b" }
                        : { label: "Le sobra",      bg: "#451a03", color: "#fcd34d" };

                  return (
                    <div key={cromo.cromoId} onClick={() => toggleOferta(cromo.cromoId)} style={{
                      borderRadius: "12px", overflow: "hidden", cursor: "pointer",
                      position: "relative",
                      border:     sel ? "3px solid #10b981" : `2px solid ${getBorder(cromo.info.rareza)}`,
                      opacity:    sel ? 1 : (vendCantidad > 0 ? 0.55 : 0.85),
                      transform:  sel ? "scale(1.05)" : "scale(1)",
                      transition: "all 0.2s",
                    }}>
                      <img src={cromo.info.imagen} alt="" style={{ width: "100%", aspectRatio: "1", objectFit: "cover" }} />

                      {/* Badge "Le interesa / Ya la tiene / Le sobra" */}
                      {badge && !sel && (
                        <div style={{
                          position: "absolute", top: "4px", left: "4px", right: "4px",
                          background: badge.bg, color: badge.color,
                          fontSize: "0.48rem", fontWeight: "bold",
                          padding: "2px 4px", borderRadius: "4px",
                          textAlign: "center", letterSpacing: "0.3px",
                        }}>
                          {badge.label}
                        </div>
                      )}

                      {sel && (
                        <div style={{
                          position: "absolute", inset: 0,
                          background: "rgba(16,185,129,0.2)",
                          display: "flex", justifyContent: "center", alignItems: "center",
                          fontSize: "1.5rem",
                        }}>✅</div>
                      )}
                      <div style={{ padding: "3px", textAlign: "center", background: "rgba(0,0,0,0.65)", fontSize: "0.5rem" }}>
                        {cromo.info.nombre} <span style={{ color: "#94a3b8" }}>x{cromo.sobrantes}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Resumen */}
            {cromosOferta.length > 0 && (
              <div style={{
                background: "#1e293b", borderRadius: "12px", padding: "12px",
                marginBottom: "15px", textAlign: "center",
              }}>
                <p style={{ fontSize: "0.8rem", color: "#94a3b8", marginBottom: "4px" }}>
                  Tu oferta: {cromosOferta.length} carta{cromosOferta.length !== 1 ? "s" : ""}
                </p>
                <p style={{
                  fontSize: "0.78rem",
                  color: cumpleMinimo(ventaSeleccionada.cromoRareza, cromosOferta) ? "#10b981" : "#ef4444",
                }}>
                  {cumpleMinimo(ventaSeleccionada.cromoRareza, cromosOferta)
                    ? "✅ Cumple el mínimo"
                    : "❌ No cumple el mínimo aún"}
                </p>
              </div>
            )}

            <button
              onClick={estaEditando ? guardarEdicionOferta : hacerOferta}
              disabled={!cumpleMinimo(ventaSeleccionada?.cromoRareza, cromosOferta)}
              style={{
                width: "100%", padding: "15px", borderRadius: "14px", border: "none",
                background: cumpleMinimo(ventaSeleccionada?.cromoRareza, cromosOferta)
                  ? estaEditando
                    ? "linear-gradient(135deg, #3b82f6, #2563eb)"
                    : "linear-gradient(135deg, #10b981, #059669)"
                  : "#334155",
                color:  cumpleMinimo(ventaSeleccionada?.cromoRareza, cromosOferta) ? "white" : "#64748b",
                fontSize: "1rem", fontWeight: "bold",
                cursor: cumpleMinimo(ventaSeleccionada?.cromoRareza, cromosOferta) ? "pointer" : "not-allowed",
              }}
            >
              {estaEditando ? "💾 Guardar cambios" : "📤 Enviar oferta"}
            </button>
          </div>
        )}

        {/* ════════════════════════════════════════
            TAB: VENDER
        ════════════════════════════════════════ */}
        {dataLoaded && tab === "vender" && (
          <div>
            <h2 style={{ fontSize: "1.1rem", marginBottom: "5px" }}>📦 Poner una carta a la venta</h2>
            <p style={{ fontSize: "0.8rem", color: "#64748b", marginBottom: "20px" }}>
              Disponible 24h. Si nadie hace oferta, caduca.
            </p>

            {yaVendiHoy ? (
              /* Slot ya usado hoy */
              <div style={{ textAlign: "center", padding: "20px 0", color: "#64748b" }}>
                <p style={{ fontSize: "2rem", marginBottom: "10px" }}>🔒</p>
                <p style={{ marginBottom: "16px" }}>Ya has puesto una carta a la venta hoy</p>
                {misVentas.length > 0 && (
                  <div style={{
                    background: "#1e293b", borderRadius: "14px", padding: "14px",
                    border: "1px solid #334155", maxWidth: "320px", margin: "0 auto",
                  }}>
                    <p style={{ fontSize: "0.8rem", color: "#94a3b8", marginBottom: "12px" }}>
                      Tu carta en venta:
                    </p>
                    {misVentas.map((v) => (
                      <div key={v.id} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <img src={v.cromoImagen} alt="" style={{
                          width: "48px", height: "48px", borderRadius: "8px",
                          objectFit: "cover", border: `2px solid ${getBorder(v.cromoRareza)}`,
                        }} />
                        <div style={{ flex: 1, textAlign: "left" }}>
                          <p style={{ margin: 0, fontSize: "0.85rem", fontWeight: "bold" }}>{v.cromoNombre}</p>
                          <p style={{ margin: "2px 0 0", fontSize: "0.7rem", color: "#94a3b8" }}>
                            🔥 {(v.ofertas || []).length} oferta{(v.ofertas || []).length !== 1 ? "s" : ""}
                            {" · "}⏰ {horasRestantes(v.fechaExpiracion)}h
                          </p>
                        </div>
                        <button onClick={() => retirarVenta(v.id)} style={{
                          padding: "6px 10px", borderRadius: "8px",
                          border: "1px solid #475569", background: "transparent",
                          color: "#64748b", cursor: "pointer", fontSize: "0.75rem",
                        }}>🗑️</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : getMisRepetidos().length === 0 ? (
              <div style={{ textAlign: "center", padding: "30px", color: "#64748b" }}>
                <p style={{ fontSize: "2rem", marginBottom: "10px" }}>📦</p>
                <p>No tienes cartas repetidas para vender</p>
              </div>
            ) : (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px", marginBottom: "20px" }}>
                  {getMisRepetidos().map((cromo) => {
                    const sel = cromoAVender === cromo.cromoId;
                    return (
                      <div key={cromo.cromoId}
                        onClick={() => setCromoAVender(sel ? null : cromo.cromoId)}
                        style={{
                          borderRadius: "12px", overflow: "hidden", cursor: "pointer",
                          position: "relative",
                          border:     sel ? "3px solid #f59e0b" : `2px solid ${getBorder(cromo.info.rareza)}`,
                          transform:  sel ? "scale(1.05)" : "scale(1)",
                          transition: "all 0.2s",
                        }}
                      >
                        <img src={cromo.info.imagen} alt="" style={{ width: "100%", aspectRatio: "1", objectFit: "cover" }} />
                        {sel && (
                          <div style={{
                            position: "absolute", inset: 0,
                            background: "rgba(245,158,11,0.2)",
                            display: "flex", justifyContent: "center", alignItems: "center",
                            fontSize: "1.5rem",
                          }}>🏷️</div>
                        )}
                        <div style={{ padding: "3px", textAlign: "center", background: "rgba(0,0,0,0.65)", fontSize: "0.5rem" }}>
                          {cromo.info.nombre} <span style={{ color: "#94a3b8" }}>x{cromo.sobrantes}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {cromoAVender && (
                  <button onClick={ponerEnVenta} style={{
                    width: "100%", padding: "15px", borderRadius: "14px", border: "none",
                    background: "linear-gradient(135deg, #f59e0b, #d97706)",
                    color: "#000", fontSize: "1rem", fontWeight: "bold", cursor: "pointer",
                  }}>
                    🏷️ Poner a la venta (24h)
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════
            TAB: MIS OFERTAS
        ════════════════════════════════════════ */}
        {dataLoaded && tab === "mis-ofertas" && (() => {
          const misOfertas = [];
          ventas.forEach((v) => {
            (v.ofertas || []).forEach((o) => {
              if (o.ofertanteId === user?.uid) misOfertas.push({ venta: v, oferta: o });
            });
          });

          return (
            <div>
              {/* Oferta enviada */}
              <h2 style={{ fontSize: "1.1rem", marginBottom: "15px" }}>💰 Mi oferta activa</h2>
              {misOfertas.length === 0 ? (
                <div style={{ textAlign: "center", padding: "20px 0", color: "#64748b", marginBottom: "20px" }}>
                  <p style={{ fontSize: "1.8rem", marginBottom: "8px" }}>💰</p>
                  <p>{yaOfertHoy ? "Tu oferta ya fue aceptada o la carta caducó" : "No has hecho ninguna oferta hoy"}</p>
                  {!yaOfertHoy && <p style={{ fontSize: "0.8rem", marginTop: "4px" }}>Ve al Mercado para ofertar</p>}
                </div>
              ) : (
                misOfertas.map(({ venta, oferta }) => (
                  <div key={venta.id} style={{
                    background: "#1e293b", borderRadius: "16px",
                    padding: "15px", marginBottom: "12px",
                  }}>
                    <div style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "10px" }}>
                      <img src={venta.cromoImagen} alt="" style={{
                        width: "50px", height: "50px", borderRadius: "8px", objectFit: "cover",
                        border: `2px solid ${getBorder(venta.cromoRareza)}`, flexShrink: 0,
                      }} />
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: 0, fontSize: "0.85rem", fontWeight: "bold" }}>
                          Quieres: {venta.cromoNombre}
                        </p>
                        <p style={{ margin: "2px 0 0", fontSize: "0.7rem", color: "#94a3b8" }}>
                          de {venta.vendedorNombre} · ⏰ {horasRestantes(venta.fechaExpiracion)}h
                        </p>
                      </div>
                      <span style={{
                        fontSize: "0.65rem", padding: "3px 8px", borderRadius: "6px",
                        background: "rgba(245,158,11,0.15)", color: "#f59e0b", flexShrink: 0,
                      }}>⏳ Pendiente</span>
                    </div>
                    <p style={{ fontSize: "0.75rem", color: "#94a3b8", marginBottom: "10px" }}>
                      Ofreces: {oferta.cromos.map((c) => c.nombre).join(", ")}
                    </p>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button
                        onClick={() => {
                          // Abrir el overlay de oferta en modo edición con las cartas ya seleccionadas
                          setVentaSeleccionada(venta);
                          setCromosOferta(oferta.cromos.map((c) => c.cromoId));
                          setEstaEditando(true);
                          setTab("mercado");
                        }}
                        style={{
                          flex: 1, padding: "8px", borderRadius: "8px", border: "none",
                          background: "linear-gradient(135deg, #3b82f6, #2563eb)",
                          color: "white", cursor: "pointer", fontSize: "0.8rem", fontWeight: "bold",
                        }}
                      >✏️ Editar</button>
                      <button onClick={() => cancelarMiOferta(venta)} style={{
                        flex: 1, padding: "8px", borderRadius: "8px",
                        border: "1px solid #334155", background: "transparent",
                        color: "#64748b", cursor: "pointer", fontSize: "0.8rem",
                      }}>🗑️ Cancelar</button>
                    </div>
                  </div>
                ))
              )}

              {/* Mi carta en venta */}
              {misVentas.length > 0 && (
                <>
                  <h2 style={{ fontSize: "1.1rem", marginTop: "10px", marginBottom: "15px" }}>
                    🏷️ Mi carta en venta
                  </h2>
                  {misVentas.map((venta) => {
                    const num = (venta.ofertas || []).length;
                    return (
                      <div key={venta.id} style={{
                        background: "#1e3a5f", borderRadius: "16px",
                        padding: "15px", marginBottom: "10px", border: "1px solid #3b82f6",
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                          <img src={venta.cromoImagen} alt="" style={{
                            width: "50px", height: "50px", borderRadius: "8px", objectFit: "cover",
                            border: `2px solid ${getBorder(venta.cromoRareza)}`, flexShrink: 0,
                          }} />
                          <div style={{ flex: 1 }}>
                            <p style={{ margin: 0, fontSize: "0.85rem", fontWeight: "bold" }}>{venta.cromoNombre}</p>
                            <p style={{ margin: "2px 0 0", fontSize: "0.7rem", color: "#94a3b8" }}>
                              🔥 {num} oferta{num !== 1 ? "s" : ""} · ⏰ {horasRestantes(venta.fechaExpiracion)}h
                            </p>
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: "8px" }}>
                          <button onClick={() => verOfertas(venta)} style={{
                            flex: 1, padding: "10px", borderRadius: "10px", border: "none",
                            background: num > 0 ? "#10b981" : "#334155",
                            color: "white", fontWeight: "bold", cursor: "pointer", fontSize: "0.8rem",
                          }}>
                            📥 {num > 0 ? `Ver ${num} oferta${num !== 1 ? "s" : ""}` : "Sin ofertas"}
                          </button>
                          <button onClick={() => retirarVenta(venta.id)} style={{
                            padding: "10px 14px", borderRadius: "10px",
                            border: "1px solid #334155", background: "transparent",
                            color: "#64748b", cursor: "pointer",
                          }}>🗑️</button>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          );
        })()}

        {/* ════════════════════════════════════════
            TAB: HISTORIAL
        ════════════════════════════════════════ */}
        {dataLoaded && tab === "historial" && (
          <div>
            <h2 style={{ fontSize: "1.1rem", marginBottom: "15px" }}>📜 Historial de intercambios</h2>
            {!historialLoaded ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {[1, 2, 3].map((i) => (
                  <div key={i} style={{
                    height: "70px", borderRadius: "14px",
                    background: "linear-gradient(90deg, #1e293b 25%, #334155 50%, #1e293b 75%)",
                    backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite",
                  }} />
                ))}
              </div>
            ) : historial.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 20px", color: "#64748b" }}>
                <p style={{ fontSize: "2rem", marginBottom: "10px" }}>🤝</p>
                <p>Aún no hay intercambios completados</p>
              </div>
            ) : (
              historial.map((ev) => (
                <div key={ev.id} style={{
                  background: "linear-gradient(135deg, #0c1929, #1e293b)",
                  borderRadius: "14px", padding: "14px", marginBottom: "10px",
                  borderLeft: "4px solid #3b82f6",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "5px" }}>
                    <span style={{ fontWeight: "bold", fontSize: "0.85rem" }}>🤝 {ev.userName}</span>
                    <span style={{ fontSize: "0.7rem", color: "#64748b" }}>{timeAgo(ev.timestamp)}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: "0.8rem", color: "#94a3b8", lineHeight: 1.4 }}>{ev.details}</p>
                </div>
              ))
            )}
          </div>
        )}

        {/* ════════════════════════════════════════
            MODAL: VER Y ACEPTAR OFERTAS (vendedor)
        ════════════════════════════════════════ */}
        {ventaVerOfertas && (
          <div style={{
            position: "fixed", inset: 0,
            background: "rgba(0,0,0,0.87)", zIndex: 100,
            display: "flex", flexDirection: "column",
            padding: "20px", overflowY: "auto",
            animation: "fadeInUp 0.3s",
          }}>
            <button onClick={() => setVentaVerOfertas(null)} style={{
              padding: "8px 16px", borderRadius: "10px", border: "1px solid #475569",
              background: "transparent", color: "#94a3b8", cursor: "pointer",
              alignSelf: "flex-start", marginBottom: "15px",
            }}>← Cerrar</button>

            {/* Carta en venta */}
            <div style={{ textAlign: "center", marginBottom: "20px" }}>
              <img src={ventaVerOfertas.cromoImagen} alt="" style={{
                width: "70px", height: "70px", borderRadius: "12px", objectFit: "cover",
                border: `3px solid ${getBorder(ventaVerOfertas.cromoRareza)}`,
              }} />
              <p style={{ fontWeight: "bold", marginTop: "8px" }}>{ventaVerOfertas.cromoNombre}</p>
              <p style={{ fontSize: "0.75rem", color: "#64748b" }}>
                {(ventaVerOfertas.ofertas || []).length} oferta{(ventaVerOfertas.ofertas || []).length !== 1 ? "s" : ""} recibidas
              </p>
            </div>

            {(ventaVerOfertas.ofertas || []).length === 0 ? (
              <p style={{ color: "#64748b", textAlign: "center" }}>Aún no hay ofertas</p>
            ) : (
              (ventaVerOfertas.ofertas || []).map((oferta, i) => (
                <div key={i} style={{
                  background: "#1e293b", borderRadius: "16px",
                  padding: "15px", marginBottom: "12px",
                }}>
                  <p style={{ fontWeight: "bold", fontSize: "0.9rem", marginBottom: "10px" }}>
                    {oferta.ofertanteNombre} ofrece:
                  </p>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px", marginBottom: "12px" }}>
                    {oferta.cromos.map((c, j) => {
                      const esNueva = !tieneCromo(c.cromoId);
                      return (
                        <div key={j} style={{
                          position: "relative", borderRadius: "10px",
                          border: `2px solid ${getBorder(c.rareza)}`, overflow: "visible",
                        }}>
                          <div style={{ borderRadius: "8px 8px 0 0", overflow: "hidden" }}>
                            <img src={c.imagen} alt="" style={{ width: "100%", aspectRatio: "1", objectFit: "cover", display: "block" }} />
                          </div>
                          <div style={{ padding: "3px 4px", textAlign: "center", fontSize: "0.55rem", color: "#cbd5e1", lineHeight: 1.2 }}>
                            {c.nombre}
                          </div>
                          <div style={{
                            position: "absolute", top: "-8px", right: "-4px",
                            background: esNueva ? "#10b981" : "#475569",
                            color: "white", fontSize: "0.45rem", fontWeight: "bold",
                            padding: "2px 5px", borderRadius: "4px",
                            boxShadow: "0 1px 4px rgba(0,0,0,0.6)", whiteSpace: "nowrap",
                          }}>
                            {esNueva ? "✨ NUEVA" : "REPETIDA"}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <button onClick={() => aceptarOferta(oferta)} style={{
                    width: "100%", padding: "12px", borderRadius: "10px", border: "none",
                    background: "linear-gradient(135deg, #10b981, #059669)",
                    color: "white", fontWeight: "bold", cursor: "pointer", fontSize: "0.85rem",
                  }}>
                    ✅ Aceptar esta oferta
                  </button>
                </div>
              ))
            )}
          </div>
        )}

      </div>
    </div>
  );
}
