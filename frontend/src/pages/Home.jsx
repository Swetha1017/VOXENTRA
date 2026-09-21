import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api, getGlobalWSUrl } from "../api/client";
import {
  Radio, Gamepad2, LayoutDashboard, Trophy, Shield, Sparkles,
  ArrowRight, Settings, Search, RotateCcw, Share2,
  Plus, Check, CheckCircle2, LayoutGrid, List, SlidersHorizontal,
  Flame, Vote, Info
} from "lucide-react";
import { ShareModal } from "../components/ShareModal";

/**
 * Storage key for persisting user customized featured pages on home
 */
const STORAGE_KEY_FEATURED = "voxentra_home_featured_pages";
const STORAGE_KEY_VIEW_MODE = "voxentra_home_view_mode";

/**
 * Master catalog of all destinations and features available in Voxentra
 */
const PLATFORM_DESTINATIONS = [
  {
    id: "polls",
    path: "/voting",
    title: "Live Polls & Voting",
    shortTitle: "Live Polls",
    tagline: "Small Vote. Bigger Impact.",
    description: "Explore trending community polls, cast your vote in real time, and watch dynamic interactive outcome charts.",
    icon: Radio,
    theme: "cyan",
    badgeText: "Live Active",
    primaryActionText: "Explore Live Polls",
    statsLabel: "Active Polls Available",
    defaultFeatured: true,
  },
  {
    id: "games",
    path: "/games",
    title: "Interactive Games Hub",
    shortTitle: "Games Hub",
    tagline: "Play, Compete & Climb.",
    description: "Fast-paced cognitive games including Color Match & Snake Classic. Test your reflexes and earn rank points.",
    icon: Gamepad2,
    theme: "pink",
    badgeText: "Live Arcade",
    primaryActionText: "Play Arcade Games",
    statsLabel: "Multiplayer Modes",
    defaultFeatured: true,
  },
  {
    id: "dashboard",
    path: "/dashboard",
    title: "Activity Dashboard",
    shortTitle: "Dashboard",
    tagline: "Personal Pulse & Stats.",
    description: "Review your cast votes, point earnings, unlocked reward badges, and real-time engagement history in one place.",
    icon: LayoutDashboard,
    theme: "purple",
    badgeText: "Analytics",
    primaryActionText: "Open Dashboard",
    statsLabel: "Personal Analytics",
    defaultFeatured: false,
  },
  {
    id: "leaderboard",
    path: "/leaderboard",
    title: "Global Leaderboard",
    shortTitle: "Leaderboard",
    tagline: "Top Platform Champions.",
    description: "Inspect podium standings, community badges, and top-ranked contributors across live voting and games.",
    icon: Trophy,
    theme: "amber",
    badgeText: "Rankings",
    primaryActionText: "View Leaderboard",
    statsLabel: "Top Contributors",
    defaultFeatured: false,
  },
  {
    id: "admin",
    path: "/admin",
    title: "Admin Portal & Poll Studio",
    shortTitle: "Admin Portal",
    tagline: "Clearance & Management.",
    description: "Create official community polls, manage expiration windows, inspect system audits, and moderate comments.",
    icon: Shield,
    theme: "blue",
    badgeText: "Admin Suite",
    primaryActionText: "Open Admin Portal",
    statsLabel: "Governance & Tools",
    defaultFeatured: false,
    requiresAdmin: true,
  },
  {
    id: "about",
    path: "/about",
    title: "Platform Story & Architecture",
    shortTitle: "About Voxentra",
    tagline: "Mission & Tech Stack.",
    description: "Discover the technology stack behind Voxentra, our real-time WebSocket protocol, and democratic ethos.",
    icon: Info,
    theme: "purple",
    badgeText: "About Us",
    primaryActionText: "Read About Voxentra",
    statsLabel: "Platform Insights",
    defaultFeatured: false,
  },
];

export const Home = ({ navigate: propNavigate }) => {
  const routerNavigate = useNavigate();
  const { isAdmin } = useAuth();

  // Internal unified navigation
  const navigate = (to) => {
    if (typeof to === "string") {
      if (to === "home" || to === "/") routerNavigate("/home");
      else if (to === "polls" || to === "voting" || to === "explore") routerNavigate("/voting");
      else if (to === "games") routerNavigate("/games");
      else if (to === "dashboard") routerNavigate("/dashboard");
      else if (to === "admin") routerNavigate("/admin");
      else if (to === "leaderboard") routerNavigate("/leaderboard");
      else if (to === "about") routerNavigate("/about");
      else if (to === "login") routerNavigate("/login");
      else if (to === "register") routerNavigate("/register");
      else routerNavigate(to.startsWith("/") ? to : `/${to}`);
    } else if (propNavigate) {
      propNavigate(to);
    } else {
      routerNavigate(to);
    }
  };

  // 1. User Preference Persistence: Which 2 pages are featured on Home
  const [featuredPageIds, setFeaturedPageIds] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_FEATURED);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length === 2) {
          return parsed;
        }
      }
    } catch {
      // Use defaults
    }
    return ["polls", "games"]; // Default fixed configuration: Live Polls and Games
  });

  // 2. Presentation Format: "cards" (default), "buttons", or "list"
  const [viewMode, setViewMode] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_VIEW_MODE);
      if (saved && ["cards", "buttons", "list"].includes(saved)) {
        return saved;
      }
    } catch {
      // Use defaults
    }
    return "cards";
  });

  // Secondary destinations search filter
  const [searchQuery, setSearchQuery] = useState("");
  // Customization modal state
  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);
  const [tempSelectedIds, setTempSelectedIds] = useState(featuredPageIds);
  // Share modal state
  const [sharePoll, setSharePoll] = useState(null);
  // Live stats telemetry
  const [pollsCount, setPollsCount] = useState(0);
  const [totalVotes, setTotalVotes] = useState(0);

  // Sync viewMode changes to localStorage
  const handleSetViewMode = (mode) => {
    setViewMode(mode);
    try {
      localStorage.setItem(STORAGE_KEY_VIEW_MODE, mode);
    } catch {
      // Ignore storage error
    }
  };

  // Fetch telemetry to enrich featured cards
  useEffect(() => {
    const fetchTelemetry = async () => {
      try {
        const data = await api.get("/api/polls");
        if (Array.isArray(data)) {
          setPollsCount(data.length);
          const sumVotes = data.reduce((acc, p) => acc + (p.total_votes || 0), 0);
          setTotalVotes(sumVotes);
        }
      } catch (err) {
        console.warn("Home telemetry error:", err.message);
      }
    };
    fetchTelemetry();
  }, []);

  // Real-time WebSocket connection for live telemetry updates
  useEffect(() => {
    let ws;
    try {
      ws = new WebSocket(getGlobalWSUrl());
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "poll_update") {
            setTotalVotes((prev) => prev + 1);
          }
        } catch {
          // Ignore invalid message
        }
      };
    } catch {
      // WebSocket connection fallback
    }

    return () => {
      if (ws) ws.close();
    };
  }, []);

  // Filtered available destination items based on role
  const availableDestinations = useMemo(() => {
    return PLATFORM_DESTINATIONS.filter((dest) => !dest.requiresAdmin || isAdmin);
  }, [isAdmin]);

  // The 2 featured pages currently active
  const featuredPages = useMemo(() => {
    const map = new Map(availableDestinations.map((d) => [d.id, d]));
    const list = featuredPageIds.map((id) => map.get(id)).filter(Boolean);
    // Fallback if an id wasn't found
    if (list.length < 2) {
      const remaining = availableDestinations.filter((d) => !list.includes(d));
      return [...list, ...remaining].slice(0, 2);
    }
    return list.slice(0, 2);
  }, [featuredPageIds, availableDestinations]);

  // Non-featured options (accessible via Secondary Access Method)
  const secondaryDestinations = useMemo(() => {
    const featuredSet = new Set(featuredPages.map((f) => f.id));
    return availableDestinations.filter((dest) => !featuredSet.has(dest.id));
  }, [featuredPages, availableDestinations]);

  // Secondary destinations filtered by search input
  const filteredSecondaryDestinations = useMemo(() => {
    if (!searchQuery.trim()) return secondaryDestinations;
    const query = searchQuery.toLowerCase();
    return secondaryDestinations.filter(
      (dest) =>
        dest.title.toLowerCase().includes(query) ||
        dest.description.toLowerCase().includes(query) ||
        dest.shortTitle.toLowerCase().includes(query)
    );
  }, [secondaryDestinations, searchQuery]);

  // Handle Customization Modal: toggle selection
  const handleToggleSelectDestination = (id) => {
    if (tempSelectedIds.includes(id)) {
      if (tempSelectedIds.length > 1) {
        setTempSelectedIds(tempSelectedIds.filter((item) => item !== id));
      }
    } else {
      if (tempSelectedIds.length < 2) {
        setTempSelectedIds([...tempSelectedIds, id]);
      } else {
        // Replace second item with newly selected item
        setTempSelectedIds([tempSelectedIds[0], id]);
      }
    }
  };

  // Save customized preferences to localStorage
  const handleSaveCustomization = () => {
    if (tempSelectedIds.length !== 2) {
      alert("Please select exactly 2 pages to be featured on your home page.");
      return;
    }
    setFeaturedPageIds(tempSelectedIds);
    try {
      localStorage.setItem(STORAGE_KEY_FEATURED, JSON.stringify(tempSelectedIds));
    } catch {
      // Ignore storage write error
    }
    setIsCustomizeOpen(false);
  };

  // Reset to default fixed configuration
  const handleResetToDefault = () => {
    const defaultIds = ["polls", "games"];
    setTempSelectedIds(defaultIds);
    setFeaturedPageIds(defaultIds);
    try {
      localStorage.setItem(STORAGE_KEY_FEATURED, JSON.stringify(defaultIds));
    } catch {
      // Ignore storage write error
    }
    setIsCustomizeOpen(false);
  };

  return (
    <div className="vox-home-minimal-container">
      {/* 1. MINIMAL HERO HEADER */}
      <div className="vox-minimal-header">
        <div className="vox-minimal-title-wrap">
          <div className="brand-glow-badge" style={{ marginBottom: "8px" }}>
            <span style={{ fontSize: "0.85rem" }}>💜</span>
            <span>Your Voice Drives What's Next</span>
          </div>

          <h1 className="vox-minimal-title">
            Small Vote. <span className="vox-gradient-text">Bigger Impact.</span>
          </h1>

          <p className="vox-minimal-subtitle">
            Welcome to Voxentra. Access our two primary real-time experiences below,
            or browse all platform features directly.
          </p>
        </div>

        {/* View Mode & Customization Controls */}
        <div className="vox-minimal-controls">
          {/* Format Switcher: Cards | Buttons | List */}
          <div className="vox-view-toggle-bar" title="Switch layout format for featured pages">
            <button
              onClick={() => handleSetViewMode("cards")}
              className={`vox-view-toggle-btn ${viewMode === "cards" ? "active" : ""}`}
              aria-label="Cards View"
            >
              <LayoutGrid size={14} />
              <span>Cards</span>
            </button>
            <button
              onClick={() => handleSetViewMode("buttons")}
              className={`vox-view-toggle-btn ${viewMode === "buttons" ? "active" : ""}`}
              aria-label="Buttons View"
            >
              <SlidersHorizontal size={14} />
              <span>Buttons</span>
            </button>
            <button
              onClick={() => handleSetViewMode("list")}
              className={`vox-view-toggle-btn ${viewMode === "list" ? "active" : ""}`}
              aria-label="List View"
            >
              <List size={14} />
              <span>List</span>
            </button>
          </div>

          {/* Customize Featured Pages Button */}
          <button
            onClick={() => {
              setTempSelectedIds(featuredPageIds);
              setIsCustomizeOpen(true);
            }}
            className="vox-customize-btn"
            title="Customize which two pages are featured on your home page"
          >
            <Settings size={14} />
            <span>Customize (2 Pages)</span>
          </button>
        </div>
      </div>

      {/* 2. PRIMARY NAVIGATION ELEMENTS: THE TWO FEATURED PAGES */}
      {viewMode === "cards" && (
        <div className="vox-featured-duo-grid">
          {featuredPages.map((page) => {
            const Icon = page.icon;

            return (
              <div
                key={page.id}
                className={`vox-featured-card theme-${page.theme}`}
                onClick={() => navigate(page.path)}
                style={{ cursor: "pointer" }}
              >
                <div>
                  {/* Top Meta Header */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
                    <div className="vox-featured-icon-badge">
                      <Icon size={30} />
                    </div>
                    <span
                      style={{
                        padding: "6px 14px",
                        borderRadius: "9999px",
                        fontSize: "0.78rem",
                        fontWeight: 700,
                        letterSpacing: "0.04em",
                        textTransform: "uppercase",
                        background: "rgba(255, 255, 255, 0.06)",
                        border: "1px solid rgba(255, 255, 255, 0.12)",
                        color: "inherit",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <span className="pulse-dot-green" />
                      <span>{page.badgeText}</span>
                    </span>
                  </div>

                  {/* Title & Tagline */}
                  <div style={{ fontSize: "0.82rem", fontWeight: 700, opacity: 0.8, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" }}>
                    {page.tagline}
                  </div>
                  <h2 className="vox-featured-card-title">{page.title}</h2>
                  <p className="vox-featured-card-desc">{page.description}</p>

                  {/* Live Stats Preview */}
                  <div className="vox-featured-card-stats">
                    {page.id === "polls" ? (
                      <>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: "#38bdf8", fontWeight: 700 }}>
                          <Radio size={14} />
                          <span>{pollsCount > 0 ? `${pollsCount} Active Polls` : "Live Voting Online"}</span>
                        </span>
                        <span style={{ color: "var(--text-dim)" }}>•</span>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: "var(--text-muted)" }}>
                          <Vote size={14} />
                          <span>{totalVotes.toLocaleString()} Votes Cast</span>
                        </span>
                      </>
                    ) : page.id === "games" ? (
                      <>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: "#f472b6", fontWeight: 700 }}>
                          <Gamepad2 size={14} />
                          <span>Color Match & Snake</span>
                        </span>
                        <span style={{ color: "var(--text-dim)" }}>•</span>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: "var(--text-muted)" }}>
                          <Flame size={14} color="#f59e0b" />
                          <span>Double Points Active</span>
                        </span>
                      </>
                    ) : (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: "var(--text-muted)" }}>
                        <Sparkles size={14} />
                        <span>{page.statsLabel}</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Primary Action Button */}
                <button
                  className="vox-featured-action-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(page.path);
                  }}
                  style={{
                    background:
                      page.theme === "cyan"
                        ? "linear-gradient(135deg, #0284c7 0%, #06b6d4 100%)"
                        : page.theme === "pink"
                        ? "linear-gradient(135deg, #db2777 0%, #ec4899 100%)"
                        : page.theme === "purple"
                        ? "linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%)"
                        : "linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)",
                    color: "#ffffff",
                    boxShadow: "0 8px 24px rgba(0, 0, 0, 0.35)",
                  }}
                >
                  <span>{page.primaryActionText}</span>
                  <ArrowRight size={18} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* VIEW MODE 2: MEGA BUTTONS */}
      {viewMode === "buttons" && (
        <div className="vox-featured-duo-buttons">
          {featuredPages.map((page) => {
            const Icon = page.icon;
            return (
              <button
                key={page.id}
                className="vox-featured-mega-btn"
                onClick={() => navigate(page.path)}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "16px", textAlign: "left" }}>
                  <div style={{
                    width: "52px",
                    height: "52px",
                    borderRadius: "14px",
                    background: "rgba(255, 255, 255, 0.08)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}>
                    <Icon size={26} color="#ffffff" />
                  </div>
                  <div>
                    <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#c084fc", textTransform: "uppercase" }}>
                      {page.badgeText}
                    </div>
                    <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "#ffffff", marginTop: "2px" }}>
                      {page.title}
                    </div>
                    <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: "4px" }}>
                      {page.description.slice(0, 75)}...
                    </div>
                  </div>
                </div>
                <div style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  background: "rgba(255, 255, 255, 0.08)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}>
                  <ArrowRight size={18} color="#ffffff" />
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* VIEW MODE 3: STACKED LIST ITEMS */}
      {viewMode === "list" && (
        <div className="vox-featured-duo-list">
          {featuredPages.map((page) => {
            const Icon = page.icon;
            return (
              <div
                key={page.id}
                className="vox-featured-list-item"
                onClick={() => navigate(page.path)}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "18px" }}>
                  <div style={{
                    width: "46px",
                    height: "46px",
                    borderRadius: "12px",
                    background: "rgba(255, 255, 255, 0.08)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}>
                    <Icon size={22} color="#ffffff" />
                  </div>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <h3 style={{ fontSize: "1.12rem", fontWeight: 800, color: "#ffffff" }}>
                        {page.title}
                      </h3>
                      <span style={{ fontSize: "0.72rem", padding: "2px 8px", borderRadius: "9999px", background: "rgba(139, 92, 246, 0.2)", color: "#c084fc", fontWeight: 700 }}>
                        {page.badgeText}
                      </span>
                    </div>
                    <p style={{ fontSize: "0.86rem", color: "var(--text-muted)", marginTop: "2px" }}>
                      {page.description}
                    </p>
                  </div>
                </div>

                <button
                  className="btn-vox-secondary"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(page.path);
                  }}
                  style={{ whiteSpace: "nowrap", padding: "8px 18px", fontSize: "0.88rem" }}
                >
                  <span>Launch</span>
                  <ArrowRight size={15} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* 3. SECONDARY ACCESS METHOD: ALL DESTINATIONS & ADDITIONAL FEATURES */}
      <section className="vox-secondary-hub-section">
        <div className="vox-secondary-hub-header">
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#a78bfa", fontSize: "0.82rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" }}>
              <Sparkles size={14} />
              <span>Secondary Access Method</span>
            </div>
            <h2 style={{ fontSize: "1.45rem", fontWeight: 800, color: "#ffffff" }}>
              Explore Other Destinations
            </h2>
            <p style={{ fontSize: "0.88rem", color: "var(--text-muted)" }}>
              Access secondary platform features and options directly.
            </p>
          </div>

          {/* Quick Search Bar for Instant Destination Jump */}
          <div className="vox-secondary-search-bar">
            <Search size={16} color="var(--text-muted)" />
            <input
              type="text"
              placeholder="Search or jump to feature..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                background: "none",
                border: "none",
                color: "#ffffff",
                fontSize: "0.85rem",
                width: "100%",
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "0.8rem" }}
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Secondary Destination Cards Grid */}
        <div className="vox-secondary-grid">
          {filteredSecondaryDestinations.map((dest) => {
            const Icon = dest.icon;
            return (
              <div
                key={dest.id}
                className="vox-secondary-card"
                onClick={() => navigate(dest.path)}
                title={`Navigate to ${dest.title}`}
              >
                <div style={{
                  width: "42px",
                  height: "42px",
                  borderRadius: "12px",
                  background: "rgba(255, 255, 255, 0.05)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}>
                  <Icon size={20} color="#ffffff" />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                    <div style={{ fontSize: "0.98rem", fontWeight: 700, color: "#ffffff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {dest.title}
                    </div>
                    <ArrowRight size={14} color="var(--text-dim)" />
                  </div>
                  <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginTop: "4px", lineHeight: 1.4 }}>
                    {dest.description.slice(0, 68)}...
                  </p>
                </div>
              </div>
            );
          })}

          {/* Quick Secondary Utility: Share & Referral Modal */}
          <div
            className="vox-secondary-card"
            onClick={() => setSharePoll({ id: "general", title: "Voxentra — Small Votes, Big Impact" })}
            title="Open platform share modal"
          >
            <div style={{
              width: "42px",
              height: "42px",
              borderRadius: "12px",
              background: "rgba(59, 130, 246, 0.12)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}>
              <Share2 size={20} color="#60a5fa" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                <div style={{ fontSize: "0.98rem", fontWeight: 700, color: "#ffffff" }}>
                  Share & Invite Friends
                </div>
                <ArrowRight size={14} color="var(--text-dim)" />
              </div>
              <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginTop: "4px", lineHeight: 1.4 }}>
                Copy invite links or scan QR code to bring peers to Voxentra.
              </p>
            </div>
          </div>

          {/* If user is Admin, direct Poll Creator shortcut */}
          {isAdmin && (
            <div
              className="vox-secondary-card"
              onClick={() => navigate("/create-poll")}
              title="Quickly create a new live poll"
              style={{
                borderColor: "rgba(16, 185, 129, 0.3)",
                background: "rgba(16, 185, 129, 0.05)",
              }}
            >
              <div style={{
                width: "42px",
                height: "42px",
                borderRadius: "12px",
                background: "rgba(16, 185, 129, 0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}>
                <Plus size={20} color="#34d399" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                  <div style={{ fontSize: "0.98rem", fontWeight: 700, color: "#34d399" }}>
                    + Create New Poll
                  </div>
                  <ArrowRight size={14} color="#34d399" />
                </div>
                <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginTop: "4px", lineHeight: 1.4 }}>
                  Launch new live community polls and questions instantly.
                </p>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 4. CUSTOMIZE FEATURED PAGES MODAL (PERSISTENCE IN LOCALSTORAGE) */}
      {isCustomizeOpen && (
        <div className="vox-customize-modal-backdrop" onClick={() => setIsCustomizeOpen(false)}>
          <div className="vox-customize-modal-card" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
              <div>
                <h3 style={{ fontSize: "1.3rem", fontWeight: 800, color: "#ffffff" }}>
                  Customize Featured Home Pages
                </h3>
                <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: "4px" }}>
                  Select exactly 2 pages to be prominently featured on your Home page. Preferences persist automatically for future visits.
                </p>
              </div>
            </div>

            {/* Destination Selection Checklist */}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", margin: "20px 0" }}>
              {availableDestinations.map((dest) => {
                const Icon = dest.icon;
                const isSelected = tempSelectedIds.includes(dest.id);

                return (
                  <div
                    key={dest.id}
                    onClick={() => handleToggleSelectDestination(dest.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "14px 18px",
                      borderRadius: "14px",
                      background: isSelected ? "rgba(139, 92, 246, 0.16)" : "rgba(255, 255, 255, 0.03)",
                      border: isSelected ? "1px solid #a855f7" : "1px solid rgba(255, 255, 255, 0.08)",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                      <div style={{
                        width: "36px",
                        height: "36px",
                        borderRadius: "10px",
                        background: "rgba(255, 255, 255, 0.08)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}>
                        <Icon size={18} color="#ffffff" />
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, color: "#ffffff", fontSize: "0.95rem" }}>
                          {dest.title}
                        </div>
                        <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "2px" }}>
                          {dest.tagline}
                        </div>
                      </div>
                    </div>

                    <div style={{
                      width: "24px",
                      height: "24px",
                      borderRadius: "6px",
                      border: isSelected ? "1px solid #a855f7" : "1px solid var(--text-dim)",
                      background: isSelected ? "#7c3aed" : "transparent",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}>
                      {isSelected && <Check size={16} color="#ffffff" />}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Selection Counter Note */}
            <div style={{
              fontSize: "0.82rem",
              color: tempSelectedIds.length === 2 ? "#34d399" : "#fbbf24",
              marginBottom: "24px",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}>
              {tempSelectedIds.length === 2 ? (
                <>
                  <CheckCircle2 size={15} />
                  <span>Ready: 2 of 2 featured pages selected.</span>
                </>
              ) : (
                <>
                  <Info size={15} />
                  <span>Please choose 2 featured pages ({tempSelectedIds.length} currently selected).</span>
                </>
              )}
            </div>

            {/* Actions */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
              <button
                onClick={handleResetToDefault}
                style={{
                  background: "none",
                  border: "none",
                  color: "#94a3b8",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  cursor: "pointer",
                }}
              >
                <RotateCcw size={14} />
                <span>Reset to Default (Polls + Games)</span>
              </button>

              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  onClick={() => setIsCustomizeOpen(false)}
                  className="btn-vox-secondary"
                  style={{ padding: "8px 18px", fontSize: "0.9rem" }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveCustomization}
                  disabled={tempSelectedIds.length !== 2}
                  className="btn-vox-primary"
                  style={{ padding: "8px 22px", fontSize: "0.9rem" }}
                >
                  Save & Persist
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. SHARE MODAL INTEGRATION */}
      {sharePoll && (
        <ShareModal
          poll={sharePoll}
          isOpen={Boolean(sharePoll)}
          onClose={() => setSharePoll(null)}
        />
      )}
    </div>
  );
};

export default Home;
