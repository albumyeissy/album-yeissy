"use client";
import { useState, useEffect } from "react";
import { auth, db } from "../../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs } from "firebase/firestore";
import { useRouter } from "next/navigation";

export default function FeedPage() {
  const [user, setUser] = useState(null);
  const [events, setEvents] = useState([]);
  const [dataLoaded, setDataLoaded] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        try {
          const snap = await getDocs(collection(db, "feed"));
          const list = [];
          snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
          list.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
          setEvents(list.slice(0, 50));
        } catch (err) { console.error(err); }
      } else {
        router.push("/");
      }
      setDataLoaded(true);
    });
    return () => unsub();
  }, [router]);

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

  const getEventStyle = (type) => {
    switch (type) {
      case "legendaria":
        return { bg: "linear-gradient(135deg, #422006, #1e293b)", border: "#fbbf24", icon: "⭐" };
      case "pagina_completada":
        return { bg: "linear-gradient(135deg, #052e16, #1e293b)", border: "#10b981", icon: "🎉" };
      case "intercambio":
        return { bg: "linear-gradient(135deg, #0c1929, #1e293b)", border: "#3b82f6", icon: "🤝" };
      case "racha":
        return { bg: "linear-gradient(135deg, #431407, #1e293b)", border: "#f59e0b", icon: "🔥" };
        case "mitica":
        return { bg: "linear-gradient(135deg, #450a0a, #1e293b)", border: "#ef4444", icon: "⚡" };
      default:
        return { bg: "#1e293b", border: "#475569", icon: "📌" };
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0f172a", padding: "15px" }}>
      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes fadeInUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>

      {/* HEADER */}
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

      <h1 style={{ textAlign: "center", fontSize: "1.6rem", marginBottom: "5px" }}>
        📢 Novedades
      </h1>
      <p style={{
        textAlign: "center", color: "#64748b", fontSize: "0.85rem", marginBottom: "25px"
      }}>
        ¿Qué está pasando en el grupo?
      </p>

      {/* LOADING */}
      {!dataLoaded && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} style={{
              height: "80px", borderRadius: "16px",
              background: "linear-gradient(90deg, #1e293b 25%, #334155 50%, #1e293b 75%)",
              backgroundSize: "200% 100%",
              animation: "shimmer 1.5s infinite"
            }} />
          ))}
        </div>
      )}

      {/* EVENTS */}
      {dataLoaded && events.length === 0 && (
        <div style={{ textAlign: "center", padding: "40px 20px", color: "#64748b" }}>
          <p style={{ fontSize: "2.5rem", marginBottom: "10px" }}>📢</p>
          <p>Aún no hay novedades</p>
          <p style={{ fontSize: "0.85rem" }}>¡Abrid sobres para que pase algo!</p>
        </div>
      )}

      {dataLoaded && (
        <div style={{ maxWidth: "500px", margin: "0 auto" }}>
          {events.map((event, index) => {
            const style = getEventStyle(event.type);
            return (
              <div
                key={event.id}
                style={{
                  background: style.bg,
                  borderRadius: "16px",
                  padding: "15px",
                  marginBottom: "10px",
                  borderLeft: `4px solid ${style.border}`,
                  animation: `fadeInUp 0.3s ease-out ${index * 0.05}s both`,
                }}
              >
                <div style={{
                  display: "flex", justifyContent: "space-between",
                  alignItems: "flex-start", marginBottom: "6px"
                }}>
                  <span style={{ fontSize: "0.9rem", fontWeight: "bold" }}>
                    {style.icon} {event.userName}
                  </span>
                  <span style={{ fontSize: "0.7rem", color: "#64748b" }}>
                    {timeAgo(event.timestamp)}
                  </span>
                </div>
                <p style={{
                  margin: 0, fontSize: "0.85rem", color: "#cbd5e1",
                  lineHeight: 1.4
                }}>
                  {event.details}
                </p>
                {event.image && (
                  <img src={event.image} alt="" style={{
                    width: "60px", height: "60px", borderRadius: "10px",
                    objectFit: "cover", marginTop: "8px",
                    border: `2px solid ${style.border}`
                  }} />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}