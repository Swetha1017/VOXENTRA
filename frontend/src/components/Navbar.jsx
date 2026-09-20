import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Search, LogOut, Shield, User, Flame, Moon, Sun, Trophy, Gamepad2, Radio } from "lucide-react";

export const Navbar = ({ onSearch }) => {
  const routerNavigate = useNavigate();
  const location = useLocation();
  const { user, logout, isAuthenticated, isAdmin, openAuthModal } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("voxentra_theme") || "dark";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("voxentra_theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchTerm(val);
    if (onSearch) onSearch(val);
  };

  const handleExploreClick = () => {
    routerNavigate("/voting");
  };

  const handleFeaturesClick = () => {
    if (location.pathname !== "/home") {
      routerNavigate("/home");
    }
    setTimeout(() => {
      const el = document.getElementById("voxentra-features-section");
      if (el) el.scrollIntoView({ behavior: "smooth" });
    }, 150);
  };

  const handleLogout = () => {
    logout();
    routerNavigate("/login", { replace: true });
  };

  const pathname = location.pathname;

  return (
    <nav style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "16px 40px",
      borderBottom: "1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))",
      background: "rgba(7, 9, 20, 0.92)",
      backdropFilter: "blur(20px)",
      WebkitBackdropFilter: "blur(20px)",
      position: "sticky",
      top: 0,
      zIndex: 100,
    }}>
      {/* Brand Logo: Voxentra */}
      <div 
        onClick={() => routerNavigate("/home")}
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
          boxShadow: "0 0 22px rgba(139, 92, 246, 0.6)",
          position: "relative",
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M4 4L12 20L20 4H15L12 12L9 4H4Z" fill="#ffffff" />
          </svg>
        </div>
        <div style={{ display: "flex", alignItems: "center" }}>
          <span style={{ fontSize: "1.45rem", fontWeight: 900, letterSpacing: "-0.03em", color: "#ffffff" }}>
            Voxentra
          </span>
        </div>
      </div>

      {/* Center Navigation Links: Home, Explore Polls, Games, Dashboard, About */}
      <div style={{ display: "flex", alignItems: "center", gap: "28px", flexShrink: 0 }}>
        <button
          onClick={() => routerNavigate("/home")}
          style={{
            background: "none",
            border: "none",
            color: pathname === "/home" || pathname === "/" ? "#ffffff" : "var(--text-muted, #94a3b8)",
            fontSize: "0.95rem",
            fontWeight: 600,
            position: "relative",
            padding: "6px 0",
            cursor: "pointer",
            transition: "color 0.2s ease",
          }}
        >
          Home
          {(pathname === "/home" || pathname === "/") && (
            <span style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: "2.5px",
              background: "linear-gradient(90deg, #3b82f6, #06b6d4)",
              borderRadius: "2px",
              boxShadow: "0 0 10px #3b82f6",
            }} />
          )}
        </button>

        <button
          onClick={handleExploreClick}
          style={{
            background: "none",
            border: "none",
            color: pathname === "/voting" || pathname === "/polls" || pathname.startsWith("/poll/") ? "#ffffff" : "var(--text-muted, #94a3b8)",
            fontSize: "0.95rem",
            fontWeight: 600,
            position: "relative",
            padding: "6px 0",
            cursor: "pointer",
            transition: "color 0.2s ease",
          }}
        >
          Explore Polls
          {(pathname === "/voting" || pathname === "/polls" || pathname.startsWith("/poll/")) && (
            <span style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: "2.5px",
              background: "linear-gradient(90deg, #3b82f6, #06b6d4)",
              borderRadius: "2px",
              boxShadow: "0 0 10px #3b82f6",
            }} />
          )}
        </button>

        <button
          onClick={() => routerNavigate("/games")}
          style={{
            background: "none",
            border: "none",
            color: pathname === "/games" ? "#ffffff" : "var(--text-muted, #94a3b8)",
            fontSize: "0.95rem",
            fontWeight: 600,
            position: "relative",
            padding: "6px 0",
            cursor: "pointer",
            transition: "color 0.2s ease",
          }}
        >
          Games
          {pathname === "/games" && (
            <span style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: "2.5px",
              background: "linear-gradient(90deg, #ec4899, #8b5cf6)",
              borderRadius: "2px",
            }} />
          )}
        </button>

        <button
          onClick={() => routerNavigate("/dashboard")}
          style={{
            background: "none",
            border: "none",
            color: pathname === "/dashboard" ? "#ffffff" : "var(--text-muted, #94a3b8)",
            fontSize: "0.95rem",
            fontWeight: 600,
            position: "relative",
            padding: "6px 0",
            cursor: "pointer",
            transition: "color 0.2s ease",
          }}
        >
          Dashboard
          {pathname === "/dashboard" && (
            <span style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: "2.5px",
              background: "linear-gradient(90deg, #3b82f6, #06b6d4)",
              borderRadius: "2px",
            }} />
          )}
        </button>

        <button
          onClick={() => routerNavigate("/leaderboard")}
          style={{
            background: "none",
            border: "none",
            color: pathname === "/leaderboard" ? "#ffffff" : "var(--text-muted, #94a3b8)",
            fontSize: "0.95rem",
            fontWeight: 600,
            position: "relative",
            padding: "6px 0",
            cursor: "pointer",
            transition: "color 0.2s ease",
          }}
        >
          Leaderboard
          {pathname === "/leaderboard" && (
            <span style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: "2.5px",
              background: "linear-gradient(90deg, #f59e0b, #ef4444)",
              borderRadius: "2px",
            }} />
          )}
        </button>

        <button
          onClick={() => routerNavigate("/about")}
          style={{
            background: "none",
            border: "none",
            color: pathname === "/about" ? "#ffffff" : "var(--text-muted, #94a3b8)",
            fontSize: "0.95rem",
            fontWeight: 600,
            position: "relative",
            padding: "6px 0",
            cursor: "pointer",
            transition: "color 0.2s ease",
          }}
        >
          About
          {pathname === "/about" && (
            <span style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: "2.5px",
              background: "linear-gradient(90deg, #3b82f6, #06b6d4)",
              borderRadius: "2px",
            }} />
          )}
        </button>
      </div>

      {/* Right Actions: Search, Theme Toggle & User Info / Logout */}
      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        {/* Search Input Bar */}
        <div style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          background: "rgba(255, 255, 255, 0.04)",
          border: "1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))",
          borderRadius: "9999px",
          padding: "6px 14px",
          width: "210px",
        }}>
          <Search size={15} color="var(--text-dim, #64748b)" style={{ marginRight: "8px" }} />
          <input
            type="text"
            placeholder="Search polls..."
            value={searchTerm}
            onChange={handleSearchChange}
            style={{
              background: "transparent",
              border: "none",
              color: "#ffffff",
              fontSize: "0.85rem",
              width: "100%",
              outline: "none",
            }}
          />
        </div>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
          className="theme-switch-btn"
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {theme === "dark" ? (
            <Moon size={18} color="#38bdf8" />
          ) : (
            <Sun size={18} color="#f59e0b" />
          )}
        </button>

        {/* User Account / Admin Badge / Logout */}
        {isAuthenticated ? (
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {isAdmin && (
              <button
                className="btn-vox-secondary"
                style={{
                  padding: "6px 14px",
                  fontSize: "0.85rem",
                  borderColor: "rgba(37, 99, 235, 0.5)",
                  background: "rgba(37, 99, 235, 0.15)",
                  color: "#60a5fa",
                  borderRadius: "9999px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  fontWeight: 600,
                }}
                onClick={() => routerNavigate("/admin")}
              >
                <Shield size={14} />
                <span>Admin Portal</span>
              </button>
            )}

            <button
              onClick={() => routerNavigate("/dashboard")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                background: "rgba(255, 255, 255, 0.06)",
                border: "1px solid var(--border-subtle, rgba(255, 255, 255, 0.1))",
                borderRadius: "9999px",
                padding: "4px 14px 4px 6px",
                cursor: "pointer",
              }}
            >
              <img
                src={user?.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${user?.username || "Voxentra"}`}
                alt={user?.username}
                style={{ width: "28px", height: "28px", borderRadius: "50%", border: "1.5px solid #3b82f6" }}
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

            {/* Logout button -> calls logout and navigates to /login */}
            <button
              onClick={handleLogout}
              title="Logout to Login Page"
              style={{
                background: "rgba(255, 255, 255, 0.05)",
                border: "1px solid var(--border-subtle, rgba(255, 255, 255, 0.1))",
                borderRadius: "50%",
                width: "36px",
                height: "36px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--text-muted, #94a3b8)",
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
            >
              <LogOut size={16} />
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <button
              style={{
                background: "#2563eb",
                color: "#ffffff",
                padding: "10px 22px",
                borderRadius: "9999px",
                fontSize: "0.92rem",
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                gap: "8px",
                boxShadow: "0 4px 14px rgba(37, 99, 235, 0.4)",
                cursor: "pointer",
                border: "none",
                transition: "all 0.2s ease",
              }}
              onClick={() => routerNavigate("/login")}
            >
              <User size={16} />
              <span>Login</span>
            </button>
          </div>
        )}
      </div>
    </nav>
  );
};
