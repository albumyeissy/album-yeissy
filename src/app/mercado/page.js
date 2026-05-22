"use client";
import { useState, useEffect } from "react";
import { auth, db } from "../../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  doc, getDoc, setDoc, collection, getDocs,
  addDoc, updateDoc, deleteDoc, writeBatch
} from "firebase/firestore";
import { useRouter } from "next/navigation";
import { CROMOS } from "../../data/cromos";
import { addFeedEvent } from "../../lib/feedHelper";

const MINIMOS = {
  legendaria: [
    { rarezas: { comun: 3 }, label: "3 Comunes 📄" },
    { rarezas: { rara: 2 }, label: "2 Raras 💎" },
    { rarezas: { legendaria: 1 }, label: "1 Legendaria ⭐" },
  ],
  rara: [
    { rarezas: { comun: 2 }, label: "2 Comunes 📄" },
    { rarezas: { rara: 1 }, label: "1 Rara 💎" },
  ],
  comun: [
    { rarezas: { comun: 1 }, label: "1 Común 📄" },
  ],
};

export default function MercadoPage() {
  const [user, setUser] = useState(null);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [tab, setTab] = useState("mercado");
  const [misDatos, setMisDatos] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [ventas, setVentas] = useState([]);
  const [mensaje, setMensaje] = useState("");
  const [mensajeTipo, setMensajeTipo] = useState("");

  // Vender
  const [cromoAVender, setCromoAVender] = useState(null);

  // Ofertar
  const [ventaSeleccionada, setVentaSeleccionada] = useState(null);
  const [cromosOferta, setCromosOferta] = useState([]);

  // Ver ofertas (vendedor)
  const [ventaVerOfertas, setVentaVerOfertas] = useState(null);
  const [ofertasDeVenta, setOfertasDeVenta] = useState([]);

  // Historial
  const [historial, setHistorial] = useState([]);
  const [historialLoaded, setHistorialLoaded] = useState(false);

  const router = useRouter();
  const HOY = new Date().toISOString().split("T")[0];

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        await loadData(u.uid);
      } else { router.push("/"); }
    });
    return () => unsub();
  }, [router]);

  const loadData = async (uid) => {
    try {
      const [usersSnap, ventasSnap] = await Promise.all([
        getDocs(collection(db, "usuarios")),
        getDocs(collection(db, "ventas")),
      ]);
      const users = [];
      usersSnap.forEach((d) => users.push({ uid: d.id, ...d.data() }));
      setAllUsers(users);
      setMisDatos(users.find((u) => u.uid === uid) || { cromos: [] });

      const v = [];
      ventasSnap.forEach((d) => {
        const data = { id: d.id, ...d.data() };
        if (!isExpired(data)) v.push(data);
      });
      setVentas(v);
    } catch (err) { console.error(err); }
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

  const timeAgo = (timestamp) => {
    const diff = Date.now() - new Date(timestamp).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "ahora mismo";
    if (mins < 60) return `hace ${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `hace ${hours}h`;
    const days = Math.floor(hours / 24);
    return `hace ${days}d`;
  };

  const showMsg = (text, tipo = "") => {
    setMensaje(text); setMensajeTipo(tipo);
    setTimeout(() => setMensaje(""), 4000);
  };

  const isExpired = (venta) => {
    if (!venta.fechaExpiracion) return false;
    return new Date() > new Date(venta.fechaExpiracion);
  };

  // === HELPERS ===
  const getCromoInfo = (id) => CROMOS.find((c) => c.id === id);
  const getBorderColor = (r) => r === "legendaria" ? "#fbbf24" : r === "rara" ? "#3b82f6" : "#64748b";
  const getRarezaLabel = (r) => r === "legendaria" ? "⭐" : r === "rara" ? "💎" : "";

  const tieneCromo = (cromoId) =>
    misDatos?.cromos?.some((c) => c.cromoId === cromoId && c.cantidad > 0) ?? false;

  const getMisRepetidos = () => {
    if (!misDatos?.cromos) return [];
    return misDatos.cromos
      .filter((c) => c.cantidad > 1)
      .map((c) => ({ ...c, info: getCromoInfo(c.cromoId), sobrantes: c.cantidad - 1 }))
      .filter((c) => c.info);
  };

  const getMisRepetidosPorRareza = (rareza) => {
    return getMisRepetidos().filter((c) => c.info.rareza === rareza);
  };

  const ventasHoy = ventas.filter((v) => v.vendedorId === user?.uid && v.fechaCreacion?.startsWith(HOY)).length;
  const ofertasHoy = () => {
    let count = 0;
    ventas.forEach((v) => {
      (v.ofertas || []).forEach((o) => {
        if (o.ofertanteId === user?.uid && o.fecha?.startsWith(HOY)) count++;
      });
    });
    return count;
  };

  const misVentas = ventas.filter((v) => v.vendedorId === user?.uid);

  const cumpleMinimoOferta = (rarezaProducto, cromosSeleccionados) => {
    if (cromosSeleccionados.length === 0) return false;
    const mins = MINIMOS[rarezaProducto];
    const conteo = {};
    cromosSeleccionados.forEach((id) => {
      const info = getCromoInfo(id);
      if (info) conteo[info.rareza] = (conteo[info.rareza] || 0) + 1;
    });

    return mins.some((min) => {
      return Object.entries(min.rarezas).every(([rareza, cantidad]) => {
        return (conteo[rareza] || 0) >= cantidad;
      });
    });
  };

  const toggleCromoOferta = (cromoId) => {
    setCromosOferta((prev) => {
      if (prev.includes(cromoId)) return prev.filter((id) => id !== cromoId);
      return [...prev, cromoId];
    });
  };

  // === ACCIONES ===
  const ponerEnVenta = async () => {
    if (!cromoAVender) return;
    if (ventasHoy >= 1) {
      showMsg("❌ Ya has puesto 1 carta a la venta hoy", "error");
      return;
    }
    const info = getCromoInfo(cromoAVender);
    if (!info) return;

    try {
      const now = new Date();
      const exp = new Date(now.getTime() + 48 * 60 * 60 * 1000);
      await addDoc(collection(db, "ventas"), {
        vendedorId: user.uid,
        vendedorNombre: misDatos.nombre || misDatos.email,
        cromoId: cromoAVender,
        cromoNombre: info.nombre,
        cromoRareza: info.rareza,
        cromoImagen: info.imagen,
        ofertas: [],
        fechaCreacion: now.toISOString(),
        fechaExpiracion: exp.toISOString(),
      });
      setCromoAVender(null);
      setTab("mercado");
      showMsg("✅ Carta puesta a la venta", "success");
      await loadData(user.uid);
    } catch (err) { showMsg("❌ Error", "error"); }
  };

  const hacerOferta = async () => {
    if (!ventaSeleccionada || cromosOferta.length === 0) return;
    if (ofertasHoy() >= 2) {
      showMsg("❌ Ya has hecho 2 ofertas hoy", "error");
      return;
    }

    const venta = ventas.find((v) => v.id === ventaSeleccionada.id);
    if (!venta) return;

    if (!cumpleMinimoOferta(venta.cromoRareza, cromosOferta)) {
      showMsg("❌ No cumples el mínimo requerido", "error");
      return;
    }

    try {
      const ofertasCromos = cromosOferta.map((id) => {
        const info = getCromoInfo(id);
        return { cromoId: id, nombre: info.nombre, rareza: info.rareza, imagen: info.imagen };
      });

      const nuevaOferta = {
        ofertanteId: user.uid,
        ofertanteNombre: misDatos.nombre || misDatos.email,
        cromos: ofertasCromos,
        fecha: new Date().toISOString(),
        estado: "pendiente",
      };

      const ofertasActuales = venta.ofertas || [];
      await updateDoc(doc(db, "ventas", venta.id), {
        ofertas: [...ofertasActuales, nuevaOferta],
      });

      setVentaSeleccionada(null);
      setCromosOferta([]);
      setTab("mercado");
      showMsg("✅ Oferta enviada", "success");
      await loadData(user.uid);
    } catch (err) { showMsg("❌ Error", "error"); }
  };

  const aceptarOferta = async (venta, ofertaIndex) => {
    try {
      const oferta = venta.ofertas[ofertaIndex];
      const vendedorRef = doc(db, "usuarios", venta.vendedorId);
      const compRef = doc(db, "usuarios", oferta.ofertanteId);
      const [vendSnap, compSnap] = await Promise.all([getDoc(vendedorRef), getDoc(compRef)]);
      if (!vendSnap.exists() || !compSnap.exists()) {
        showMsg("❌ Usuario no encontrado", "error");
        return;
      }

      const vendCromos = [...vendSnap.data().cromos];
      const compCromos = [...compSnap.data().cromos];

      // Verificar que vendedor aún tiene el cromo
      const vendCromo = vendCromos.find((c) => c.cromoId === venta.cromoId);
      if (!vendCromo || vendCromo.cantidad < 2) {
        showMsg("❌ Ya no tienes esa carta de sobra", "error");
        return;
      }

      // Verificar que comprador aún tiene los cromos ofertados
      for (const c of oferta.cromos) {
        const comp = compCromos.find((x) => x.cromoId === c.cromoId);
        if (!comp || comp.cantidad < 2) {
          showMsg(`❌ ${oferta.ofertanteNombre} ya no tiene ${c.nombre} de sobra`, "error");
          return;
        }
      }

      // Ejecutar intercambio
      // Vendedor pierde su carta, gana las ofertadas
      vendCromo.cantidad -= 1;
      oferta.cromos.forEach((c) => {
        const existing = vendCromos.find((x) => x.cromoId === c.cromoId);
        if (existing) existing.cantidad += 1;
        else vendCromos.push({ cromoId: c.cromoId, cantidad: 1, fechaObtenido: HOY, pegado: false });
      });

      // Comprador pierde sus cartas, gana la del vendedor
      oferta.cromos.forEach((c) => {
        compCromos.find((x) => x.cromoId === c.cromoId).cantidad -= 1;
      });
      const compGain = compCromos.find((x) => x.cromoId === venta.cromoId);
      if (compGain) compGain.cantidad += 1;
      else compCromos.push({ cromoId: venta.cromoId, cantidad: 1, fechaObtenido: HOY, pegado: false });

      const batch = writeBatch(db);
      batch.update(vendedorRef, { cromos: vendCromos });
      batch.update(compRef, { cromos: compCromos });
      batch.delete(doc(db, "ventas", venta.id));
      await batch.commit();

      addFeedEvent({
        type: "intercambio",
        userName: venta.vendedorNombre,
        details: `🤝 Intercambió ${venta.cromoNombre} con ${oferta.ofertanteNombre} a cambio de ${oferta.cromos.map((c) => c.nombre).join(", ")}`,
      });

      setVentaVerOfertas(null);
      setOfertasDeVenta([]);
      showMsg("🎉 ¡Intercambio completado!", "success");
      await loadData(user.uid);
    } catch (err) { showMsg("❌ Error", "error"); }
  };

  const retirarVenta = async (ventaId) => {
    try {
      await deleteDoc(doc(db, "ventas", ventaId));
      showMsg("Carta retirada de la venta");
      await loadData(user.uid);
    } catch (err) { showMsg("❌ Error", "error"); }
  };

  const cancelarOferta = async (venta, ofertaIndex) => {
    try {
      const ofertas = [...venta.ofertas];
      ofertas.splice(ofertaIndex, 1);
      await updateDoc(doc(db, "ventas", venta.id), { ofertas });
      showMsg("Oferta cancelada");
      await loadData(user.uid);
    } catch (err) { showMsg("❌ Error", "error"); }
  };

  const verOfertas = async (venta) => {
    try {
      const snap = await getDoc(doc(db, "ventas", venta.id));
      if (snap.exists()) {
        const fresh = { id: snap.id, ...snap.data() };
        setVentaVerOfertas(fresh);
        setOfertasDeVenta(fresh.ofertas || []);
      } else {
        showMsg("Esta venta ya no está disponible");
        await loadData(user.uid);
      }
    } catch (err) {
      setVentaVerOfertas(venta);
      setOfertasDeVenta(venta.ofertas || []);
    }
  };

  // === RENDER ===
  const ventaCromoInfo = ventaSeleccionada ? getCromoInfo(ventaSeleccionada.cromoId) : null;

  return (
    <div style={{ minHeight: "100vh", background: "#0f172a" }}>
      <style>{`
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        @keyframes fadeInUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `}</style>

      {/* HEADER */}
      <div style={{ background: "#1e293b", padding: "12px 15px", borderBottom: "1px solid #334155" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
          <button onClick={() => router.push("/album")} style={{
            padding: "6px 14px", borderRadius: "8px", border: "1px solid #475569",
            background: "transparent", color: "#94a3b8", cursor: "pointer", fontSize: "0.85rem"
          }}>← Álbum</button>
          <div style={{ display: "flex", gap: "12px", fontSize: "0.75rem", color: "#64748b" }}>
            <span>🏷️ {ventasHoy}/1 ventas</span>
            <span>💰 {ofertasHoy()}/2 ofertas</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: "4px" }}>
          {[
            { id: "mercado", label: "🏷️ Mercado" },
            { id: "vender", label: "📦 Vender" },
            { id: "mis-ofertas", label: "📤 Mis ofertas" },
            { id: "historial", label: "📜" },
          ].map((t) => (
            <button key={t.id} onClick={() => { setTab(t.id); setVentaSeleccionada(null); setCromosOferta([]); setVentaVerOfertas(null); }}
              style={{
                flex: t.id === "historial" ? "none" : 1, padding: "8px 10px", borderRadius: "10px",
                border: "none", background: tab === t.id ? "#3b82f6" : "transparent",
                color: tab === t.id ? "white" : "#94a3b8", cursor: "pointer",
                fontSize: "0.8rem", fontWeight: tab === t.id ? "bold" : "normal"
              }}
            >{t.label}</button>
          ))}
        </div>
      </div>

      {mensaje && (
        <div style={{
          margin: "10px 15px 0", padding: "10px 15px", borderRadius: "10px",
          background: mensajeTipo === "success" ? "#064e3b" : mensajeTipo === "error" ? "#7f1d1d" : "#334155",
          fontSize: "0.85rem", textAlign: "center", animation: "fadeInUp 0.3s"
        }}>{mensaje}</div>
      )}

      <div style={{ padding: "15px" }}>
        {!dataLoaded && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {[1, 2, 3].map((i) => (
              <div key={i} style={{ height: "80px", borderRadius: "16px", background: "linear-gradient(90deg, #1e293b 25%, #334155 50%, #1e293b 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite" }} />
            ))}
          </div>
        )}

        {/* ============= MERCADO ============= */}
        {dataLoaded && tab === "mercado" && !ventaSeleccionada && (
          <div>
            {ventas.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 20px", color: "#64748b" }}>
                <p style={{ fontSize: "2.5rem", marginBottom: "10px" }}>🏷️</p>
                <p>No hay cartas a la venta</p>
                <p style={{ fontSize: "0.85rem" }}>¡Sé el primero en poner una!</p>
              </div>
            ) : (
              ventas.map((venta) => {
                const esMia = venta.vendedorId === user?.uid;
                const horas = Math.max(0, Math.round((new Date(venta.fechaExpiracion) - new Date()) / 3600000));
                const numOfertas = (venta.ofertas || []).length;

                return (
                  <div key={venta.id} style={{
                    background: esMia ? "#1e3a5f" : "#1e293b", borderRadius: "16px",
                    padding: "15px", marginBottom: "10px",
                    border: esMia ? "1px solid #3b82f6" : "1px solid #334155",
                  }}>
                    <div style={{ display: "flex", gap: "12px", alignItems: "center", marginBottom: "10px" }}>
                      <img src={venta.cromoImagen} alt="" style={{
                        width: "60px", height: "60px", borderRadius: "10px",
                        objectFit: "cover", border: `2px solid ${getBorderColor(venta.cromoRareza)}`
                      }} />
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: 0, fontWeight: "bold", fontSize: "0.9rem" }}>
                          {venta.cromoNombre}
                        </p>
                        <p style={{ margin: "2px 0 0", fontSize: "0.75rem", color: "#94a3b8" }}>
                          {getRarezaLabel(venta.cromoRareza)} {venta.cromoRareza} · de {venta.vendedorNombre}
                        </p>
                        <div style={{ display: "flex", gap: "10px", marginTop: "4px" }}>
                          <span style={{ fontSize: "0.7rem", color: "#64748b" }}>
                            🔥 {numOfertas} oferta{numOfertas !== 1 ? "s" : ""}
                          </span>
                          <span style={{ fontSize: "0.7rem", color: "#64748b" }}>
                            ⏰ {horas}h
                          </span>
                        </div>
                      </div>
                    </div>

                    {esMia ? (
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button onClick={() => verOfertas(venta)} style={{
                          flex: 1, padding: "10px", borderRadius: "10px", border: "none",
                          background: numOfertas > 0 ? "#10b981" : "#334155",
                          color: "white", fontWeight: "bold", cursor: "pointer", fontSize: "0.8rem"
                        }}>
                          {numOfertas > 0 ? `📥 Ver ${numOfertas} oferta${numOfertas !== 1 ? "s" : ""}` : "Sin ofertas"}
                        </button>
                        <button onClick={() => retirarVenta(venta.id)} style={{
                          padding: "10px 14px", borderRadius: "10px", border: "1px solid #334155",
                          background: "transparent", color: "#64748b", cursor: "pointer", fontSize: "0.8rem"
                        }}>🗑️</button>
                      </div>
                    ) : (
                      <button onClick={() => { setVentaSeleccionada(venta); setCromosOferta([]); }} style={{
                        width: "100%", padding: "10px", borderRadius: "10px", border: "none",
                        background: "linear-gradient(135deg, #f59e0b, #d97706)",
                        color: "#000", fontWeight: "bold", cursor: "pointer", fontSize: "0.85rem"
                      }}>
                        💰 Hacer oferta
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ============= HACER OFERTA ============= */}
        {dataLoaded && tab === "mercado" && ventaSeleccionada && (
          <div>
            <button onClick={() => { setVentaSeleccionada(null); setCromosOferta([]); }} style={{
              padding: "6px 14px", borderRadius: "8px", border: "1px solid #475569",
              background: "transparent", color: "#94a3b8", cursor: "pointer",
              marginBottom: "15px", fontSize: "0.85rem"
            }}>← Volver</button>

            {/* Carta que quieres */}
            <div style={{
              background: "#1e293b", borderRadius: "16px", padding: "20px",
              textAlign: "center", marginBottom: "15px",
              border: `2px solid ${getBorderColor(ventaSeleccionada.cromoRareza)}`
            }}>
              <p style={{ fontSize: "0.8rem", color: "#94a3b8", marginBottom: "10px" }}>
                Quieres comprar de {ventaSeleccionada.vendedorNombre}:
              </p>
              <img src={ventaSeleccionada.cromoImagen} alt="" style={{
                width: "80px", height: "80px", borderRadius: "12px", objectFit: "cover",
                border: `3px solid ${getBorderColor(ventaSeleccionada.cromoRareza)}`
              }} />
              <p style={{ fontWeight: "bold", marginTop: "8px", fontSize: "0.9rem" }}>
                {ventaSeleccionada.cromoNombre}
              </p>
              <p style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                Mínimo: {MINIMOS[ventaSeleccionada.cromoRareza].map((m) => m.label).join(" o ")}
              </p>
            </div>

            {/* Seleccionar cromos para ofrecer */}
            <p style={{ fontSize: "0.9rem", fontWeight: "bold", marginBottom: "5px" }}>
              Elige cartas para ofrecer:
            </p>
            <p style={{ fontSize: "0.75rem", color: "#64748b", marginBottom: "10px" }}>
              Puedes superar el mínimo para hacer una oferta más atractiva
            </p>

            {getMisRepetidos().length === 0 ? (
              <p style={{ color: "#64748b", textAlign: "center", padding: "20px" }}>
                No tienes cromos repetidos para ofrecer
              </p>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px", marginBottom: "20px" }}>
                {getMisRepetidos().map((cromo) => {
                  const isSelected = cromosOferta.includes(cromo.cromoId);
                  return (
                    <div key={cromo.cromoId} onClick={() => toggleCromoOferta(cromo.cromoId)}
                      style={{
                        borderRadius: "12px", overflow: "hidden", cursor: "pointer",
                        position: "relative",
                        border: isSelected ? "3px solid #10b981" : `2px solid ${getBorderColor(cromo.info.rareza)}`,
                        opacity: isSelected ? 1 : 0.7,
                        transform: isSelected ? "scale(1.05)" : "scale(1)",
                        transition: "all 0.2s"
                      }}
                    >
                      <img src={cromo.info.imagen} alt="" style={{
                        width: "100%", aspectRatio: "1", objectFit: "cover"
                      }} />
                      {isSelected && (
                        <div style={{
                          position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
                          background: "rgba(16,185,129,0.2)",
                          display: "flex", justifyContent: "center", alignItems: "center",
                          fontSize: "1.5rem"
                        }}>✅</div>
                      )}
                      <div style={{
                        padding: "3px", textAlign: "center",
                        background: "rgba(0,0,0,0.6)", fontSize: "0.5rem"
                      }}>
                        {cromo.info.nombre} <span style={{ color: "#94a3b8" }}>x{cromo.sobrantes}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Resumen oferta */}
            {cromosOferta.length > 0 && (
              <div style={{
                background: "#1e293b", borderRadius: "12px", padding: "12px",
                marginBottom: "15px", textAlign: "center"
              }}>
                <p style={{ fontSize: "0.8rem", color: "#94a3b8", marginBottom: "5px" }}>
                  Tu oferta: {cromosOferta.length} carta{cromosOferta.length !== 1 ? "s" : ""}
                </p>
                <p style={{
                  fontSize: "0.75rem",
                  color: cumpleMinimoOferta(ventaSeleccionada.cromoRareza, cromosOferta) ? "#10b981" : "#ef4444"
                }}>
                  {cumpleMinimoOferta(ventaSeleccionada.cromoRareza, cromosOferta)
                    ? "✅ Cumple el mínimo"
                    : "❌ No cumple el mínimo"}
                </p>
              </div>
            )}

            <button
              onClick={hacerOferta}
              disabled={!cumpleMinimoOferta(ventaSeleccionada?.cromoRareza, cromosOferta)}
              style={{
                width: "100%", padding: "15px", borderRadius: "14px", border: "none",
                background: cumpleMinimoOferta(ventaSeleccionada?.cromoRareza, cromosOferta)
                  ? "linear-gradient(135deg, #10b981, #059669)" : "#334155",
                color: cumpleMinimoOferta(ventaSeleccionada?.cromoRareza, cromosOferta) ? "white" : "#64748b",
                fontSize: "1rem", fontWeight: "bold",
                cursor: cumpleMinimoOferta(ventaSeleccionada?.cromoRareza, cromosOferta) ? "pointer" : "not-allowed",
              }}
            >
              📤 Enviar oferta
            </button>
          </div>
        )}

        {/* ============= VER OFERTAS (VENDEDOR) ============= */}
        {ventaVerOfertas && (
          <div style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(0,0,0,0.85)", zIndex: 100,
            display: "flex", flexDirection: "column",
            padding: "20px", overflowY: "auto",
            animation: "fadeInUp 0.3s"
          }}>
            <button onClick={() => setVentaVerOfertas(null)} style={{
              padding: "8px 16px", borderRadius: "10px", border: "1px solid #475569",
              background: "transparent", color: "#94a3b8", cursor: "pointer",
              alignSelf: "flex-start", marginBottom: "15px"
            }}>← Cerrar</button>

            <div style={{ textAlign: "center", marginBottom: "20px" }}>
              <img src={ventaVerOfertas.cromoImagen} alt="" style={{
                width: "70px", height: "70px", borderRadius: "12px", objectFit: "cover",
                border: `3px solid ${getBorderColor(ventaVerOfertas.cromoRareza)}`
              }} />
              <p style={{ fontWeight: "bold", marginTop: "8px" }}>{ventaVerOfertas.cromoNombre}</p>
            </div>

            <h3 style={{ fontSize: "1rem", marginBottom: "15px" }}>
              📥 {ofertasDeVenta.length} oferta{ofertasDeVenta.length !== 1 ? "s" : ""}
            </h3>

            {ofertasDeVenta.length === 0 ? (
              <p style={{ color: "#64748b", textAlign: "center" }}>Aún no hay ofertas</p>
            ) : (
              ofertasDeVenta.map((oferta, index) => (
                <div key={index} style={{
                  background: "#1e293b", borderRadius: "16px",
                  padding: "15px", marginBottom: "10px"
                }}>
                  <p style={{ fontWeight: "bold", fontSize: "0.9rem", marginBottom: "10px" }}>
                    {oferta.ofertanteNombre} ofrece:
                  </p>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px", marginBottom: "12px" }}>
                    {oferta.cromos.map((c, i) => {
                      const esNueva = !tieneCromo(c.cromoId);
                      return (
                        <div key={i} style={{
                          position: "relative", borderRadius: "10px",
                          border: `2px solid ${getBorderColor(c.rareza)}`,
                          background: "#334155", overflow: "visible",
                        }}>
                          <div style={{ borderRadius: "8px 8px 0 0", overflow: "hidden" }}>
                            <img src={c.imagen} alt="" style={{
                              width: "100%", aspectRatio: "1", objectFit: "cover", display: "block"
                            }} />
                          </div>
                          <div style={{ padding: "3px 4px", textAlign: "center", fontSize: "0.55rem", color: "#cbd5e1", lineHeight: 1.2 }}>
                            {c.nombre}
                          </div>
                          <div style={{
                            position: "absolute", top: "-8px", right: "-4px",
                            background: esNueva ? "#10b981" : "#f59e0b",
                            color: esNueva ? "white" : "#000",
                            fontSize: "0.45rem", fontWeight: "bold",
                            padding: "2px 5px", borderRadius: "4px",
                            textTransform: "uppercase", letterSpacing: "0.5px",
                            boxShadow: "0 1px 4px rgba(0,0,0,0.6)",
                            whiteSpace: "nowrap",
                          }}>
                            {esNueva ? "✨ NUEVA" : "REPETIDA"}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <button onClick={() => aceptarOferta(ventaVerOfertas, index)} style={{
                    width: "100%", padding: "12px", borderRadius: "10px", border: "none",
                    background: "#10b981", color: "white", fontWeight: "bold",
                    cursor: "pointer", fontSize: "0.85rem"
                  }}>
                    ✅ Aceptar esta oferta
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {/* ============= VENDER ============= */}
        {dataLoaded && tab === "vender" && (
          <div>
            <h2 style={{ fontSize: "1.1rem", marginBottom: "15px" }}>📦 Poner a la venta</h2>

            {ventasHoy >= 1 ? (
              <div style={{ textAlign: "center", padding: "30px", color: "#64748b" }}>
                <p style={{ fontSize: "2rem", marginBottom: "10px" }}>🏷️</p>
                <p>Ya has puesto 1 carta a la venta hoy</p>
              </div>
            ) : getMisRepetidos().length === 0 ? (
              <div style={{ textAlign: "center", padding: "30px", color: "#64748b" }}>
                <p style={{ fontSize: "2rem", marginBottom: "10px" }}>📦</p>
                <p>No tienes cromos repetidos para vender</p>
              </div>
            ) : (
              <>
                <p style={{ fontSize: "0.8rem", color: "#64748b", marginBottom: "15px" }}>
                  Elige una carta repetida para poner a la venta (48h)
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px", marginBottom: "20px" }}>
                  {getMisRepetidos().map((cromo) => {
                    const isSelected = cromoAVender === cromo.cromoId;
                    return (
                      <div key={cromo.cromoId} onClick={() => setCromoAVender(isSelected ? null : cromo.cromoId)}
                        style={{
                          borderRadius: "12px", overflow: "hidden", cursor: "pointer",
                          border: isSelected ? "3px solid #f59e0b" : `2px solid ${getBorderColor(cromo.info.rareza)}`,
                          transform: isSelected ? "scale(1.05)" : "scale(1)",
                          transition: "all 0.2s", position: "relative"
                        }}
                      >
                        <img src={cromo.info.imagen} alt="" style={{
                          width: "100%", aspectRatio: "1", objectFit: "cover"
                        }} />
                        {isSelected && (
                          <div style={{
                            position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
                            background: "rgba(245,158,11,0.2)",
                            display: "flex", justifyContent: "center", alignItems: "center",
                            fontSize: "1.5rem"
                          }}>🏷️</div>
                        )}
                        <div style={{
                          padding: "3px", textAlign: "center",
                          background: "rgba(0,0,0,0.6)", fontSize: "0.5rem"
                        }}>
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
                    🏷️ Poner a la venta (48h)
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {/* ============= MIS OFERTAS ============= */}
        {dataLoaded && tab === "mis-ofertas" && (
          <div>
            <h2 style={{ fontSize: "1.1rem", marginBottom: "15px" }}>📤 Mis ofertas enviadas</h2>
            {(() => {
              const misOfertas = [];
              ventas.forEach((v) => {
                (v.ofertas || []).forEach((o, idx) => {
                  if (o.ofertanteId === user?.uid && o.estado === "pendiente") {
                    misOfertas.push({ venta: v, oferta: o, index: idx });
                  }
                });
              });

              if (misOfertas.length === 0) {
                return (
                  <div style={{ textAlign: "center", padding: "30px", color: "#64748b" }}>
                    <p style={{ fontSize: "2rem", marginBottom: "10px" }}>📤</p>
                    <p>No tienes ofertas pendientes</p>
                  </div>
                );
              }

              return misOfertas.map(({ venta, oferta, index }) => {
                const horas = Math.max(0, Math.round((new Date(venta.fechaExpiracion) - new Date()) / 3600000));
                return (
                  <div key={`${venta.id}-${index}`} style={{
                    background: "#1e293b", borderRadius: "16px",
                    padding: "15px", marginBottom: "10px"
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                      <img src={venta.cromoImagen} alt="" style={{
                        width: "45px", height: "45px", borderRadius: "8px", objectFit: "cover",
                        border: `2px solid ${getBorderColor(venta.cromoRareza)}`
                      }} />
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: 0, fontSize: "0.85rem", fontWeight: "bold" }}>
                          Quieres: {venta.cromoNombre}
                        </p>
                        <p style={{ margin: 0, fontSize: "0.7rem", color: "#94a3b8" }}>
                          de {venta.vendedorNombre} · ⏰ {horas}h
                        </p>
                      </div>
                    </div>
                    <p style={{ fontSize: "0.75rem", color: "#94a3b8", marginBottom: "8px" }}>
                      Ofreces: {oferta.cromos.map((c) => c.nombre).join(", ")}
                    </p>
                    <button onClick={() => cancelarOferta(venta, index)} style={{
                      width: "100%", padding: "8px", borderRadius: "8px",
                      border: "1px solid #334155", background: "transparent",
                      color: "#64748b", cursor: "pointer", fontSize: "0.8rem"
                    }}>🗑️ Cancelar oferta</button>
                  </div>
                );
              });
            })()}

            {/* Mis ventas activas */}
            {misVentas.length > 0 && (
              <>
                <h2 style={{ fontSize: "1.1rem", marginTop: "25px", marginBottom: "15px" }}>
                  🏷️ Mis cartas en venta
                </h2>
                {misVentas.map((venta) => {
                  const numOfertas = (venta.ofertas || []).length;
                  const horas = Math.max(0, Math.round((new Date(venta.fechaExpiracion) - new Date()) / 3600000));
                  return (
                    <div key={venta.id} style={{
                      background: "#1e293b", borderRadius: "16px",
                      padding: "15px", marginBottom: "10px"
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                        <img src={venta.cromoImagen} alt="" style={{
                          width: "45px", height: "45px", borderRadius: "8px", objectFit: "cover",
                          border: `2px solid ${getBorderColor(venta.cromoRareza)}`
                        }} />
                        <div style={{ flex: 1 }}>
                          <p style={{ margin: 0, fontSize: "0.85rem", fontWeight: "bold" }}>
                            {venta.cromoNombre}
                          </p>
                          <p style={{ margin: 0, fontSize: "0.7rem", color: "#94a3b8" }}>
                            🔥 {numOfertas} oferta{numOfertas !== 1 ? "s" : ""} · ⏰ {horas}h
                          </p>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button onClick={() => verOfertas(venta)} style={{
                          flex: 1, padding: "10px", borderRadius: "10px", border: "none",
                          background: numOfertas > 0 ? "#10b981" : "#334155",
                          color: "white", fontWeight: "bold", cursor: "pointer", fontSize: "0.8rem"
                        }}>
                          📥 Ver ofertas
                        </button>
                        <button onClick={() => retirarVenta(venta.id)} style={{
                          padding: "10px 14px", borderRadius: "10px", border: "1px solid #334155",
                          background: "transparent", color: "#64748b", cursor: "pointer"
                        }}>🗑️</button>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}

        {/* ============= HISTORIAL ============= */}
        {dataLoaded && tab === "historial" && (
          <div>
            <h2 style={{ fontSize: "1.1rem", marginBottom: "15px" }}>📜 Historial de intercambios</h2>
            {!historialLoaded ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {[1, 2, 3].map((i) => (
                  <div key={i} style={{ height: "70px", borderRadius: "14px", background: "linear-gradient(90deg, #1e293b 25%, #334155 50%, #1e293b 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite" }} />
                ))}
              </div>
            ) : historial.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 20px", color: "#64748b" }}>
                <p style={{ fontSize: "2rem", marginBottom: "10px" }}>🤝</p>
                <p>Aún no hay intercambios</p>
                <p style={{ fontSize: "0.85rem", marginTop: "5px" }}>¡Poned cartas a la venta!</p>
              </div>
            ) : (
              historial.map((evento) => (
                <div key={evento.id} style={{
                  background: "linear-gradient(135deg, #0c1929, #1e293b)",
                  borderRadius: "14px", padding: "14px", marginBottom: "10px",
                  borderLeft: "4px solid #3b82f6",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "5px" }}>
                    <span style={{ fontWeight: "bold", fontSize: "0.85rem" }}>🤝 {evento.userName}</span>
                    <span style={{ fontSize: "0.7rem", color: "#64748b" }}>{timeAgo(evento.timestamp)}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: "0.8rem", color: "#94a3b8", lineHeight: 1.4 }}>
                    {evento.details}
                  </p>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}