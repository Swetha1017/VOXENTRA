import React from "react";
import { Shield, Zap, Database, Server, Cpu, CheckCircle } from "lucide-react";

export const About = ({ navigate }) => {
  return (
    <div className="vox-page-container" style={{ maxWidth: "1000px" }}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: "48px" }}>
        <div className="brand-glow-badge" style={{ marginBottom: "14px" }}>
          <span>Architecture & Engineering</span>
        </div>
        <h1 style={{ fontSize: "2.6rem", fontWeight: 900, color: "#ffffff", marginBottom: "12px" }}>
          About Voxentra
        </h1>
        <p style={{ color: "var(--text-muted)", fontSize: "1.1rem", maxWidth: "680px", margin: "0 auto" }}>
          A high-concurrency live voting, real-time commentary, and interactive gaming engine built for true zero-refresh synchronization.
        </p>
      </div>

      {/* Tech Stack Breakdown matching HCL / GUVI requirements */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: "20px",
        marginBottom: "48px",
      }}>
        <div className="glass-panel" style={{ padding: "26px" }}>
          <div style={{ color: "#38bdf8", marginBottom: "12px" }}>
            <Cpu size={28} />
          </div>
          <h3 style={{ fontSize: "1.15rem", fontWeight: 700, color: "#ffffff", marginBottom: "6px" }}>Frontend</h3>
          <div style={{ color: "#38bdf8", fontWeight: 800, fontSize: "0.85rem", marginBottom: "8px" }}>React 19 + Vite</div>
          <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", lineHeight: 1.5 }}>
            Responsive dark glassmorphic interface, state management, instant WebSocket bindings, and smooth CSS transitions.
          </p>
        </div>

        <div className="glass-panel" style={{ padding: "26px" }}>
          <div style={{ color: "#a855f7", marginBottom: "12px" }}>
            <Server size={28} />
          </div>
          <h3 style={{ fontSize: "1.15rem", fontWeight: 700, color: "#ffffff", marginBottom: "6px" }}>Backend Service</h3>
          <div style={{ color: "#c084fc", fontWeight: 800, fontSize: "0.85rem", marginBottom: "8px" }}>Go (Gin Framework)</div>
          <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", lineHeight: 1.5 }}>
            High-performance compiled REST API and Gorilla WebSocket hub handling concurrent live connections.
          </p>
        </div>

        <div className="glass-panel" style={{ padding: "26px" }}>
          <div style={{ color: "#34d399", marginBottom: "12px" }}>
            <Database size={28} />
          </div>
          <h3 style={{ fontSize: "1.15rem", fontWeight: 700, color: "#ffffff", marginBottom: "6px" }}>Database</h3>
          <div style={{ color: "#34d399", fontWeight: 800, fontSize: "0.85rem", marginBottom: "8px" }}>MongoDB</div>
          <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", lineHeight: 1.5 }}>
            Persistent storage of users, questions, vote registries, comments, and leaderboard metrics.
          </p>
        </div>

        <div className="glass-panel" style={{ padding: "26px" }}>
          <div style={{ color: "#f43f5e", marginBottom: "12px" }}>
            <Zap size={28} />
          </div>
          <h3 style={{ fontSize: "1.15rem", fontWeight: 700, color: "#ffffff", marginBottom: "6px" }}>Realtime Engine</h3>
          <div style={{ color: "#fda4af", fontWeight: 800, fontSize: "0.85rem", marginBottom: "8px" }}>Redis</div>
          <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", lineHeight: 1.5 }}>
            Powers atomic O(1) vote tallies (`HINCRBY`), instant voter deduplication (`SADD`), and Pub/Sub broadcasting.
          </p>
        </div>
      </div>

      {/* Security & Voting Integrity */}
      <div className="glass-panel" style={{ padding: "36px", marginBottom: "40px" }}>
        <h2 style={{ fontSize: "1.4rem", fontWeight: 800, color: "#ffffff", marginBottom: "16px", display: "flex", alignItems: "center", gap: "10px" }}>
          <Shield size={22} color="#8b5cf6" />
          <span>Vote Integrity & Tamper Prevention</span>
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))", gap: "20px" }}>
          <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
            <CheckCircle size={18} color="#34d399" style={{ flexShrink: 0, marginTop: "3px" }} />
            <div>
              <div style={{ fontWeight: 700, color: "#ffffff", fontSize: "0.95rem" }}>Mandatory User Authentication</div>
              <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: "2px" }}>
                Anonymous voting is disallowed. Users must register or log in before submitting votes.
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
            <CheckCircle size={18} color="#34d399" style={{ flexShrink: 0, marginTop: "3px" }} />
            <div>
              <div style={{ fontWeight: 700, color: "#ffffff", fontSize: "0.95rem" }}>One Vote Per Registered User</div>
              <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: "2px" }}>
                Enforced both in backend storage and Redis sets, strictly blocking duplicate votes.
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
            <CheckCircle size={18} color="#34d399" style={{ flexShrink: 0, marginTop: "3px" }} />
            <div>
              <div style={{ fontWeight: 700, color: "#ffffff", fontSize: "0.95rem" }}>Exclusive Admin Controls</div>
              <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: "2px" }}>
                Single designated administrator account with unexposed credentials and dedicated separate portal.
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
            <CheckCircle size={18} color="#34d399" style={{ flexShrink: 0, marginTop: "3px" }} />
            <div>
              <div style={{ fontWeight: 700, color: "#ffffff", fontSize: "0.95rem" }}>Live Social Referral Tracking</div>
              <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: "2px" }}>
                Every shared link appends referral tokens that feed directly into administrator analytics.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
