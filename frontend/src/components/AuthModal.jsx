import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { X, Mail, Lock, User, Sparkles, AlertCircle } from "lucide-react";

export const AuthModal = () => {
  const { authModal, closeAuthModal, login, register } = useAuth();
  const [isLogin, setIsLogin] = useState(authModal.mode === "login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    setIsLogin(authModal.mode === "login");
    setError("");
  }, [authModal.mode, authModal.isOpen]);

  if (!authModal.isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isLogin) {
        await login(email, password);
      } else {
        if (!username.trim()) {
          throw new Error("Please choose a display name or username");
        }
        await register(username, email, password);
      }
      // Redirect users to comprehensive dashboard upon successful auth
      if (!authModal.redirectPollId) {
        window.location.hash = "dashboard";
      }
    } catch (err) {
      setError(err.message || "Authentication failed. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={closeAuthModal}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Close Button */}
        <button
          onClick={closeAuthModal}
          style={{
            position: "absolute",
            top: "18px",
            right: "18px",
            background: "rgba(255, 255, 255, 0.06)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "50%",
            width: "32px",
            height: "32px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--text-muted)",
          }}
        >
          <X size={18} />
        </button>

        {/* Modal Header */}
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <div style={{
            width: "48px",
            height: "48px",
            borderRadius: "14px",
            background: "linear-gradient(135deg, #06b6d4 0%, #8b5cf6 100%)",
            margin: "0 auto 14px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 0 20px rgba(139, 92, 246, 0.5)",
          }}>
            <Sparkles size={24} color="#ffffff" />
          </div>

          <h2 style={{ fontSize: "1.6rem", fontWeight: 800, color: "#ffffff", marginBottom: "6px" }}>
            {isLogin ? "Welcome Back to Voxentra" : "Join the Voxentra Community"}
          </h2>
          <p style={{ fontSize: "0.9rem", color: "var(--text-muted)" }}>
            {isLogin
              ? "Sign in to vote on live polls, participate in games & track stats"
              : "Register to vote, leave live commentary, and unlock all features"}
          </p>
        </div>

        {/* Error banner */}
        {error && (
          <div style={{
            background: "rgba(244, 63, 94, 0.15)",
            border: "1px solid rgba(244, 63, 94, 0.35)",
            color: "#fda4af",
            padding: "10px 14px",
            borderRadius: "var(--radius-md)",
            fontSize: "0.85rem",
            marginBottom: "18px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {!isLogin && (
            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: "6px" }}>
                Username / Display Name
              </label>
              <div style={{ position: "relative" }}>
                <User size={18} color="var(--text-dim)" style={{ position: "absolute", left: "14px", top: "14px" }} />
                <input
                  type="text"
                  required
                  placeholder="e.g. AlexMorgan"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="vox-input"
                  style={{ paddingLeft: "42px" }}
                />
              </div>
            </div>
          )}

          <div>
            <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: "6px" }}>
              Email Address
            </label>
            <div style={{ position: "relative" }}>
              <Mail size={18} color="var(--text-dim)" style={{ position: "absolute", left: "14px", top: "14px" }} />
              <input
                type="email"
                required
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="vox-input"
                style={{ paddingLeft: "42px" }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: "6px" }}>
              Password
            </label>
            <div style={{ position: "relative" }}>
              <Lock size={18} color="var(--text-dim)" style={{ position: "absolute", left: "14px", top: "14px" }} />
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="vox-input"
                style={{ paddingLeft: "42px" }}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-vox-primary"
            style={{ width: "100%", padding: "14px", marginTop: "8px", fontSize: "1rem" }}
          >
            {loading ? "Verifying..." : isLogin ? "Sign In & Continue" : "Create Account & Vote"}
          </button>
        </form>

        {/* Toggle Mode */}
        <div style={{ textAlign: "center", marginTop: "20px", fontSize: "0.875rem", color: "var(--text-muted)" }}>
          {isLogin ? (
            <span>
              Don't have an account?{" "}
              <button
                type="button"
                onClick={() => { setIsLogin(false); setError(""); }}
                style={{ background: "none", color: "#a78bfa", fontWeight: 600, cursor: "pointer" }}
              >
                Register Now
              </button>
            </span>
          ) : (
            <span>
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => { setIsLogin(true); setError(""); }}
                style={{ background: "none", color: "#a78bfa", fontWeight: 600, cursor: "pointer" }}
              >
                Sign In
              </button>
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
