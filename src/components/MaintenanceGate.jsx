"use client";
import { useState, useEffect } from "react";
import { db } from "../lib/firebase";
import { doc, getDoc } from "firebase/firestore";

const BYPASS_KEY   = "ay_maintenance_bypass";
const PASSWORD     = "yeissy2026";

export default function MaintenanceGate({ children }) {
  const [estado, setEstado] = useState("cargando"); // "cargando" | "abierto" | "mantenimiento" | "desbloqueado"
  const [input, setInput]   = useState("");
  const [error, setError]   = useState(false);
  const [shake, setShake]   = useState(false);

  useEffect(() => {
    // Si ya tiene el bypass guardado, pasar directamente
    if (typeof window !== "undefined" && localStorage.getItem(BYPASS_KEY) === PASSWORD) {
      setEstado("desbloqueado");
      return;
    }

    getDoc(doc(db, "config", "features"))
      .then((snap) => {
        if (snap.exists() && snap.data().mantenimiento === true) {
          setEstado("mantenimiento");
        } else {
          setEstado("abierto");
        }
      })
      .catch(() => {
        // Si falla la lectura de Firestore, dejar pasar (no bloquear por error de red)
        setEstado("abierto");
      });
  }, []);

  const intentarEntrar = () => {
    if (input === PASSWORD) {
      localStorage.setItem(BYPASS_KEY, PASSWORD);
      setEstado("desbloqueado");
    } else {
      setError(true);
      setShake(true);
      setTimeout(() => { setShake(false); setError(false); setInput(""); }, 800);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") intentarEntrar();
  };

  if (estado === "cargando") {
    return (
      <div style={{
        minHeight: "100vh", background: "#0f172a",
        display: "flex", justifyContent: "center", alignItems: "center",
      }}>
        <div style={{
          width: "40px", height: "40px", borderRadius: "50%",
          border: "3px solid #334155", borderTop: "3px solid #f59e0b",
          animation: "spin 0.8s linear infinite",
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (estado === "abierto" || estado === "desbloqueado") {
    return <>{children}</>;
  }

  // --- Pantalla de mantenimiento ---
  return (
    <div style={{
      minHeight: "100vh", background: "#0f172a", color: "white",
      display: "flex", flexDirection: "column",
      justifyContent: "center", alignItems: "center",
      padding: "30px", fontFamily: "system-ui, sans-serif",
    }}>
      <style>{`
        @keyframes spin        { to { transform: rotate(360deg); } }
        @keyframes floatTool   { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-12px); } }
        @keyframes shakeInput  { 0%,100% { transform: translateX(0); } 20%,60% { transform: translateX(-8px); } 40%,80% { transform: translateX(8px); } }
        @keyframes fadeInUp    { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {/* Icono animado */}
      <div style={{ fontSize: "5rem", marginBottom: "20px", animation: "floatTool 3s ease-in-out infinite" }}>
        🔧
      </div>

      {/* Título */}
      <h1 style={{
        fontSize: "1.8rem", fontWeight: "bold", textAlign: "center",
        marginBottom: "8px", animation: "fadeInUp 0.5s ease-out",
      }}>
        En mantenimiento
      </h1>
      <p style={{
        color: "#64748b", textAlign: "center", maxWidth: "300px",
        lineHeight: 1.5, marginBottom: "40px", fontSize: "0.95rem",
        animation: "fadeInUp 0.6s ease-out",
      }}>
        Estamos arreglando cositas para que todo funcione perfecto 😊
        <br />
        <span style={{ fontSize: "0.8rem" }}>Vuelve en un rato.</span>
      </p>

      {/* Separador */}
      <div style={{
        width: "200px", height: "1px",
        background: "linear-gradient(90deg, transparent, #334155, transparent)",
        marginBottom: "30px",
      }} />

      {/* Input contraseña (discreto) */}
      <div style={{
        background: "#1e293b", borderRadius: "16px", padding: "24px",
        width: "100%", maxWidth: "300px",
        border: "1px solid #334155",
        animation: "fadeInUp 0.7s ease-out",
        ...(shake ? { animation: "shakeInput 0.4s ease-out" } : {}),
      }}>
        <p style={{ color: "#475569", fontSize: "0.75rem", marginBottom: "12px", textAlign: "center" }}>
          ¿Tienes acceso? Introduce la contraseña
        </p>
        <input
          type="password"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="••••••••"
          style={{
            width: "100%", padding: "12px 16px",
            borderRadius: "10px", border: error ? "1px solid #ef4444" : "1px solid #334155",
            background: "#0f172a", color: "white", fontSize: "1rem",
            outline: "none", boxSizing: "border-box",
            marginBottom: "12px",
            transition: "border-color 0.2s",
          }}
          autoComplete="off"
          autoFocus
        />
        {error && (
          <p style={{ color: "#ef4444", fontSize: "0.75rem", textAlign: "center", marginBottom: "10px" }}>
            Contraseña incorrecta
          </p>
        )}
        <button
          onClick={intentarEntrar}
          style={{
            width: "100%", padding: "12px",
            borderRadius: "10px", border: "none",
            background: "linear-gradient(135deg, #f59e0b, #d97706)",
            color: "#000", fontWeight: "bold", fontSize: "0.95rem",
            cursor: "pointer",
          }}
        >
          Entrar →
        </button>
      </div>
    </div>
  );
}
