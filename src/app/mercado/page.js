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
  const [monedasOferta,      setMonedasOferta]      = useState(0);
  const [vendedorCromos,     setVendedorCromos]     = useState(null);
  const [vendedorCargando,   setVendedorCargando]   = useState(false);
  const [estaEditando,       setEstaEditando]       = useState(false);

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

  const getCromoInfo   = (id) => CROMOS.find((c) => c.id === id);
  const getBorder      = (r)  => r === "legendaria" ? "#fbbf24" : r === "rara" ? "#3b82f6" : "#64748b";
  const getRarezaEmoji = (r)  => r === "legendaria" ? "⭐" : r === "rara" ? "💎" : "📄";

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

  // Ventas del día (máximo 3; bloqueado si ya hizo un intercambio como vendedor)
  const ventasHoyCount          = misDatos?.fechaUltimaVenta === HOY ? (misDatos?.ventasHoy || 0) : 0;
  const intercambioVentaHoyFlag = misDatos?.intercambioVentaHoy === HOY;
  const puedeVender             = ventasHoyCount < 3 && !intercambioVentaHoyFlag;
  const ventasRestantes         = Math.max(0, 3 - ventasHoyCount);

  // Ofertas del día
  const propuestasHoyCount         = misDatos?.fechaUltimaOferta             === HOY ? (misDatos?.propuestasHoy        || 0) : 0;
  const intercambiosOfertaHoyCount = misDatos?.fechaUltimaIntercambioOferta  === HOY ? (misDatos?.intercambiosOfertaHoy || 0) : 0;
  const puedeHacerOferta           = propuestasHoyCount < 3 && intercambiosOfertaHoyCount < 1;
  const ofertasRestantes           = Math.max(0, 3 - propuestasHoyCount);

  // Monedas comprometidas en ofertas activas del usuario
  const monedasEnOfertas   = ventas.reduce((sum, v) => {
    (v.ofertas || []).filter((o) => o.ofertanteId === user?.uid)
      .forEach((o) => { sum += (o.monedas || 0); });
    return sum;
  }, 0);
  const monedasTotales     = misDatos?.monedas ?? 50;
  const monedasDisponibles = Math.max(0, monedasTotales - monedasEnOfertas);

  const misVentas = ventas.filter((v) => v.vendedorId === user?.uid);

  // Repetidos disponibles: carta con (cantidad - reservada) > 1
  const getMisRepetidos = () => {
    if (!misDatos?.cromos) return [];
    const enVenta = new Set(misVentas.map((v) => v.cromoId));

    const enOfertaCount = {};
    ventas.forEach((v) => {
      (v.ofertas || [])
        .filter((o) => o.ofertanteId === user?.uid)
        .forEach((o) => {
          (o.cromos || []).forEach((c) => {
            enOfertaCount[c.cromoId] = (enOfertaCount[c.cromoId] || 0) + 1;
          });
        });
    });

    return misDatos.cromos
      .filter((c) => {
        const reservada = (enVenta.has(c.cromoId) ? 1 : 0) + (enOfertaCount[c.cromoId] || 0);
        return (c.cantidad - reservada) > 1;
      })
      .map((c) => {
        const reservada = (enVenta.has(c.cromoId) ? 1 : 0) + (enOfertaCount[c.cromoId] || 0);
        return { ...c, info: getCromoInfo(c.cromoId), sobrantes: c.cantidad - 1 - reservada };
      })
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

  // Una oferta es válida si cumple el mínimo de cartas O incluye monedas
  const ofertaEsValida = (rareza, ids, monedas) =>
    (ids.length > 0 && cumpleMinimo(rareza, ids)) || monedas > 0;

  const toggleOferta = (id) =>
    setCromosOferta((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  // ── Acción: Poner en venta ──────────────────────────────────────────────────
  const ponerEnVenta = async () => {
    if (!cromoAVender) return;
    const info = getCromoInfo(cromoAVender);
    if (!info) return;

    // Pre-check: la carta no puede estar en una oferta activa del usuario
    const cartaEnOferta = ventas.some((v) =>
      (v.ofertas || []).some((o) =>
        o.ofertanteId === user.uid &&
        (o.cromos || []).some((c) => c.cromoId === cromoAVender)
      )
    );
    if (cartaEnOferta) {
      showMsg("❌ Esa carta ya está comprometida en una oferta activa", "error");
      return;
    }

    try {
      await runTransaction(db, async (tx) => {
        const userRef  = doc(db, "usuarios", user.uid);
        const userSnap = await tx.get(userRef);
        const datos    = userSnap.data() || {};

        if (datos.intercambioVentaHoy === HOY) throw new Error("ya-intercambio-venta");
        const freshVentasHoy = datos.fechaUltimaVenta === HOY ? (datos.ventasHoy || 0) : 0;
        if (freshVentasHoy >= 3) throw new Error("ya-3-ventas-hoy");

        const cartaActual = (datos.cromos || []).find((c) => c.cromoId === cromoAVender);
        if (!cartaActual || cartaActual.cantidad < 2) throw new Error("sin-repetidas");

        const ventaRef = doc(collection(db, "ventas"));
        const ahora    = new Date();
        const exp      = new Date(ahora.getTime() + 24 * 60 * 60 * 1000);

        tx.set(ventaRef, {
          vendedorId:      user.uid,
          vendedorNombre:  misDatos.nombre || misDatos.email || "Jugador",
          cromoId:         cromoAVender,
          cromoNombre:     info.nombre,
          cromoRareza:     info.rareza,
          cromoImagen:     info.imagen,
          ofertas:         [],
          fechaCreacion:   ahora.toISOString(),
          fechaExpiracion: exp.toISOString(),
        });
        tx.set(userRef, {
          ventasHoy:       freshVentasHoy + 1,
          fechaUltimaVenta: HOY,
        }, { merge: true });
      });

      setCromoAVender(null);
      setTab("mercado");
      showMsg("✅ Carta puesta en el mercado (24h)", "success");
      await loadData(user.uid);
    } catch (err) {
      const msgs = {
        "ya-intercambio-venta": "❌ Ya completaste un intercambio hoy como vendedor",
        "ya-3-ventas-hoy":      "❌ Ya has puesto 3 cartas a la venta hoy",
        "sin-repetidas":        "❌ Necesitas tener esa carta repetida para venderla",
      };
      showMsg(msgs[err.message] || "❌ Error al poner en venta", "error");
      if (!msgs[err.message]) console.error(err);
    }
  };

  // ── Acción: Hacer oferta ────────────────────────────────────────────────────
  const hacerOferta = async () => {
    if (!ventaSeleccionada) return;
    if (!ofertaEsValida(ventaSeleccionada.cromoRareza, cromosOferta, monedasOferta)) return;

    // Pre-check: ninguna carta ofertada puede estar en una venta activa del usuario
    const enMisVentas = new Set(misVentas.map((v) => v.cromoId));
    const cartaEnVenta = cromosOferta.find((id) => enMisVentas.has(id));
    if (cartaEnVenta) {
      const nombreCarta = getCromoInfo(cartaEnVenta)?.nombre || "esa carta";
      showMsg(`❌ "${nombreCarta}" está puesta en venta — retírala antes de ofertarla`, "error");
      return;
    }
    if (monedasOferta > monedasDisponibles) {
      showMsg(`❌ No tienes suficientes monedas (disponibles: ${monedasDisponibles}🪙)`, "error");
      return;
    }

    try {
      await runTransaction(db, async (tx) => {
        const userRef   = doc(db, "usuarios", user.uid);
        const ventaRef  = doc(db, "ventas", ventaSeleccionada.id);

        const userSnap  = await tx.get(userRef);
        const ventaSnap = await tx.get(ventaRef);

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

        const yaOferto = (ventaData.ofertas || []).some((o) => o.ofertanteId === user.uid);
        if (yaOferto) throw new Error("ya-ofert-aqui");

        const nuevaOferta = {
          ofertanteId:     user.uid,
          ofertanteNombre: misDatos.nombre || misDatos.email || "Jugador",
          cromos: cromosOferta.map((id) => {
            const inf = getCromoInfo(id);
            return { cromoId: id, nombre: inf.nombre, rareza: inf.rareza, imagen: inf.imagen };
          }),
          monedas: monedasOferta,
          fecha: new Date().toISOString(),
        };

        tx.set(userRef, {
          propuestasHoy:    freshPropuestas + 1,
          fechaUltimaOferta: HOY,
        }, { merge: true });
        tx.update(ventaRef, { ofertas: [...(ventaData.ofertas || []), nuevaOferta] });
      });

      setVentaSeleccionada(null);
      setCromosOferta([]);
      setMonedasOferta(0);
      setTab("mercado");
      showMsg("✅ Oferta enviada", "success");
      await loadData(user.uid);
    } catch (err) {
      const msgs = {
        "propuestas-agotadas": "❌ Ya has agotado tus 3 ofertas de hoy",
        "ya-intercambio-hoy":  "❌ Ya completaste un intercambio hoy",
        "sin-monedas":         "❌ No tienes suficientes monedas",
        "no-autotrade":        "❌ No puedes ofertar en tu propia venta",
        "venta-no-existe":     "❌ Esta venta ya no existe",
        "venta-expirada":      "❌ Esta venta ha caducado",
        "ya-ofert-aqui":       "❌ Ya tienes una oferta en esta venta",
      };
      showMsg(msgs[err.message] || "❌ Error al enviar la oferta", "error");
      if (!msgs[err.message]) console.error(err);
    }
  };

  // ── Acción: Guardar edición de oferta existente ────────────────────────────
  const guardarEdicionOferta = async () => {
    if (!ventaSeleccionada) return;
    if (!ofertaEsValida(ventaSeleccionada.cromoRareza, cromosOferta, monedasOferta)) return;

    const enMisVentasEd = new Set(misVentas.map((v) => v.cromoId));
    const cartaEnVentaEd = cromosOferta.find((id) => enMisVentasEd.has(id));
    if (cartaEnVentaEd) {
      const nombreCarta = getCromoInfo(cartaEnVentaEd)?.nombre || "esa carta";
      showMsg(`❌ "${nombreCarta}" está puesta en venta — retírala antes de ofertarla`, "error");
      return;
    }

    try {
      await runTransaction(db, async (tx) => {
        const userRef   = doc(db, "usuarios", user.uid);
        const ventaRef  = doc(db, "ventas", ventaSeleccionada.id);
        const userSnap  = await tx.get(userRef);
        const ventaSnap = await tx.get(ventaRef);

        if (!ventaSnap.exists()) throw new Error("venta-no-existe");
        const ventaData = ventaSnap.data();
        if (new Date() > new Date(ventaData.fechaExpiracion)) throw new Error("venta-expirada");

        // Calcular monedas disponibles excluyendo la oferta actual
        const ofertaActual = (ventaData.ofertas || []).find((o) => o.ofertanteId === user.uid);
        const monedasEnOfertasExcluida = monedasEnOfertas - (ofertaActual?.monedas || 0);
        const monedasLibres = Math.max(0, (userSnap.data()?.monedas ?? 50) - monedasEnOfertasExcluida);
        if (monedasOferta > monedasLibres) throw new Error("sin-monedas");

        const ofertaIdx = (ventaData.ofertas || []).findIndex((o) => o.ofertanteId === user.uid);
        if (ofertaIdx === -1) throw new Error("oferta-no-encontrada");
        const ofertasActualizadas = [...(ventaData.ofertas || [])];
        ofertasActualizadas[ofertaIdx] = {
          ...ofertasActualizadas[ofertaIdx],
          cromos: cromosOferta.map((id) => {
            const inf = getCromoInfo(id);
            return { cromoId: id, nombre: inf.nombre, rareza: inf.rareza, imagen: inf.imagen };
          }),
          monedas: monedasOferta,
          fechaEdicion: new Date().toISOString(),
        };

        tx.update(ventaRef, { ofertas: ofertasActualizadas });
      });

      setVentaSeleccionada(null);
      setCromosOferta([]);
      setMonedasOferta(0);
      setEstaEditando(false);
      setTab("mis-ofertas");
      showMsg("✅ Oferta actualizada", "success");
      await loadData(user.uid);
    } catch (err) {
      const msgs = {
        "venta-no-existe":       "❌ Esta venta ya no existe",
        "venta-expirada":        "❌ Esta venta ha caducado",
        "oferta-no-encontrada":  "❌ Tu oferta ya no existe en esta venta",
        "sin-monedas":           "❌ No tienes suficientes monedas disponibles",
      };
      showMsg(msgs[err.message] || "❌ Error al actualizar la oferta", "error");
      if (!msgs[err.message]) console.error(err);
    }
  };

  // ── Acción: Aceptar oferta ──────────────────────────────────────────────────
  // Intercambio atómico + cascada:
  //   1. Swap de cartas + transferencia de monedas
  //   2. Marca intercambioVentaHoy en vendedor + intercambiosOfertaHoy en ofertante
  //   3. Elimina esta venta + TODAS las otras ventas del vendedor
  //   4. Cancela las otras ofertas activas del ofertante en otras ventas
  //   5. Si el ofertante también vendía una carta que acaba de entregar → borra esa venta
  const aceptarOferta = async (oferta) => {
    try {
      await runTransaction(db, async (tx) => {
        const ventaRef     = doc(db, "ventas", ventaVerOfertas.id);
        const vendedorRef  = doc(db, "usuarios", user.uid);
        const compradorRef = doc(db, "usuarios", oferta.ofertanteId);

        const otrasVentasRefs = ventas
          .filter((v) => v.id !== ventaVerOfertas.id)
          .map((v) => doc(db, "ventas", v.id));

        const [ventaSnap, vendedorSnap, compradorSnap, ...otrasVentasSnaps] =
          await Promise.all([
            tx.get(ventaRef),
            tx.get(vendedorRef),
            tx.get(compradorRef),
            ...otrasVentasRefs.map((r) => tx.get(r)),
          ]);

        if (!ventaSnap.exists()) throw new Error("venta-no-existe");
        if (!vendedorSnap.exists() || !compradorSnap.exists()) throw new Error("usuario-no-existe");

        const ventaData     = ventaSnap.data();
        const comprDatos    = compradorSnap.data();
        const vendDatosSnap = vendedorSnap.data();

        // Bloquear si el ofertante ya completó un intercambio hoy
        const freshIntercambios = comprDatos.fechaUltimaIntercambioOferta === HOY
          ? (comprDatos.intercambiosOfertaHoy || 0) : 0;
        if (freshIntercambios >= 1) throw new Error("ofertante-ya-intercambio");

        const monedasOfertaAmount = oferta.monedas || 0;
        const coinsComprador = comprDatos.monedas ?? 50;
        const coinsVendedor  = vendDatosSnap.monedas ?? 50;
        if (monedasOfertaAmount > 0 && coinsComprador < monedasOfertaAmount)
          throw new Error("comprador-sin-monedas");

        const vendCromos  = vendDatosSnap.cromos.map((c) => ({ ...c }));
        const comprCromos = comprDatos.cromos.map((c) => ({ ...c }));

        // Verificar stock del vendedor (≥2: 1 se queda + 1 entrega)
        const vendTiene = vendCromos.find((c) => c.cromoId === ventaData.cromoId);
        if (!vendTiene || vendTiene.cantidad < 2) throw new Error("vendedor-sin-carta");

        // Verificar stock del ofertante para cada carta ofertada
        for (const c of (oferta.cromos || [])) {
          const comprTiene = comprCromos.find((x) => x.cromoId === c.cromoId);
          if (!comprTiene || comprTiene.cantidad < 2)
            throw new Error(`comprador-sin:${c.nombre}`);
        }

        // ── Ejecutar el intercambio ──────────────────────────────────────────
        // Vendedor: entrega su carta, recibe las ofertadas, recibe las monedas
        vendTiene.cantidad -= 1;
        (oferta.cromos || []).forEach((c) => {
          const ex = vendCromos.find((x) => x.cromoId === c.cromoId);
          if (ex) ex.cantidad += 1;
          else vendCromos.push({ cromoId: c.cromoId, cantidad: 1, fechaObtenido: HOY, pegado: false });
        });

        // Ofertante: entrega las cartas ofertadas, entrega las monedas, recibe la carta del vendedor
        (oferta.cromos || []).forEach((c) => {
          comprCromos.find((x) => x.cromoId === c.cromoId).cantidad -= 1;
        });
        const comprGana = comprCromos.find((x) => x.cromoId === ventaData.cromoId);
        if (comprGana) comprGana.cantidad += 1;
        else comprCromos.push({ cromoId: ventaData.cromoId, cantidad: 1, fechaObtenido: HOY, pegado: false });

        // ── Writes principales ───────────────────────────────────────────────
        tx.update(vendedorRef, {
          cromos:             vendCromos,
          monedas:            coinsVendedor + monedasOfertaAmount,
          intercambioVentaHoy: HOY,
        });
        tx.update(compradorRef, {
          cromos:                       comprCromos,
          monedas:                      coinsComprador - monedasOfertaAmount,
          intercambiosOfertaHoy:        freshIntercambios + 1,
          fechaUltimaIntercambioOferta: HOY,
        });
        tx.delete(ventaRef);

        // ── Cascada sobre otras ventas ───────────────────────────────────────
        const cardsGiven = new Set((oferta.cromos || []).map((c) => c.cromoId));

        for (let i = 0; i < otrasVentasSnaps.length; i++) {
          const snap = otrasVentasSnaps[i];
          if (!snap.exists()) continue;
          const data = snap.data();
          const ref  = otrasVentasRefs[i];

          // Caso A: el ofertante también vendía una carta que acaba de entregar → borrar
          if (data.vendedorId === oferta.ofertanteId && cardsGiven.has(data.cromoId)) {
            const cantidadTrasSwap = comprCromos.find((c) => c.cromoId === data.cromoId)?.cantidad ?? 0;
            if (cantidadTrasSwap < 2) {
              tx.delete(ref);
              continue;
            }
          }

          // Caso B: el vendedor tiene otras ventas activas → eliminarlas (intercambio hecho)
          if (data.vendedorId === user.uid) {
            tx.delete(ref);
            continue;
          }

          // Caso C: el ofertante tenía una oferta en esta otra venta → cancelarla
          const tieneOferta = (data.ofertas || []).some((o) => o.ofertanteId === oferta.ofertanteId);
          if (tieneOferta) {
            const ofertasFiltradas = (data.ofertas || []).filter((o) => o.ofertanteId !== oferta.ofertanteId);
            tx.update(ref, { ofertas: ofertasFiltradas });
          }
        }
      });

      const detalleCartas = (oferta.cromos || []).map((c) => c.nombre).join(", ");
      const detalleMon    = oferta.monedas > 0 ? ` + ${oferta.monedas}🪙` : "";
      addFeedEvent({
        type:     "intercambio",
        userName: misDatos.nombre || misDatos.email,
        details:  `🤝 Intercambió ${ventaVerOfertas.cromoNombre} con ${oferta.ofertanteNombre} a cambio de ${detalleCartas || "monedas"}${detalleMon}`,
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
          "venta-no-existe":          "❌ Esta venta ya no existe",
          "usuario-no-existe":        "❌ Usuario no encontrado",
          "vendedor-sin-carta":       "❌ Ya no tienes esa carta de sobra",
          "comprador-sin-monedas":    `❌ ${oferta.ofertanteNombre} ya no tiene esas monedas`,
          "ofertante-ya-intercambio": `❌ ${oferta.ofertanteNombre} ya completó un intercambio hoy`,
        };
        showMsg(msgs[err.message] || "❌ Error al aceptar la oferta", "error");
        if (!msgs[err.message]) console.error(err);
      }
    }
  };

  // ── Acción: Retirar venta propia ────────────────────────────────────────────
  const retirarVenta = async (ventaId) => {
    try {
      await deleteDoc(doc(db, "ventas", ventaId));
      showMsg("Carta retirada del mercado");
      await loadData(user.uid);
    } catch (err) { showMsg("❌ Error al retirar", "error"); }
  };

  // ── Acción: Cancelar mi oferta ──────────────────────────────────────────────
  const cancelarMiOferta = async (venta) => {
    try {
      await runTransaction(db, async (tx) => {
        const ventaRef  = doc(db, "ventas", venta.id);
        const ventaSnap = await tx.get(ventaRef);
        if (!ventaSnap.exists()) return;
        const ofertasFiltradas = (ventaSnap.data().ofertas || []).filter(
          (o) => o.ofertanteId !== user.uid
        );
        tx.update(ventaRef, { ofertas: ofertasFiltradas });
      });
      showMsg("Oferta cancelada");
      await loadData(user.uid);
    } catch (err) { showMsg("❌ Error al cancelar", "error"); }
  };

  // ── Acción: Ver ofertas recibidas ────────────────────────────────────────────
  const verOfertas = async (venta) => {
    try {
      const snap = await getDoc(doc(db, "ventas", venta.id));
      if (snap.exists()) setVentaVerOfertas({ id: snap.id, ...snap.data() });
      else { showMsg("Esta venta ya no existe"); await loadData(user.uid); }
    } catch (err) {
      setVentaVerOfertas(venta);
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

          {/* Pills de estado */}
          <div style={{ display: "flex", gap: "6px" }}>
            <span style={{
              fontSize: "0.68rem", fontWeight: "bold", padding: "3px 9px", borderRadius: "6px",
              background: !puedeVender ? "rgba(239,68,68,0.15)" : "rgba(16,185,129,0.15)",
              color:      !puedeVender ? "#ef4444"              : "#10b981",
            }}>
              🏷️ {intercambioVentaHoyFlag
                ? "Intercambio hecho"
                : ventasRestantes === 0
                  ? "Ventas agotadas"
                  : `${ventasRestantes} venta${ventasRestantes !== 1 ? "s" : ""} libre${ventasRestantes !== 1 ? "s" : ""}`}
            </span>
            <span style={{
              fontSize: "0.68rem", fontWeight: "bold", padding: "3px 9px", borderRadius: "6px",
              background: !puedeHacerOferta ? "rgba(239,68,68,0.15)" : "rgba(245,158,11,0.15)",
              color:      !puedeHacerOferta ? "#ef4444"               : "#f59e0b",
            }}>
              💰 {intercambiosOfertaHoyCount >= 1
                ? "Intercambio hecho"
                : ofertasRestantes === 0
                  ? "Ofertas agotadas"
                  : `${ofertasRestantes} oferta${ofertasRestantes !== 1 ? "s" : ""} libre${ofertasRestantes !== 1 ? "s" : ""}`}
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
              setVentaSeleccionada(null); setCromosOferta([]); setMonedasOferta(0); setVentaVerOfertas(null);
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

        {/* Skeleton */}
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
                    background:   esMia ? "#1e3a5f" : "#1e293b",
                    borderRadius: "16px", padding: "15px", marginBottom: "10px",
                    border: esMia ? "1px solid #3b82f6" : "1px solid #334155",
                  }}>
                    <div style={{ display: "flex", gap: "12px", alignItems: "center", marginBottom: "10px" }}>
                      <img src={venta.cromoImagen} alt="" style={{
                        width: "60px", height: "60px", borderRadius: "10px",
                        objectFit: "cover", border: `2px solid ${getBorder(venta.cromoRareza)}`, flexShrink: 0,
                      }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontWeight: "bold", fontSize: "0.9rem" }}>{venta.cromoNombre}</p>
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
                          if (!puedeHacerOferta) {
                            showMsg(intercambiosOfertaHoyCount >= 1
                              ? "❌ Ya completaste un intercambio hoy"
                              : "❌ Ya has agotado tus 3 ofertas de hoy", "error");
                            return;
                          }
                          setVentaSeleccionada(venta); setCromosOferta([]); setMonedasOferta(0);
                        }}
                        style={{
                          width: "100%", padding: "10px", borderRadius: "10px", border: "none",
                          background: !puedeHacerOferta
                            ? "#334155"
                            : "linear-gradient(135deg, #f59e0b, #d97706)",
                          color:      !puedeHacerOferta ? "#64748b" : "#000",
                          fontWeight: "bold",
                          cursor:     !puedeHacerOferta ? "not-allowed" : "pointer",
                          fontSize:   "0.85rem",
                        }}
                      >
                        {!puedeHacerOferta
                          ? (intercambiosOfertaHoyCount >= 1 ? "🔒 Intercambio hecho" : "🔒 Ofertas agotadas")
                          : `💰 Hacer oferta${ofertasRestantes < 3 ? ` (${ofertasRestantes} libre${ofertasRestantes !== 1 ? "s" : ""})` : ""}`}
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ════════════════════════════════════════
            OVERLAY: HACER / EDITAR OFERTA
        ════════════════════════════════════════ */}
        {dataLoaded && tab === "mercado" && ventaSeleccionada && (
          <div>
            <button onClick={() => {
              setVentaSeleccionada(null); setCromosOferta([]); setMonedasOferta(0); setEstaEditando(false);
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
                Mínimo con cartas: {MINIMOS[ventaSeleccionada.cromoRareza].map((m) => m.label).join(" · ")}
              </p>
            </div>

            {/* ── Monedas ── */}
            <div style={{
              background: "#1e293b", borderRadius: "14px", padding: "14px",
              marginBottom: "14px", border: "1px solid #334155",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                <p style={{ margin: 0, fontWeight: "bold", fontSize: "0.9rem" }}>🪙 Añadir monedas</p>
                <span style={{ fontSize: "0.72rem", color: "#64748b" }}>
                  Disponibles: <strong style={{ color: "#fbbf24" }}>{monedasDisponibles}🪙</strong>
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <button
                  onClick={() => setMonedasOferta((p) => Math.max(0, p - 5))}
                  style={{ width: "36px", height: "36px", borderRadius: "50%", border: "1px solid #475569", background: "#0f172a", color: "white", cursor: "pointer", fontSize: "1rem", flexShrink: 0 }}
                >−</button>
                <div style={{ flex: 1, position: "relative" }}>
                  <input
                    type="number" min="0" max={monedasDisponibles}
                    value={monedasOferta}
                    onChange={(e) => {
                      const v = Math.max(0, Math.min(monedasDisponibles, parseInt(e.target.value) || 0));
                      setMonedasOferta(v);
                    }}
                    style={{
                      width: "100%", padding: "8px 36px 8px 12px", borderRadius: "10px",
                      border: "1px solid #475569", background: "#0f172a", color: "white",
                      fontSize: "1rem", fontWeight: "bold", textAlign: "center",
                      boxSizing: "border-box",
                    }}
                  />
                  <span style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", fontSize: "0.9rem" }}>🪙</span>
                </div>
                <button
                  onClick={() => setMonedasOferta((p) => Math.min(monedasDisponibles, p + 5))}
                  style={{ width: "36px", height: "36px", borderRadius: "50%", border: "1px solid #475569", background: "#0f172a", color: "white", cursor: "pointer", fontSize: "1rem", flexShrink: 0 }}
                >+</button>
              </div>
              {monedasOferta > 0 && (
                <p style={{ margin: "8px 0 0", fontSize: "0.72rem", color: "#fbbf24", textAlign: "center" }}>
                  {monedasOferta}🪙 quedarán reservadas hasta que resuelva la oferta
                </p>
              )}
            </div>

            {/* Grid de repetidos */}
            <p style={{ fontSize: "0.9rem", fontWeight: "bold", marginBottom: "4px" }}>
              Elige cartas para ofrecer: <span style={{ fontSize: "0.75rem", fontWeight: "normal", color: "#64748b" }}>(opcional si incluyes monedas)</span>
            </p>
            <p style={{ fontSize: "0.75rem", color: "#64748b", marginBottom: "12px" }}>
              Solo tus cartas repetidas · puedes superar el mínimo
            </p>

            {getMisRepetidos().length === 0 && monedasOferta === 0 ? (
              <p style={{ color: "#64748b", textAlign: "center", padding: "20px" }}>
                No tienes cartas repetidas disponibles. Añade monedas para ofertar.
              </p>
            ) : vendedorCargando ? (
              <div style={{ textAlign: "center", padding: "20px", color: "#64748b", fontSize: "0.85rem" }}>
                Cargando inventario del vendedor…
              </div>
            ) : getMisRepetidos().length > 0 ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px", marginBottom: "16px" }}>
                {getMisRepetidos().map((cromo) => {
                  const sel = cromosOferta.includes(cromo.cromoId);
                  const vendCantidad = vendedorCromos
                    ? (vendedorCromos.find((c) => c.cromoId === cromo.cromoId)?.cantidad || 0)
                    : null;
                  const badge = vendedorCromos === null ? null
                    : vendCantidad === 0
                      ? { label: "✨ Le interesa", bg: "#065f46", color: "#6ee7b7" }
                      : vendCantidad === 1
                        ? { label: "Ya la tiene",  bg: "#1e293b", color: "#64748b" }
                        : { label: "Le sobra",      bg: "#451a03", color: "#fcd34d" };
                  return (
                    <div key={cromo.cromoId} onClick={() => toggleOferta(cromo.cromoId)} style={{
                      borderRadius: "12px", overflow: "hidden", cursor: "pointer", position: "relative",
                      border:    sel ? "3px solid #10b981" : `2px solid ${getBorder(cromo.info.rareza)}`,
                      opacity:   sel ? 1 : (vendCantidad > 0 ? 0.55 : 0.85),
                      transform: sel ? "scale(1.05)" : "scale(1)",
                      transition: "all 0.2s",
                    }}>
                      <img src={cromo.info.imagen} alt="" style={{ width: "100%", aspectRatio: "1", objectFit: "cover" }} />
                      {badge && !sel && (
                        <div style={{
                          position: "absolute", top: "4px", left: "4px", right: "4px",
                          background: badge.bg, color: badge.color,
                          fontSize: "0.48rem", fontWeight: "bold",
                          padding: "2px 4px", borderRadius: "4px",
                          textAlign: "center", letterSpacing: "0.3px",
                        }}>{badge.label}</div>
                      )}
                      {sel && (
                        <div style={{
                          position: "absolute", inset: 0, background: "rgba(16,185,129,0.2)",
                          display: "flex", justifyContent: "center", alignItems: "center", fontSize: "1.5rem",
                        }}>✅</div>
                      )}
                      <div style={{ padding: "3px", textAlign: "center", background: "rgba(0,0,0,0.65)", fontSize: "0.5rem" }}>
                        {cromo.info.nombre} <span style={{ color: "#94a3b8" }}>x{cromo.sobrantes}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}

            {/* Resumen */}
            <div style={{
              background: "#1e293b", borderRadius: "12px", padding: "12px",
              marginBottom: "15px", textAlign: "center",
            }}>
              <p style={{ fontSize: "0.8rem", color: "#94a3b8", marginBottom: "4px" }}>
                Tu oferta: {cromosOferta.length > 0 ? `${cromosOferta.length} carta${cromosOferta.length !== 1 ? "s" : ""}` : "sin cartas"}
                {monedasOferta > 0 && ` + ${monedasOferta}🪙`}
              </p>
              <p style={{
                fontSize: "0.78rem",
                color: ofertaEsValida(ventaSeleccionada.cromoRareza, cromosOferta, monedasOferta) ? "#10b981" : "#ef4444",
              }}>
                {ofertaEsValida(ventaSeleccionada.cromoRareza, cromosOferta, monedasOferta)
                  ? "✅ Oferta válida"
                  : "❌ Añade cartas (mínimo) o monedas para poder enviar"}
              </p>
            </div>

            <button
              onClick={estaEditando ? guardarEdicionOferta : hacerOferta}
              disabled={!ofertaEsValida(ventaSeleccionada?.cromoRareza, cromosOferta, monedasOferta)}
              style={{
                width: "100%", padding: "15px", borderRadius: "14px", border: "none",
                background: ofertaEsValida(ventaSeleccionada?.cromoRareza, cromosOferta, monedasOferta)
                  ? estaEditando
                    ? "linear-gradient(135deg, #3b82f6, #2563eb)"
                    : "linear-gradient(135deg, #10b981, #059669)"
                  : "#334155",
                color:  ofertaEsValida(ventaSeleccionada?.cromoRareza, cromosOferta, monedasOferta) ? "white" : "#64748b",
                fontSize: "1rem", fontWeight: "bold",
                cursor: ofertaEsValida(ventaSeleccionada?.cromoRareza, cromosOferta, monedasOferta) ? "pointer" : "not-allowed",
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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "5px" }}>
              <h2 style={{ fontSize: "1.1rem", margin: 0 }}>📦 Poner cartas a la venta</h2>
              <span style={{ fontSize: "0.75rem", color: puedeVender ? "#10b981" : "#64748b" }}>
                {intercambioVentaHoyFlag ? "Intercambio hecho hoy" : `${ventasRestantes}/3 disponibles`}
              </span>
            </div>
            <p style={{ fontSize: "0.8rem", color: "#64748b", marginBottom: "16px" }}>
              Hasta 3 cartas/día · 24h de vida · Al aceptar una oferta, las demás se retiran
            </p>

            {/* Ventas activas propias */}
            {misVentas.length > 0 && (
              <div style={{ marginBottom: "16px" }}>
                {misVentas.map((v) => (
                  <div key={v.id} style={{
                    display: "flex", alignItems: "center", gap: "10px",
                    background: "#1e3a5f", borderRadius: "12px", padding: "10px 12px",
                    border: "1px solid #3b82f6", marginBottom: "8px",
                  }}>
                    <img src={v.cromoImagen} alt="" style={{
                      width: "44px", height: "44px", borderRadius: "8px",
                      objectFit: "cover", border: `2px solid ${getBorder(v.cromoRareza)}`, flexShrink: 0,
                    }} />
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontSize: "0.85rem", fontWeight: "bold" }}>{v.cromoNombre}</p>
                      <p style={{ margin: "2px 0 0", fontSize: "0.7rem", color: "#94a3b8" }}>
                        🔥 {(v.ofertas || []).length} oferta{(v.ofertas || []).length !== 1 ? "s" : ""}
                        {" · "}⏰ {horasRestantes(v.fechaExpiracion)}h
                      </p>
                    </div>
                    <button onClick={() => verOfertas(v)} style={{
                      padding: "6px 10px", borderRadius: "8px", border: "none",
                      background: (v.ofertas || []).length > 0 ? "#10b981" : "#334155",
                      color: "white", cursor: "pointer", fontSize: "0.72rem", fontWeight: "bold",
                    }}>
                      {(v.ofertas || []).length > 0 ? `📥 ${(v.ofertas || []).length}` : "📥"}
                    </button>
                    <button onClick={() => retirarVenta(v.id)} style={{
                      padding: "6px 10px", borderRadius: "8px",
                      border: "1px solid #475569", background: "transparent",
                      color: "#64748b", cursor: "pointer", fontSize: "0.75rem",
                    }}>🗑️</button>
                  </div>
                ))}
              </div>
            )}

            {/* Bloqueo */}
            {!puedeVender ? (
              <div style={{ textAlign: "center", padding: "20px 0", color: "#64748b" }}>
                <p style={{ fontSize: "2rem", marginBottom: "10px" }}>🔒</p>
                <p>{intercambioVentaHoyFlag
                  ? "Ya completaste un intercambio hoy como vendedor"
                  : "Ya has usado tus 3 slots de venta de hoy"}</p>
              </div>
            ) : getMisRepetidos().length === 0 ? (
              <div style={{ textAlign: "center", padding: "20px", color: "#64748b" }}>
                <p style={{ fontSize: "2rem", marginBottom: "10px" }}>📦</p>
                <p>No tienes cartas repetidas para vender</p>
              </div>
            ) : (
              <>
                <p style={{ fontSize: "0.85rem", color: "#94a3b8", marginBottom: "12px" }}>
                  Elige una carta para poner a la venta:
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px", marginBottom: "20px" }}>
                  {getMisRepetidos().map((cromo) => {
                    const sel = cromoAVender === cromo.cromoId;
                    const yaEnVenta = misVentas.some((v) => v.cromoId === cromo.cromoId);
                    if (yaEnVenta) return null;
                    return (
                      <div key={cromo.cromoId}
                        onClick={() => setCromoAVender(sel ? null : cromo.cromoId)}
                        style={{
                          borderRadius: "12px", overflow: "hidden", cursor: "pointer", position: "relative",
                          border:    sel ? "3px solid #f59e0b" : `2px solid ${getBorder(cromo.info.rareza)}`,
                          transform: sel ? "scale(1.05)" : "scale(1)",
                          transition: "all 0.2s",
                        }}
                      >
                        <img src={cromo.info.imagen} alt="" style={{ width: "100%", aspectRatio: "1", objectFit: "cover" }} />
                        {sel && (
                          <div style={{
                            position: "absolute", inset: 0, background: "rgba(245,158,11,0.2)",
                            display: "flex", justifyContent: "center", alignItems: "center", fontSize: "1.5rem",
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
              <h2 style={{ fontSize: "1.1rem", marginBottom: "15px" }}>
                💰 Mis ofertas activas{misOfertas.length > 0 && ` (${misOfertas.length})`}
                <span style={{ fontSize: "0.7rem", color: "#64748b", fontWeight: "normal", marginLeft: "8px" }}>
                  {propuestasHoyCount}/3 usadas
                </span>
              </h2>
              {misOfertas.length === 0 ? (
                <div style={{ textAlign: "center", padding: "20px 0", color: "#64748b", marginBottom: "20px" }}>
                  <p style={{ fontSize: "1.8rem", marginBottom: "8px" }}>💰</p>
                  <p>
                    {intercambiosOfertaHoyCount >= 1
                      ? "Ya completaste tu intercambio de hoy"
                      : propuestasHoyCount > 0
                        ? "Tus ofertas están pendientes o caducaron"
                        : "No has hecho ninguna oferta hoy"}
                  </p>
                </div>
              ) : (
                misOfertas.map(({ venta, oferta }) => (
                  <div key={venta.id} style={{
                    background: "#1e293b", borderRadius: "16px", padding: "15px", marginBottom: "12px",
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
                      Ofreces:{" "}
                      {(oferta.cromos || []).length > 0
                        ? oferta.cromos.map((c) => c.nombre).join(", ")
                        : "solo monedas"}
                      {oferta.monedas > 0 && ` + ${oferta.monedas}🪙`}
                    </p>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button
                        onClick={() => {
                          setVentaSeleccionada(venta);
                          setCromosOferta(oferta.cromos.map((c) => c.cromoId));
                          setMonedasOferta(oferta.monedas || 0);
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

              {/* Mis ventas activas */}
              {misVentas.length > 0 && (
                <>
                  <h2 style={{ fontSize: "1.1rem", marginTop: "10px", marginBottom: "15px" }}>
                    🏷️ Mis cartas en venta
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
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.87)", zIndex: 100,
            display: "flex", flexDirection: "column", padding: "20px", overflowY: "auto",
            animation: "fadeInUp 0.3s",
          }}>
            <button onClick={() => setVentaVerOfertas(null)} style={{
              padding: "8px 16px", borderRadius: "10px", border: "1px solid #475569",
              background: "transparent", color: "#94a3b8", cursor: "pointer",
              alignSelf: "flex-start", marginBottom: "15px",
            }}>← Cerrar</button>

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
                  background: "#1e293b", borderRadius: "16px", padding: "15px", marginBottom: "12px",
                }}>
                  <p style={{ fontWeight: "bold", fontSize: "0.9rem", marginBottom: "10px" }}>
                    {oferta.ofertanteNombre} ofrece:
                  </p>

                  {/* Monedas */}
                  {oferta.monedas > 0 && (
                    <div style={{
                      background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.3)",
                      borderRadius: "10px", padding: "8px 14px", marginBottom: "10px",
                      display: "flex", alignItems: "center", gap: "8px",
                    }}>
                      <span style={{ fontSize: "1.3rem" }}>🪙</span>
                      <span style={{ fontWeight: "bold", color: "#fbbf24", fontSize: "1rem" }}>
                        {oferta.monedas} monedas
                      </span>
                    </div>
                  )}

                  {/* Cartas */}
                  {(oferta.cromos || []).length > 0 && (
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
                  )}

                  {(oferta.cromos || []).length === 0 && oferta.monedas > 0 && (
                    <p style={{ fontSize: "0.75rem", color: "#64748b", marginBottom: "12px" }}>
                      Solo monedas, sin cartas
                    </p>
                  )}

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
