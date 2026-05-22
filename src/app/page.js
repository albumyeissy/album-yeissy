"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "../lib/firebase";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";

const JUGADORES = ["JC", "Sergio", "Coke", "Noel", "Juanma", "Robert", "test"];

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nombre, setNombre] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  const handleLogin = async () => {
    setError("");
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push("/album");
    } catch (err) {
      setError("Email o contraseña incorrectos");
    }
  };

  const handleRegister = async () => {
    setError("");
    if (!nombre) {
      setError("Selecciona tu nombre");
      return;
    }
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      await setDoc(doc(db, "usuarios", result.user.uid), {
        email: email,
        nombre: nombre,
        cromos: [],
        sobresAbiertosHoy: 0,
        fechaUltimoSobre: "",
        propuestasHoy: 0,
        fechaPropuestas: "",
        intercambiosHoy: 0,
        fechaIntercambio: "",
      });
      router.push("/album");
    } catch (err) {
      setError("Error al crear cuenta. ¿Ya existe?");
    }
  };

  return (
    <div style={{
      display: "flex", justifyContent: "center", alignItems: "center",
      minHeight: "100vh", padding: "20px"
    }}>
      <div style={{
        background: "#1e293b", padding: "40px", borderRadius: "20px",
        width: "100%", maxWidth: "400px", textAlign: "center"
      }}>
        <h1 style={{ fontSize: "2.5rem", marginBottom: "5px" }}>🎴</h1>
        <h2 style={{ fontSize: "1.8rem", marginBottom: "5px" }}>Album Yeissy</h2>
        <p style={{ color: "#94a3b8", marginBottom: "30px" }}>
          El álbum de cromos del grupo
        </p>

        <input type="email" placeholder="Email" value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{
            width: "100%", padding: "12px", borderRadius: "10px", border: "none",
            marginBottom: "10px", background: "#334155", color: "white", fontSize: "1rem"
          }}
        />
        <input type="password" placeholder="Contraseña" value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{
            width: "100%", padding: "12px", borderRadius: "10px", border: "none",
            marginBottom: "10px", background: "#334155", color: "white", fontSize: "1rem"
          }}
        />

        <select value={nombre} onChange={(e) => setNombre(e.target.value)}
          style={{
            width: "100%", padding: "12px", borderRadius: "10px", border: "none",
            marginBottom: "20px", background: "#334155", color: nombre ? "white" : "#94a3b8",
            fontSize: "1rem"
          }}
        >
          <option value="">¿Quién eres? (solo para registro)</option>
          {JUGADORES.map((j) => (
            <option key={j} value={j}>{j}</option>
          ))}
        </select>

        <button onClick={handleLogin} style={{
          width: "100%", padding: "12px", borderRadius: "10px", border: "none",
          background: "#3b82f6", color: "white", fontSize: "1rem",
          cursor: "pointer", marginBottom: "10px"
        }}>
          Entrar
        </button>
        <button onClick={handleRegister} style={{
          width: "100%", padding: "12px", borderRadius: "10px", border: "none",
          background: "#10b981", color: "white", fontSize: "1rem", cursor: "pointer"
        }}>
          Crear cuenta
        </button>

        {error && <p style={{ color: "#ef4444", marginTop: "15px" }}>{error}</p>}
      </div>
    </div>
  );
}