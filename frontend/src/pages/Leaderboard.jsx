import React, { useState, useEffect } from "react";
import { api } from "../api/client";
import { Trophy, Award, Flame, Search, Sparkles } from "lucide-react";

export const Leaderboard = ({ navigate }) => {
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const data = await api.get("/api/leaderboard");
        setLeaderboard(data || []);
      } catch (err) {
        console.warn("Failed to load leaderboard:", err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchLeaderboard();
  }, []);

  const filtered = leaderboard.filter((u) =>
    u.username.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ maxWidth: "980px", margin: "0 auto", padding: "40px 24px 80px" }}>
      {/* Title */}
      <div style={{ textAlign: "center", marginBottom: "36px" }}>
        <div className="brand-glow-badge" style={{ marginBottom: "12px" }}>
          <span>Global Rankings</span>
        </div>
        <h1 style={{ fontSize: "2.4rem", fontWeight: 900, color: "#ffffff", marginBottom: "8px" }}>
          Voxentra Leaderboard
        </h1>
        <p style={{ color: "var(--text-muted)", fontSize: "1rem" }}>
          Earn points and climb the ranks by answering live polls and scoring in games.
        </p>
      </div>

      {/* Top 3 Podium */}
      {leaderboard.length >= 3 && (
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1.15fr 1fr",
          alignItems: "flex-end",
          gap: "20px",
          marginBottom: "40px",
        }}>
          {/* #2 Silver */}
          <div className="glass-panel" style={{
            padding: "24px",
            textAlign: "center",
            borderTop: "3px solid #94a3b8",
            background: "rgba(255, 255, 255, 0.03)",
          }}>
            <div style={{ fontSize: "2rem", marginBottom: "6px" }}>🥈</div>
            <img
              src={leaderboard[1]?.avatar}
              alt={leaderboard[1]?.username}
              style={{ width: "56px", height: "56px", borderRadius: "50%", margin: "0 auto 8px" }}
            />
            <div style={{ fontWeight: 800, color: "#ffffff", fontSize: "1.1rem" }}>
              {leaderboard[1]?.username}
            </div>
            <div style={{ color: "#c084fc", fontWeight: 800, fontSize: "1.2rem", marginTop: "4px" }}>
              {leaderboard[1]?.points} pts
            </div>
            <div style={{ fontSize: "0.8rem", color: "var(--text-dim)", marginTop: "4px" }}>
              Rank #2
            </div>
          </div>

          {/* #1 Gold Champion */}
          <div className="glass-panel" style={{
            padding: "32px 24px",
            textAlign: "center",
            borderTop: "4px solid #fbbf24",
            background: "linear-gradient(180deg, rgba(245, 158, 11, 0.12) 0%, rgba(13, 16, 36, 0.95) 100%)",
            boxShadow: "0 0 35px rgba(245, 158, 11, 0.2)",
          }}>
            <div style={{ fontSize: "2.6rem", marginBottom: "6px" }}>👑</div>
            <img
              src={leaderboard[0]?.avatar}
              alt={leaderboard[0]?.username}
              style={{ width: "68px", height: "68px", borderRadius: "50%", margin: "0 auto 8px", border: "2px solid #fbbf24" }}
            />
            <div style={{ fontWeight: 900, color: "#ffffff", fontSize: "1.3rem" }}>
              {leaderboard[0]?.username}
            </div>
            <div style={{ color: "#fbbf24", fontWeight: 900, fontSize: "1.45rem", marginTop: "4px" }}>
              {leaderboard[0]?.points} pts
            </div>
            <div style={{ fontSize: "0.85rem", color: "#fbbf24", fontWeight: 700, marginTop: "4px" }}>
              Grand Champion
            </div>
          </div>

          {/* #3 Bronze */}
          <div className="glass-panel" style={{
            padding: "24px",
            textAlign: "center",
            borderTop: "3px solid #d97706",
            background: "rgba(255, 255, 255, 0.03)",
          }}>
            <div style={{ fontSize: "2rem", marginBottom: "6px" }}>🥉</div>
            <img
              src={leaderboard[2]?.avatar}
              alt={leaderboard[2]?.username}
              style={{ width: "56px", height: "56px", borderRadius: "50%", margin: "0 auto 8px" }}
            />
            <div style={{ fontWeight: 800, color: "#ffffff", fontSize: "1.1rem" }}>
              {leaderboard[2]?.username}
            </div>
            <div style={{ color: "#c084fc", fontWeight: 800, fontSize: "1.2rem", marginTop: "4px" }}>
              {leaderboard[2]?.points} pts
            </div>
            <div style={{ fontSize: "0.8rem", color: "var(--text-dim)", marginTop: "4px" }}>
              Rank #3
            </div>
          </div>
        </div>
      )}

      {/* Table Container */}
      <div className="glass-panel" style={{ padding: "28px" }}>
        {/* Search */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
          <h3 style={{ fontSize: "1.2rem", fontWeight: 800, color: "#ffffff" }}>
            All Competitors
          </h3>

          <div style={{ position: "relative", width: "240px" }}>
            <Search size={16} color="var(--text-dim)" style={{ position: "absolute", left: "12px", top: "12px" }} />
            <input
              type="text"
              placeholder="Search user..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="vox-input"
              style={{ paddingLeft: "36px", padding: "8px 12px 8px 36px", fontSize: "0.85rem" }}
            />
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {filtered.map((entry, idx) => (
            <div
              key={idx}
              style={{
                display: "grid",
                gridTemplateColumns: "50px 1fr 120px 120px",
                alignItems: "center",
                padding: "12px 18px",
                borderRadius: "var(--radius-md)",
                background: entry.is_you ? "rgba(139, 92, 246, 0.15)" : "rgba(255, 255, 255, 0.02)",
                border: entry.is_you ? "1px solid rgba(139, 92, 246, 0.4)" : "1px solid var(--border-subtle)",
              }}
            >
              <span style={{ fontWeight: 800, fontSize: "1rem", color: idx < 3 ? "#fbbf24" : "var(--text-dim)" }}>
                #{entry.rank || idx + 1}
              </span>

              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <img
                  src={entry.avatar}
                  alt={entry.username}
                  style={{ width: "36px", height: "36px", borderRadius: "50%" }}
                />
                <span style={{ fontWeight: 700, color: "#ffffff", fontSize: "0.95rem" }}>
                  {entry.username} {entry.is_you && <span style={{ color: "#a78bfa" }}>(You)</span>}
                </span>
              </div>

              <span style={{ fontWeight: 800, color: "#c084fc", fontSize: "1rem" }}>
                {entry.points} pts
              </span>

              <div style={{ display: "flex", gap: "6px" }}>
                {entry.badges?.map((b, i) => (
                  <span key={i} style={{ fontSize: "1.1rem" }}>{b}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
