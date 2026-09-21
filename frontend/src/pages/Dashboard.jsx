import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api, getGlobalWSUrl, getPollWSUrl } from "../api/client";
import { 
  BarChart2, MessageSquare, Award, Flame, Trophy, Share2, 
  CheckCircle2, Clock, Copy, Check, Sparkles, ArrowRight,
  Vote, Send, RefreshCw, QrCode, Gamepad2, Palette, Shield,
  Plus, Trash2, Calendar, AlertTriangle, Eye, Edit3, History, X
} from "lucide-react";
import { showToast } from "../components/Toast";
import { ShareModal } from "../components/ShareModal";
import confetti from "canvas-confetti";

export const Dashboard = ({ navigate: propNavigate }) => {
  const routerNavigate = useNavigate();
  const navigate = (to) => {
    if (typeof to === "string") {
      if (to === "home") routerNavigate("/home");
      else if (to === "polls" || to === "voting") routerNavigate("/voting");
      else if (to === "games") routerNavigate("/games");
      else if (to === "admin") routerNavigate("/admin");
      else if (to.startsWith("poll-")) routerNavigate(`/poll/${to.replace("poll-", "")}`);
      else routerNavigate(to.startsWith("/") ? to : `/${to}`);
    } else if (propNavigate) {
      propNavigate(to);
    } else {
      routerNavigate(to);
    }
  };
  const { user, isAuthenticated, isAdmin, openAuthModal } = useAuth();
  
  const [activeSection, setActiveSection] = useState("voting"); // "voting" | "commentary" | "history"
  const [dashboardData, setDashboardData] = useState(null);
  const [polls, setPolls] = useState([]);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [votingLoading, setVotingLoading] = useState({});
  const [votingSuccess, setVotingSuccess] = useState({});
  const [sharePoll, setSharePoll] = useState(null);
  const [copied, setCopied] = useState(false);

  // Admin Question Creation State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createTab, setCreateTab] = useState("form"); // "form" | "preview"
  const [createForm, setCreateForm] = useState({
    title: "",
    description: "",
    category: "Technology",
    options: ["", ""],
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    durationMinutes: 60,
    selectionType: "single",
    resultVisibility: "immediate",
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState("");

  // Admin Timing & Schedule Management State
  const [timingModalPoll, setTimingModalPoll] = useState(null);
  const [timingDuration, setTimingDuration] = useState(60);
  const [timingTimezone, setTimingTimezone] = useState("UTC");
  const [timingLoading, setTimingLoading] = useState(false);
  const [timingError, setTimingError] = useState("");
  const [showHistoryModal, setShowHistoryModal] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // Load Fresh Data with Zero Stale State
  const loadFreshDashboard = async () => {
    setLoading(true);
    try {
      const [dash, pollsList, comms] = await Promise.all([
        api.get("/api/user/dashboard"),
        api.get("/api/polls"),
        api.get("/api/comments?target_id=global"),
      ]);
      setDashboardData(dash || null);
      setPolls(pollsList || []);
      setComments(comms || []);
    } catch (err) {
      console.warn("Failed to load dashboard:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadFreshDashboard();
    } else {
      setLoading(false);
    }
  }, [isAuthenticated]);

  // Real-time WebSocket for live votes & commentary
  useEffect(() => {
    let ws;
    try {
      ws = new WebSocket(getGlobalWSUrl());
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "poll_update") {
            setPolls((prev) =>
              prev.map((p) => {
                if (p.id === msg.poll_id) {
                  const updatedOpts = p.options.map((opt) => {
                    const votes = msg.option_votes?.[opt.id] ?? opt.votes;
                    const pct = msg.total_votes > 0 ? (votes / msg.total_votes) * 100 : 0;
                    return { ...opt, votes, percentage: Math.round(pct * 10) / 10 };
                  });
                  return { ...p, total_votes: msg.total_votes, options: updatedOpts };
                }
                return p;
              })
            );
          } else if (msg.type === "comment_add") {
            setComments((prev) => [msg.comment, ...prev]);
          }
        } catch (e) {
          console.error(e);
        }
      };
    } catch (e) {
      console.warn(e);
    }
    return () => {
      if (ws) ws.close();
    };
  }, []);

  // Handle Instant Vote Cast
  const handleVote = async (pollId, optionId) => {
    if (!isAuthenticated) {
      openAuthModal("register", pollId);
      return;
    }

    setVotingLoading((prev) => ({ ...prev, [pollId]: true }));
    try {
      await api.post(`/api/polls/${pollId}/vote`, {
        option_id: optionId,
        referral_source: "dashboard",
      });

      confetti({ particleCount: 60, spread: 60, origin: { y: 0.7 } });
      showToast("Vote recorded successfully! +10 XP added.");
      setVotingSuccess((prev) => ({ ...prev, [pollId]: optionId }));

      // Reload dashboard stats and history freshly
      loadFreshDashboard();
    } catch (err) {
      showToast(err.message || "Failed to vote", "error");
    } finally {
      setVotingLoading((prev) => ({ ...prev, [pollId]: false }));
    }
  };

  // Handle Live Commentary Post
  const handlePostComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    try {
      await api.post("/api/comments", {
        target_id: "global",
        content: newComment.trim(),
      });
      setNewComment("");
      showToast("Comment published to live stream!");
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  // Admin: Create Question Handlers
  const handleAddOption = () => {
    if (createForm.options.length < 10) {
      setCreateForm((prev) => ({ ...prev, options: [...prev.options, ""] }));
    }
  };

  const handleRemoveOption = (index) => {
    if (createForm.options.length > 2) {
      setCreateForm((prev) => ({
        ...prev,
        options: prev.options.filter((_, i) => i !== index),
      }));
    }
  };

  const handleOptionChange = (index, value) => {
    const next = [...createForm.options];
    next[index] = value;
    setCreateForm((prev) => ({ ...prev, options: next }));
  };

  const handleCreatePoll = async (status) => {
    setCreateError("");
    const trimmedTitle = createForm.title.trim();
    if (!trimmedTitle || trimmedTitle.length < 3) {
      setCreateError("Question title must be at least 3 characters long.");
      return;
    }

    const cleanOptions = createForm.options.map((o) => o.trim()).filter(Boolean);
    if (cleanOptions.length < 2) {
      setCreateError("Please provide at least 2 non-empty options.");
      return;
    }

    const unique = new Set(cleanOptions.map((o) => o.toLowerCase()));
    if (unique.size !== cleanOptions.length) {
      setCreateError("Options must be unique (no duplicates).");
      return;
    }

    const dur = Number(createForm.durationMinutes);
    if (dur < 25 || dur > 120) {
      setCreateError("Voting period duration must be between 25 and 120 minutes.");
      return;
    }

    setCreateLoading(true);
    try {
      const payload = {
        title: trimmedTitle,
        description: createForm.description.trim(),
        category: createForm.category,
        options: cleanOptions,
        duration_minutes: dur,
        timezone: createForm.timezone,
        selection_type: createForm.selectionType,
        result_visibility: createForm.resultVisibility,
        status: status, // "active" or "draft"
        is_active: status === "active",
      };

      await api.post("/api/admin/polls", payload);
      showToast(status === "active" ? "Voting question published live!" : "Question saved as draft successfully!");
      setShowCreateModal(false);
      setCreateForm({
        title: "",
        description: "",
        category: "Technology",
        options: ["", ""],
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        durationMinutes: 60,
        selectionType: "single",
        resultVisibility: "immediate",
      });
      loadFreshDashboard();
    } catch (err) {
      setCreateError(err.message || "Failed to create question");
    } finally {
      setCreateLoading(false);
    }
  };

  // Admin: Timing & Schedule Handlers
  const handleOpenTimingModal = (poll) => {
    setTimingModalPoll(poll);
    setTimingDuration(poll.duration_minutes || 60);
    setTimingTimezone(poll.timezone || "UTC");
    setTimingError("");
  };

  const handleQuickAdjust = (mins) => {
    setTimingDuration((prev) => Math.max(25, Math.min(120, prev + mins)));
  };

  const handleSaveTiming = async () => {
    if (!timingModalPoll) return;
    setTimingError("");
    setTimingLoading(true);
    try {
      await api.put(`/api/admin/polls/${timingModalPoll.id}`, {
        duration_minutes: Number(timingDuration),
        timezone: timingTimezone,
      });
      showToast("Voting schedule updated successfully!");
      setTimingModalPoll(null);
      loadFreshDashboard();
    } catch (err) {
      setTimingError(err.message || "Failed to update timing");
    } finally {
      setTimingLoading(false);
    }
  };

  const handleClosePollEarly = async () => {
    if (!timingModalPoll) return;
    if (!window.confirm(`Close voting early for "${timingModalPoll.title}"? Current voters will see results immediately.`)) {
      return;
    }
    setTimingLoading(true);
    try {
      await api.patch(`/api/admin/polls/${timingModalPoll.id}/end`, {});
      showToast("Voting session closed early.");
      setTimingModalPoll(null);
      loadFreshDashboard();
    } catch (err) {
      setTimingError(err.message || "Failed to close poll");
    } finally {
      setTimingLoading(false);
    }
  };

  const handleOpenHistoryModal = async (poll) => {
    setShowHistoryModal(poll);
    setLogsLoading(true);
    try {
      const logs = await api.get(`/api/admin/polls/${poll.id}/audit-logs`);
      setAuditLogs(logs || []);
    } catch (err) {
      setAuditLogs([]);
    } finally {
      setLogsLoading(false);
    }
  };

  const getTimingStatus = (poll) => {
    if (!poll.is_active && (poll.status === "ended" || poll.status === "closed")) {
      return { label: "Closed", color: "#ef4444", bg: "rgba(239, 68, 68, 0.15)" };
    }
    if (poll.status === "draft") {
      return { label: "Draft", color: "#94a3b8", bg: "rgba(148, 163, 184, 0.15)" };
    }
    if (poll.status === "upcoming") {
      return { label: "Upcoming", color: "#f59e0b", bg: "rgba(245, 158, 11, 0.15)" };
    }
    if (poll.is_escalated) {
      return { label: "Extended", color: "#a855f7", bg: "rgba(168, 85, 247, 0.15)" };
    }
    return { label: "Active", color: "#10b981", bg: "rgba(168, 85, 129, 0.15)" };
  };

  const referralUrl = `${window.location.origin}/?ref=${user?.username || "friend"}`;

  const handleCopyReferral = () => {
    navigator.clipboard.writeText(referralUrl);
    setCopied(true);
    showToast("Referral link copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: "1.1rem" }}>
        <RefreshCw size={24} className="animate-spin" style={{ marginRight: "10px" }} />
        Initializing your Voxentra Dashboard...
      </div>
    );
  }

  const votedPolls = dashboardData?.voted_polls || [];
  const userGameScores = dashboardData?.game_scores || [];
  const activePolls = polls.filter((p) => p.is_active && !p.is_archived);

  return (
    <div className="vox-page-container">
      {/* Top Banner: User Identity & High-Level Statistics */}
      <div className="glass-panel" style={{
        padding: "32px",
        marginBottom: "32px",
        background: "linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(6, 182, 212, 0.1) 100%)",
        border: "1px solid rgba(139, 92, 246, 0.3)",
      }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "24px",
        }}>
          {/* User Profile */}
          <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
            <img
              src={user?.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${user?.username}`}
              alt={user?.username}
              style={{
                width: "76px",
                height: "76px",
                borderRadius: "50%",
                border: "3px solid #8b5cf6",
                boxShadow: "0 0 25px rgba(139, 92, 246, 0.5)",
              }}
            />
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <h1 style={{ fontSize: "1.9rem", fontWeight: 900, color: "#ffffff", letterSpacing: "-0.01em" }}>
                  {user?.username}
                </h1>
                <span style={{
                  background: "rgba(16, 185, 129, 0.15)",
                  color: "#34d399",
                  border: "1px solid rgba(16, 185, 129, 0.35)",
                  padding: "3px 12px",
                  borderRadius: "9999px",
                  fontSize: "0.78rem",
                  fontWeight: 800,
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                }}>
                  <Shield size={12} /> Verified Voter
                </span>
              </div>
              <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginTop: "4px" }}>
                {user?.email} · Member of Voxentra Community
              </p>
            </div>
          </div>

          {/* User Gamified Stats Counters */}
          <div style={{ display: "flex", alignItems: "center", gap: "28px", flexWrap: "wrap" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "4px", color: "#fbbf24", fontSize: "1.7rem", fontWeight: 900 }}>
                <Flame size={22} />
                <span>{user?.points || 50}</span>
              </div>
              <span style={{ fontSize: "0.75rem", color: "var(--text-dim)", textTransform: "uppercase", fontWeight: 700 }}>
                Total XP Earned
              </span>
            </div>

            <div style={{ textAlign: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "4px", color: "#22d3ee", fontSize: "1.7rem", fontWeight: 900 }}>
                <Vote size={22} />
                <span>{votedPolls.length}</span>
              </div>
              <span style={{ fontSize: "0.75rem", color: "var(--text-dim)", textTransform: "uppercase", fontWeight: 700 }}>
                Votes Cast
              </span>
            </div>

            <div style={{ textAlign: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "4px", color: "#a855f7", fontSize: "1.7rem", fontWeight: 900 }}>
                <Gamepad2 size={22} />
                <span>{userGameScores.length}</span>
              </div>
              <span style={{ fontSize: "0.75rem", color: "var(--text-dim)", textTransform: "uppercase", fontWeight: 700 }}>
                Games Played
              </span>
            </div>

            <button
              className="btn-vox-secondary"
              onClick={handleCopyReferral}
              style={{ display: "flex", alignItems: "center", gap: "6px", padding: "10px 18px", fontSize: "0.85rem" }}
            >
              {copied ? <Check size={16} /> : <Share2 size={16} />}
              <span>{copied ? "Link Copied!" : "Invite Friends"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* DASHBOARD NAVIGATION TABS */}
      <div className="vox-scroll-pills" style={{
        marginBottom: "28px",
        borderBottom: "1px solid var(--border-subtle)",
        paddingBottom: "14px",
      }}>
        <button
          onClick={() => setActiveSection("voting")}
          style={{
            background: activeSection === "voting" ? "rgba(139, 92, 246, 0.2)" : "transparent",
            border: activeSection === "voting" ? "1px solid #8b5cf6" : "1px solid transparent",
            color: activeSection === "voting" ? "#ffffff" : "var(--text-muted)",
            padding: "10px 20px",
            borderRadius: "10px",
            fontWeight: 700,
            fontSize: "0.95rem",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            transition: "all 0.2s ease",
          }}
        >
          <Vote size={18} color={activeSection === "voting" ? "#c084fc" : "currentColor"} />
          Live Voting Arena
        </button>

        <button
          onClick={() => setActiveSection("commentary")}
          style={{
            background: activeSection === "commentary" ? "rgba(6, 182, 212, 0.2)" : "transparent",
            border: activeSection === "commentary" ? "1px solid #06b6d4" : "1px solid transparent",
            color: activeSection === "commentary" ? "#ffffff" : "var(--text-muted)",
            padding: "10px 20px",
            borderRadius: "10px",
            fontWeight: 700,
            fontSize: "0.95rem",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            transition: "all 0.2s ease",
          }}
        >
          <MessageSquare size={18} color={activeSection === "commentary" ? "#22d3ee" : "currentColor"} />
          Real-Time Commentary
        </button>

        <button
          onClick={() => setActiveSection("history")}
          style={{
            background: activeSection === "history" ? "rgba(251, 191, 36, 0.2)" : "transparent",
            border: activeSection === "history" ? "1px solid #fbbf24" : "1px solid transparent",
            color: activeSection === "history" ? "#ffffff" : "var(--text-muted)",
            padding: "10px 20px",
            borderRadius: "10px",
            fontWeight: 700,
            fontSize: "0.95rem",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            transition: "all 0.2s ease",
          }}
        >
          <Award size={18} color={activeSection === "history" ? "#fbbf24" : "currentColor"} />
          Participation History & Stats
        </button>
      </div>

      {/* SECTION 1: LIVE VOTING INTERFACE */}
      {activeSection === "voting" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
            <div>
              <h2 style={{ fontSize: "1.5rem", fontWeight: 800, color: "#ffffff" }}>
                Active Voting Sessions
              </h2>
              <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                Each poll session starts fresh with zero stale votes. Click an option below to cast your authenticated vote!
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              {isAdmin && (
                <button
                  className="btn-vox-primary"
                  onClick={() => {
                    setCreateTab("form");
                    setCreateError("");
                    setShowCreateModal(true);
                  }}
                  style={{ padding: "8px 16px", fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "6px" }}
                >
                  <Plus size={16} /> Create Question
                </button>
              )}
              <button className="btn-vox-secondary" onClick={loadFreshDashboard} style={{ padding: "8px 14px", fontSize: "0.82rem" }}>
                <RefreshCw size={14} /> Refresh Polls
              </button>
            </div>
          </div>

          <div className="vox-dashboard-grid">
            {activePolls.map((poll) => {
              const userVotedOpt = votedPolls.find((v) => v.poll_id === poll.id)?.option_id || votingSuccess[poll.id];

              return (
                <div key={poll.id} className="glass-panel" style={{ padding: "26px" }}>
                  {/* Clean Question Header - No Category / No Idea tag */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span className="pulse-dot-green" />
                      <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#34d399" }}>
                        {poll.is_active ? "Live Election Round" : "Voting Concluded"}
                      </span>
                      {isAdmin && (
                        <span style={{
                          padding: "2px 8px",
                          borderRadius: "9999px",
                          fontSize: "0.72rem",
                          fontWeight: 800,
                          color: getTimingStatus(poll).color,
                          background: getTimingStatus(poll).bg,
                          border: `1px solid ${getTimingStatus(poll).color}40`,
                          textTransform: "uppercase",
                        }}>
                          {getTimingStatus(poll).label}
                        </span>
                      )}
                    </div>

                    <button 
                      onClick={() => navigate(`poll-${poll.id}`)}
                      style={{ background: "none", color: "#818cf8", fontSize: "0.8rem", fontWeight: 700, cursor: "pointer" }}
                    >
                      Open Full View →
                    </button>
                  </div>

                  <h3 
                    onClick={() => navigate(`poll-${poll.id}`)}
                    style={{
                      fontSize: "1.25rem",
                      fontWeight: 800,
                      color: "#ffffff",
                      marginBottom: "8px",
                      lineHeight: "1.35",
                      cursor: "pointer",
                    }}
                  >
                    {poll.title}
                  </h3>
                  {poll.description && (
                    <p style={{ fontSize: "0.9rem", color: "#94a3b8", marginBottom: "16px", lineHeight: "1.5" }}>
                      {poll.description}
                    </p>
                  )}

                  {/* Distinct Separated Metric Counters */}
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: "8px",
                    marginBottom: "18px",
                  }}>
                    <div style={{
                      background: "rgba(15, 23, 42, 0.5)",
                      border: "1px solid rgba(255, 255, 255, 0.06)",
                      borderRadius: "8px",
                      padding: "8px 10px",
                      textAlign: "center",
                    }}>
                      <div style={{ fontSize: "0.68rem", color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>Total Votes</div>
                      <div style={{ fontSize: "1rem", fontWeight: 800, color: "#ffffff" }}>{poll.total_votes || 0}</div>
                    </div>
                    <div style={{
                      background: "rgba(15, 23, 42, 0.5)",
                      border: "1px solid rgba(255, 255, 255, 0.06)",
                      borderRadius: "8px",
                      padding: "8px 10px",
                      textAlign: "center",
                    }}>
                      <div style={{ fontSize: "0.68rem", color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>Total Views</div>
                      <div style={{ fontSize: "1rem", fontWeight: 800, color: "#22d3ee" }}>{poll.views || 10420}</div>
                    </div>
                    <div style={{
                      background: "rgba(15, 23, 42, 0.5)",
                      border: "1px solid rgba(255, 255, 255, 0.06)",
                      borderRadius: "8px",
                      padding: "8px 10px",
                      textAlign: "center",
                    }}>
                      <div style={{ fontSize: "0.68rem", color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>Answers</div>
                      <div style={{ fontSize: "1rem", fontWeight: 800, color: "#f472b6" }}>{poll.total_votes ? Math.round(poll.total_votes / 16) : 54}</div>
                    </div>
                  </div>

                  {/* Clean Options List matching Screenshot 2 with circular radio indicators */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" }}>
                    {poll.options.map((opt) => {
                      const isVoted = userVotedOpt === opt.id;
                      const showResults = Boolean(userVotedOpt) || !poll.is_active;

                      return (
                        <div
                          key={opt.id}
                          onClick={() => !userVotedOpt && handleVote(poll.id, opt.id)}
                          className={`screenshot2-option-row ${isVoted ? "selected" : ""}`}
                          style={{
                            padding: "12px 16px",
                            borderRadius: "10px",
                            cursor: userVotedOpt ? "default" : "pointer",
                          }}
                        >
                          {/* Progress fill */}
                          {showResults && (
                            <div
                              className="screenshot2-option-progress"
                              style={{ width: `${opt.percentage || 0}%` }}
                            />
                          )}

                          {/* Circular Radio Indicator */}
                          <div className="screenshot2-radio-circle">
                            {isVoted && <div className="screenshot2-radio-inner-dot" />}
                          </div>

                          <span className="screenshot2-option-text" style={{ fontSize: "0.95rem" }}>
                            {opt.text}
                          </span>

                          {showResults && (
                            <span className="screenshot2-option-pct">
                              {opt.percentage || 0}%
                              <span style={{ fontSize: "0.75rem", color: "var(--text-dim)", marginLeft: "4px" }}>
                                ({opt.votes})
                              </span>
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Poll Actions */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--border-subtle)", paddingTop: "14px" }}>
                    <span style={{ fontSize: "0.8rem", color: userVotedOpt ? "#34d399" : "var(--text-dim)", fontWeight: 700 }}>
                      {userVotedOpt ? "✓ You voted on this poll" : "1 vote per user"}
                    </span>
                    <button
                      className="btn-vox-secondary"
                      onClick={() => setSharePoll(poll)}
                      style={{ padding: "6px 14px", fontSize: "0.8rem", display: "flex", alignItems: "center", gap: "6px" }}
                    >
                      <Share2 size={14} /> Share & QR
                    </button>
                  </div>

                  {/* Admin Scheduling Toolbar */}
                  {isAdmin && (
                    <div style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginTop: "14px",
                      paddingTop: "12px",
                      borderTop: "1px dashed rgba(255, 255, 255, 0.08)",
                      flexWrap: "wrap",
                      gap: "8px",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.78rem", color: "#94a3b8" }}>
                        <Clock size={13} color="#38bdf8" />
                        <span>{poll.duration_minutes || 60}m · {poll.timezone || "UTC"}</span>
                      </div>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button
                          className="btn-vox-secondary"
                          onClick={() => handleOpenTimingModal(poll)}
                          style={{
                            padding: "4px 12px",
                            fontSize: "0.75rem",
                            display: "flex",
                            alignItems: "center",
                            gap: "5px",
                            color: "#38bdf8",
                            borderColor: "rgba(56, 189, 248, 0.35)",
                          }}
                        >
                          <Clock size={12} /> Timing
                        </button>
                        <button
                          className="btn-vox-secondary"
                          onClick={() => handleOpenHistoryModal(poll)}
                          style={{
                            padding: "4px 12px",
                            fontSize: "0.75rem",
                            display: "flex",
                            alignItems: "center",
                            gap: "5px",
                            color: "#c084fc",
                            borderColor: "rgba(192, 132, 252, 0.35)",
                          }}
                        >
                          <History size={12} /> Log
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SECTION 2: REAL-TIME COMMENTARY STREAM */}
      {activeSection === "commentary" && (
        <div className="glass-panel" style={{ padding: "28px" }}>
          <div style={{ marginBottom: "20px" }}>
            <h2 style={{ fontSize: "1.5rem", fontWeight: 800, color: "#ffffff", marginBottom: "4px" }}>
              Live Community Commentary
            </h2>
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
              Engage with voters and players across ongoing sessions in real-time.
            </p>
          </div>

          {/* New Comment Box */}
          <form onSubmit={handlePostComment} style={{ display: "flex", gap: "10px", marginBottom: "24px" }}>
            <input
              type="text"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Share your thoughts or voting rationale..."
              className="vox-input"
              style={{ flex: 1 }}
            />
            <button type="submit" className="btn-vox-primary" style={{ padding: "10px 24px" }}>
              <Send size={16} /> Post
            </button>
          </form>

          {/* Stream List */}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", maxHeight: "450px", overflowY: "auto" }}>
            {comments.map((c, cIdx) => (
              <div key={`${c.id || "comm"}-${cIdx}`} style={{
                background: "rgba(255, 255, 255, 0.02)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "12px",
                padding: "14px 18px",
                display: "flex",
                gap: "14px",
                alignItems: "flex-start",
              }}>
                <img
                  src={c.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${c.username}`}
                  alt={c.username}
                  style={{ width: "38px", height: "38px", borderRadius: "50%", border: "2px solid #8b5cf6" }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                    <span style={{ fontSize: "0.9rem", fontWeight: 700, color: "#ffffff" }}>
                      {c.username}
                    </span>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>
                      {new Date(c.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <p style={{ fontSize: "0.88rem", color: "var(--text-primary)", margin: 0, lineHeight: "1.4" }}>
                    {c.content}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECTION 3: PARTICIPATION HISTORY & STATISTICS */}
      {activeSection === "history" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))", gap: "24px" }}>
          {/* Voting History */}
          <div className="glass-panel" style={{ padding: "24px" }}>
            <h3 style={{ fontSize: "1.25rem", fontWeight: 800, color: "#ffffff", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
              <Vote size={20} color="#8b5cf6" /> Voting History
            </h3>
            {votedPolls.length === 0 ? (
              <div style={{ textAlign: "center", padding: "30px", color: "var(--text-muted)" }}>
                You haven't voted in any polls yet. Jump into the Live Voting Arena!
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {votedPolls.map((vp, idx) => (
                  <div key={idx} style={{ background: "rgba(255, 255, 255, 0.02)", padding: "12px 16px", borderRadius: "10px", border: "1px solid var(--border-subtle)" }}>
                    <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "#ffffff", marginBottom: "4px" }}>
                      {vp.title}
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem" }}>
                      <span style={{ color: "#34d399", fontWeight: 600 }}>Your Vote: {vp.option_text}</span>
                      <span style={{ color: "var(--text-dim)" }}>+10 XP Earned</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Mini Games High Scores */}
          <div className="glass-panel" style={{ padding: "24px" }}>
            <h3 style={{ fontSize: "1.25rem", fontWeight: 800, color: "#ffffff", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
              <Trophy size={20} color="#fbbf24" /> Mini Games Record
            </h3>
            {userGameScores.length === 0 ? (
              <div style={{ textAlign: "center", padding: "30px", color: "var(--text-muted)" }}>
                No mini games played yet. Try Color Match or Snake!
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {userGameScores.map((gs, idx) => (
                  <div key={idx} style={{ background: "rgba(255, 255, 255, 0.02)", padding: "12px 16px", borderRadius: "10px", border: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "#ffffff", textTransform: "capitalize" }}>
                        {gs.game_name.replace("_", " ")}
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>
                        {new Date(gs.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: "1.1rem", fontWeight: 900, color: "#fbbf24" }}>
                        {gs.score} pts
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "#22d3ee" }}>
                        {gs.accuracy}% accuracy
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Share & QR Code Modal */}
      {sharePoll && (
        <ShareModal
          poll={sharePoll}
          isOpen={!!sharePoll}
          onClose={() => setSharePoll(null)}
        />
      )}

      {/* ADMIN MODAL 1: CREATE QUESTION FOR VOTING */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => !createLoading && setShowCreateModal(false)}>
          <div
            className="modal-card"
            style={{ maxWidth: "680px", maxHeight: "90vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "10px",
                  background: "linear-gradient(135deg, #8b5cf6, #06b6d4)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}>
                  <Plus size={20} color="#ffffff" />
                </div>
                <div>
                  <h3 style={{ fontSize: "1.3rem", fontWeight: 800, color: "#ffffff", margin: 0 }}>
                    Create Voting Question
                  </h3>
                  <p style={{ fontSize: "0.8rem", color: "var(--text-dim)", margin: 0 }}>
                    Admin Functionality · Design, preview & launch real-time audience questions
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowCreateModal(false)}
                style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
              >
                <X size={20} />
              </button>
            </div>

            {/* View Mode Toggle: Form vs Preview */}
            <div style={{
              display: "flex",
              gap: "8px",
              background: "rgba(255, 255, 255, 0.05)",
              padding: "4px",
              borderRadius: "10px",
              marginBottom: "20px",
            }}>
              <button
                type="button"
                onClick={() => setCreateTab("form")}
                style={{
                  flex: 1,
                  padding: "8px",
                  borderRadius: "8px",
                  fontSize: "0.88rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  border: "none",
                  background: createTab === "form" ? "#8b5cf6" : "transparent",
                  color: createTab === "form" ? "#ffffff" : "var(--text-muted)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  transition: "all 0.2s ease",
                }}
              >
                <Edit3 size={15} /> Question Form
              </button>
              <button
                type="button"
                onClick={() => setCreateTab("preview")}
                style={{
                  flex: 1,
                  padding: "8px",
                  borderRadius: "8px",
                  fontSize: "0.88rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  border: "none",
                  background: createTab === "preview" ? "#06b6d4" : "transparent",
                  color: createTab === "preview" ? "#ffffff" : "var(--text-muted)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  transition: "all 0.2s ease",
                }}
              >
                <Eye size={15} /> Live Voter Preview
              </button>
            </div>

            {/* Error Message */}
            {createError && (
              <div style={{
                background: "rgba(239, 68, 68, 0.15)",
                border: "1px solid rgba(239, 68, 68, 0.35)",
                borderRadius: "10px",
                padding: "10px 14px",
                color: "#fca5a5",
                fontSize: "0.85rem",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "16px",
              }}>
                <AlertTriangle size={16} />
                <span>{createError}</span>
              </div>
            )}

            {createTab === "form" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {/* Title */}
                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, color: "#cbd5e1", marginBottom: "6px" }}>
                    Question Title / Text <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={createForm.title}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, title: e.target.value }))}
                    placeholder="e.g. Which web architecture standard will dominate in 2026?"
                    className="vox-input"
                    required
                  />
                </div>

                {/* Description / Context */}
                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, color: "#cbd5e1", marginBottom: "6px" }}>
                    Description or Context (Optional)
                  </label>
                  <textarea
                    rows={2}
                    value={createForm.description}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, description: e.target.value }))}
                    placeholder="Provide additional background, rules, or context for voters..."
                    className="vox-input"
                    style={{ resize: "vertical" }}
                  />
                </div>

                {/* Category & Selection Type */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, color: "#cbd5e1", marginBottom: "6px" }}>
                      Category
                    </label>
                    <select
                      value={createForm.category}
                      onChange={(e) => setCreateForm((prev) => ({ ...prev, category: e.target.value }))}
                      className="vox-input"
                    >
                      <option value="Technology">Technology</option>
                      <option value="Entertainment">Entertainment</option>
                      <option value="Politics">Politics & Policy</option>
                      <option value="Community">Community Life</option>
                      <option value="Gaming">Gaming & Esports</option>
                      <option value="Sports">Sports</option>
                      <option value="Business">Business & Economics</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, color: "#cbd5e1", marginBottom: "6px" }}>
                      Selection Type
                    </label>
                    <select
                      value={createForm.selectionType}
                      onChange={(e) => setCreateForm((prev) => ({ ...prev, selectionType: e.target.value }))}
                      className="vox-input"
                    >
                      <option value="single">Single Choice (1 Option)</option>
                      <option value="multiple">Multiple Choice</option>
                    </select>
                  </div>
                </div>

                {/* Dynamic Options List */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <label style={{ fontSize: "0.85rem", fontWeight: 700, color: "#cbd5e1" }}>
                      Multiple Choice Options (Min 2, Max 10) <span style={{ color: "#ef4444" }}>*</span>
                    </label>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>
                      {createForm.options.length} / 10 options
                    </span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {createForm.options.map((opt, idx) => (
                      <div key={idx} style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                        <div style={{
                          width: "28px",
                          height: "28px",
                          borderRadius: "50%",
                          background: "rgba(255, 255, 255, 0.08)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          color: "#94a3b8",
                          flexShrink: 0,
                        }}>
                          {idx + 1}
                        </div>
                        <input
                          type="text"
                          value={opt}
                          onChange={(e) => handleOptionChange(idx, e.target.value)}
                          placeholder={`Option ${idx + 1}...`}
                          className="vox-input"
                          style={{ flex: 1 }}
                        />
                        {createForm.options.length > 2 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveOption(idx)}
                            style={{
                              background: "rgba(239, 68, 68, 0.12)",
                              border: "1px solid rgba(239, 68, 68, 0.3)",
                              color: "#f87171",
                              width: "36px",
                              height: "36px",
                              borderRadius: "8px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              cursor: "pointer",
                            }}
                            title="Delete Option"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {createForm.options.length < 10 && (
                    <button
                      type="button"
                      onClick={handleAddOption}
                      className="btn-vox-secondary"
                      style={{ marginTop: "10px", padding: "6px 14px", fontSize: "0.82rem", display: "inline-flex", alignItems: "center", gap: "6px" }}
                    >
                      <Plus size={14} /> Add Option
                    </button>
                  )}
                </div>

                {/* Timing & Timezone Controls */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, color: "#cbd5e1", marginBottom: "6px" }}>
                      Voting Duration (Minutes)
                    </label>
                    <input
                      type="number"
                      min={25}
                      max={120}
                      value={createForm.durationMinutes}
                      onChange={(e) => setCreateForm((prev) => ({ ...prev, durationMinutes: e.target.value }))}
                      className="vox-input"
                    />
                    <div style={{ display: "flex", gap: "6px", marginTop: "6px" }}>
                      {[30, 45, 60, 90, 120].map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setCreateForm((prev) => ({ ...prev, durationMinutes: d }))}
                          style={{
                            background: Number(createForm.durationMinutes) === d ? "rgba(139, 92, 246, 0.3)" : "rgba(255, 255, 255, 0.05)",
                            border: "1px solid rgba(255, 255, 255, 0.1)",
                            color: Number(createForm.durationMinutes) === d ? "#c084fc" : "#94a3b8",
                            padding: "3px 8px",
                            borderRadius: "6px",
                            fontSize: "0.75rem",
                            cursor: "pointer",
                          }}
                        >
                          {d}m
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, color: "#cbd5e1", marginBottom: "6px" }}>
                      Timezone
                    </label>
                    <select
                      value={createForm.timezone}
                      onChange={(e) => setCreateForm((prev) => ({ ...prev, timezone: e.target.value }))}
                      className="vox-input"
                    >
                      <option value="UTC">UTC (Coordinated Universal Time)</option>
                      <option value="America/New_York">America/New_York (EST/EDT)</option>
                      <option value="America/Los_Angeles">America/Los_Angeles (PST/PDT)</option>
                      <option value="Europe/London">Europe/London (GMT/BST)</option>
                      <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                      <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
                    </select>
                  </div>
                </div>

                {/* Result Visibility */}
                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, color: "#cbd5e1", marginBottom: "6px" }}>
                    Result Visibility Policy
                  </label>
                  <select
                    value={createForm.resultVisibility}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, resultVisibility: e.target.value }))}
                    className="vox-input"
                  >
                    <option value="immediate">Immediate (Real-Time Results Visible to All)</option>
                    <option value="after_vote">Reveal Only After Voter Casts Ballot</option>
                    <option value="after_close">Hide Results Until Voting Session Ends</option>
                  </select>
                </div>

                {/* Modal Actions */}
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "10px", borderTop: "1px solid var(--border-subtle)", paddingTop: "18px" }}>
                  <button
                    type="button"
                    className="btn-vox-secondary"
                    onClick={() => setShowCreateModal(false)}
                    disabled={createLoading}
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    className="btn-vox-secondary"
                    onClick={() => handleCreatePoll("draft")}
                    disabled={createLoading}
                    style={{ borderColor: "rgba(148, 163, 184, 0.4)", color: "#cbd5e1" }}
                  >
                    Save as Draft
                  </button>

                  <button
                    type="button"
                    className="btn-vox-primary"
                    onClick={() => handleCreatePoll("active")}
                    disabled={createLoading}
                  >
                    {createLoading ? "Publishing..." : "Publish Immediately"}
                  </button>
                </div>
              </div>
            ) : (
              /* LIVE VOTER PREVIEW MODE */
              <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                <div style={{
                  background: "rgba(6, 182, 212, 0.1)",
                  border: "1px solid rgba(6, 182, 212, 0.3)",
                  borderRadius: "10px",
                  padding: "10px 16px",
                  color: "#67e8f9",
                  fontSize: "0.85rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}>
                  <Eye size={16} />
                  <span>Voter Live Preview: This shows exactly how questions appear on public voter devices.</span>
                </div>

                {/* Mock Live Voter Card */}
                <div className="glass-panel" style={{ padding: "28px", border: "1px solid rgba(139, 92, 246, 0.4)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span className="pulse-dot-green" />
                      <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#34d399" }}>
                        Live Election Round
                      </span>
                      <span style={{
                        background: "rgba(59, 130, 246, 0.18)",
                        color: "#93c5fd",
                        padding: "2px 8px",
                        borderRadius: "9999px",
                        fontSize: "0.75rem",
                        fontWeight: 700,
                      }}>
                        {createForm.category}
                      </span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "5px", color: "var(--text-dim)", fontSize: "0.8rem" }}>
                      <Clock size={13} />
                      <span>{createForm.durationMinutes}m remaining</span>
                    </div>
                  </div>

                  <h3 style={{ fontSize: "1.35rem", fontWeight: 800, color: "#ffffff", marginBottom: "8px" }}>
                    {createForm.title || "Your question title will appear here..."}
                  </h3>

                  {createForm.description && (
                    <p style={{ fontSize: "0.9rem", color: "#94a3b8", marginBottom: "16px", lineHeight: "1.5" }}>
                      {createForm.description}
                    </p>
                  )}

                  {/* Mock Options */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px", margin: "20px 0" }}>
                    {createForm.options.filter(Boolean).length === 0 ? (
                      <div style={{ color: "var(--text-dim)", fontStyle: "italic", fontSize: "0.88rem" }}>
                        Add options in the form to preview them here.
                      </div>
                    ) : (
                      createForm.options.filter(Boolean).map((opt, idx) => (
                        <div
                          key={idx}
                          className="screenshot2-option-row"
                          style={{ padding: "14px 18px", borderRadius: "10px", cursor: "pointer" }}
                        >
                          <div className="screenshot2-radio-circle" />
                          <span className="screenshot2-option-text" style={{ fontSize: "0.95rem" }}>
                            {opt}
                          </span>
                        </div>
                      ))
                    )}
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--border-subtle)", paddingTop: "14px" }}>
                    <span style={{ fontSize: "0.8rem", color: "var(--text-dim)", fontWeight: 700 }}>
                      {createForm.selectionType === "single" ? "Single choice ballot" : "Multiple selections allowed"}
                    </span>
                    <button className="btn-vox-primary" disabled style={{ opacity: 0.7, padding: "8px 18px", fontSize: "0.85rem" }}>
                      Submit Ballot
                    </button>
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", borderTop: "1px solid var(--border-subtle)", paddingTop: "16px" }}>
                  <button
                    type="button"
                    className="btn-vox-secondary"
                    onClick={() => setCreateTab("form")}
                  >
                    ← Back to Edit Form
                  </button>
                  <button
                    type="button"
                    className="btn-vox-primary"
                    onClick={() => handleCreatePoll("active")}
                    disabled={createLoading}
                  >
                    {createLoading ? "Publishing..." : "Confirm & Launch"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ADMIN MODAL 2: TIMING & SCHEDULE CHANGE OPTIONS */}
      {timingModalPoll && (
        <div className="modal-overlay" onClick={() => !timingLoading && setTimingModalPoll(null)}>
          <div
            className="modal-card"
            style={{ maxWidth: "560px" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "10px",
                  background: "linear-gradient(135deg, #0284c7, #38bdf8)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}>
                  <Clock size={20} color="#ffffff" />
                </div>
                <div>
                  <h3 style={{ fontSize: "1.25rem", fontWeight: 800, color: "#ffffff", margin: 0 }}>
                    Timing & Schedule Controls
                  </h3>
                  <p style={{ fontSize: "0.8rem", color: "var(--text-dim)", margin: 0 }}>
                    Adjust duration, extend, or close voting sessions in real-time
                  </p>
                </div>
              </div>

              <button
                onClick={() => setTimingModalPoll(null)}
                style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Target Poll Details */}
            <div style={{
              background: "rgba(255, 255, 255, 0.03)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "12px",
              padding: "14px 16px",
              marginBottom: "18px",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                <span style={{ fontSize: "0.8rem", color: "var(--text-dim)", fontWeight: 700 }}>SELECTED POLL</span>
                <span style={{
                  padding: "2px 8px",
                  borderRadius: "9999px",
                  fontSize: "0.72rem",
                  fontWeight: 800,
                  color: getTimingStatus(timingModalPoll).color,
                  background: getTimingStatus(timingModalPoll).bg,
                }}>
                  {getTimingStatus(timingModalPoll).label}
                </span>
              </div>
              <h4 style={{ fontSize: "1.05rem", fontWeight: 700, color: "#ffffff", margin: 0 }}>
                {timingModalPoll.title}
              </h4>
            </div>

            {/* Warning Alert for Active Sessions */}
            {timingModalPoll.is_active && (
              <div style={{
                background: "rgba(245, 158, 11, 0.12)",
                border: "1px solid rgba(245, 158, 11, 0.35)",
                borderRadius: "10px",
                padding: "10px 14px",
                color: "#fcd34d",
                fontSize: "0.82rem",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "18px",
              }}>
                <AlertTriangle size={18} style={{ flexShrink: 0 }} />
                <span>
                  Notice: This poll is active. Adjusting duration will recalculate the live countdown for all connected voters.
                </span>
              </div>
            )}

            {/* Error Banner */}
            {timingError && (
              <div style={{
                background: "rgba(239, 68, 68, 0.15)",
                border: "1px solid rgba(239, 68, 68, 0.35)",
                borderRadius: "10px",
                padding: "10px 14px",
                color: "#fca5a5",
                fontSize: "0.85rem",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "16px",
              }}>
                <AlertTriangle size={16} />
                <span>{timingError}</span>
              </div>
            )}

            {/* Quick Adjustment Controls */}
            <div style={{ marginBottom: "18px" }}>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, color: "#cbd5e1", marginBottom: "8px" }}>
                Quick Extend / Shorten
              </label>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => handleQuickAdjust(15)}
                  className="btn-vox-secondary"
                  style={{ padding: "6px 14px", fontSize: "0.82rem", color: "#34d399", borderColor: "rgba(16, 185, 129, 0.3)" }}
                >
                  +15 Min
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickAdjust(30)}
                  className="btn-vox-secondary"
                  style={{ padding: "6px 14px", fontSize: "0.82rem", color: "#38bdf8", borderColor: "rgba(56, 189, 248, 0.3)" }}
                >
                  +30 Min
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickAdjust(60)}
                  className="btn-vox-secondary"
                  style={{ padding: "6px 14px", fontSize: "0.82rem", color: "#c084fc", borderColor: "rgba(192, 132, 252, 0.3)" }}
                >
                  +1 Hour
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickAdjust(-15)}
                  className="btn-vox-secondary"
                  style={{ padding: "6px 14px", fontSize: "0.82rem", color: "#fbbf24", borderColor: "rgba(251, 191, 36, 0.3)" }}
                >
                  -15 Min
                </button>
                <button
                  type="button"
                  onClick={handleClosePollEarly}
                  className="btn-vox-secondary"
                  style={{ padding: "6px 14px", fontSize: "0.82rem", color: "#f87171", borderColor: "rgba(239, 68, 68, 0.4)" }}
                >
                  Close Voting Early
                </button>
              </div>
            </div>

            {/* Total Duration & Timezone */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "20px" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, color: "#cbd5e1", marginBottom: "6px" }}>
                  Total Duration (Minutes)
                </label>
                <input
                  type="number"
                  min={25}
                  max={120}
                  value={timingDuration}
                  onChange={(e) => setTimingDuration(Number(e.target.value))}
                  className="vox-input"
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, color: "#cbd5e1", marginBottom: "6px" }}>
                  Timezone
                </label>
                <select
                  value={timingTimezone}
                  onChange={(e) => setTimingTimezone(e.target.value)}
                  className="vox-input"
                >
                  <option value="UTC">UTC</option>
                  <option value="America/New_York">America/New_York (EST)</option>
                  <option value="America/Los_Angeles">America/Los_Angeles (PST)</option>
                  <option value="Europe/London">Europe/London (GMT)</option>
                  <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                </select>
              </div>
            </div>

            {/* Modal Actions */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--border-subtle)", paddingTop: "16px" }}>
              <button
                type="button"
                className="btn-vox-secondary"
                onClick={() => handleOpenHistoryModal(timingModalPoll)}
                style={{ padding: "8px 14px", fontSize: "0.82rem", display: "flex", alignItems: "center", gap: "5px" }}
              >
                <History size={14} /> View History Log
              </button>

              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  type="button"
                  className="btn-vox-secondary"
                  onClick={() => setTimingModalPoll(null)}
                  disabled={timingLoading}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-vox-primary"
                  onClick={handleSaveTiming}
                  disabled={timingLoading}
                >
                  {timingLoading ? "Saving..." : "Save Schedule"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ADMIN MODAL 3: AUDIT LOG & TIMING HISTORY */}
      {showHistoryModal && (
        <div className="modal-overlay" onClick={() => setShowHistoryModal(null)}>
          <div
            className="modal-card"
            style={{ maxWidth: "580px", maxHeight: "80vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "10px",
                  background: "linear-gradient(135deg, #a855f7, #6366f1)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}>
                  <History size={20} color="#ffffff" />
                </div>
                <div>
                  <h3 style={{ fontSize: "1.25rem", fontWeight: 800, color: "#ffffff", margin: 0 }}>
                    Schedule Audit History
                  </h3>
                  <p style={{ fontSize: "0.8rem", color: "var(--text-dim)", margin: 0 }}>
                    {showHistoryModal.title}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowHistoryModal(null)}
                style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Timeline List */}
            {logsLoading ? (
              <div style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
                Loading audit trail...
              </div>
            ) : auditLogs.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
                No modification history recorded yet for this session.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {auditLogs.map((log, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: "rgba(255, 255, 255, 0.03)",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: "10px",
                      padding: "12px 16px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                      <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#38bdf8" }}>
                        {log.action || "Schedule Adjusted"}
                      </span>
                      <span style={{ fontSize: "0.72rem", color: "var(--text-dim)" }}>
                        {log.created_at ? new Date(log.created_at).toLocaleString() : "Recently"}
                      </span>
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "#cbd5e1" }}>
                      {log.details || log.action}
                    </div>
                    {log.admin_username && (
                      <div style={{ fontSize: "0.72rem", color: "var(--text-dim)", marginTop: "4px" }}>
                        Modified by: {log.admin_username}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "20px", borderTop: "1px solid var(--border-subtle)", paddingTop: "14px" }}>
              <button
                type="button"
                className="btn-vox-secondary"
                onClick={() => setShowHistoryModal(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
