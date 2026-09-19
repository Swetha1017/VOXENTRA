import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { api, getGlobalWSUrl } from "../api/client";
import { 
  Radio, Clock, Users, Zap, Award, Flame, Send, 
  Share2, ArrowRight, CheckCircle2, MessageSquare, Play, 
  Copy, Check, Sparkles, Trophy, Trash2 
} from "lucide-react";
import confetti from "canvas-confetti";
import { ShareModal } from "../components/ShareModal";

export const Home = ({ navigate, searchQuery }) => {
  const { user, isAuthenticated, isAdmin, openAuthModal } = useAuth();
  const [polls, setPolls] = useState([]);
  const [comments, setComments] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [selectedOptions, setSelectedOptions] = useState({});
  const [votedMap, setVotedMap] = useState({});
  const [commentInput, setCommentInput] = useState("");
  const [activeFilter, setActiveFilter] = useState("all"); // "all", "polls", "games"
  const [sharePoll, setSharePoll] = useState(null);
  const [copiedShare, setCopiedShare] = useState(false);

  // Fetch initial data
  const fetchData = async () => {
    try {
      const [pollsData, commentsData, lbData] = await Promise.all([
        api.get("/api/polls"),
        api.get("/api/comments?target_id=global"),
        api.get("/api/leaderboard"),
      ]);

      setPolls(pollsData || []);
      setComments(commentsData || []);
      setLeaderboard(lbData || []);

      // If user logged in, check which polls they already voted on
      if (isAuthenticated && pollsData) {
        for (const p of pollsData) {
          try {
            const single = await api.get(`/api/polls/${p.id}`);
            if (single.has_voted) {
              setVotedMap((prev) => ({ ...prev, [p.id]: single.voted_option_id }));
            }
          } catch (e) {}
        }
      }
    } catch (err) {
      console.warn("Error fetching homepage data:", err.message);
    }
  };

  useEffect(() => {
    fetchData();
  }, [isAuthenticated]);

  // Real-time WebSocket Stream for Polls, Comments, and Games
  useEffect(() => {
    let ws;
    try {
      ws = new WebSocket(getGlobalWSUrl());
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "poll_update") {
            const update = msg.data;
            setPolls((prev) =>
              prev.map((poll) => {
                if (poll.id === update.poll_id) {
                  const updatedOptions = poll.options.map((opt) => {
                    const votes = update.option_votes?.[opt.id] ?? opt.votes;
                    const pct = update.total_votes > 0 ? (votes / update.total_votes) * 100 : 0;
                    return {
                      ...opt,
                      votes,
                      percentage: Math.round(pct * 10) / 10,
                    };
                  });
                  return {
                    ...poll,
                    total_votes: update.total_votes,
                    options: updatedOptions,
                  };
                }
                return poll;
              })
            );
          } else if (msg.type === "comment_update") {
            const update = msg.data;
            if (update.type === "comment_delete") {
              setComments((prev) => prev.filter((c) => c.id !== update.comment.id));
            } else {
              setComments((prev) => [update.comment, ...prev.filter((c) => c.id !== update.comment.id)]);
            }
          }
        } catch (e) {}
      };
    } catch (e) {}

    return () => {
      if (ws) ws.close();
    };
  }, []);

  // Handle Option Select
  const handleSelectOption = (pollId, optionId) => {
    if (votedMap[pollId]) return;
    setSelectedOptions((prev) => ({ ...prev, [pollId]: optionId }));
  };

  // Submit Vote
  const handleVote = async (poll) => {
    if (!isAuthenticated) {
      openAuthModal("register", poll.id);
      return;
    }

    const optionId = selectedOptions[poll.id];
    if (!optionId) {
      alert("Please select an option before casting your vote.");
      return;
    }

    try {
      await api.post(`/api/polls/${poll.id}/vote`, {
        option_id: optionId,
        referral_source: "home_page",
      });

      setVotedMap((prev) => ({ ...prev, [poll.id]: optionId }));
      confetti({ particleCount: 50, spread: 70, origin: { y: 0.6 } });
    } catch (err) {
      alert(err.message || "Failed to submit vote");
    }
  };

  // Post Live Comment
  const handlePostComment = async (e) => {
    e.preventDefault();
    if (!isAuthenticated) {
      openAuthModal("register");
      return;
    }

    if (!commentInput.trim()) return;

    try {
      const newComment = await api.post("/api/comments", {
        target_id: "global",
        content: commentInput.trim(),
      });
      setComments((prev) => [newComment, ...prev]);
      setCommentInput("");
    } catch (err) {
      alert(err.message || "Failed to post comment");
    }
  };

  // Admin Delete Comment
  const handleDeleteComment = async (commentId) => {
    if (!window.confirm("Admin: Remove this comment from public view?")) return;
    try {
      await api.delete(`/api/admin/comments/${commentId}`);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch (err) {
      alert(err.message);
    }
  };

  // Copy Main Referral Share Link
  const handleCopyMainShare = () => {
    const link = `${window.location.origin}/#join/7xQ9`;
    navigator.clipboard.writeText(link);
    setCopiedShare(true);
    setTimeout(() => setCopiedShare(false), 2000);
  };

  // Filter polls
  const filteredPolls = polls.filter((p) => {
    if (!searchQuery) return true;
    return p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.category?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "40px 24px 80px" }}>
      {/* 1. HERO SECTION */}
      <div className="hero-flex-container" style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "40px",
        marginBottom: "48px",
      }}>
        {/* Hero Left Content */}
        <div style={{ flex: 1, maxWidth: "580px" }}>
          {/* Top Tagline */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "16px" }}>
            <span style={{ color: "#a855f7", fontSize: "0.95rem" }}>💜</span>
            <span style={{
              fontSize: "0.82rem",
              fontWeight: 800,
              letterSpacing: "0.08em",
              color: "#c084fc",
              textTransform: "uppercase",
            }}>
              Your Voice Drives What's Next
            </span>
          </div>

          {/* Hero Headline: "Small Vote. Bigger Impact. Together." */}
          <h1 style={{
            fontSize: "clamp(2.4rem, 4.8vw, 3.8rem)",
            fontWeight: 900,
            lineHeight: 1.12,
            marginBottom: "16px",
            color: "#ffffff",
          }}>
            Small Vote. <br />
            <span style={{
              background: "linear-gradient(135deg, #a855f7 0%, #6366f1 50%, #06b6d4 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}>
              Bigger Impact.
            </span><br />
            Together.
          </h1>

          {/* Subtitle */}
          <p style={{
            fontSize: "1.05rem",
            color: "var(--text-muted)",
            lineHeight: 1.6,
            marginBottom: "28px",
          }}>
            Live polls, exciting games, real-time reactions and a community that makes every moment count.
          </p>

          {/* Action Buttons */}
          <div style={{ display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap", marginBottom: "40px" }}>
            <button
              className="btn-vox-primary"
              style={{ padding: "12px 28px", fontSize: "1rem" }}
              onClick={() => {
                if (isAuthenticated) {
                  navigate("dashboard");
                } else {
                  openAuthModal("register");
                }
              }}
            >
              <span>Register & Join</span>
            </button>
            <button
              className="btn-vox-secondary"
              style={{ padding: "12px 24px", fontSize: "1rem" }}
              onClick={() => {
                const el = document.getElementById("live-now-section");
                if (el) el.scrollIntoView({ behavior: "smooth" });
              }}
            >
              <Radio size={16} color="#06b6d4" />
              <span>Explore Live Polls</span>
            </button>
          </div>

          {/* Distinct, Separated Metric Stat Cards (Removed clustered display & Idea label) */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
            gap: "12px",
          }}>
            <div style={{
              background: "rgba(15, 23, 42, 0.6)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: "12px",
              padding: "12px 16px",
            }}>
              <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#ffffff" }}>10K+</div>
              <div style={{ fontSize: "0.74rem", color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Active Voters
              </div>
            </div>

            <div style={{
              background: "rgba(15, 23, 42, 0.6)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: "12px",
              padding: "12px 16px",
            }}>
              <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#818cf8" }}>200+</div>
              <div style={{ fontSize: "0.74rem", color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Live Sessions
              </div>
            </div>

            <div style={{
              background: "rgba(15, 23, 42, 0.6)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: "12px",
              padding: "12px 16px",
            }}>
              <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#22d3ee" }}>50+</div>
              <div style={{ fontSize: "0.74rem", color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Gaming Events
              </div>
            </div>

            <div style={{
              background: "rgba(15, 23, 42, 0.6)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: "12px",
              padding: "12px 16px",
            }}>
              <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#34d399" }}>99.9%</div>
              <div style={{ fontSize: "0.74rem", color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Audit Accuracy
              </div>
            </div>
          </div>
        </div>

        {/* Hero Center Visual: 3D Holographic Podium with Prism Emblem & Floating Badges */}
        <div style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}>
          <div className="podium-wrapper">
            {/* Concentric Glowing Neon Rings */}
            <div className="podium-glow-ring" />
            <div className="podium-cylinder" />

            {/* Floating 3D V Hologram Prism */}
            <div className="hologram-prism">
              <svg width="130" height="130" viewBox="0 0 100 100" fill="none">
                <defs>
                  <linearGradient id="prismGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#06b6d4" />
                    <stop offset="50%" stopColor="#8b5cf6" />
                    <stop offset="100%" stopColor="#ec4899" />
                  </linearGradient>
                </defs>
                <path d="M15 15L50 85L85 15H65L50 50L35 15H15Z" fill="url(#prismGrad)" />
                <path d="M35 15L50 50L65 15H52L50 20L48 15H35Z" fill="#ffffff" opacity="0.4" />
              </svg>
            </div>

            {/* Floating Circular Interactive Nodes */}
            {/* 1. Vote (Top-Left) */}
            <div className="floating-pill" style={{ top: "10px", left: "10px" }}>
              <div className="floating-pill-icon" style={{ background: "rgba(6, 182, 212, 0.2)", border: "1px solid #06b6d4" }}>
                <Radio size={18} color="#06b6d4" />
              </div>
              <span style={{ color: "#38bdf8" }}>Vote</span>
            </div>

            {/* 2. Play (Top-Right) */}
            <div className="floating-pill" style={{ top: "10px", right: "10px", animationDelay: "1s" }}>
              <div className="floating-pill-icon" style={{ background: "rgba(139, 92, 246, 0.2)", border: "1px solid #8b5cf6" }}>
                <Zap size={18} color="#a855f7" />
              </div>
              <span style={{ color: "#c084fc" }}>Play</span>
            </div>

            {/* 3. Comment (Bottom-Left) */}
            <div className="floating-pill" style={{ bottom: "65px", left: "-15px", animationDelay: "1.8s" }}>
              <div className="floating-pill-icon" style={{ background: "rgba(236, 72, 153, 0.2)", border: "1px solid #ec4899" }}>
                <MessageSquare size={18} color="#f472b6" />
              </div>
              <span style={{ color: "#f472b6" }}>Comment</span>
            </div>

            {/* 4. Compete (Bottom-Right) */}
            <div className="floating-pill" style={{ bottom: "65px", right: "-15px", animationDelay: "2.4s" }}>
              <div className="floating-pill-icon" style={{ background: "rgba(245, 158, 11, 0.2)", border: "1px solid #f59e0b" }}>
                <Trophy size={18} color="#fbbf24" />
              </div>
              <span style={{ color: "#fbbf24" }}>Compete</span>
            </div>
          </div>

          {/* Handwritten Style Accent Below Podium */}
          <div style={{ marginTop: "14px", textAlign: "center" }}>
            <span className="script-accent">
              Small Votes, Big Impact 💜
            </span>
          </div>
        </div>

        {/* Hero Right Callout Card matching screenshot */}
        {!isAuthenticated ? (
          <div className="glass-panel hero-right-card" style={{
            width: "300px",
            padding: "26px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}>
            <h3 style={{ fontSize: "1.25rem", fontWeight: 800, color: "#ffffff", marginBottom: "8px" }}>
              Ready to make an impact?
            </h3>
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", lineHeight: 1.5, marginBottom: "20px" }}>
              Create an account to vote, join games, comment and be part of the Voxentra community.
            </p>
            <button
              className="btn-vox-primary"
              style={{ width: "100%", padding: "12px", fontSize: "0.95rem", marginBottom: "12px" }}
              onClick={() => openAuthModal("register")}
            >
              Register Now
            </button>
            <div style={{ textAlign: "center", fontSize: "0.8rem", color: "var(--text-dim)" }}>
              Already have an account?{" "}
              <button
                onClick={() => openAuthModal("login")}
                style={{ background: "none", color: "#a78bfa", fontWeight: 700, cursor: "pointer" }}
              >
                Login
              </button>
            </div>
          </div>
        ) : (
          <div className="glass-panel hero-right-card" style={{
            width: "300px",
            padding: "26px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
              <img
                src={user?.avatar}
                alt={user?.username}
                style={{ width: "42px", height: "42px", borderRadius: "50%", border: "2px solid #8b5cf6" }}
              />
              <div>
                <div style={{ fontWeight: 800, color: "#ffffff" }}>{user?.username}</div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>Member Status: Active</div>
              </div>
            </div>
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "18px" }}>
              You have cast votes in active community polls. Track your impact on the dashboard.
            </p>
            <button
              className="btn-vox-primary"
              style={{ width: "100%", padding: "10px" }}
              onClick={() => navigate("dashboard")}
            >
              Go to Dashboard
            </button>
          </div>
        )}
      </div>

      {/* 2. QUICK CATEGORIES ROW */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: "16px",
        marginBottom: "56px",
      }}>
        <div className="glass-panel category-card" onClick={() => navigate("polls")}>
          <Radio size={22} color="#06b6d4" />
          <div>
            <div style={{ fontWeight: 700, color: "#ffffff", fontSize: "0.95rem" }}>Live Polls</div>
            <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "2px" }}>Real-time voting on trending topics</div>
          </div>
        </div>

        <div className="glass-panel category-card" onClick={() => navigate("games")}>
          <Zap size={22} color="#ec4899" />
          <div>
            <div style={{ fontWeight: 700, color: "#ffffff", fontSize: "0.95rem" }}>Fun Games</div>
            <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "2px" }}>Play, compete and climb the ranks</div>
          </div>
        </div>

        <div className="glass-panel category-card" onClick={() => {
          const el = document.getElementById("live-commentary-widget");
          if (el) el.scrollIntoView({ behavior: "smooth" });
        }}>
          <MessageSquare size={22} color="#8b5cf6" />
          <div>
            <div style={{ fontWeight: 700, color: "#ffffff", fontSize: "0.95rem" }}>Live Commentary</div>
            <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "2px" }}>See what others are saying live</div>
          </div>
        </div>

        <div className="glass-panel category-card" onClick={() => navigate("leaderboard")}>
          <Trophy size={22} color="#f59e0b" />
          <div>
            <div style={{ fontWeight: 700, color: "#ffffff", fontSize: "0.95rem" }}>Leaderboards</div>
            <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "2px" }}>Who's leading? Find out now</div>
          </div>
        </div>

        <div className="glass-panel category-card" onClick={() => setSharePoll(polls[0] || { id: "general", title: "Voxentra" })}>
          <Share2 size={22} color="#3b82f6" />
          <div>
            <div style={{ fontWeight: 700, color: "#ffffff", fontSize: "0.95rem" }}>Share & Invite</div>
            <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "2px" }}>Bring your friends and make it bigger</div>
          </div>
        </div>

        {/* Quote Card */}
        <div className="glass-panel" style={{
          padding: "20px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          background: "linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(6, 182, 212, 0.1) 100%)",
        }}>
          <div style={{ fontStyle: "italic", fontSize: "0.95rem", fontWeight: 700, color: "#ffffff", marginBottom: "4px" }}>
            "Different Minds. Brighter Tomorrow."
          </div>
          <div className="script-accent" style={{ fontSize: "1.2rem", color: "#c084fc" }}>
            ~ Voxentra Team
          </div>
        </div>
      </div>

      {/* 3. LIVE NOW SECTION */}
      <div id="live-now-section" style={{ marginBottom: "56px" }}>
        {/* Section Header with Tabs */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "16px",
          marginBottom: "24px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <h2 style={{ fontSize: "1.8rem", fontWeight: 800, color: "#ffffff" }}>
              Live Now
            </h2>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span className="pulse-dot-green" />
              <span style={{ fontSize: "0.85rem", color: "var(--text-dim)" }}>
                Happening in real-time. Join before it ends!
              </span>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <button
              onClick={() => navigate("polls")}
              style={{ background: "none", color: "#a78bfa", fontWeight: 700, fontSize: "0.9rem", display: "flex", alignItems: "center", gap: "4px" }}
            >
              <span>View All</span>
              <ArrowRight size={15} />
            </button>

            {/* Filter Pills */}
            <div style={{
              display: "flex",
              background: "rgba(255, 255, 255, 0.05)",
              padding: "4px",
              borderRadius: "9999px",
              border: "1px solid var(--border-subtle)",
            }}>
              {["all", "polls", "games"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveFilter(tab)}
                  style={{
                    padding: "4px 14px",
                    borderRadius: "9999px",
                    fontSize: "0.8rem",
                    fontWeight: 700,
                    textTransform: "capitalize",
                    background: activeFilter === tab ? "#7c3aed" : "transparent",
                    color: activeFilter === tab ? "#ffffff" : "var(--text-muted)",
                    transition: "all 0.2s ease",
                  }}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Live Grid: 2 Live Polls, 2 Live Games, 1 Live Commentary Sidebar */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "24px",
        }}>
          {/* POLL CARDS */}
          {(activeFilter === "all" || activeFilter === "polls") && filteredPolls.slice(0, 2).map((poll) => {
            const hasVoted = Boolean(votedMap[poll.id]);
            const selectedOptId = selectedOptions[poll.id];

            return (
              <div
                key={poll.id}
                className="glass-panel"
                style={{
                  padding: "24px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  {/* Card Meta Header */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
                    <span className="badge-live-poll">
                      <span className="pulse-dot-green" />
                      <span>Live Poll</span>
                    </span>

                    <div style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "0.8rem", color: "var(--text-muted)" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        <Clock size={14} />
                        <span>02:34</span>
                      </span>
                      <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        <Users size={14} />
                        <span>{poll.total_votes.toLocaleString()}</span>
                      </span>
                    </div>
                  </div>

                  {/* Question Title (Click to open full clean interface) */}
                  <h3 
                    onClick={() => navigate(`poll-${poll.id}`)}
                    style={{
                      fontSize: "1.15rem",
                      fontWeight: 700,
                      color: "#ffffff",
                      lineHeight: 1.4,
                      marginBottom: "16px",
                      cursor: "pointer",
                      transition: "color 0.2s ease",
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.color = "#a78bfa"}
                    onMouseLeave={(e) => e.currentTarget.style.color = "#ffffff"}
                  >
                    {poll.title}
                  </h3>

                  {/* Poll Options matching Screenshot 2 with circular radio indicators */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" }}>
                    {poll.options.map((opt, idx) => {
                      const isSelected = selectedOptId === opt.id || votedMap[poll.id] === opt.id;
                      const showResults = Boolean(votedMap[poll.id]) || !poll.is_active;

                      return (
                        <div
                          key={opt.id || idx}
                          onClick={() => handleSelectOption(poll.id, opt.id)}
                          className={`screenshot2-option-row ${isSelected ? "selected" : ""}`}
                          style={{
                            padding: "12px 16px",
                            borderRadius: "10px",
                            cursor: hasVoted ? "default" : "pointer",
                          }}
                        >
                          {/* Animated Progress Fill */}
                          {showResults && (
                            <div
                              className="screenshot2-option-progress"
                              style={{ width: `${opt.percentage || 0}%` }}
                            />
                          )}

                          {/* Circular Radio Indicator */}
                          <div className="screenshot2-radio-circle">
                            {isSelected && <div className="screenshot2-radio-inner-dot" />}
                          </div>

                          <span className="screenshot2-option-text" style={{ fontSize: "0.95rem" }}>
                            {opt.text}
                          </span>

                          {showResults && (
                            <span className="screenshot2-option-pct">
                              {opt.percentage || 0}%
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Vote Action Button */}
                <button
                  disabled={hasVoted || !poll.is_active}
                  onClick={() => handleVote(poll)}
                  className="btn-vox-primary"
                  style={{
                    width: "100%",
                    padding: "12px",
                    background: hasVoted
                      ? "rgba(16, 185, 129, 0.2)"
                      : undefined,
                    border: hasVoted ? "1px solid #10b981" : undefined,
                    color: hasVoted ? "#34d399" : "#ffffff",
                  }}
                >
                  {hasVoted ? (
                    <>
                      <CheckCircle2 size={16} />
                      <span>Voted Successfully</span>
                    </>
                  ) : (
                    <>
                      <span>Vote Now</span>
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </div>
            );
          })}

          {/* GAME CARDS */}
          {(activeFilter === "all" || activeFilter === "games") && (
            <>
              {/* Game 1: Color Match */}
              <div className="glass-panel" style={{
                padding: "24px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                background: "linear-gradient(180deg, rgba(24, 20, 52, 0.8) 0%, rgba(13, 16, 36, 0.9) 100%)",
                border: "1px solid rgba(139, 92, 246, 0.3)",
              }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
                    <span className="badge-live-game">
                      <span className="pulse-dot-amber" />
                      <span>Live Game</span>
                    </span>
                    <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "4px" }}>
                      <Users size={14} />
                      <span>482 playing</span>
                    </span>
                  </div>

                  <div style={{
                    width: "56px",
                    height: "56px",
                    borderRadius: "16px",
                    background: "rgba(236, 72, 153, 0.15)",
                    border: "1px solid rgba(236, 72, 153, 0.3)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: "16px",
                    boxShadow: "0 0 20px rgba(236, 72, 153, 0.3)",
                  }}>
                    <Sparkles size={28} color="#ec4899" />
                  </div>

                  <h3 style={{ fontSize: "1.35rem", fontWeight: 800, color: "#ffffff", marginBottom: "6px" }}>
                    Color Match
                  </h3>
                  <p style={{ fontSize: "0.9rem", color: "var(--text-muted)", marginBottom: "20px" }}>
                    Rapid cognitive speed test. Match text colors against words under 30s pressure!
                  </p>
                </div>

                <button
                  className="btn-vox-primary"
                  onClick={() => navigate("games")}
                  style={{ width: "100%", padding: "12px", background: "linear-gradient(135deg, #ec4899, #8b5cf6)" }}
                >
                  <span>Play Color Match</span>
                  <ArrowRight size={16} />
                </button>
              </div>

              {/* Game 2: Snake Classic */}
              <div className="glass-panel" style={{
                padding: "24px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                background: "linear-gradient(180deg, rgba(16, 32, 54, 0.8) 0%, rgba(10, 18, 36, 0.9) 100%)",
                border: "1px solid rgba(6, 182, 212, 0.3)",
              }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
                    <span className="badge-live-game">
                      <span className="pulse-dot-amber" />
                      <span>Live Game</span>
                    </span>
                    <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "4px" }}>
                      <Users size={14} />
                      <span>391 playing</span>
                    </span>
                  </div>

                  <div style={{
                    width: "56px",
                    height: "56px",
                    borderRadius: "16px",
                    background: "rgba(6, 182, 212, 0.15)",
                    border: "1px solid rgba(6, 182, 212, 0.3)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: "16px",
                    boxShadow: "0 0 20px rgba(6, 182, 212, 0.3)",
                    fontSize: "1.4rem",
                  }}>
                    🕹️
                  </div>

                  <h3 style={{ fontSize: "1.35rem", fontWeight: 800, color: "#ffffff", marginBottom: "6px" }}>
                    Snake Classic
                  </h3>
                  <p style={{ fontSize: "0.9rem", color: "var(--text-muted)", marginBottom: "20px" }}>
                    Classic arcade navigation. Collect neon dots, grow your tail, and climb the ranks!
                  </p>
                </div>

                <button
                  className="btn-vox-primary"
                  onClick={() => navigate("games")}
                  style={{
                    width: "100%",
                    padding: "12px",
                    background: "linear-gradient(135deg, #06b6d4, #10b981)",
                  }}
                >
                  <span>Play Snake</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </>
          )}

          {/* LIVE COMMENTARY SIDEBAR WIDGET */}
          <div
            id="live-commentary-widget"
            className="glass-panel"
            style={{
              padding: "24px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              minHeight: "420px",
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
                <span className="pulse-dot-green" />
                <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#ffffff" }}>
                  Live Commentary
                </h3>
              </div>

              {/* Comments Feed List */}
              <div className="commentary-list" style={{ maxHeight: "290px", marginBottom: "16px" }}>
                {comments.map((c, cIdx) => (
                  <div key={`${c.id || "comm"}-${cIdx}`} className="commentary-item">
                    <img
                      src={c.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${c.username}`}
                      alt={c.username}
                      className="commentary-avatar"
                    />
                    <div className="commentary-bubble">
                      <div className="commentary-header">
                        <span className="commentary-username">{c.username}</span>
                        <span className="commentary-time">10:25 AM</span>
                        {isAdmin && (
                          <button
                            onClick={() => handleDeleteComment(c.id)}
                            style={{ background: "none", color: "#fda4af", padding: "0 4px", cursor: "pointer" }}
                            title="Admin: Delete comment"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                      <div className="commentary-text">{c.content}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Input Form */}
            <form onSubmit={handlePostComment} style={{ display: "flex", gap: "8px" }}>
              <input
                type="text"
                placeholder={isAuthenticated ? "Type a comment..." : "Sign in to chat live..."}
                value={commentInput}
                onChange={(e) => setCommentInput(e.target.value)}
                className="vox-input"
                style={{ padding: "10px 14px", fontSize: "0.85rem" }}
              />
              <button
                type="submit"
                className="btn-vox-primary"
                style={{ padding: "10px 16px", borderRadius: "var(--radius-md)" }}
              >
                <Send size={15} />
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* 4. BOTTOM SECTION: Leaderboard, Share & Invite, Cosmic Banner */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1.1fr 1fr 0.9fr",
        gap: "24px",
      }}>
        {/* Card 1: Climb the Leaderboard */}
        <div className="glass-panel" style={{ padding: "26px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <Trophy size={24} color="#fbbf24" />
              <div>
                <h3 style={{ fontSize: "1.15rem", fontWeight: 800, color: "#ffffff" }}>
                  Climb the Leaderboard
                </h3>
                <p style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                  Play games, answer polls and be the top contributor!
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate("leaderboard")}
              style={{ background: "none", color: "#a78bfa", fontSize: "0.8rem", fontWeight: 700, whiteSpace: "nowrap" }}
            >
              View Full Leaderboard &rarr;
            </button>
          </div>

          {/* Table */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <div style={{
              display: "grid",
              gridTemplateColumns: "30px 1fr 70px 80px",
              fontSize: "0.72rem",
              fontWeight: 700,
              color: "var(--text-dim)",
              padding: "4px 8px",
              textTransform: "uppercase",
            }}>
              <span>#</span>
              <span>User</span>
              <span>Points</span>
              <span>Badges</span>
            </div>

            {leaderboard.slice(0, 5).map((entry, idx) => (
              <div
                key={idx}
                style={{
                  display: "grid",
                  gridTemplateColumns: "30px 1fr 70px 80px",
                  alignItems: "center",
                  padding: "8px",
                  borderRadius: "var(--radius-md)",
                  background: entry.is_you ? "rgba(139, 92, 246, 0.15)" : "rgba(255, 255, 255, 0.02)",
                  border: entry.is_you ? "1px solid rgba(139, 92, 246, 0.35)" : "1px solid transparent",
                  fontSize: "0.85rem",
                }}
              >
                <span style={{ fontWeight: 800, color: idx === 0 ? "#fbbf24" : idx === 1 ? "#94a3b8" : idx === 2 ? "#d97706" : "var(--text-dim)" }}>
                  {idx === 0 ? "👑" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : idx + 1}
                </span>

                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <img
                    src={entry.avatar}
                    alt={entry.username}
                    style={{ width: "24px", height: "24px", borderRadius: "50%" }}
                  />
                  <span style={{ fontWeight: 600, color: "#ffffff" }}>
                    {entry.username} {entry.is_you && <span style={{ color: "#a78bfa", fontSize: "0.75rem" }}>(You)</span>}
                  </span>
                </div>

                <span style={{ fontWeight: 700, color: "#e2e8f0" }}>
                  {entry.points}
                </span>

                <div style={{ display: "flex", gap: "3px" }}>
                  {entry.badges?.map((b, bIdx) => (
                    <span key={bIdx} style={{ fontSize: "0.9rem" }}>{b}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Card 2: Share & Invite Friends */}
        <div className="glass-panel" style={{ padding: "26px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
              <div style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                background: "rgba(59, 130, 246, 0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}>
                <Share2 size={18} color="#3b82f6" />
              </div>
              <h3 style={{ fontSize: "1.15rem", fontWeight: 800, color: "#ffffff" }}>
                Share & Invite Friends
              </h3>
            </div>
            <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginBottom: "16px" }}>
              Make it more fun together! Share the link and invite your friends to vote and play.
            </p>

            {/* Link Copy Bar */}
            <div style={{ display: "flex", gap: "8px", marginBottom: "18px" }}>
              <input
                type="text"
                readOnly
                value={`${window.location.origin}/#join/7xQ9`}
                className="vox-input"
                style={{ fontSize: "0.8rem", background: "rgba(0, 0, 0, 0.4)", padding: "8px 12px" }}
              />
              <button
                className="btn-vox-primary"
                onClick={handleCopyMainShare}
                style={{ padding: "8px 14px" }}
              >
                {copiedShare ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>

            {/* Social Icons */}
            <div style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}>
              {[
                { name: "WhatsApp", color: "#25d366" },
                { name: "Telegram", color: "#0088cc" },
                { name: "Instagram", color: "#e1306c" },
                { name: "X", color: "#ffffff" },
                { name: "More", color: "#94a3b8" },
              ].map((s) => (
                <button
                  key={s.name}
                  onClick={() => setSharePoll(polls[0] || { id: "general", title: "Voxentra" })}
                  style={{
                    flex: 1,
                    padding: "8px 4px",
                    borderRadius: "var(--radius-md)",
                    background: "rgba(255, 255, 255, 0.04)",
                    border: "1px solid var(--border-subtle)",
                    color: s.color,
                    fontSize: "0.75rem",
                    fontWeight: 700,
                  }}
                >
                  {s.name}
                </button>
              ))}
            </div>
          </div>

          <div style={{ textAlign: "center", marginTop: "14px" }}>
            <span className="script-accent" style={{ fontSize: "1.35rem" }}>
              More Friends = More Fun! 😊
            </span>
          </div>
        </div>

        {/* Card 3: Cosmic Rocket Illustration Card */}
        <div className="glass-panel" style={{
          padding: "26px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          background: "radial-gradient(ellipse at 50% 30%, rgba(139, 92, 246, 0.25) 0%, rgba(9, 13, 26, 0.95) 75%)",
          position: "relative",
          overflow: "hidden",
        }}>
          {/* Animated Rocket Graphic */}
          <div style={{
            width: "70px",
            height: "70px",
            borderRadius: "50%",
            background: "rgba(255, 255, 255, 0.05)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: "14px",
            boxShadow: "0 0 30px rgba(139, 92, 246, 0.4)",
            fontSize: "2rem",
          }}>
            🚀
          </div>

          <h3 style={{
            fontSize: "1.2rem",
            fontWeight: 800,
            color: "#ffffff",
            lineHeight: 1.3,
            marginBottom: "8px",
          }}>
            "Curious Minds Create Brighter Tomorrows"
          </h3>
          <p style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
            Empowering community discourse through real-time voting technology.
          </p>
        </div>
      </div>

      {/* Share Modal */}
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
