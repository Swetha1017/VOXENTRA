import React, { useState, useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api, getGlobalWSUrl, getWSUrl } from "../api/client";
import { LiveResultsChart } from "../components/LiveResultsChart";
import { ShareModal } from "../components/ShareModal";
import { 
  Radio, Clock, Users, Zap, CheckCircle2, MessageSquare, 
  Send, Share2, ArrowLeft, Trophy, AlertCircle, Shield, 
  Filter, Search, Check, Sparkles, RefreshCw, BarChart3, HelpCircle
} from "lucide-react";
import confetti from "canvas-confetti";

export const VotingPage = () => {
  const navigate = useNavigate();
  const { id: paramPollId } = useParams();
  const [searchParams] = useSearchParams();
  const { user, isAuthenticated, isAdmin } = useAuth();

  const [polls, setPolls] = useState([]);
  const [selectedPollId, setSelectedPollId] = useState(paramPollId || null);
  const [activePoll, setActivePoll] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pollLoading, setPollLoading] = useState(false);
  const [error, setError] = useState("");

  // Voting state
  const [selectedOption, setSelectedOption] = useState("");
  const [hasVoted, setHasVoted] = useState(false);
  const [votedOptionId, setVotedOptionId] = useState("");
  const [voting, setVoting] = useState(false);
  const [voteError, setVoteError] = useState("");

  // Commentary state
  const [comments, setComments] = useState([]);
  const [commentInput, setCommentInput] = useState("");
  const [commentLoading, setCommentLoading] = useState(false);

  // Filters & Search
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Share modal
  const [shareModalOpen, setShareModalOpen] = useState(false);

  // Countdown timer
  const [timeLeft, setTimeLeft] = useState(3600);

  // 1. Fetch all polls
  const fetchAllPolls = async () => {
    try {
      const data = await api.get("/api/polls");
      const list = Array.isArray(data) ? data : [];
      setPolls(list);

      // Determine initially selected poll
      if (!selectedPollId && list.length > 0) {
        const active = list.find((p) => p.is_active) || list[0];
        setSelectedPollId(active.id);
      }
    } catch (err) {
      console.error("Failed to load polls:", err);
      setError("Failed to load live polls. Please refresh.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllPolls();
  }, []);

  // 2. When selectedPollId changes, load poll detail + user vote state + comments
  useEffect(() => {
    if (!selectedPollId) return;

    const loadPollDetail = async () => {
      setPollLoading(true);
      setVoteError("");
      try {
        const data = await api.get(`/api/polls/${selectedPollId}`);
        const poll = data.poll || data;
        setActivePoll(poll);
        setHasVoted(Boolean(data.has_voted));
        setVotedOptionId(data.voted_option_id || "");
        setSelectedOption(data.voted_option_id || "");

        if (poll?.remaining_seconds) {
          setTimeLeft(poll.remaining_seconds);
        } else if (poll?.duration_minutes) {
          setTimeLeft(poll.duration_minutes * 60);
        }

        // Fetch comments for this poll
        try {
          const comms = await api.get(`/api/comments?target_id=${poll.id}`);
          setComments(Array.isArray(comms) ? comms : []);
        } catch (e) {
          setComments([]);
        }
      } catch (err) {
        console.error("Error loading poll detail:", err);
        setVoteError("Could not fetch details for this poll.");
      } finally {
        setPollLoading(false);
      }
    };

    loadPollDetail();
  }, [selectedPollId, isAuthenticated]);

  // 3. Real-time WebSocket connection
  useEffect(() => {
    let ws;
    try {
      ws = new WebSocket(getGlobalWSUrl());
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "poll_update") {
            const update = msg.data;
            // Update poll in list
            setPolls((prev) =>
              prev.map((p) => {
                if (p.id === update.poll_id) {
                  const updatedOptions = p.options.map((opt) => {
                    const votes = update.option_votes?.[opt.id] ?? opt.votes;
                    const pct = update.total_votes > 0 ? (votes / update.total_votes) * 100 : 0;
                    return { ...opt, votes, percentage: Math.round(pct * 10) / 10 };
                  });
                  return { ...p, total_votes: update.total_votes, options: updatedOptions };
                }
                return p;
              })
            );

            // Update active poll if currently viewed
            if (activePoll && activePoll.id === update.poll_id) {
              setActivePoll((prev) => {
                if (!prev) return prev;
                const updatedOptions = prev.options.map((opt) => {
                  const votes = update.option_votes?.[opt.id] ?? opt.votes;
                  const pct = update.total_votes > 0 ? (votes / update.total_votes) * 100 : 0;
                  return { ...opt, votes, percentage: Math.round(pct * 10) / 10 };
                });
                return { ...prev, total_votes: update.total_votes, options: updatedOptions };
              });
            }
          } else if (msg.type === "comment_update") {
            const update = msg.data;
            if (activePoll && (update.comment?.target_id === activePoll.id || update.comment?.target_id === "global")) {
              if (update.type === "comment_delete") {
                setComments((prev) => prev.filter((c) => c.id !== update.comment.id));
              } else {
                setComments((prev) => [update.comment, ...prev.filter((c) => c.id !== update.comment.id)]);
              }
            }
          }
        } catch (e) {}
      };
    } catch (e) {}

    return () => {
      if (ws) ws.close();
    };
  }, [activePoll]);

  // Countdown timer
  useEffect(() => {
    if (timeLeft <= 0) return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [timeLeft]);

  const formatTimer = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Submit Vote Handler
  const handleCastVote = async () => {
    if (!selectedOption) {
      setVoteError("Please choose an option before submitting your vote.");
      return;
    }
    if (hasVoted) return;

    setVoting(true);
    setVoteError("");
    try {
      await api.post(`/api/polls/${activePoll.id}/vote`, {
        option_id: selectedOption,
        referral_source: "voting_page",
      });

      setHasVoted(true);
      setVotedOptionId(selectedOption);

      // Trigger Confetti
      confetti({
        particleCount: 60,
        spread: 80,
        origin: { y: 0.6 },
        colors: ["#06b6d4", "#8b5cf6", "#ec4899", "#10b981"],
      });

      // Update local votes count optimistically
      setActivePoll((prev) => {
        if (!prev) return prev;
        const total = (prev.total_votes || 0) + 1;
        const opts = prev.options.map((o) => {
          const v = o.id === selectedOption ? (o.votes || 0) + 1 : o.votes || 0;
          return { ...o, votes: v, percentage: Math.round((v / total) * 1000) / 10 };
        });
        return { ...prev, total_votes: total, options: opts };
      });
    } catch (err) {
      setVoteError(err.message || "Failed to submit vote");
    } finally {
      setVoting(false);
    }
  };

  // Post Comment Handler
  const handlePostComment = async (e) => {
    e.preventDefault();
    if (!commentInput.trim()) return;

    setCommentLoading(true);
    try {
      const newComment = await api.post("/api/comments", {
        target_id: activePoll.id,
        content: commentInput.trim(),
      });
      setComments((prev) => [newComment, ...prev]);
      setCommentInput("");
    } catch (err) {
      alert(err.message || "Failed to post comment");
    } finally {
      setCommentLoading(false);
    }
  };

  // Filtered polls
  const filteredPolls = polls.filter((p) => {
    const matchesCat = categoryFilter === "all" || p.category?.toLowerCase() === categoryFilter.toLowerCase();
    const matchesSearch = !searchQuery || p.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const categories = ["all", "Technology", "Design", "Gaming", "General"];

  if (loading) {
    return (
      <div style={{
        minHeight: "70vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--text-muted)",
        fontSize: "1.1rem",
      }}>
        Loading Live Polling Arena...
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "32px 24px 80px" }}>
      {/* Top Banner & Header */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: "20px",
        marginBottom: "32px",
      }}>
        <div>
          <button
            onClick={() => navigate("/home")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              background: "none",
              border: "none",
              color: "var(--text-muted, #94a3b8)",
              fontSize: "0.85rem",
              fontWeight: 600,
              cursor: "pointer",
              marginBottom: "8px",
              padding: 0,
            }}
          >
            <ArrowLeft size={16} />
            <span>Back to Home</span>
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <h1 style={{ fontSize: "2rem", fontWeight: 800, color: "#ffffff", margin: 0 }}>
              Live Polling & Voting
            </h1>
            <span className="badge-live-poll">
              <span className="pulse-dot-green" />
              <span>Live Now</span>
            </span>
          </div>
          <p style={{ color: "var(--text-muted, #94a3b8)", fontSize: "0.95rem", margin: "6px 0 0" }}>
            Real-time community opinions, live voting, dynamic results, and live commentary.
          </p>
        </div>

        {/* User Role Indicator */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {isAdmin ? (
            <button
              onClick={() => navigate("/admin")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "10px 18px",
                background: "rgba(37, 99, 235, 0.15)",
                border: "1px solid rgba(37, 99, 235, 0.4)",
                borderRadius: "12px",
                color: "#60a5fa",
                fontWeight: 700,
                fontSize: "0.88rem",
                cursor: "pointer",
              }}
            >
              <Shield size={16} />
              <span>Admin: Create / Edit Questions</span>
            </button>
          ) : (
            <div style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 16px",
              background: "rgba(16, 185, 129, 0.12)",
              border: "1px solid rgba(16, 185, 129, 0.3)",
              borderRadius: "12px",
              color: "#34d399",
              fontSize: "0.85rem",
              fontWeight: 600,
            }}>
              <CheckCircle2 size={16} />
              <span>Registered Voter</span>
            </div>
          )}
        </div>
      </div>

      {/* Category Pills & Search Filter */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: "16px",
        marginBottom: "28px",
        background: "rgba(255, 255, 255, 0.02)",
        padding: "12px 18px",
        borderRadius: "16px",
        border: "1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))",
      }}>
        {/* Category Filter Pills */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <span style={{ fontSize: "0.85rem", color: "var(--text-dim, #64748b)", fontWeight: 600, marginRight: "4px" }}>
            Category:
          </span>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              style={{
                padding: "6px 14px",
                borderRadius: "9999px",
                border: "1px solid",
                borderColor: categoryFilter === cat ? "#7c3aed" : "rgba(255, 255, 255, 0.08)",
                background: categoryFilter === cat ? "linear-gradient(135deg, #7c3aed, #2563eb)" : "rgba(255, 255, 255, 0.04)",
                color: categoryFilter === cat ? "#ffffff" : "var(--text-muted, #94a3b8)",
                fontSize: "0.82rem",
                fontWeight: 600,
                cursor: "pointer",
                textTransform: "capitalize",
                transition: "all 0.2s ease",
              }}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          background: "rgba(255, 255, 255, 0.05)",
          padding: "6px 14px",
          borderRadius: "9999px",
          border: "1px solid var(--border-subtle, rgba(255, 255, 255, 0.1))",
          minWidth: "220px",
        }}>
          <Search size={15} color="var(--text-dim, #64748b)" />
          <input
            type="text"
            placeholder="Search questions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
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
      </div>

      {/* Main Grid: Left = Poll Selector & Live Voting + Results, Right = Live Commentary */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 360px",
        gap: "32px",
        alignItems: "start",
      }}>
        {/* Left Column: Poll Switcher + Active Poll Card + Live Results */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {/* Poll Selection Tabs / Carousel */}
          <div>
            <div style={{
              fontSize: "0.85rem",
              color: "var(--text-muted, #94a3b8)",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: "12px",
            }}>
              Available Live Polls ({filteredPolls.length})
            </div>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: "12px",
            }}>
              {filteredPolls.map((p) => {
                const isSelected = p.id === selectedPollId;
                return (
                  <div
                    key={p.id}
                    onClick={() => setSelectedPollId(p.id)}
                    style={{
                      padding: "14px 16px",
                      borderRadius: "14px",
                      background: isSelected ? "rgba(124, 58, 237, 0.18)" : "rgba(255, 255, 255, 0.03)",
                      border: isSelected ? "1.5px solid #8b5cf6" : "1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                      position: "relative",
                      boxShadow: isSelected ? "0 4px 20px rgba(139, 92, 246, 0.25)" : "none",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                      <span style={{
                        fontSize: "0.72rem",
                        padding: "2px 8px",
                        borderRadius: "9999px",
                        background: "rgba(6, 182, 212, 0.15)",
                        color: "#38bdf8",
                        fontWeight: 700,
                        textTransform: "uppercase",
                      }}>
                        {p.category || "General"}
                      </span>
                      <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "0.75rem", color: "var(--text-dim, #64748b)" }}>
                        <Users size={12} />
                        <span>{p.total_votes || 0}</span>
                      </div>
                    </div>
                    <div style={{
                      fontWeight: 700,
                      fontSize: "0.92rem",
                      color: isSelected ? "#ffffff" : "var(--text-muted, #94a3b8)",
                      lineHeight: "1.3",
                    }}>
                      {p.title}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Active Poll Voting & Live Results Card */}
          {activePoll ? (
            <div className="glass-panel" style={{ padding: "32px", borderRadius: "20px" }}>
              {/* Poll Header Meta */}
              <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "12px",
                marginBottom: "18px",
                borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                paddingBottom: "16px",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span className="badge-live-poll">
                    <span className="pulse-dot-green" />
                    <span>Active Voting</span>
                  </span>
                  <span style={{
                    fontSize: "0.78rem",
                    padding: "3px 10px",
                    borderRadius: "9999px",
                    background: "rgba(255, 255, 255, 0.08)",
                    color: "var(--text-muted, #94a3b8)",
                    fontWeight: 600,
                  }}>
                    {activePoll.category || "General"}
                  </span>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--text-muted, #94a3b8)", fontSize: "0.85rem" }}>
                    <Clock size={15} color="#38bdf8" />
                    <span style={{ fontWeight: 700, color: "#ffffff" }}>{formatTimer(timeLeft)}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--text-muted, #94a3b8)", fontSize: "0.85rem" }}>
                    <Users size={15} color="#ec4899" />
                    <span style={{ fontWeight: 700, color: "#ffffff" }}>{activePoll.total_votes || 0} votes</span>
                  </div>
                  <button
                    onClick={() => setShareModalOpen(true)}
                    style={{
                      background: "rgba(255, 255, 255, 0.06)",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      borderRadius: "8px",
                      padding: "6px 10px",
                      color: "var(--text-muted, #94a3b8)",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                    }}
                  >
                    <Share2 size={13} />
                    <span>Share</span>
                  </button>
                </div>
              </div>

              {/* Poll Question & Description */}
              <div style={{ marginBottom: "28px" }}>
                <h2 style={{ fontSize: "1.6rem", fontWeight: 800, color: "#ffffff", margin: "0 0 8px", lineHeight: "1.3" }}>
                  {activePoll.title}
                </h2>
                {activePoll.description && (
                  <p style={{ color: "var(--text-muted, #94a3b8)", fontSize: "0.95rem", margin: 0 }}>
                    {activePoll.description}
                  </p>
                )}
              </div>

              {voteError && (
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "12px 14px",
                  background: "rgba(244, 63, 94, 0.15)",
                  border: "1px solid rgba(244, 63, 94, 0.3)",
                  borderRadius: "12px",
                  color: "#fda4af",
                  fontSize: "0.85rem",
                  marginBottom: "20px",
                }}>
                  <AlertCircle size={18} />
                  <span>{voteError}</span>
                </div>
              )}

              {/* Voting Options Section */}
              <div style={{ marginBottom: "28px" }}>
                <div style={{
                  fontSize: "0.85rem",
                  color: "var(--text-dim, #64748b)",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  marginBottom: "12px",
                }}>
                  {hasVoted ? "Your Ballot Selection" : "Select Your Option to Vote"}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {activePoll.options?.map((opt, idx) => {
                    const isSelected = selectedOption === opt.id;
                    const isVotedChoice = votedOptionId === opt.id;

                    return (
                      <div
                        key={opt.id}
                        onClick={() => {
                          if (!hasVoted) setSelectedOption(opt.id);
                        }}
                        style={{
                          padding: "16px 20px",
                          borderRadius: "14px",
                          background: isVotedChoice
                            ? "rgba(16, 185, 129, 0.12)"
                            : isSelected
                            ? "rgba(124, 58, 237, 0.15)"
                            : "rgba(255, 255, 255, 0.03)",
                          border: isVotedChoice
                            ? "1.5px solid #10b981"
                            : isSelected
                            ? "1.5px solid #8b5cf6"
                            : "1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))",
                          cursor: hasVoted ? "default" : "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          transition: "all 0.2s ease",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                          <span style={{
                            width: "28px",
                            height: "28px",
                            borderRadius: "8px",
                            background: isVotedChoice
                              ? "#10b981"
                              : isSelected
                              ? "#8b5cf6"
                              : "rgba(255, 255, 255, 0.08)",
                            color: "#ffffff",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "0.8rem",
                            fontWeight: 700,
                          }}>
                            {isVotedChoice ? <Check size={16} /> : String.fromCharCode(65 + idx)}
                          </span>
                          <span style={{
                            fontWeight: isSelected || isVotedChoice ? 700 : 500,
                            color: isSelected || isVotedChoice ? "#ffffff" : "var(--text-muted, #94a3b8)",
                            fontSize: "1rem",
                          }}>
                            {opt.text}
                          </span>
                        </div>

                        {isVotedChoice && (
                          <span style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            padding: "3px 10px",
                            borderRadius: "9999px",
                            background: "rgba(16, 185, 129, 0.2)",
                            color: "#34d399",
                            fontSize: "0.78rem",
                            fontWeight: 700,
                          }}>
                            <CheckCircle2 size={13} />
                            <span>Your Vote Cast</span>
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Cast Vote Action Button */}
                <div style={{ marginTop: "20px" }}>
                  {hasVoted ? (
                    <div style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      padding: "14px 20px",
                      background: "rgba(16, 185, 129, 0.1)",
                      border: "1px solid rgba(16, 185, 129, 0.25)",
                      borderRadius: "14px",
                      color: "#34d399",
                      fontWeight: 600,
                      fontSize: "0.95rem",
                    }}>
                      <CheckCircle2 size={20} />
                      <span>Thank you! Your vote has been recorded and verified in the live stream.</span>
                    </div>
                  ) : (
                    <button
                      onClick={handleCastVote}
                      disabled={voting || !selectedOption}
                      style={{
                        padding: "14px 32px",
                        borderRadius: "14px",
                        border: "none",
                        background: selectedOption
                          ? "linear-gradient(135deg, #06b6d4 0%, #8b5cf6 50%, #ec4899 100%)"
                          : "rgba(255, 255, 255, 0.08)",
                        color: selectedOption ? "#ffffff" : "var(--text-dim, #64748b)",
                        fontWeight: 700,
                        fontSize: "1rem",
                        cursor: selectedOption && !voting ? "pointer" : "not-allowed",
                        boxShadow: selectedOption ? "0 4px 20px rgba(139, 92, 246, 0.4)" : "none",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "10px",
                        transition: "all 0.2s ease",
                      }}
                    >
                      <Sparkles size={18} />
                      <span>{voting ? "Submitting Vote..." : "Cast Your Vote"}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Live Animated Results Chart Section */}
              <div style={{
                marginTop: "32px",
                paddingTop: "28px",
                borderTop: "1px solid rgba(255, 255, 255, 0.08)",
              }}>
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "18px",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <BarChart3 size={20} color="#06b6d4" />
                    <h3 style={{ fontSize: "1.2rem", fontWeight: 700, color: "#ffffff", margin: 0 }}>
                      Live Results Stream
                    </h3>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.8rem", color: "var(--text-dim, #64748b)" }}>
                    <span className="pulse-dot-green" />
                    <span>Real-time WebSocket Sync</span>
                  </div>
                </div>

                <LiveResultsChart
                  options={activePoll.options || []}
                  totalVotes={activePoll.total_votes || 0}
                  lastVotedOption={votedOptionId}
                />
              </div>
            </div>
          ) : (
            <div className="glass-panel" style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
              Select a live poll from the list above to vote and watch real-time results.
            </div>
          )}
        </div>

        {/* Right Column: Live Commentary Stream */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div className="glass-panel" style={{
            padding: "24px",
            borderRadius: "20px",
            display: "flex",
            flexDirection: "column",
            maxHeight: "750px",
          }}>
            {/* Commentary Header */}
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "16px",
              paddingBottom: "12px",
              borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <MessageSquare size={18} color="#8b5cf6" />
                <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "#ffffff", margin: 0 }}>
                  Live Commentary
                </h3>
              </div>
              <span style={{ fontSize: "0.78rem", color: "var(--text-dim, #64748b)" }}>
                {comments.length} messages
              </span>
            </div>

            {/* Comments List */}
            <div style={{
              flex: 1,
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              paddingRight: "6px",
              marginBottom: "16px",
              minHeight: "320px",
              maxHeight: "480px",
            }}>
              {comments.length === 0 ? (
                <div style={{
                  padding: "40px 16px",
                  textAlign: "center",
                  color: "var(--text-dim, #64748b)",
                  fontSize: "0.88rem",
                }}>
                  No comments yet. Share your thoughts on this poll first!
                </div>
              ) : (
                comments.map((c) => (
                  <div
                    key={c.id}
                    style={{
                      padding: "12px 14px",
                      borderRadius: "12px",
                      background: "rgba(255, 255, 255, 0.03)",
                      border: "1px solid rgba(255, 255, 255, 0.06)",
                    }}
                  >
                    <div style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: "6px",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <img
                          src={c.user?.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${c.user?.username || c.username || "User"}`}
                          alt="avatar"
                          style={{ width: "22px", height: "22px", borderRadius: "50%", border: "1px solid #7c3aed" }}
                        />
                        <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#ffffff" }}>
                          {c.user?.username || c.username || "Participant"}
                        </span>
                        {(c.user?.role === "admin" || c.role === "admin") && (
                          <span style={{
                            fontSize: "0.68rem",
                            padding: "1px 6px",
                            borderRadius: "4px",
                            background: "rgba(37, 99, 235, 0.2)",
                            color: "#60a5fa",
                            fontWeight: 700,
                          }}>
                            Admin
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: "0.72rem", color: "var(--text-dim, #64748b)" }}>
                        {c.created_at ? new Date(c.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "just now"}
                      </span>
                    </div>
                    <p style={{
                      color: "var(--text-muted, #94a3b8)",
                      fontSize: "0.88rem",
                      margin: 0,
                      lineHeight: "1.4",
                      wordBreak: "break-word",
                    }}>
                      {c.content}
                    </p>
                  </div>
                ))
              )}
            </div>

            {/* Post Comment Input */}
            <form onSubmit={handlePostComment} style={{ display: "flex", gap: "8px" }}>
              <input
                type="text"
                placeholder="Join the discussion..."
                value={commentInput}
                onChange={(e) => setCommentInput(e.target.value)}
                style={{
                  flex: 1,
                  padding: "10px 14px",
                  borderRadius: "10px",
                  background: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid var(--border-subtle, rgba(255, 255, 255, 0.1))",
                  color: "#ffffff",
                  fontSize: "0.85rem",
                  outline: "none",
                }}
              />
              <button
                type="submit"
                disabled={commentLoading || !commentInput.trim()}
                style={{
                  padding: "10px 14px",
                  borderRadius: "10px",
                  border: "none",
                  background: commentInput.trim() ? "linear-gradient(135deg, #7c3aed, #2563eb)" : "rgba(255, 255, 255, 0.08)",
                  color: "#ffffff",
                  cursor: commentInput.trim() && !commentLoading ? "pointer" : "not-allowed",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Send size={15} />
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Share Modal */}
      {shareModalOpen && activePoll && (
        <ShareModal
          poll={activePoll}
          onClose={() => setShareModalOpen(false)}
        />
      )}
    </div>
  );
};
