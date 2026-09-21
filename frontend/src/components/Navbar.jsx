import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { 
  Search, LogOut, Shield, User, Flame, Moon, Sun, 
  Trophy, Gamepad2, Radio, Menu, X, Home as HomeIcon, 
  Vote, LayoutDashboard, Info 
} from "lucide-react";

export const Navbar = ({ onSearch }) => {
  const routerNavigate = useNavigate();
  const location = useLocation();
  const { user, logout, isAuthenticated, isAdmin, openAuthModal } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("voxentra_theme") || "dark";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("voxentra_theme", theme);
  }, [theme]);

  // Close mobile drawer whenever location changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

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

  const handleLogout = () => {
    logout();
    routerNavigate("/login", { replace: true });
  };

  const pathname = location.pathname;

  return (
    <>
      <nav className="vox-navbar-container">
        {/* Left Side: Brand Logo & Title */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div 
            onClick={() => routerNavigate("/home")}
            style={{ 
              display: "flex", 
              alignItems: "center", 
              gap: "10px", 
              cursor: "pointer", 
              userSelect: "none",
              flexShrink: 0
            }}
          >
            {/* Glowing Stylized 3D Prism V Icon */}
            <div style={{
              width: "38px",
              height: "38px",
              borderRadius: "11px",
              background: "linear-gradient(135deg, #06b6d4 0%, #8b5cf6 50%, #ec4899 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 0 18px rgba(139, 92, 246, 0.55)",
              position: "relative",
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M4 4L12 20L20 4H15L12 12L9 4H4Z" fill="#ffffff" />
              </svg>
            </div>
            <span style={{ fontSize: "1.35rem", fontWeight: 900, letterSpacing: "-0.03em", color: "#ffffff" }}>
              Voxentra
            </span>
          </div>
        </div>

        {/* Center Navigation Links (Desktop only, >= 1024px) */}
        <div className="vox-desktop-only" style={{ alignItems: "center", gap: "24px", flexShrink: 0 }}>
          <button
            onClick={() => routerNavigate("/home")}
            style={{
              background: "none",
              border: "none",
              color: pathname === "/home" || pathname === "/" ? "#ffffff" : "var(--text-muted, #94a3b8)",
              fontSize: "0.92rem",
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
              fontSize: "0.92rem",
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
              fontSize: "0.92rem",
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
              fontSize: "0.92rem",
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
              fontSize: "0.92rem",
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
              fontSize: "0.92rem",
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

        {/* Right Actions: Search (responsive), Theme, User Profile & Mobile Menu Toggle */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {/* Search Input Bar (Desktop / Tablet) */}
          <div className="vox-desktop-only" style={{
            position: "relative",
            alignItems: "center",
            background: "rgba(255, 255, 255, 0.04)",
            border: "1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))",
            borderRadius: "9999px",
            padding: "6px 14px",
            width: "clamp(140px, 15vw, 200px)",
          }}>
            <Search size={14} color="var(--text-dim, #64748b)" style={{ marginRight: "8px", flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Search polls..."
              value={searchTerm}
              onChange={handleSearchChange}
              style={{
                background: "transparent",
                border: "none",
                color: "#ffffff",
                fontSize: "0.82rem",
                width: "100%",
                outline: "none",
              }}
            />
          </div>

          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
            className="theme-switch-btn"
            style={{ width: "38px", height: "38px" }}
          >
            {theme === "dark" ? (
              <Moon size={16} color="#38bdf8" />
            ) : (
              <Sun size={16} color="#f59e0b" />
            )}
          </button>

          {/* Desktop User Account Info / Admin Badge / Logout */}
          {isAuthenticated ? (
            <div className="vox-desktop-only" style={{ alignItems: "center", gap: "10px" }}>
              {isAdmin && (
                <button
                  className="btn-vox-secondary"
                  style={{
                    padding: "6px 12px",
                    fontSize: "0.82rem",
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
                  <Shield size={13} />
                  <span>Admin</span>
                </button>
              )}

              <button
                onClick={() => routerNavigate("/dashboard")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  background: "rgba(255, 255, 255, 0.06)",
                  border: "1px solid var(--border-subtle, rgba(255, 255, 255, 0.1))",
                  borderRadius: "9999px",
                  padding: "4px 12px 4px 6px",
                  cursor: "pointer",
                }}
              >
                <img
                  src={user?.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${user?.username || "Voxentra"}`}
                  alt={user?.username}
                  style={{ width: "26px", height: "26px", borderRadius: "50%", border: "1.5px solid #3b82f6" }}
                />
                <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "#ffffff" }}>
                  {user?.username}
                </span>
                <span style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "3px",
                  fontSize: "0.72rem",
                  background: "rgba(245, 158, 11, 0.15)",
                  color: "#fbbf24",
                  padding: "2px 6px",
                  borderRadius: "8px",
                  fontWeight: 700,
                }}>
                  <Flame size={11} />
                  {user?.points || 50}
                </span>
              </button>

              <button
                onClick={handleLogout}
                title="Logout"
                style={{
                  background: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid var(--border-subtle, rgba(255, 255, 255, 0.1))",
                  borderRadius: "50%",
                  width: "34px",
                  height: "34px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--text-muted, #94a3b8)",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
              >
                <LogOut size={15} />
              </button>
            </div>
          ) : (
            <div className="vox-desktop-only" style={{ alignItems: "center", gap: "8px" }}>
              <button
                style={{
                  background: "#2563eb",
                  color: "#ffffff",
                  padding: "8px 18px",
                  borderRadius: "9999px",
                  fontSize: "0.85rem",
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  boxShadow: "0 4px 14px rgba(37, 99, 235, 0.4)",
                  cursor: "pointer",
                  border: "none",
                  transition: "all 0.2s ease",
                }}
                onClick={() => routerNavigate("/login")}
              >
                <User size={15} />
                <span>Login</span>
              </button>
            </div>
          )}

          {/* Mobile Hamburger Toggle Button (Shown on tablets and phones < 1024px) */}
          <button
            className="vox-hamburger-btn"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
            title="Toggle Navigation Menu"
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </nav>

      {/* Mobile Drawer Overlay Backdrop */}
      <div 
        className={`vox-mobile-drawer-overlay ${mobileMenuOpen ? "open" : ""}`}
        onClick={() => setMobileMenuOpen(false)}
        aria-hidden="true"
      />

      {/* Mobile Slide-Out Glassmorphic Navigation Drawer */}
      <aside 
        className={`vox-mobile-drawer ${mobileMenuOpen ? "open" : ""}`}
        aria-label="Mobile Navigation"
      >
        {/* Drawer Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{
              width: "32px",
              height: "32px",
              borderRadius: "8px",
              background: "linear-gradient(135deg, #06b6d4 0%, #8b5cf6 50%, #ec4899 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 0 14px rgba(139, 92, 246, 0.5)",
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M4 4L12 20L20 4H15L12 12L9 4H4Z" fill="#ffffff" />
              </svg>
            </div>
            <span style={{ fontSize: "1.25rem", fontWeight: 900, color: "#ffffff" }}>
              Voxentra
            </span>
          </div>

          <button
            onClick={() => setMobileMenuOpen(false)}
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "10px",
              background: "rgba(255, 255, 255, 0.06)",
              border: "1px solid var(--border-subtle)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--text-muted)",
              cursor: "pointer",
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Mobile Search Bar */}
        <div style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          background: "rgba(255, 255, 255, 0.05)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "12px",
          padding: "10px 14px",
          marginBottom: "20px",
        }}>
          <Search size={16} color="var(--text-dim, #64748b)" style={{ marginRight: "10px", flexShrink: 0 }} />
          <input
            type="text"
            placeholder="Search questions & polls..."
            value={searchTerm}
            onChange={handleSearchChange}
            style={{
              background: "transparent",
              border: "none",
              color: "#ffffff",
              fontSize: "0.9rem",
              width: "100%",
              outline: "none",
            }}
          />
        </div>

        {/* Mobile User Profile Box (if authenticated) */}
        {isAuthenticated && (
          <div style={{
            background: "rgba(255, 255, 255, 0.03)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "14px",
            padding: "14px",
            marginBottom: "20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <img
                src={user?.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${user?.username || "Voxentra"}`}
                alt={user?.username}
                style={{ width: "38px", height: "38px", borderRadius: "50%", border: "2px solid #3b82f6" }}
              />
              <div>
                <div style={{ fontWeight: 800, color: "#ffffff", fontSize: "0.95rem" }}>
                  {user?.username}
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                  {user?.email}
                </div>
              </div>
            </div>

            <span style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              fontSize: "0.75rem",
              background: "rgba(245, 158, 11, 0.15)",
              color: "#fbbf24",
              padding: "4px 8px",
              borderRadius: "8px",
              fontWeight: 800,
            }}>
              <Flame size={12} />
              {user?.points || 50} pts
            </span>
          </div>
        )}

        {/* Mobile Navigation Links */}
        <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: 1 }}>
          <button
            className={`vox-drawer-nav-item ${pathname === "/home" || pathname === "/" ? "active" : ""}`}
            onClick={() => routerNavigate("/home")}
          >
            <HomeIcon size={18} color="#3b82f6" />
            <span>Home</span>
          </button>

          <button
            className={`vox-drawer-nav-item ${pathname === "/voting" || pathname === "/polls" || pathname.startsWith("/poll/") ? "active" : ""}`}
            onClick={() => routerNavigate("/voting")}
          >
            <Vote size={18} color="#06b6d4" />
            <span>Explore Polls</span>
          </button>

          <button
            className={`vox-drawer-nav-item ${pathname === "/games" ? "active" : ""}`}
            onClick={() => routerNavigate("/games")}
          >
            <Gamepad2 size={18} color="#ec4899" />
            <span>Games Arena</span>
          </button>

          <button
            className={`vox-drawer-nav-item ${pathname === "/dashboard" ? "active" : ""}`}
            onClick={() => routerNavigate("/dashboard")}
          >
            <LayoutDashboard size={18} color="#8b5cf6" />
            <span>Dashboard</span>
          </button>

          <button
            className={`vox-drawer-nav-item ${pathname === "/leaderboard" ? "active" : ""}`}
            onClick={() => routerNavigate("/leaderboard")}
          >
            <Trophy size={18} color="#f59e0b" />
            <span>Leaderboard</span>
          </button>

          <button
            className={`vox-drawer-nav-item ${pathname === "/about" ? "active" : ""}`}
            onClick={() => routerNavigate("/about")}
          >
            <Info size={18} color="#10b981" />
            <span>About</span>
          </button>

          {isAdmin && (
            <button
              className={`vox-drawer-nav-item ${pathname === "/admin" ? "active" : ""}`}
              onClick={() => routerNavigate("/admin")}
              style={{
                marginTop: "10px",
                border: "1px dashed rgba(37, 99, 235, 0.4)",
                background: "rgba(37, 99, 235, 0.1)",
                color: "#60a5fa",
              }}
            >
              <Shield size={18} />
              <span>Admin Portal</span>
            </button>
          )}
        </div>

        {/* Drawer Footer Actions */}
        <div style={{ paddingTop: "20px", borderTop: "1px solid var(--border-subtle)", marginTop: "auto" }}>
          {isAuthenticated ? (
            <button
              onClick={handleLogout}
              className="btn-vox-secondary"
              style={{
                width: "100%",
                justifyContent: "center",
                padding: "12px",
                color: "#f87171",
                borderColor: "rgba(239, 68, 68, 0.3)",
                background: "rgba(239, 68, 68, 0.08)",
              }}
            >
              <LogOut size={16} />
              <span>Sign Out</span>
            </button>
          ) : (
            <button
              onClick={() => routerNavigate("/login")}
              className="btn-vox-primary"
              style={{ width: "100%", justifyContent: "center", padding: "12px" }}
            >
              <User size={16} />
              <span>Sign In to Voxentra</span>
            </button>
          )}
        </div>
      </aside>
    </>
  );
};

export default Navbar;
