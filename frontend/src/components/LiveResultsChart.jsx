import React from "react";
import { Trophy, TrendingUp } from "lucide-react";

const PALETTE = [
  { bar: "linear-gradient(90deg, #6366f1 0%, #818cf8 100%)", glow: "rgba(99, 102, 241, 0.4)" },
  { bar: "linear-gradient(90deg, #06b6d4 0%, #38bdf8 100%)", glow: "rgba(6, 182, 212, 0.4)" },
  { bar: "linear-gradient(90deg, #10b981 0%, #34d399 100%)", glow: "rgba(16, 185, 129, 0.4)" },
  { bar: "linear-gradient(90deg, #f59e0b 0%, #fbbf24 100%)", glow: "rgba(245, 158, 11, 0.4)" },
  { bar: "linear-gradient(90deg, #ec4899 0%, #f472b6 100%)", glow: "rgba(236, 72, 153, 0.4)" },
  { bar: "linear-gradient(90deg, #8b5cf6 0%, #a78bfa 100%)", glow: "rgba(139, 92, 246, 0.4)" },
];

export const LiveResultsChart = ({ options = [], totalVotes = 0, lastVotedOption = null }) => {
  // Find highest vote count
  const maxVotes = Math.max(...options.map((o) => o.votes || 0), 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {options.map((opt, idx) => {
        const votes = opt.votes || 0;
        const percentage = totalVotes > 0 ? ((votes / totalVotes) * 100).toFixed(1) : 0;
        const isLeading = votes > 0 && votes === maxVotes;
        const isJustVoted = lastVotedOption === opt.id;
        const theme = PALETTE[idx % PALETTE.length];

        return (
          <div
            key={opt.id}
            style={{
              background: "rgba(255, 255, 255, 0.02)",
              border: isLeading ? "1px solid rgba(99, 102, 241, 0.3)" : "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-md)",
              padding: "16px",
              position: "relative",
              overflow: "hidden",
              transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
              transform: isJustVoted ? "scale(1.01)" : "scale(1)",
              boxShadow: isJustVoted ? `0 0 15px ${theme.glow}` : "none",
            }}
          >
            {/* Background Progress Fill Bar */}
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                bottom: 0,
                width: `${percentage}%`,
                background: theme.bar,
                opacity: 0.18,
                transition: "width 0.6s cubic-bezier(0.4, 0, 0.2, 1)",
                borderRadius: "var(--radius-md)",
              }}
            />

            {/* Content Container */}
            <div style={{ position: "relative", zIndex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{
                    width: "24px",
                    height: "24px",
                    borderRadius: "6px",
                    background: "rgba(255, 255, 255, 0.05)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    color: "var(--text-muted)",
                  }}>
                    {String.fromCharCode(65 + idx)}
                  </span>
                  <span style={{ fontWeight: 600, fontSize: "1rem" }}>{opt.text}</span>
                  {isLeading && (
                    <span style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      padding: "2px 8px",
                      background: "rgba(245, 158, 11, 0.15)",
                      color: "#fbbf24",
                      borderRadius: "9999px",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                    }}>
                      <Trophy size={11} /> Leader
                    </span>
                  )}
                </div>

                <div style={{ textAlign: "right" }}>
                  <span style={{ fontSize: "1.1rem", fontWeight: 700 }}>{percentage}%</span>
                  <span style={{ fontSize: "0.8rem", color: "var(--text-dim)", marginLeft: "8px" }}>
                    ({votes} {votes === 1 ? "vote" : "votes"})
                  </span>
                </div>
              </div>

              {/* Progress Line */}
              <div style={{
                height: "6px",
                width: "100%",
                background: "rgba(255, 255, 255, 0.06)",
                borderRadius: "9999px",
                overflow: "hidden",
              }}>
                <div
                  style={{
                    height: "100%",
                    width: `${percentage}%`,
                    background: theme.bar,
                    borderRadius: "9999px",
                    transition: "width 0.6s cubic-bezier(0.4, 0, 0.2, 1)",
                    boxShadow: isLeading ? `0 0 8px ${theme.glow}` : "none",
                  }}
                />
              </div>
            </div>
          </div>
        );
      })}

      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        paddingTop: "8px",
        color: "var(--text-muted)",
        fontSize: "0.875rem",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <TrendingUp size={16} color="var(--accent-secondary)" />
          <span>Real-time Redis tally</span>
        </div>
        <div>
          Total votes cast: <strong style={{ color: "var(--text-main)" }}>{totalVotes}</strong>
        </div>
      </div>
    </div>
  );
};
