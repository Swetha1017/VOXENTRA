import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { api, getGlobalWSUrl, getPollWSUrl } from "../api/client";
import { 
  BarChart2, MessageSquare, Award, Flame, Trophy, Share2, 
  CheckCircle2, Clock, Copy, Check, Sparkles, ArrowRight,
  Vote, Send, RefreshCw, QrCode, Gamepad2, Palette, Shield
} from "lucide-react";
import { showToast } from "../components/Toast";
import { ShareModal } from "../components/ShareModal";
import confetti from "canvas-confetti";

export const Dashboard = ({ navigate }) => {
  const { user, isAuthenticated, openAuthModal } = useAuth();
  
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
    <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "36px 20px" }}>
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
      <div style={{
        display: "flex",
        gap: "12px",
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
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <div>
              <h2 style={{ fontSize: "1.5rem", fontWeight: 800, color: "#ffffff" }}>
                Active Voting Sessions
              </h2>
              <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                Each poll session starts fresh with zero stale votes. Click an option below to cast your authenticated vote!
              </p>
            </div>
            <button className="btn-vox-secondary" onClick={loadFreshDashboard} style={{ padding: "8px 14px", fontSize: "0.82rem" }}>
              <RefreshCw size={14} /> Refresh Polls
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: "24px" }}>
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
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
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
    </div>
  );
};
