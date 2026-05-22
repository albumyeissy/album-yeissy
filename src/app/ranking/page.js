"use client";
import { useState, useEffect } from "react";
import { auth, db } from "../../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { CROMOS } from "../../data/cromos";

export default function RankingPage() {
  const [user, setUser] = useState(null);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [jugadores, setJugadores] = useState([]);
  const router = useRouter();
  const TOTAL_CROMOS = CROMOS.length;

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        try {
          const snap = await getDocs(collection(db, "usuarios"));
          const lista = [];
          snap.forEach((d) => {
            const data = d.data();
            const pegados = (data.cromos || []).filter((c) => c.pegado !== false).length;
            const cromosUnicos = new Set((data.cromos || []).map((c) => c.cromoId)).size;
            const totalRepetidos = (data.cromos || []).reduce(
              (sum, c) => sum + Math.max(0, c.cantidad - 1), 0
            );
            lista.push({
              uid: d.id,
              nombre: data.nombre || data.email || "???",
              pegados,
              cromosUnicos,
              totalRepetidos,
              porcentaje: Math.round((pegados / TOTAL_CROMOS) * 100),
            });
          });
          lista.sort((a, b) => b.pegados - a.pegados);
          setJugadores(lista);
        } catch (err) { console.error(err); }
      } else {
        router.push("/");
      }
      setDataLoaded(true);
    });
    return () => unsub();
  }, [router]);

  const getMedal = (i) => i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}º`;
  const getBarColor = (i) => i === 0 ? "#fbbf24" : i === 1 ? "#94a3b8" : i === 2 ? "#cd7f32" : "#3b82f6";

  return (
    <div style={{ minHeight: "100vh", background: "#0f172a", padding: "15px" }}>
      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>

      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginBottom: "20px"
      }}>
        <button onClick={() => router.push("/album")} style={{
          padding: "8px 16px", borderRadius: "10px", border: "1px solid #475569",
          background: "transparent", color: "#94a3b8", cursor: "pointer"
        }}>
          ← Álbum
        </button>
      </div>

      <h1 style={{ textAlign: "center", fontSize: "2rem", marginBottom: "5px" }}>
        🏆 Ranking
      </h1>
      <p style={{
        textAlign: "center", color: "#94a3b8", marginBottom: "25px", fontSize: "0.9rem"
      }}>
        ¿Quién completa el álbum primero?
      </p>

      <div style={{ maxWidth: "500px", margin: "0 auto" }}>
        {!dataLoaded ? (
          [1, 2, 3].map((i) => (
            <div key={i} style={{
              height: "85px", borderRadius: "15px", marginBottom: "12px",
              background: "linear-gradient(90deg, #1e293b 25%, #334155 50%, #1e293b 75%)",
              backgroundSize: "200% 100%",
              animation: "shimmer 1.5s infinite"
            }} />
          ))
        ) : (
          jugadores.map((j, index) => {
            const esYo = j.uid === user?.uid;
            return (
              <div key={j.uid} style={{
                background: esYo ? "#1e3a5f" : "#1e293b",
                padding: "15px", borderRadius: "15px",
                marginBottom: "12px",
                border: esYo ? "2px solid #3b82f6" : "2px solid transparent",
                animation: `fadeInUp 0.3s ease-out ${index * 0.1}s both`,
              }}>
                <div style={{
                  display: "flex", justifyContent: "space-between",
                  alignItems: "center", marginBottom: "10px"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ fontSize: index < 3 ? "1.8rem" : "1.2rem" }}>
                      {getMedal(index)}
                    </span>
                    <div>
                      <p style={{ margin: 0, fontWeight: "bold", fontSize: "1.1rem" }}>
                        {j.nombre} {esYo && "(tú)"}
                      </p>
                      <p style={{ margin: 0, color: "#94a3b8", fontSize: "0.75rem" }}>
                        {j.pegados}/{TOTAL_CROMOS} pegados · {j.totalRepetidos} repetidos
                      </p>
                    </div>
                  </div>
                  <span style={{
                    fontSize: "1.5rem", fontWeight: "bold", color: getBarColor(index)
                  }}>
                    {j.porcentaje}%
                  </span>
                </div>
                <div style={{
                  width: "100%", height: "10px", background: "#0f172a",
                  borderRadius: "5px", overflow: "hidden"
                }}>
                  <div style={{
                    width: `${j.porcentaje}%`, height: "100%",
                    background: getBarColor(index), borderRadius: "5px",
                    transition: "width 0.5s ease"
                  }} />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}