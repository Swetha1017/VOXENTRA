import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { Search, LogIn, LogOut, Shield, Award, User, Flame } from "lucide-react";

export const Navbar = ({ currentRoute, navigate, onSearch }) => {
  const { user, logout, isAuthenticated, isAdmin, openAuthModal } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchTerm(val);
    if (onSearch) onSearch(val);
  };

  return (
    <nav style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "14px 36px",
      borderBottom: "1px solid var(--border-subtle)",
      background: "rgba(7, 9, 19, 0.88)",
      backdropFilter: "blur(18px)",
      WebkitBackdropFilter: "blur(18px)",
      position: "sticky",
      top: 0,
      zIndex: 100,
    }}>
      {/* Brand Logo: Voxentra */}
      <div 
        onClick={() => navigate("home")}
        style={{ 
          display: "flex", 
          alignItems: "center", 
          gap: "12px", 
          cursor: "pointer", 
          userSelect: "none",
          marginRight: "36px",
          flexShrink: 0
        }}
      >
        {/* Glowing Stylized 3D Prism V Icon */}
        <div style={{
          width: "40px",
          height: "40px",
          borderRadius: "12px",
          background: "linear-gradient(135deg, #06b6d4 0%, #8b5cf6 50%, #ec4899 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 0 20px rgba(139, 92, 246, 0.55)",
          position: "relative",
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M4 4L12 20L20 4H15L12 12L9 4H4Z" fill="#ffffff" />
          </svg>
        </div>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "1.35rem", fontWeight: 900, letterSpacing: "-0.03em", color: "#ffffff" }}>
              Voxentra
            </span>
          </div>
        </div>
      </div>

      {/* Center Navigation Links */}
      <div style={{ display: "flex", alignItems: "center", gap: "28px", flexShrink: 0 }}>
        <button
          onClick={() => navigate("home")}
          style={{
            background: "none",
            color: currentRoute === "home" ? "#ffffff" : "var(--text-muted)",
            fontSize: "0.95rem",
            fontWeight: 600,
            position: "relative",
            padding: "6px 0",
            transition: "color 0.2s ease",
          }}
        >
          Home
          {currentRoute === "home" && (
            <span style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: "2.5px",
              background: "linear-gradient(90deg, #8b5cf6, #06b6d4)",
              borderRadius: "2px",
              boxShadow: "0 0 10px #8b5cf6",
            }} />
          )}
        </button>

        <button
          onClick={() => navigate("polls")}
          style={{
            background: "none",
            color: currentRoute === "polls" || currentRoute === "poll" ? "#ffffff" : "var(--text-muted)",
            fontSize: "0.95rem",
            fontWeight: 600,
            position: "relative",
            padding: "6px 0",
            transition: "color 0.2s ease",
          }}
        >
          Live Polls
          {(currentRoute === "polls" || currentRoute === "poll") && (
            <span style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: "2.5px",
              background: "linear-gradient(90deg, #8b5cf6, #06b6d4)",
              borderRadius: "2px",
            }} />
          )}
        </button>

        <button
          onClick={() => navigate("games")}
          style={{
            background: "none",
            color: currentRoute === "games" ? "#ffffff" : "var(--text-muted)",
            fontSize: "0.95rem",
            fontWeight: 600,
            position: "relative",
            padding: "6px 0",
            transition: "color 0.2s ease",
          }}
        >
          Games
          {currentRoute === "games" && (
            <span style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: "2.5px",
              background: "linear-gradient(90deg, #8b5cf6, #06b6d4)",
              borderRadius: "2px",
            }} />
          )}
        </button>

        <button
          onClick={() => navigate("leaderboard")}
          style={{
            background: "none",
            color: currentRoute === "leaderboard" ? "#ffffff" : "var(--text-muted)",
            fontSize: "0.95rem",
            fontWeight: 600,
            position: "relative",
            padding: "6px 0",
            transition: "color 0.2s ease",
          }}
        >
          Leaderboard
          {currentRoute === "leaderboard" && (
            <span style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: "2.5px",
              background: "linear-gradient(90deg, #8b5cf6, #06b6d4)",
              borderRadius: "2px",
            }} />
          )}
        </button>

        <button
          onClick={() => navigate("about")}
          style={{
            background: "none",
            color: currentRoute === "about" ? "#ffffff" : "var(--text-muted)",
            fontSize: "0.95rem",
            fontWeight: 600,
            position: "relative",
            padding: "6px 0",
            transition: "color 0.2s ease",
          }}
        >
          About
          {currentRoute === "about" && (
            <span style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: "2.5px",
              background: "linear-gradient(90deg, #8b5cf6, #06b6d4)",
              borderRadius: "2px",
            }} />
          )}
        </button>
      </div>

      {/* Right Search and Actions */}
      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        {/* Search Input Bar */}
        <div style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          background: "rgba(255, 255, 255, 0.04)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "9999px",
          padding: "6px 14px",
          width: "230px",
        }}>
          <Search size={16} color="var(--text-dim)" style={{ marginRight: "8px" }} />
          <input
            type="text"
            placeholder="Search events, polls..."
            value={searchTerm}
            onChange={handleSearchChange}
            style={{
              background: "transparent",
              border: "none",
              color: "#ffffff",
              fontSize: "0.85rem",
              width: "100%",
            }}
          />
        </div>

        {/* Live Election Pill Button (Screenshot 2 Match) */}
        <button
          onClick={() => navigate("polls")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            background: "rgba(99, 102, 241, 0.2)",
            border: "1px solid rgba(129, 140, 248, 0.4)",
            color: "#e0e7ff",
            padding: "6px 14px",
            borderRadius: "9999px",
            fontSize: "0.82rem",
            fontWeight: 700,
            cursor: "pointer",
            transition: "all 0.2s ease",
          }}
        >
          <span className="pulse-dot-green" style={{ width: "7px", height: "7px" }} />
          <span>Live Election</span>
        </button>

        {isAuthenticated ? (
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {isAdmin && (
              <button
                className="btn-vox-secondary"
                style={{
                  padding: "6px 14px",
                  fontSize: "0.85rem",
                  borderColor: "rgba(139, 92, 246, 0.5)",
                  background: "rgba(139, 92, 246, 0.15)",
                  color: "#c084fc",
                }}
                onClick={() => navigate("admin")}
              >
                <Shield size={14} />
                <span>Admin Portal</span>
              </button>
            )}

            <button
              onClick={() => navigate("dashboard")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                background: "rgba(255, 255, 255, 0.05)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "9999px",
                padding: "4px 14px 4px 6px",
                cursor: "pointer",
              }}
            >
              <img
                src={user?.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${user?.username}`}
                alt={user?.username}
                style={{ width: "28px", height: "28px", borderRadius: "50%", border: "1.5px solid #8b5cf6" }}
              />
              <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "#ffffff" }}>
                {user?.username}
              </span>
              <span style={{
                display: "flex",
                alignItems: "center",
                gap: "3px",
                fontSize: "0.75rem",
                background: "rgba(245, 158, 11, 0.15)",
                color: "#fbbf24",
                padding: "2px 8px",
                borderRadius: "10px",
                fontWeight: 700,
              }}>
                <Flame size={12} />
                {user?.points || 50} pts
              </span>
            </button>

            <button
              onClick={logout}
              title="Sign Out"
              style={{
                background: "rgba(255, 255, 255, 0.05)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "50%",
                width: "36px",
                height: "36px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--text-muted)",
                transition: "all 0.2s ease",
              }}
            >
              <LogOut size={16} />
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <button
              className="btn-vox-secondary"
              style={{ padding: "8px 18px", fontSize: "0.9rem" }}
              onClick={() => openAuthModal("login")}
            >
              <LogIn size={15} />
              <span>Login</span>
            </button>
            <button
              className="btn-vox-primary"
              style={{ padding: "8px 20px", fontSize: "0.9rem" }}
              onClick={() => openAuthModal("register")}
            >
              <span>Register</span>
            </button>
          </div>
        )}
      </div>
    </nav>
  );
};
