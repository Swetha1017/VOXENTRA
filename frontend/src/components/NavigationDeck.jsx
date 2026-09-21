import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Radio, Gamepad2, LayoutDashboard, ArrowRight, AlertCircle } from "lucide-react";

/**
 * Three distinct navigation destinations required by specification:
 * 1. Explore Poll: /voting (also aliased to /explore-polls and /polls)
 * 2. Games: /games
 * 3. Dashboard: /dashboard (also aliased to /user/dashboard)
 */
const NAVIGATION_ROUTES = [
  {
    id: "explore-poll",
    label: "Explore Poll",
    path: "/voting",
    aliases: ["/explore-polls", "/polls", "/voting"],
    description: "Browse live community polls and vote in real time",
    icon: Radio,
    themeColor: "#06b6d4",
    accentGlow: "rgba(6, 182, 212, 0.35)",
    tag: "Live Voting",
  },
  {
    id: "games",
    label: "Games",
    path: "/games",
    aliases: ["/games"],
    description: "Play Color Match and Snake Classic to earn points",
    icon: Gamepad2,
    themeColor: "#ec4899",
    accentGlow: "rgba(236, 72, 153, 0.35)",
    tag: "Arcade Arena",
  },
  {
    id: "dashboard",
    label: "Dashboard",
    path: "/dashboard",
    aliases: ["/dashboard", "/user/dashboard"],
    description: "Review personal voting statistics, badges and points",
    icon: LayoutDashboard,
    themeColor: "#8b5cf6",
    accentGlow: "rgba(139, 92, 246, 0.35)",
    tag: "User Analytics",
  },
];

export const NavigationDeck = ({ className = "" }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [navError, setNavError] = useState(null);

  /**
   * Resilient Navigation Handler with Try-Catch Error Handling
   * Supports both click and touch input methods across all viewports.
   */
  const handleNavigate = (targetPath, e) => {
    // Prevent double invocation if both touch and click fire
    if (e && e.type === "touchend") {
      e.preventDefault();
    }

    try {
      setNavError(null);
      if (!targetPath) {
        throw new Error("Invalid destination route path.");
      }
      navigate(targetPath);
    } catch (err) {
      console.error(`[Navigation Error]: Failed to navigate to ${targetPath}:`, err);
      setNavError(`Navigation failed: ${err.message}. Attempting fallback...`);
      // Fallback navigation attempt
      try {
        window.location.assign(targetPath);
      } catch (fallbackErr) {
        console.error("[Navigation Fallback Error]:", fallbackErr);
      }
    }
  };

  /**
   * Keyboard accessibility handler (Enter & Space keys)
   */
  const handleKeyDown = (targetPath, e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleNavigate(targetPath, e);
    }
  };

  return (
    <nav
      role="navigation"
      aria-label="Main Destinations Navigation Deck"
      className={`vox-nav-deck-container ${className}`}
    >
      {/* Visual Navigation Bar Label */}
      <div className="vox-nav-deck-header">
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span className="pulse-dot-green" />
          <span style={{ fontSize: "0.85rem", fontWeight: 700, letterSpacing: "0.05em", color: "var(--text-muted, #94a3b8)", textTransform: "uppercase" }}>
            Direct Platform Destinations
          </span>
        </div>
        <span style={{ fontSize: "0.78rem", color: "var(--text-dim, #64748b)" }}>
          Select or tap destination
        </span>
      </div>

      {/* Navigation Failure Notice (Graceful Error Handling) */}
      {navError && (
        <div
          role="alert"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "10px 16px",
            borderRadius: "10px",
            background: "rgba(239, 68, 68, 0.15)",
            border: "1px solid rgba(239, 68, 68, 0.4)",
            color: "#fca5a5",
            fontSize: "0.85rem",
            marginBottom: "16px",
          }}
        >
          <AlertCircle size={16} />
          <span>{navError}</span>
        </div>
      )}

      {/* Three Distinct Navigation Paths */}
      <div className="vox-nav-deck-grid">
        {NAVIGATION_ROUTES.map((route) => {
          const Icon = route.icon;
          // Active state detection matching exact path or registered aliases
          const isActive = route.aliases.some((alias) =>
            location.pathname === alias || location.pathname.startsWith(`${alias}/`)
          );

          return (
            <div
              key={route.id}
              role="button"
              tabIndex={0}
              aria-label={`Navigate to ${route.label} - ${route.description}`}
              aria-current={isActive ? "page" : undefined}
              onClick={(e) => handleNavigate(route.path, e)}
              onTouchEnd={(e) => handleNavigate(route.path, e)}
              onKeyDown={(e) => handleKeyDown(route.path, e)}
              className={`vox-nav-deck-item ${isActive ? "active" : ""}`}
              style={{
                "--item-color": route.themeColor,
                "--item-glow": route.accentGlow,
              }}
            >
              {/* Top Row: Icon + Badge + Active Indicator */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
                <div
                  className="vox-nav-deck-icon-wrap"
                  style={{
                    background: `${route.themeColor}22`,
                    border: `1px solid ${route.themeColor}55`,
                    color: route.themeColor,
                  }}
                >
                  <Icon size={24} />
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span
                    style={{
                      fontSize: "0.72rem",
                      fontWeight: 700,
                      padding: "3px 10px",
                      borderRadius: "9999px",
                      background: "rgba(255, 255, 255, 0.05)",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      color: "var(--text-muted, #94a3b8)",
                      textTransform: "uppercase",
                    }}
                  >
                    {route.tag}
                  </span>
                  {isActive && (
                    <span
                      style={{
                        fontSize: "0.72rem",
                        fontWeight: 800,
                        padding: "3px 8px",
                        borderRadius: "9999px",
                        background: "#7c3aed",
                        color: "#ffffff",
                      }}
                    >
                      Active
                    </span>
                  )}
                </div>
              </div>

              {/* Title & Description */}
              <div>
                <h3 className="vox-nav-deck-title">
                  {route.label}
                </h3>
                <p className="vox-nav-deck-desc">
                  {route.description}
                </p>
              </div>

              {/* Bottom CTA Indicator */}
              <div className="vox-nav-deck-action">
                <span style={{ fontSize: "0.86rem", fontWeight: 700, color: route.themeColor }}>
                  Open {route.label}
                </span>
                <div className="vox-nav-deck-arrow">
                  <ArrowRight size={16} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </nav>
  );
};

export default NavigationDeck;
