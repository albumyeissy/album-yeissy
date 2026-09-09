"use client";
import { useState, useEffect } from "react";
import { auth, db } from "../../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  doc, getDoc, getDoc as getDocOnce, collection, getDocs,
  runTransaction, deleteDoc,
} from "firebase/firestore";
import { useRouter } from "next/navigation";
import { CROMOS } from "../../data/cromos";
import { addFeedEvent } from "../../lib/feedHelper";
import "../hv.css";
import HvBottomNav from "../HvBottomNav";

const RAREZA_COLOR = {
  legendaria: "oklch(0.83 0.13 85)",
  mitica:     "oklch(0.68 0.22 18)",
  rara:       "oklch(0.76 0.15 230)",
  comun:      "oklch(0.74 0.03 265)",
};

const MINIMOS = {
  legendaria: [
    { rarezas: { comun: 3 },      label: "3 Comunes 📄" },
    { rarezas: { rara: 2 },       label: "2 Raras 💎" },
    { rarezas: { legendaria: 1 }, label: "1 Legendaria ⭐" },
  ],
  rara:  [
    { rarezas: { comun: 2 }, label: "2 Comunes 📄" },
    { rarezas: { rara: 1 },  label: "1 Rara 💎" },
  ],
  comun: [
    { rarezas: { comun: 1 }, label: "1 Común 📄" },
  ],
  mitica: [
    { rarezas: { legendaria: 2 }, label: "2 Legendarias ⭐" },
    { rarezas: { mitica: 1 },     label: "1 Mítica 🔥" },
  ],
};

function timeLeft(fechaExpiracion) {
  const diff = new Date(fechaExpiracion) - Date.now();
  if (diff <= 0) return "expirado";
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function MercadoHvPage() {
  const [loading,    setLoading]    = useState(true);
  const [user,       setUser]       = useState(null);
  const [misDatos,   setMisDatos]   = useState(null);
  const [ventas,     setVentas]     = useState([]);
  const [tab,        setTab]        = useState("mercado");

  // ── Hacer oferta ──
  const [ventaSeleccionada,  setVentaSeleccionada]  = useState(null);
  const [cromosOferta,       setCromosOferta]       = useState([]);
  const [monedasOferta,      setMonedasOferta]      = useState(0);
  const [vendedorCromos,     setVendedorCromos]     = useState(null);
  const [vendedorCargando,   setVendedorCargando]   = useState(false);
  const [estaEditando,       setEstaEditando]       = useState(false);

  // ── Ver ofertas recibidas (vendedor) ──
  const [ventaVerOfertas,    setVentaVerOfertas]    = useState(null);

  // ── Vender ──
  const [cromoAVender,       setCromoAVender]       = useState(null);

  // ── Toast ──
  const [toast,              setToast]              = useState(null); // { msg, tipo }

  const router = useRouter();
  const HOY = new Date().toLocaleDateString("en-CA");

  // ── Carga ──
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { router.push("/"); return; }
      setUser(u);
      await loadData(u.uid);
      setLoading(false);
    });
    return () => unsub();
  }, [router]);

  const loadData = async (uid) => {
    try {
      const [snap, ventasSnap] = await Promise.all([
        getDoc(doc(db, "usuarios", uid)),
        getDocs(collection(db, "ventas")),
      ]);
      setMisDatos(snap.exists() ? { uid, ...snap.data() } : { uid, cromos: [] });
      const ahora = new Date();
      const activas = [];
      ventasSnap.forEach(d => {
        const v = { id: d.id, ...d.data() };
        if (new Date(v.fechaExpiracion) > ahora) activas.push(v);
      });
      activas.sort((a, b) => new Date(b.fechaCreacion) - new Date(a.fechaCreacion));
      setVentas(activas);
    } catch (err) { console.error(err); }
  };

  // ── Cargar inventario del vendedor al abrir panel oferta ──
  useEffect(() => {
    if (!ventaSeleccionada) { setVendedorCromos(null); return; }
    setVendedorCargando(true);
    getDoc(doc(db, "usuarios", ventaSeleccionada.vendedorId))
      .then(snap => setVendedorCromos(snap.exists() ? snap.data().cromos || [] : []))
      .catch(() => setVendedorCromos([]))
      .finally(() => setVendedorCargando(false));
  }, [ventaSeleccionada]);

  const showToast = (msg, tipo = "ok") => {
    setToast({ msg, tipo });
    setTimeout(() => setToast(null), 4000);
  };

  // ── Estado derivado ──
  const ventasHoyCount          = misDatos?.fechaUltimaVenta === HOY ? (misDatos?.ventasHoy || 0) : 0;
  const intercambioVentaHoyFlag = misDatos?.intercambioVentaHoy === HOY;
  const puedeVender             = ventasHoyCount < 3 && !intercambioVentaHoyFlag;
  const ventasRestantes         = Math.max(0, 3 - ventasHoyCount);

  const propuestasHoyCount         = misDatos?.fechaUltimaOferta             === HOY ? (misDatos?.propuestasHoy        || 0) : 0;
  const intercambiosOfertaHoyCount = misDatos?.fechaUltimaIntercambioOferta  === HOY ? (misDatos?.intercambiosOfertaHoy || 0) : 0;
  const puedeHacerOferta           = propuestasHoyCount < 3 && intercambiosOfertaHoyCount < 1;
  const ofertasRestantes           = Math.max(0, 3 - propuestasHoyCount);

  const monedasEnOfertas = ventas.reduce((sum, v) => {
    (v.ofertas || []).filter(o => o.ofertanteId === user?.uid).forEach(o => { sum += (o.monedas || 0); });
    return sum;
  }, 0);
  const monedasTotales     = misDatos?.monedas ?? 50;
  const monedasDisponibles = Math.max(0, monedasTotales - monedasEnOfertas);

  const misVentas = ventas.filter(v => v.vendedorId === user?.uid);

  const getMisRepetidos = () => {
    if (!misDatos?.cromos) return [];
    const enVenta = new Set(misVentas.map(v => v.cromoId));
    const enOfertaCount = {};
    ventas.forEach(v => {
      (v.ofertas || []).filter(o => o.ofertanteId === user?.uid).forEach(o => {
        (o.cromos || []).forEach(c => { enOfertaCount[c.cromoId] = (enOfertaCount[c.cromoId] || 0) + 1; });
      });
    });
    return misDatos.cromos
      .filter(c => {
        const reservada = (enVenta.has(c.cromoId) ? 1 : 0) + (enOfertaCount[c.cromoId] || 0);
        return (c.cantidad - reservada) > 1;
      })
      .map(c => {
        const reservada = (enVenta.has(c.cromoId) ? 1 : 0) + (enOfertaCount[c.cromoId] || 0);
        return { ...c, info: CROMOS.find(x => x.id === c.cromoId), sobrantes: c.cantidad - 1 - reservada };
      })
      .filter(c => c.info);
  };

  const getCromoInfo = id => CROMOS.find(c => c.id === id);

  const cumpleMinimo = (rareza, ids) => {
    if (!ids.length) return false;
    const conteo = {};
    ids.forEach(id => { const inf = getCromoInfo(id); if (inf) conteo[inf.rareza] = (conteo[inf.rareza] || 0) + 1; });
    return (MINIMOS[rareza] || MINIMOS.comun).some(min =>
      Object.entries(min.rarezas).every(([r, n]) => (conteo[r] || 0) >= n)
    );
  };

  const ofertaEsValida = (rareza, ids, monedas) =>
    (ids.length > 0 && cumpleMinimo(rareza, ids)) || monedas > 0;

  const toggleOferta = id =>
    setCromosOferta(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  // ── Poner en venta ──
  const ponerEnVenta = async () => {
    if (!cromoAVender) return;
    const info = getCromoInfo(cromoAVender);
    if (!info) return;
    const cartaEnOferta = ventas.some(v =>
      (v.ofertas || []).some(o =>
        o.ofertanteId === user.uid && (o.cromos || []).some(c => c.cromoId === cromoAVender)
      )
    );
    if (cartaEnOferta) { showToast("❌ Esa carta ya está comprometida en una oferta", "err"); return; }
    try {
      await runTransaction(db, async tx => {
        const userRef  = doc(db, "usuarios", user.uid);
        const userSnap = await tx.get(userRef);
        const datos    = userSnap.data() || {};
        if (datos.intercambioVentaHoy === HOY)  throw new Error("ya-intercambio-venta");
        const freshVentasHoy = datos.fechaUltimaVenta === HOY ? (datos.ventasHoy || 0) : 0;
        if (freshVentasHoy >= 3) throw new Error("ya-3-ventas-hoy");
        const cartaActual = (datos.cromos || []).find(c => c.cromoId === cromoAVender);
        if (!cartaActual || cartaActual.cantidad < 2) throw new Error("sin-repetidas");
        const ventaRef = doc(collection(db, "ventas"));
        const ahora = new Date();
        const exp   = new Date(ahora.getTime() + 24 * 60 * 60 * 1000);
        tx.set(ventaRef, {
          vendedorId: user.uid, vendedorNombre: misDatos.nombre || misDatos.email || "Jugador",
          cromoId: cromoAVender, cromoNombre: info.nombre, cromoRareza: info.rareza, cromoImagen: info.imagen,
          ofertas: [], fechaCreacion: ahora.toISOString(), fechaExpiracion: exp.toISOString(),
        });
        tx.set(userRef, { ventasHoy: freshVentasHoy + 1, fechaUltimaVenta: HOY }, { merge: true });
      });
      setCromoAVender(null); setTab("mis-ventas");
      showToast("✅ Carta puesta en el mercado (24h)");
      await loadData(user.uid);
    } catch (err) {
      const msgs = {
        "ya-intercambio-venta": "❌ Ya completaste un intercambio hoy como vendedor",
        "ya-3-ventas-hoy":      "❌ Ya has puesto 3 cartas a la venta hoy",
        "sin-repetidas":        "❌ Necesitas tener esa carta repetida",
      };
      showToast(msgs[err.message] || "❌ Error al poner en venta", "err");
    }
  };

  // ── Hacer oferta ──
  const hacerOferta = async () => {
    if (!ventaSeleccionada || !ofertaEsValida(ventaSeleccionada.cromoRareza, cromosOferta, monedasOferta)) return;
    const enMisVentas = new Set(misVentas.map(v => v.cromoId));
    const cartaEnVenta = cromosOferta.find(id => enMisVentas.has(id));
    if (cartaEnVenta) { showToast(`❌ "${getCromoInfo(cartaEnVenta)?.nombre}" está en venta, retírala antes`, "err"); return; }
    if (monedasOferta > monedasDisponibles) { showToast(`❌ Monedas insuficientes (disponibles: ${monedasDisponibles}🪙)`, "err"); return; }
    try {
      await runTransaction(db, async tx => {
        const userRef  = doc(db, "usuarios", user.uid);
        const ventaRef = doc(db, "ventas", ventaSeleccionada.id);
        const [userSnap, ventaSnap] = await Promise.all([tx.get(userRef), tx.get(ventaRef)]);
        const datos = userSnap.data() || {};
        const freshPropuestas   = datos.fechaUltimaOferta            === HOY ? (datos.propuestasHoy        || 0) : 0;
        const freshIntercambios = datos.fechaUltimaIntercambioOferta === HOY ? (datos.intercambiosOfertaHoy || 0) : 0;
        if (freshPropuestas  >= 3) throw new Error("propuestas-agotadas");
        if (freshIntercambios >= 1) throw new Error("ya-intercambio-hoy");
        if ((datos.monedas ?? 50) < monedasOferta) throw new Error("sin-monedas");
        if (!ventaSnap.exists()) throw new Error("venta-no-existe");
        const ventaData = ventaSnap.data();
        if (new Date() > new Date(ventaData.fechaExpiracion)) throw new Error("venta-expirada");
        if (ventaData.vendedorId === user.uid) throw new Error("no-autotrade");
        if ((ventaData.ofertas || []).some(o => o.ofertanteId === user.uid)) throw new Error("ya-ofert-aqui");
        const nuevaOferta = {
          ofertanteId: user.uid, ofertanteNombre: misDatos.nombre || misDatos.email || "Jugador",
          cromos: cromosOferta.map(id => { const inf = getCromoInfo(id); return { cromoId: id, nombre: inf.nombre, rareza: inf.rareza, imagen: inf.imagen }; }),
          monedas: monedasOferta, fecha: new Date().toISOString(),
        };
        tx.set(userRef, { propuestasHoy: freshPropuestas + 1, fechaUltimaOferta: HOY }, { merge: true });
        tx.update(ventaRef, { ofertas: [...(ventaData.ofertas || []), nuevaOferta] });
      });
      setVentaSeleccionada(null); setCromosOferta([]); setMonedasOferta(0);
      showToast("✅ Oferta enviada");
      await loadData(user.uid);
    } catch (err) {
      const msgs = {
        "propuestas-agotadas": "❌ Ya agotaste tus 3 ofertas de hoy",
        "ya-intercambio-hoy":  "❌ Ya completaste un intercambio hoy",
        "sin-monedas":         "❌ No tienes suficientes monedas",
        "no-autotrade":        "❌ No puedes ofertar en tu propia venta",
        "venta-no-existe":     "❌ Esta venta ya no existe",
        "venta-expirada":      "❌ Esta venta ha caducado",
        "ya-ofert-aqui":       "❌ Ya tienes una oferta en esta venta",
      };
      showToast(msgs[err.message] || "❌ Error al enviar la oferta", "err");
    }
  };

  // ── Editar oferta existente ──
  const guardarEdicionOferta = async () => {
    if (!ventaSeleccionada || !ofertaEsValida(ventaSeleccionada.cromoRareza, cromosOferta, monedasOferta)) return;
    const enMisVentasEd = new Set(misVentas.map(v => v.cromoId));
    const cartaEd = cromosOferta.find(id => enMisVentasEd.has(id));
    if (cartaEd) { showToast(`❌ "${getCromoInfo(cartaEd)?.nombre}" está en venta`, "err"); return; }
    try {
      await runTransaction(db, async tx => {
        const userRef  = doc(db, "usuarios", user.uid);
        const ventaRef = doc(db, "ventas", ventaSeleccionada.id);
        const [userSnap, ventaSnap] = await Promise.all([tx.get(userRef), tx.get(ventaRef)]);
        if (!ventaSnap.exists()) throw new Error("venta-no-existe");
        const ventaData = ventaSnap.data();
        if (new Date() > new Date(ventaData.fechaExpiracion)) throw new Error("venta-expirada");
        const ofertaActual = (ventaData.ofertas || []).find(o => o.ofertanteId === user.uid);
        const monedasEnOfertasExcluida = monedasEnOfertas - (ofertaActual?.monedas || 0);
        const monedasLibres = Math.max(0, (userSnap.data()?.monedas ?? 50) - monedasEnOfertasExcluida);
        if (monedasOferta > monedasLibres) throw new Error("sin-monedas");
        const ofertaIdx = (ventaData.ofertas || []).findIndex(o => o.ofertanteId === user.uid);
        if (ofertaIdx === -1) throw new Error("oferta-no-encontrada");
        const ofertasActualizadas = [...(ventaData.ofertas || [])];
        ofertasActualizadas[ofertaIdx] = {
          ...ofertasActualizadas[ofertaIdx],
          cromos: cromosOferta.map(id => { const inf = getCromoInfo(id); return { cromoId: id, nombre: inf.nombre, rareza: inf.rareza, imagen: inf.imagen }; }),
          monedas: monedasOferta, fechaEdicion: new Date().toISOString(),
        };
        tx.update(ventaRef, { ofertas: ofertasActualizadas });
      });
      setVentaSeleccionada(null); setCromosOferta([]); setMonedasOferta(0); setEstaEditando(false);
      showToast("✅ Oferta actualizada");
      await loadData(user.uid);
    } catch (err) {
      const msgs = { "venta-no-existe": "❌ Venta no existe", "venta-expirada": "❌ Venta caducada", "oferta-no-encontrada": "❌ Oferta no encontrada", "sin-monedas": "❌ Monedas insuficientes" };
      showToast(msgs[err.message] || "❌ Error al actualizar", "err");
    }
  };

  // ── Aceptar oferta ──
  const aceptarOferta = async (oferta) => {
    try {
      await runTransaction(db, async tx => {
        const ventaRef     = doc(db, "ventas", ventaVerOfertas.id);
        const vendedorRef  = doc(db, "usuarios", user.uid);
        const compradorRef = doc(db, "usuarios", oferta.ofertanteId);
        const otrasVentasRefs = ventas.filter(v => v.id !== ventaVerOfertas.id).map(v => doc(db, "ventas", v.id));
        const [ventaSnap, vendedorSnap, compradorSnap, ...otrasVentasSnaps] =
          await Promise.all([tx.get(ventaRef), tx.get(vendedorRef), tx.get(compradorRef), ...otrasVentasRefs.map(r => tx.get(r))]);
        if (!ventaSnap.exists() || !vendedorSnap.exists() || !compradorSnap.exists()) throw new Error("usuario-no-existe");
        const ventaData = ventaSnap.data();
        const comprDatos = compradorSnap.data();
        const vendDatos  = vendedorSnap.data();
        const freshIntercambios = comprDatos.fechaUltimaIntercambioOferta === HOY ? (comprDatos.intercambiosOfertaHoy || 0) : 0;
        if (freshIntercambios >= 1) throw new Error("ofertante-ya-intercambio");
        const monedasOfertaAmount = oferta.monedas || 0;
        if (monedasOfertaAmount > 0 && (comprDatos.monedas ?? 50) < monedasOfertaAmount) throw new Error("comprador-sin-monedas");
        const vendCromos  = vendDatos.cromos.map(c => ({ ...c }));
        const comprCromos = comprDatos.cromos.map(c => ({ ...c }));
        const vendTiene = vendCromos.find(c => c.cromoId === ventaData.cromoId);
        if (!vendTiene || vendTiene.cantidad < 2) throw new Error("vendedor-sin-carta");
        for (const c of (oferta.cromos || [])) {
          const comprTiene = comprCromos.find(x => x.cromoId === c.cromoId);
          if (!comprTiene || comprTiene.cantidad < 2) throw new Error(`comprador-sin:${c.nombre}`);
        }
        vendTiene.cantidad -= 1;
        (oferta.cromos || []).forEach(c => {
          const ex = vendCromos.find(x => x.cromoId === c.cromoId);
          if (ex) ex.cantidad += 1;
          else vendCromos.push({ cromoId: c.cromoId, cantidad: 1, fechaObtenido: HOY, pegado: false });
        });
        (oferta.cromos || []).forEach(c => { comprCromos.find(x => x.cromoId === c.cromoId).cantidad -= 1; });
        const comprGana = comprCromos.find(x => x.cromoId === ventaData.cromoId);
        if (comprGana) comprGana.cantidad += 1;
        else comprCromos.push({ cromoId: ventaData.cromoId, cantidad: 1, fechaObtenido: HOY, pegado: false });
        tx.update(vendedorRef, { cromos: vendCromos, monedas: (vendDatos.monedas ?? 50) + monedasOfertaAmount, intercambioVentaHoy: HOY });
        tx.update(compradorRef, { cromos: comprCromos, monedas: (comprDatos.monedas ?? 50) - monedasOfertaAmount, intercambiosOfertaHoy: freshIntercambios + 1, fechaUltimaIntercambioOferta: HOY });
        tx.delete(ventaRef);
        const cardsGiven = new Set((oferta.cromos || []).map(c => c.cromoId));
        for (let i = 0; i < otrasVentasSnaps.length; i++) {
          const snap = otrasVentasSnaps[i]; if (!snap.exists()) continue;
          const data = snap.data(); const ref = otrasVentasRefs[i];
          if (data.vendedorId === oferta.ofertanteId && cardsGiven.has(data.cromoId)) {
            const cantTrasSwap = comprCromos.find(c => c.cromoId === data.cromoId)?.cantidad ?? 0;
            if (cantTrasSwap < 2) { tx.delete(ref); continue; }
          }
          if (data.vendedorId === user.uid) { tx.delete(ref); continue; }
          if ((data.ofertas || []).some(o => o.ofertanteId === oferta.ofertanteId)) {
            tx.update(ref, { ofertas: (data.ofertas || []).filter(o => o.ofertanteId !== oferta.ofertanteId) });
          }
        }
      });
      const detalleCartas = (oferta.cromos || []).map(c => c.nombre).join(", ");
      const detalleMon    = oferta.monedas > 0 ? ` + ${oferta.monedas}🪙` : "";
      addFeedEvent({ type: "intercambio", userName: misDatos.nombre || misDatos.email, details: `🤝 Intercambió ${ventaVerOfertas.cromoNombre} con ${oferta.ofertanteNombre} por ${detalleCartas || "monedas"}${detalleMon}` });
      setVentaVerOfertas(null);
      showToast("🎉 ¡Intercambio completado!");
      await loadData(user.uid);
    } catch (err) {
      if (err.message.startsWith("comprador-sin:")) {
        showToast(`❌ ${oferta.ofertanteNombre} ya no tiene "${err.message.split(":")[1]}"`, "err");
      } else {
        const msgs = {
          "venta-no-existe": "❌ Venta no existe", "usuario-no-existe": "❌ Usuario no encontrado",
          "vendedor-sin-carta": "❌ Ya no tienes esa carta de sobra",
          "comprador-sin-monedas": `❌ ${oferta.ofertanteNombre} no tiene esas monedas`,
          "ofertante-ya-intercambio": `❌ ${oferta.ofertanteNombre} ya intercambió hoy`,
        };
        showToast(msgs[err.message] || "❌ Error al aceptar", "err");
      }
    }
  };

  const retirarVenta = async (ventaId) => {
    try { await deleteDoc(doc(db, "ventas", ventaId)); showToast("Carta retirada"); await loadData(user.uid); }
    catch { showToast("❌ Error al retirar", "err"); }
  };

  const cancelarMiOferta = async (venta) => {
    try {
      await runTransaction(db, async tx => {
        const ventaRef  = doc(db, "ventas", venta.id);
        const ventaSnap = await tx.get(ventaRef);
        if (!ventaSnap.exists()) return;
        tx.update(ventaRef, { ofertas: (ventaSnap.data().ofertas || []).filter(o => o.ofertanteId !== user.uid) });
      });
      showToast("Oferta cancelada");
      await loadData(user.uid);
    } catch { showToast("❌ Error al cancelar", "err"); }
  };

  const verOfertas = async (venta) => {
    try {
      const snap = await getDoc(doc(db, "ventas", venta.id));
      setVentaVerOfertas(snap.exists() ? { id: snap.id, ...snap.data() } : venta);
    } catch { setVentaVerOfertas(venta); }
  };

  const abrirHacerOferta = (venta) => {
    setVentaSeleccionada(venta); setCromosOferta([]); setMonedasOferta(0); setEstaEditando(false);
  };

  const abrirEditarOferta = (venta) => {
    const miOferta = (venta.ofertas || []).find(o => o.ofertanteId === user?.uid);
    if (!miOferta) return;
    setVentaSeleccionada(venta);
    setCromosOferta((miOferta.cromos || []).map(c => c.cromoId));
    setMonedasOferta(miOferta.monedas || 0);
    setEstaEditando(true);
  };

  if (loading) return <div className="hv-app hv-loading"><span>Cargando mercado…</span></div>;

  const otrasVentas = ventas.filter(v => v.vendedorId !== user?.uid);
  const misOfertas  = ventas.filter(v => v.vendedorId !== user?.uid && (v.ofertas || []).some(o => o.ofertanteId === user?.uid));
  const misRepetidos = getMisRepetidos();

  const rc = v => RAREZA_COLOR[v.cromoRareza] ?? RAREZA_COLOR.comun;

  return (
    <div className="hv-app hv-page">
      <div className="hv-content">
        <div className="hv-screen">

          {/* ── Header ── */}
          <div className="hv-shead" style={{ paddingTop: 16 }}>
            <div>
              <div className="hv-kicker">Álbum Yeissy</div>
              <h1 className="hv-h1">Cambios</h1>
            </div>
            <div className="hv-coin-pill">
              <span className="hv-coin-icon">◉</span>
              {monedasDisponibles}
              {monedasEnOfertas > 0 && <span style={{ fontSize: 10, color: "var(--muted)" }}> ({monedasEnOfertas} reservadas)</span>}
            </div>
          </div>

          {/* Pills de estado */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
            <span style={{
              fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 6,
              background: puedeVender ? "color-mix(in oklch, #10b981 15%, transparent)" : "color-mix(in oklch, #ef4444 15%, transparent)",
              color: puedeVender ? "#10b981" : "#ef4444",
            }}>
              🏷️ {intercambioVentaHoyFlag ? "Intercambio hecho" : ventasRestantes === 0 ? "Ventas agotadas" : `${ventasRestantes} venta${ventasRestantes !== 1 ? "s" : ""} libre${ventasRestantes !== 1 ? "s" : ""}`}
            </span>
            <span style={{
              fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 6,
              background: puedeHacerOferta ? "color-mix(in oklch, #f59e0b 15%, transparent)" : "color-mix(in oklch, #ef4444 15%, transparent)",
              color: puedeHacerOferta ? "#f59e0b" : "#ef4444",
            }}>
              💰 {intercambiosOfertaHoyCount >= 1 ? "Intercambio hecho" : ofertasRestantes === 0 ? "Ofertas agotadas" : `${ofertasRestantes} oferta${ofertasRestantes !== 1 ? "s" : ""} libre${ofertasRestantes !== 1 ? "s" : ""}`}
            </span>
          </div>

          {/* ── Tabs ── */}
          <div className="hv-seg">
            {[
              { id: "mercado",    label: "🏷️ Mercado" },
              { id: "mis-ventas", label: `📦 ${misVentas.length > 0 ? misVentas.length : "Mis"}` },
              { id: "mis-ofertas",label: `📤 ${misOfertas.length > 0 ? misOfertas.length : "Mis ofertas"}` },
              { id: "vender",     label: "➕ Vender" },
            ].map(t => (
              <button key={t.id}
                className={"hv-seg-btn" + (tab === t.id ? " on" : "")}
                onClick={() => {
                  setTab(t.id); setVentaSeleccionada(null); setCromosOferta([]); setMonedasOferta(0);
                  setVentaVerOfertas(null); setEstaEditando(false);
                }}>
                {t.label}
              </button>
            ))}
          </div>

          {/* ════ TAB: MERCADO ════ */}
          {tab === "mercado" && !ventaSeleccionada && (
            <>
              {otrasVentas.length === 0 ? (
                <div className="hv-feed-empty">
                  <span className="hv-feed-empty-icon">🏷️</span>
                  <span>No hay cartas en el mercado</span>
                  <span style={{ fontSize: 12 }}>¡Sé el primero en poner una!</span>
                </div>
              ) : (
                otrasVentas.map(v => {
                  const numOfertas = (v.ofertas || []).length;
                  const tengoOfer  = (v.ofertas || []).some(o => o.ofertanteId === user?.uid);
                  const miCant     = misDatos?.cromos?.find(c => c.cromoId === v.cromoId)?.cantidad || 0;
                  return (
                    <div key={v.id} className="hv-listing">
                      <div className="hv-listing-row">
                        <img src={v.cromoImagen} alt={v.cromoNombre} className="hv-listing-img" style={{ "--rc": rc(v) }} />
                        <div className="hv-listing-info">
                          <div className="hv-listing-name">{v.cromoNombre}</div>
                          <div className="hv-listing-meta">
                            <span style={{ color: rc(v) }}>{v.cromoRareza}</span>
                            <span>de {v.vendedorNombre}</span>
                          </div>
                          <div className="hv-listing-meta" style={{ marginTop: 4 }}>
                            <span>🔥 {numOfertas} oferta{numOfertas !== 1 ? "s" : ""}</span>
                            <span>⏰ {timeLeft(v.fechaExpiracion)}</span>
                            {miCant === 0 && <span style={{ color: "#10b981", fontSize: 10, fontWeight: 700 }}>✨ Nueva</span>}
                          </div>
                        </div>
                      </div>
                      <div className="hv-listing-actions">
                        {tengoOfer ? (
                          <>
                            <div style={{
                              flex: 1, padding: "10px", borderRadius: 10, textAlign: "center",
                              background: "color-mix(in oklch, var(--accent) 10%, transparent)",
                              border: "1px solid color-mix(in oklch, var(--accent) 35%, var(--line))",
                              fontSize: 13, color: "var(--accent)",
                            }}>⏳ Tu oferta está pendiente</div>
                            <button className="hv-btn ghost" style={{ width: "auto", padding: "10px 14px" }} onClick={() => abrirEditarOferta(v)}>✏️</button>
                          </>
                        ) : puedeHacerOferta ? (
                          <button className="hv-btn primary" style={{ flex: 1, padding: "10px", fontSize: 13 }} onClick={() => abrirHacerOferta(v)}>
                            💰 Hacer oferta
                          </button>
                        ) : (
                          <div style={{ flex: 1, padding: 10, borderRadius: 10, textAlign: "center", background: "var(--bg2)", border: "1px solid var(--line)", fontSize: 12, color: "var(--muted)" }}>
                            {intercambiosOfertaHoyCount >= 1 ? "Ya intercambiaste hoy" : "Ofertas agotadas"}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </>
          )}

          {/* Panel hacer/editar oferta */}
          {tab === "mercado" && ventaSeleccionada && (
            <div>
              <button className="hv-back-btn" onClick={() => { setVentaSeleccionada(null); setCromosOferta([]); setMonedasOferta(0); setEstaEditando(false); }}>
                ← Volver
              </button>
              <div style={{ fontFamily: "var(--head-font)", fontSize: 20, fontWeight: 700, marginBottom: 4 }}>
                {estaEditando ? "Editar oferta" : "Hacer oferta"}
              </div>
              <div className="hv-listing" style={{ marginBottom: 14 }}>
                <div className="hv-listing-row">
                  <img src={ventaSeleccionada.cromoImagen} alt="" className="hv-listing-img" style={{ "--rc": rc(ventaSeleccionada) }} />
                  <div className="hv-listing-info">
                    <div className="hv-listing-name">{ventaSeleccionada.cromoNombre}</div>
                    <div className="hv-listing-meta">
                      <span style={{ color: rc(ventaSeleccionada) }}>{ventaSeleccionada.cromoRareza}</span>
                      <span>de {ventaSeleccionada.vendedorNombre}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Mínimos requeridos */}
              <div style={{ background: "var(--bg2)", borderRadius: 10, padding: "10px 14px", marginBottom: 14, border: "1px solid var(--line)" }}>
                <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: ".1em", color: "var(--muted)", marginBottom: 6 }}>MÍNIMO REQUERIDO</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {(MINIMOS[ventaSeleccionada.cromoRareza] || MINIMOS.comun).map((m, i) => (
                    <span key={i} style={{
                      fontSize: 11, padding: "3px 9px", borderRadius: 6,
                      background: "color-mix(in oklch, var(--accent) 12%, transparent)",
                      border: "1px solid color-mix(in oklch, var(--accent) 30%, var(--line))",
                      color: "var(--accent)",
                    }}>{m.label}</span>
                  ))}
                  <span style={{ fontSize: 11, color: "var(--muted)" }}>ó monedas 🪙</span>
                </div>
              </div>

              {/* Selección de cartas */}
              <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: ".1em", color: "var(--muted)", marginBottom: 8 }}>TUS REPETIDAS</p>
              {vendedorCargando ? (
                <p style={{ color: "var(--muted)", fontSize: 13, textAlign: "center", padding: 20 }}>Cargando…</p>
              ) : misRepetidos.length === 0 ? (
                <p style={{ color: "var(--muted)", fontSize: 13, textAlign: "center", padding: "16px 0" }}>Sin cartas repetidas disponibles</p>
              ) : (
                <div className="hv-oferta-cromos" style={{ flexWrap: "wrap" }}>
                  {misRepetidos.map(c => {
                    const selected = cromosOferta.includes(c.cromoId);
                    const rcCol = RAREZA_COLOR[c.info.rareza] ?? RAREZA_COLOR.comun;
                    return (
                      <button key={c.cromoId}
                        onClick={() => toggleOferta(c.cromoId)}
                        style={{
                          border: selected ? `2px solid ${rcCol}` : "2px solid var(--line)",
                          borderRadius: 10, background: selected ? `color-mix(in oklch, ${rcCol} 12%, var(--bg2))` : "var(--bg2)",
                          padding: 0, cursor: "pointer", position: "relative", overflow: "visible",
                          transition: ".15s",
                        }}>
                        <img src={c.info.imagen} alt={c.info.nombre} style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 8, display: "block" }} />
                        {selected && <span style={{
                          position: "absolute", top: -6, right: -6, width: 18, height: 18, borderRadius: "50%",
                          background: rcCol, color: "#06121a", fontSize: 10, fontWeight: 700,
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}>✓</span>}
                        {c.sobrantes > 1 && <span className="hv-dupe">×{c.sobrantes}</span>}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Monedas */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14, marginBottom: 16 }}>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "var(--muted)" }}>🪙 Añadir monedas:</span>
                <button style={{ width: 28, height: 28, borderRadius: 8, border: "1px solid var(--line)", background: "var(--bg2)", color: "var(--text)", cursor: "pointer", fontSize: 16 }}
                  onClick={() => setMonedasOferta(m => Math.max(0, m - 1))}>−</button>
                <span style={{ fontFamily: "var(--head-font)", fontWeight: 700, fontSize: 18, minWidth: 30, textAlign: "center" }}>{monedasOferta}</span>
                <button style={{ width: 28, height: 28, borderRadius: 8, border: "1px solid var(--line)", background: "var(--bg2)", color: "var(--text)", cursor: "pointer", fontSize: 16 }}
                  onClick={() => setMonedasOferta(m => Math.min(monedasDisponibles, m + 1))}>+</button>
                <span style={{ fontSize: 11, color: "var(--muted)" }}>/{monedasDisponibles}🪙</span>
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                {estaEditando ? (
                  <button
                    className={"hv-btn primary"}
                    style={{ flex: 1, opacity: ofertaEsValida(ventaSeleccionada.cromoRareza, cromosOferta, monedasOferta) ? 1 : .4 }}
                    onClick={guardarEdicionOferta}
                    disabled={!ofertaEsValida(ventaSeleccionada.cromoRareza, cromosOferta, monedasOferta)}
                  >💾 Guardar cambios</button>
                ) : (
                  <button
                    className={"hv-btn primary"}
                    style={{ flex: 1, opacity: ofertaEsValida(ventaSeleccionada.cromoRareza, cromosOferta, monedasOferta) ? 1 : .4 }}
                    onClick={hacerOferta}
                    disabled={!ofertaEsValida(ventaSeleccionada.cromoRareza, cromosOferta, monedasOferta)}
                  >📤 Enviar oferta</button>
                )}
              </div>
            </div>
          )}

          {/* ════ TAB: MIS VENTAS ════ */}
          {tab === "mis-ventas" && !ventaVerOfertas && (
            <>
              {misVentas.length === 0 ? (
                <div className="hv-feed-empty">
                  <span className="hv-feed-empty-icon">📦</span>
                  <span>No tienes cartas en venta</span>
                </div>
              ) : (
                misVentas.map(v => {
                  const numOfertas = (v.ofertas || []).length;
                  return (
                    <div key={v.id} className="hv-listing mine">
                      <div className="hv-listing-row">
                        <img src={v.cromoImagen} alt={v.cromoNombre} className="hv-listing-img" style={{ "--rc": rc(v) }} />
                        <div className="hv-listing-info">
                          <div className="hv-listing-name">{v.cromoNombre}</div>
                          <div className="hv-listing-meta">
                            <span style={{ color: rc(v) }}>{v.cromoRareza}</span>
                            <span>⏰ {timeLeft(v.fechaExpiracion)}</span>
                          </div>
                          <div className="hv-listing-meta" style={{ marginTop: 4 }}>
                            <span style={{ color: numOfertas > 0 ? "#f59e0b" : "var(--muted)" }}>
                              🔥 {numOfertas} oferta{numOfertas !== 1 ? "s" : ""}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="hv-listing-actions">
                        <button
                          className={"hv-btn " + (numOfertas > 0 ? "primary" : "ghost")}
                          style={{ flex: 1, padding: "10px", fontSize: 13 }}
                          onClick={() => verOfertas(v)}
                        >
                          {numOfertas > 0 ? `📥 Ver ${numOfertas} oferta${numOfertas !== 1 ? "s" : ""}` : "📥 Sin ofertas aún"}
                        </button>
                        <button className="hv-btn ghost" style={{ width: "auto", padding: "10px 14px" }} onClick={() => retirarVenta(v.id)}>🗑️</button>
                      </div>
                    </div>
                  );
                })
              )}
            </>
          )}

          {/* Panel ver ofertas recibidas */}
          {tab === "mis-ventas" && ventaVerOfertas && (
            <div>
              <button className="hv-back-btn" onClick={() => setVentaVerOfertas(null)}>← Mis ventas</button>
              <div style={{ fontFamily: "var(--head-font)", fontSize: 20, fontWeight: 700, marginBottom: 14 }}>
                Ofertas por {ventaVerOfertas.cromoNombre}
              </div>
              {(ventaVerOfertas.ofertas || []).length === 0 ? (
                <div className="hv-feed-empty">
                  <span className="hv-feed-empty-icon">📭</span>
                  <span>Sin ofertas todavía</span>
                </div>
              ) : (
                (ventaVerOfertas.ofertas || []).map((oferta, i) => (
                  <div key={i} className="hv-oferta-card">
                    <div className="hv-oferta-header">
                      De <strong>{oferta.ofertanteNombre}</strong>
                      {oferta.fechaEdicion && <span style={{ fontSize: 10, color: "var(--muted)", marginLeft: 8 }}>editada</span>}
                    </div>
                    {(oferta.cromos || []).length > 0 && (
                      <div className="hv-oferta-cromos">
                        {(oferta.cromos || []).map((c, j) => {
                          const tiengoYo = misDatos?.cromos?.find(x => x.cromoId === c.cromoId)?.cantidad > 0;
                          const rcCol = RAREZA_COLOR[c.rareza] ?? RAREZA_COLOR.comun;
                          return (
                            <div key={j} className="hv-oferta-cromo">
                              <img src={c.imagen} alt={c.nombre} style={{ "--rc": rcCol }} />
                              {!tiengoYo && <span className="hv-oferta-nueva">NUEVA</span>}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {oferta.monedas > 0 && (
                      <div className="hv-monedas-offer">
                        <span>🪙</span>
                        <strong>+{oferta.monedas} monedas</strong>
                      </div>
                    )}
                    <div style={{ display: "flex", gap: 8 }}>
                      <button className="hv-btn primary" style={{ flex: 1, padding: "10px", fontSize: 13 }} onClick={() => aceptarOferta(oferta)}>
                        🤝 Aceptar
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ════ TAB: MIS OFERTAS ════ */}
          {tab === "mis-ofertas" && (
            <>
              {misOfertas.length === 0 ? (
                <div className="hv-feed-empty">
                  <span className="hv-feed-empty-icon">📤</span>
                  <span>Sin ofertas pendientes</span>
                </div>
              ) : (
                misOfertas.map(v => {
                  const miOferta = (v.ofertas || []).find(o => o.ofertanteId === user?.uid);
                  const rcCol = rc(v);
                  return (
                    <div key={v.id} className="hv-listing">
                      <div className="hv-listing-row">
                        <img src={v.cromoImagen} alt={v.cromoNombre} className="hv-listing-img" style={{ "--rc": rcCol }} />
                        <div className="hv-listing-info">
                          <div className="hv-listing-name">{v.cromoNombre}</div>
                          <div className="hv-listing-meta">
                            <span style={{ color: rcCol }}>{v.cromoRareza}</span>
                            <span>de {v.vendedorNombre}</span>
                          </div>
                          <div className="hv-listing-meta" style={{ marginTop: 4 }}>
                            <span>⏰ {timeLeft(v.fechaExpiracion)}</span>
                          </div>
                        </div>
                      </div>
                      {/* Mi oferta */}
                      {miOferta && (
                        <div className="hv-oferta-card" style={{ marginBottom: 0, marginTop: 8 }}>
                          <div className="hv-oferta-header" style={{ color: "var(--muted)" }}>Tu oferta:</div>
                          {(miOferta.cromos || []).length > 0 && (
                            <div className="hv-oferta-cromos">
                              {(miOferta.cromos || []).map((c, j) => (
                                <div key={j} className="hv-oferta-cromo">
                                  <img src={c.imagen} alt={c.nombre} style={{ "--rc": RAREZA_COLOR[c.rareza] ?? RAREZA_COLOR.comun }} />
                                </div>
                              ))}
                            </div>
                          )}
                          {miOferta.monedas > 0 && (
                            <div className="hv-monedas-offer" style={{ marginBottom: 10 }}>
                              <span>🪙</span><strong>+{miOferta.monedas} monedas</strong>
                            </div>
                          )}
                        </div>
                      )}
                      <div className="hv-listing-actions" style={{ marginTop: 8 }}>
                        <button className="hv-btn ghost" style={{ flex: 1, padding: "10px", fontSize: 13 }} onClick={() => abrirEditarOferta(v)}>
                          ✏️ Editar
                        </button>
                        <button className="hv-btn ghost" style={{ flex: 1, padding: "10px", fontSize: 13, color: "#ef4444", borderColor: "#ef4444" }} onClick={() => cancelarMiOferta(v)}>
                          🗑️ Cancelar
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </>
          )}

          {/* Panel editar oferta desde mis-ofertas */}
          {tab === "mis-ofertas" && ventaSeleccionada && (
            <div style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(6,10,22,.88)", backdropFilter: "blur(14px)", overflowY: "auto", padding: "40px 20px" }}>
              <div style={{ maxWidth: 380, margin: "0 auto" }}>
                <button className="hv-back-btn" onClick={() => { setVentaSeleccionada(null); setCromosOferta([]); setMonedasOferta(0); setEstaEditando(false); }}>← Cancelar</button>
                <div style={{ fontFamily: "var(--head-font)", fontSize: 20, fontWeight: 700, marginBottom: 12 }}>Editar oferta</div>
                {misRepetidos.length === 0 ? (
                  <p style={{ color: "var(--muted)", fontSize: 13 }}>Sin repetidas disponibles</p>
                ) : (
                  <div className="hv-oferta-cromos" style={{ flexWrap: "wrap", marginBottom: 14 }}>
                    {misRepetidos.map(c => {
                      const selected = cromosOferta.includes(c.cromoId);
                      const rcCol = RAREZA_COLOR[c.info.rareza] ?? RAREZA_COLOR.comun;
                      return (
                        <button key={c.cromoId} onClick={() => toggleOferta(c.cromoId)} style={{
                          border: selected ? `2px solid ${rcCol}` : "2px solid var(--line)",
                          borderRadius: 10, background: selected ? `color-mix(in oklch, ${rcCol} 12%, var(--bg2))` : "var(--bg2)",
                          padding: 0, cursor: "pointer", position: "relative", overflow: "visible",
                        }}>
                          <img src={c.info.imagen} alt={c.info.nombre} style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 8, display: "block" }} />
                          {selected && <span style={{ position: "absolute", top: -6, right: -6, width: 18, height: 18, borderRadius: "50%", background: rcCol, color: "#06121a", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>✓</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "var(--muted)" }}>🪙</span>
                  <button style={{ width: 28, height: 28, borderRadius: 8, border: "1px solid var(--line)", background: "var(--bg2)", color: "var(--text)", cursor: "pointer", fontSize: 16 }} onClick={() => setMonedasOferta(m => Math.max(0, m - 1))}>−</button>
                  <span style={{ fontFamily: "var(--head-font)", fontWeight: 700, fontSize: 18, minWidth: 30, textAlign: "center" }}>{monedasOferta}</span>
                  <button style={{ width: 28, height: 28, borderRadius: 8, border: "1px solid var(--line)", background: "var(--bg2)", color: "var(--text)", cursor: "pointer", fontSize: 16 }} onClick={() => setMonedasOferta(m => Math.min(monedasDisponibles, m + 1))}>+</button>
                </div>
                <button className="hv-btn primary"
                  disabled={!ofertaEsValida(ventaSeleccionada.cromoRareza, cromosOferta, monedasOferta)}
                  style={{ opacity: ofertaEsValida(ventaSeleccionada.cromoRareza, cromosOferta, monedasOferta) ? 1 : .4 }}
                  onClick={guardarEdicionOferta}>💾 Guardar</button>
              </div>
            </div>
          )}

          {/* ════ TAB: VENDER ════ */}
          {tab === "vender" && (
            <>
              {!puedeVender ? (
                <div className="hv-feed-empty">
                  <span className="hv-feed-empty-icon">🚫</span>
                  <span>{intercambioVentaHoyFlag ? "Ya completaste un intercambio hoy como vendedor" : "Has agotado tus 3 ventas de hoy"}</span>
                  <span style={{ fontSize: 12 }}>Vuelve mañana</span>
                </div>
              ) : misRepetidos.length === 0 ? (
                <div className="hv-feed-empty">
                  <span className="hv-feed-empty-icon">🃏</span>
                  <span>Sin cartas repetidas para vender</span>
                  <span style={{ fontSize: 12 }}>Necesitas al menos 2 copias de una carta</span>
                </div>
              ) : (
                <>
                  <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: ".12em", color: "var(--muted)", marginBottom: 10 }}>
                    ELIGE LA CARTA A PONER EN VENTA
                  </p>
                  <div className="hv-grid">
                    {misRepetidos.map(c => {
                      const selected = cromoAVender === c.cromoId;
                      const rcCol = RAREZA_COLOR[c.info.rareza] ?? RAREZA_COLOR.comun;
                      return (
                        <button key={c.cromoId}
                          className={"hv-slot filled rar-" + c.info.rareza}
                          onClick={() => setCromoAVender(selected ? null : c.cromoId)}
                          style={{
                            "--rc": rcCol,
                            outline: selected ? `2px solid ${rcCol}` : "none",
                            outlineOffset: 2,
                          }}>
                          <div className="hv-foil" />
                          <span className="hv-slot-num">#{String(c.info.id).padStart(2, "0")}</span>
                          {selected && <span className="hv-new">✓</span>}
                          <span className="hv-dupe">×{c.sobrantes + 1}</span>
                          <div className="hv-slot-photo"><img src={c.info.imagen} alt={c.info.nombre} loading="lazy" /></div>
                          <div className="hv-slot-foot">
                            <span className="hv-slot-name">{c.info.nombre}</span>
                            <i className="hv-slot-rdot" style={{ background: rcCol }} />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  {cromoAVender && (
                    <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                      {(() => { const info = getCromoInfo(cromoAVender); const rcCol = RAREZA_COLOR[info?.rareza] ?? RAREZA_COLOR.comun; return (
                        <div style={{ background: "var(--bg2)", border: `1.5px solid ${rcCol}`, borderRadius: 12, padding: "12px 14px", display: "flex", gap: 12, alignItems: "center" }}>
                          <img src={info?.imagen} alt={info?.nombre} style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 8, border: `1.5px solid ${rcCol}` }} />
                          <div>
                            <div style={{ fontFamily: "var(--head-font)", fontWeight: 700, fontSize: 16 }}>{info?.nombre}</div>
                            <div style={{ fontSize: 12, color: rcCol }}>{info?.rareza}</div>
                            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 3 }}>Visible 24h · max 3 ventas/día</div>
                          </div>
                        </div>
                      ); })()}
                      <button className="hv-btn primary" onClick={ponerEnVenta}>🏷️ Poner en venta</button>
                      <button className="hv-btn ghost" onClick={() => setCromoAVender(null)}>Cancelar</button>
                    </div>
                  )}
                </>
              )}
            </>
          )}

          <div className="hv-screen-pad" />
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`hv-toast ${toast.tipo === "err" ? "err" : "ok"}`}>{toast.msg}</div>
      )}

      <HvBottomNav />
    </div>
  );
}
