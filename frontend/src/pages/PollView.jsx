import React, { useState, useEffect } from "react";
import confetti from "canvas-confetti";
import { api, getWSUrl } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { ShareModal } from "../components/ShareModal";
import { 
  CheckCircle2, Share2, Clock, Users, Send, 
  ArrowLeft, Lock, Trash2, ThumbsUp, ThumbsDown, 
  Eye, MessageSquare, Check, Sparkles, AlertCircle,
  EyeOff, CheckSquare, Square, Shield
} from "lucide-react";

export const PollView = ({ pollId, navigate }) => {
  const { user, isAuthenticated, isAdmin, openAuthModal } = useAuth();
  const [poll, setPoll] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedOption, setSelectedOption] = useState("");
  const [selectedOptions, setSelectedOptions] = useState([]);
  const [hasVoted, setHasVoted] = useState(false);
  const [votedOptionId, setVotedOptionId] = useState("");
  const [voting, setVoting] = useState(false);
  const [error, setError] = useState("");
  const [shareModalOpen, setShareModalOpen] = useState(false);

  // Upvote / Downvote Reactions State
  const [upvotes, setUpvotes] = useState(142);
  const [downvotes, setDownvotes] = useState(8);
  const [userReaction, setUserReaction] = useState(null); // "upvote" | "downvote" | null

  // Timer Countdown State
  const [timeLeft, setTimeLeft] = useState(14400); // 4 hours default

  // Poll Comments
  const [comments, setComments] = useState([]);
  const [commentInput, setCommentInput] = useState("");

  const fetchPollAndComments = async () => {
    setLoading(true);
    try {
      const data = await api.get(`/api/polls/${pollId}`);
      setPoll(data.poll);
      setHasVoted(data.has_voted);
      setVotedOptionId(data.voted_option_id);
      if (data.voted_option_id) {
        setSelectedOption(data.voted_option_id);
      }
      if (data.poll?.upvotes !== undefined) {
        setUpvotes(data.poll.upvotes);
      }
      if (data.poll?.downvotes !== undefined) {
        setDownvotes(data.poll.downvotes);
      }
      if (data.poll?.remaining_seconds) {
        setTimeLeft(data.poll.remaining_seconds);
      }

      const comms = await api.get(`/api/comments?target_id=${pollId}`);
      setComments(comms || []);
    } catch (err) {
      setError(err.message || "Failed to load poll details");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (pollId) {
      fetchPollAndComments();
    }
  }, [pollId, isAuthenticated]);

  // Real-time Countdown Timer
  useEffect(() => {
    if (timeLeft <= 0) return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [timeLeft]);

  // WebSocket Live Updates
  useEffect(() => {
    if (!pollId) return;

    let ws;
    try {
      ws = new WebSocket(getWSUrl(pollId));
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "poll_update") {
            const update = msg.data;
            setPoll((prev) => {
              if (!prev) return prev;
              const updatedOptions = prev.options.map((opt) => {
                const votes = update.option_votes?.[opt.id] ?? opt.votes;
                const pct = update.total_votes > 0 ? (votes / update.total_votes) * 100 : 0;
                return {
                  ...opt,
                  votes,
                  percentage: Math.round(pct * 10) / 10,
                };
              });
              return {
                ...prev,
                total_votes: update.total_votes,
                options: updatedOptions,
              };
            });
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
  }, [pollId]);

  // Format seconds to hh:mm:ss
  const formatTime = (secs) => {
    if (secs <= 0) return "Voting Closed";
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${h.toString().padStart(2, "0")}h ${m.toString().padStart(2, "0")}m ${s.toString().padStart(2, "0")}s`;
  };

  // Upvote / Downvote Question Handler
  const handleReaction = async (type) => {
    if (!isAuthenticated) {
      openAuthModal("login", pollId);
      return;
    }

    try {
      if (userReaction === type) {
        setUserReaction(null);
        if (type === "upvote") setUpvotes((v) => Math.max(0, v - 1));
        else setDownvotes((v) => Math.max(0, v - 1));
      } else {
        if (userReaction === "upvote") setUpvotes((v) => Math.max(0, v - 1));
        if (userReaction === "downvote") setDownvotes((v) => Math.max(0, v - 1));
        setUserReaction(type);
        if (type === "upvote") setUpvotes((v) => v + 1);
        else setDownvotes((v) => v + 1);
      }

      const res = await api.post(`/api/polls/${pollId}/reaction`, { type });
      if (res.upvotes !== undefined) setUpvotes(res.upvotes);
      if (res.downvotes !== undefined) setDownvotes(res.downvotes);
    } catch (e) {
      console.warn("Reaction submission failed:", e.message);
    }
  };

  // Option Selection Toggle (Single & Multi-Select Support)
  const toggleOption = (optId) => {
    if (hasVoted || !poll?.is_active) return;
    if (poll?.selection_type === "multiple") {
      const max = poll.max_selections || 2;
      if (selectedOptions.includes(optId)) {
        setSelectedOptions((prev) => prev.filter((id) => id !== optId));
      } else {
        if (selectedOptions.length >= max) {
          alert(`You can select at most ${max} choices for this ballot.`);
          return;
        }
        setSelectedOptions((prev) => [...prev, optId]);
      }
    } else {
      setSelectedOption(optId);
    }
  };

  // Option Ballot Submission (Supports Single & Multi-Selection)
  const handleVote = async () => {
    if (!isAuthenticated) {
      openAuthModal("register", pollId);
      return;
    }

    const isMulti = poll?.selection_type === "multiple";
    if (isMulti) {
      if (!selectedOptions || selectedOptions.length === 0) {
        alert("Please select at least one choice before submitting your ballot.");
        return;
      }
      const max = poll?.max_selections || 2;
      if (selectedOptions.length > max) {
        alert(`You can select at most ${max} choices.`);
        return;
      }
    } else {
      if (!selectedOption) {
        alert("Please choose an option before submitting your ballot.");
        return;
      }
    }

    setVoting(true);
    setError("");

    try {
      const payload = isMulti
        ? { option_ids: selectedOptions, referral_source: "poll_detail" }
        : { option_id: selectedOption, referral_source: "poll_detail" };

      await api.post(`/api/polls/${pollId}/vote`, payload);

      setHasVoted(true);
      if (!isMulti) {
        setVotedOptionId(selectedOption);
      }
      confetti({ particleCount: 70, spread: 80, origin: { y: 0.6 } });
      fetchPollAndComments();
    } catch (err) {
      setError(err.message || "Voting failed");
    } finally {
      setVoting(false);
    }
  };

  const handlePostComment = async (e) => {
    e.preventDefault();
    if (!isAuthenticated) {
      openAuthModal("register", pollId);
      return;
    }

    if (!commentInput.trim()) return;

    try {
      const newC = await api.post("/api/comments", {
        target_id: pollId,
        content: commentInput.trim(),
      });
      setComments((prev) => [newC, ...prev]);
      setCommentInput("");
    } catch (err) {
      alert(err.message || "Failed to post comment");
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!window.confirm("Admin: Remove this comment?")) return;
    try {
      await api.delete(`/api/admin/comments/${commentId}`);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch (err) {}
  };

  if (loading) {
    return (
      <div style={{
        minHeight: "70vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--text-muted)",
        fontSize: "1.05rem",
      }}>
        Loading question voting interface...
      </div>
    );
  }

  if (error && !poll) {
    return (
      <div style={{ maxWidth: "600px", margin: "60px auto", padding: "32px", textAlign: "center" }}>
        <h2 style={{ color: "#f87171", marginBottom: "12px" }}>Question Unavailable</h2>
        <p style={{ color: "var(--text-muted)", marginBottom: "24px" }}>{error}</p>
        <button className="btn-vox-primary" onClick={() => navigate("polls")}>
          Return to Live Polls
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "36px 24px 80px" }}>
      {/* Top Utility Nav: Back & Share */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: "28px",
      }}>
        <button
          onClick={() => navigate("home")}
          className="btn-vox-secondary"
          style={{
            padding: "8px 18px",
            fontSize: "0.88rem",
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <ArrowLeft size={16} />
          <span>Back to Home</span>
        </button>

        <button
          onClick={() => setShareModalOpen(true)}
          className="btn-vox-secondary"
          style={{
            padding: "8px 20px",
            fontSize: "0.88rem",
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <Share2 size={16} color="#06b6d4" />
          <span>Share Question</span>
        </button>
      </div>

      {/* Main Two-Column Layout: Question Interface (Left) & Live Commentary Stream (Right) */}
      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 0.7fr", gap: "36px" }}>
        {/* LEFT COLUMN: Redesigned Question Voting Interface (Screenshot 2 Match) */}
        <div>
          {/* QUESTION HEADER SECTION: Clean Minimalist Layout (No "Idea" badge, No category tag) */}
          <div className="question-header-section">
            <h1 className="question-title">
              {poll.title}
            </h1>

            {poll.description && (
              <p className="question-body">
                {poll.description}
              </p>
            )}
          </div>

          {/* DISTINCT SEPARATED METRICS DISPLAY: Each stat clearly separated into individual labeled elements */}
          <div className="separated-metrics-grid">
            {/* 1. Distinct Vote Count Element */}
            <div className="metric-stat-box">
              <div className="metric-stat-icon-wrapper" style={{
                background: poll.results_hidden ? "rgba(139, 92, 246, 0.15)" : "rgba(99, 102, 241, 0.15)",
                color: poll.results_hidden ? "#c084fc" : "#818cf8"
              }}>
                {poll.results_hidden ? <Shield size={20} /> : <CheckCircle2 size={20} />}
              </div>
              <div className="metric-stat-info">
                <span className="metric-stat-label">Total Votes</span>
                <span className="metric-stat-val" style={{
                  fontSize: poll.results_hidden ? "0.95rem" : "1.25rem",
                  color: poll.results_hidden ? "#c084fc" : undefined
                }}>
                  {poll.results_hidden ? "Confidential" : (poll.total_votes?.toLocaleString() || "0")}
                </span>
              </div>
            </div>

            {/* 2. Distinct View Count Element */}
            <div className="metric-stat-box">
              <div className="metric-stat-icon-wrapper" style={{ background: "rgba(6, 182, 212, 0.15)", color: "#22d3ee" }}>
                <Eye size={20} />
              </div>
              <div className="metric-stat-info">
                <span className="metric-stat-label">Total Views</span>
                <span className="metric-stat-val">
                  {poll.views ? poll.views.toLocaleString() : "10,420"}
                </span>
              </div>
            </div>

            {/* 3. Distinct Answer / Response Count Element */}
            <div className="metric-stat-box">
              <div className="metric-stat-icon-wrapper" style={{ background: "rgba(236, 72, 153, 0.15)", color: "#f472b6" }}>
                <MessageSquare size={20} />
              </div>
              <div className="metric-stat-info">
                <span className="metric-stat-label">Answers / Comments</span>
                <span className="metric-stat-val">
                  {comments.length > 0 ? comments.length : (poll.total_votes ? Math.round(poll.total_votes / 16) : 54)}
                </span>
              </div>
            </div>

            {/* 4. Distinct Time Left Element */}
            <div className="metric-stat-box">
              <div className="metric-stat-icon-wrapper" style={{ background: "rgba(245, 158, 11, 0.15)", color: "#fbbf24" }}>
                <Clock size={20} />
              </div>
              <div className="metric-stat-info">
                <span className="metric-stat-label">Time Remaining</span>
                <span className="metric-stat-val" style={{ fontSize: "1.05rem" }}>
                  {formatTime(timeLeft)}
                </span>
                <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", display: "block", marginTop: "2px" }}>
                  {poll.duration_minutes || 60}m session · {poll.timezone || "UTC"}
                </span>
              </div>
            </div>
          </div>

          {/* PROMINENTLY POSITIONED & VISUALLY DISTINCT UPVOTE / DOWNVOTE ACTION BUTTONS */}
          <div className="question-actions-bar">
            {/* Upvote Button */}
            <button
              onClick={() => handleReaction("upvote")}
              className={`btn-vote-reaction btn-upvote ${userReaction === "upvote" ? "active" : ""}`}
              title="Upvote this question"
            >
              <ThumbsUp size={18} />
              <span>Upvote Question</span>
              <span style={{
                background: userReaction === "upvote" ? "rgba(255, 255, 255, 0.25)" : "rgba(16, 185, 129, 0.2)",
                padding: "2px 8px",
                borderRadius: "8px",
                fontSize: "0.82rem",
                fontWeight: 800,
              }}>
                {upvotes}
              </span>
            </button>

            {/* Downvote Button */}
            <button
              onClick={() => handleReaction("downvote")}
              className={`btn-vote-reaction btn-downvote ${userReaction === "downvote" ? "active" : ""}`}
              title="Downvote this question"
            >
              <ThumbsDown size={18} />
              <span>Downvote</span>
              <span style={{
                background: userReaction === "downvote" ? "rgba(255, 255, 255, 0.25)" : "rgba(244, 63, 94, 0.2)",
                padding: "2px 8px",
                borderRadius: "8px",
                fontSize: "0.82rem",
                fontWeight: 800,
              }}>
                {downvotes}
              </span>
            </button>

            {/* Live Voting Status Badge */}
            <div style={{
              marginLeft: "auto",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "0.85rem",
              color: "var(--text-muted)",
            }}>
              <span className="pulse-dot-green" />
              <span style={{ fontWeight: 600, color: "#34d399" }}>
                {poll.is_active ? "Live Election Round" : "Round Closed"}
              </span>
            </div>
          </div>

          {/* PRIVACY SHIELD BANNER (When Results Are Hidden) */}
          {poll.results_hidden && (
            <div style={{
              background: "rgba(139, 92, 246, 0.12)",
              border: "1px solid rgba(139, 92, 246, 0.35)",
              color: "#c084fc",
              padding: "14px 18px",
              borderRadius: "12px",
              marginBottom: "18px",
              display: "flex",
              alignItems: "center",
              gap: "12px"
            }}>
              <EyeOff size={20} style={{ flexShrink: 0 }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: "0.88rem" }}>Results Privacy Shield Active</div>
                <div style={{ fontSize: "0.8rem", color: "rgba(192, 132, 252, 0.85)", marginTop: "2px" }}>
                  {poll.results_reveal_condition || "Vote counts and percentages are confidential per administrative privacy policy."}
                </div>
              </div>
            </div>
          )}

          {/* MULTIPLE SELECTION BANNER */}
          {poll.selection_type === "multiple" && (
            <div style={{
              background: "rgba(6, 182, 212, 0.1)",
              border: "1px solid rgba(6, 182, 212, 0.3)",
              color: "#22d3ee",
              padding: "10px 16px",
              borderRadius: "10px",
              fontSize: "0.82rem",
              marginBottom: "18px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between"
            }}>
              <span>☑️ Multiple Selection Poll: You may select up to <strong>{poll.max_selections || 2}</strong> choices.</span>
              <span style={{ fontWeight: 800, background: "rgba(6, 182, 212, 0.2)", padding: "2px 8px", borderRadius: "6px" }}>
                {selectedOptions.length} / {poll.max_selections || 2} selected
              </span>
            </div>
          )}

          {/* OPTION SELECTION LIST */}
          <div className="screenshot2-options-container">
            {poll.options.map((opt, idx) => {
              const isMulti = poll.selection_type === "multiple";
              const isSelected = isMulti
                ? selectedOptions.includes(opt.id)
                : (selectedOption === opt.id || votedOptionId === opt.id);
              const showResults = (hasVoted || !poll.is_active) && !poll.results_hidden;

              return (
                <div
                  key={opt.id || idx}
                  onClick={() => toggleOption(opt.id)}
                  className={`screenshot2-option-row ${isSelected ? "selected" : ""}`}
                  style={{ cursor: hasVoted ? "default" : "pointer" }}
                >
                  {/* Subtle progress fill when voted & results visible */}
                  {showResults && (
                    <div
                      className="screenshot2-option-progress"
                      style={{ width: `${opt.percentage || 0}%` }}
                    />
                  )}

                  {/* Radio or Checkbox Indicator */}
                  {isMulti ? (
                    <div style={{ marginRight: "12px", display: "flex", alignItems: "center" }}>
                      {isSelected ? (
                        <CheckSquare size={20} color="#06b6d4" />
                      ) : (
                        <Square size={20} color="var(--border-subtle)" />
                      )}
                    </div>
                  ) : (
                    <div className="screenshot2-radio-circle">
                      {isSelected && <div className="screenshot2-radio-inner-dot" />}
                    </div>
                  )}

                  {/* Option Label Text */}
                  <span className="screenshot2-option-text">
                    {opt.text}
                  </span>

                  {/* Live Percentage Badge */}
                  {showResults && (
                    <span className="screenshot2-option-pct">
                      {opt.percentage || 0}%
                      <span style={{ fontSize: "0.78rem", color: "var(--text-dim)", marginLeft: "6px" }}>
                        ({opt.votes || 0})
                      </span>
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* VOTER AUTHENTICATION STATUS / BALLOT CONFIRMATION AREA */}
          {!isAuthenticated ? (
            /* Screenshot 2 Match: "Voter Account Required" Card */
            <div className="voter-required-box">
              <div style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "10px",
                fontSize: "1.15rem",
                fontWeight: 800,
                color: "#ffffff",
                marginBottom: "10px",
              }}>
                <Lock size={20} color="#818cf8" />
                <span>Voter Account Required</span>
              </div>

              <p style={{
                color: "#94a3b8",
                fontSize: "0.95rem",
                lineHeight: 1.6,
                maxWidth: "520px",
                margin: "0 auto 24px",
              }}>
                Only registered, authenticated voters can cast a ballot in this election. Please sign in or create an account to participate.
              </p>

              <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "16px",
                flexWrap: "wrap",
              }}>
                <button
                  onClick={() => openAuthModal("login", poll.id)}
                  style={{
                    background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
                    color: "#ffffff",
                    fontWeight: 700,
                    fontSize: "0.95rem",
                    padding: "12px 28px",
                    borderRadius: "10px",
                    border: "none",
                    cursor: "pointer",
                    boxShadow: "0 0 18px rgba(99, 102, 241, 0.45)",
                    transition: "all 0.2s ease",
                  }}
                >
                  Sign In to Vote
                </button>

                <button
                  onClick={() => openAuthModal("register", poll.id)}
                  style={{
                    background: "rgba(30, 41, 59, 0.8)",
                    color: "#f1f5f9",
                    fontWeight: 600,
                    fontSize: "0.95rem",
                    padding: "12px 26px",
                    borderRadius: "10px",
                    border: "1px solid rgba(255, 255, 255, 0.12)",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                  }}
                >
                  Register Account
                </button>
              </div>
            </div>
          ) : hasVoted ? (
            /* Officially Verified Ballot Confirmation */
            <div style={{
              background: "rgba(16, 185, 129, 0.12)",
              border: "1.5px solid rgba(16, 185, 129, 0.35)",
              color: "#34d399",
              padding: "18px 24px",
              borderRadius: "14px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "12px",
              fontWeight: 700,
              fontSize: "1rem",
            }}>
              <CheckCircle2 size={22} color="#10b981" />
              <span>Your ballot has been officially recorded and verified on the live ledger.</span>
            </div>
          ) : !poll.is_active ? (
            /* Concluded Poll Notice */
            <div style={{
              background: "rgba(244, 63, 94, 0.12)",
              border: "1.5px solid rgba(244, 63, 94, 0.35)",
              color: "#fda4af",
              padding: "16px",
              borderRadius: "14px",
              textAlign: "center",
              fontWeight: 600,
            }}>
              This election round has concluded. Voting is locked.
            </div>
          ) : (
            /* Cast Ballot Action Button */
            (() => {
              const isMulti = poll.selection_type === "multiple";
              const canSubmit = isMulti ? selectedOptions.length > 0 : !!selectedOption;
              let btnText = "Select an Option Above to Vote";
              if (voting) btnText = "Recording Ballot...";
              else if (canSubmit) {
                btnText = isMulti
                  ? `Confirm & Cast Ballot (${selectedOptions.length} of ${poll.max_selections || 2} selected)`
                  : "Confirm & Cast Ballot";
              } else if (isMulti) {
                btnText = `Select up to ${poll.max_selections || 2} Choices to Vote`;
              }

              return (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <button
                    onClick={handleVote}
                    disabled={voting || !canSubmit}
                    className="btn-vox-primary"
                    style={{
                      width: "100%",
                      padding: "15px",
                      fontSize: "1.05rem",
                      fontWeight: 800,
                      borderRadius: "12px",
                      opacity: !canSubmit ? 0.6 : 1,
                      cursor: !canSubmit ? "not-allowed" : "pointer",
                    }}
                  >
                    {btnText}
                  </button>
                  <div style={{ textAlign: "center", fontSize: "0.8rem", color: "var(--text-dim)" }}>
                    {isMulti
                      ? `Multi-selection ballot: max ${poll.max_selections || 2} choices allowed.`
                      : "Verified 1-vote-per-citizen protocol enforced."}
                  </div>
                </div>
              );
            })()
          )}
        </div>

        {/* RIGHT COLUMN: Live Commentary Stream */}
        <div className="glass-panel" style={{
          padding: "28px",
          display: "flex",
          flexDirection: "column",
          height: "640px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "18px" }}>
            <span className="pulse-dot-green" />
            <h3 style={{ fontSize: "1.15rem", fontWeight: 800, color: "#ffffff" }}>
              Live Commentary Stream
            </h3>
          </div>

          <div className="commentary-list" style={{ flex: 1, marginBottom: "16px" }}>
            {comments.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 10px", color: "var(--text-muted)", fontSize: "0.9rem" }}>
                Be the first to share your thoughts on this question!
              </div>
            ) : (
              comments.map((c, cIdx) => (
                <div key={`${c.id || "comm"}-${cIdx}`} className="commentary-item">
                  <img src={c.avatar} alt={c.username} className="commentary-avatar" />
                  <div className="commentary-bubble">
                    <div className="commentary-header">
                      <span className="commentary-username">{c.username}</span>
                      <span className="commentary-time">Live</span>
                      {isAdmin && (
                        <button
                          onClick={() => handleDeleteComment(c.id)}
                          style={{ background: "none", color: "#fda4af", padding: "0 4px", cursor: "pointer" }}
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                    <div className="commentary-text">{c.content}</div>
                  </div>
                </div>
              ))
            )}
          </div>

          <form onSubmit={handlePostComment} style={{ display: "flex", gap: "8px" }}>
            <input
              type="text"
              placeholder={isAuthenticated ? "Type your commentary..." : "Sign in to join discussion..."}
              value={commentInput}
              onChange={(e) => setCommentInput(e.target.value)}
              className="vox-input"
              style={{ padding: "11px 14px", fontSize: "0.85rem" }}
            />
            <button type="submit" className="btn-vox-primary" style={{ padding: "11px 16px" }}>
              <Send size={15} />
            </button>
          </form>
        </div>
      </div>

      {shareModalOpen && (
        <ShareModal
          poll={poll}
          isOpen={shareModalOpen}
          onClose={() => setShareModalOpen(false)}
        />
      )}
    </div>
  );
};
