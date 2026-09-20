import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { UserPlus, User, Mail, Lock, Eye, EyeOff, AlertCircle, Sparkles } from "lucide-react";

export const Register = () => {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    setLoading(true);
    try {
      await register(username.trim(), email.trim(), password);
      navigate("/home", { replace: true });
    } catch (err) {
      setError(err.message || "Failed to create account. Email may already be in use.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px 16px",
      background: "radial-gradient(circle at 50% 20%, rgba(16, 185, 129, 0.12) 0%, rgba(139, 92, 246, 0.1) 35%, #070914 80%)",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Ambient Glow */}
      <div style={{
        position: "absolute",
        top: "-100px",
        left: "50%",
        transform: "translateX(-50%)",
        width: "600px",
        height: "350px",
        background: "radial-gradient(ellipse at center, rgba(16, 185, 129, 0.2), transparent 70%)",
        filter: "blur(60px)",
        pointerEvents: "none",
      }} />

      {/* Main Container */}
      <div style={{ width: "100%", maxWidth: "440px", position: "relative", zIndex: 1 }}>
        {/* Brand Header */}
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <div style={{
            width: "56px",
            height: "56px",
            borderRadius: "16px",
            background: "linear-gradient(135deg, #10b981 0%, #06b6d4 50%, #8b5cf6 100%)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 0 32px rgba(16, 185, 129, 0.5)",
            marginBottom: "16px",
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path d="M4 4L12 20L20 4H15L12 12L9 4H4Z" fill="#ffffff" />
            </svg>
          </div>
          <h1 style={{
            fontSize: "2rem",
            fontWeight: 900,
            letterSpacing: "-0.03em",
            color: "#ffffff",
            margin: "0 0 6px",
          }}>
            VOXENTRA
          </h1>
          <p style={{
            color: "var(--text-muted, #94a3b8)",
            fontSize: "0.95rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
            margin: 0,
          }}>
            <span>💜</span>
            <span>Your Voice Drives What's Next</span>
          </p>
        </div>

        {/* Auth Card */}
        <div className="glass-card" style={{
          padding: "36px 32px",
          background: "rgba(15, 23, 42, 0.75)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          borderRadius: "20px",
          backdropFilter: "blur(20px)",
          boxShadow: "0 20px 50px rgba(0, 0, 0, 0.5)",
        }}>
          {/* Top Switcher: Sign In / Register */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "6px",
            background: "rgba(255, 255, 255, 0.05)",
            padding: "4px",
            borderRadius: "12px",
            marginBottom: "28px",
          }}>
            <button
              type="button"
              onClick={() => navigate("/login")}
              style={{
                padding: "10px",
                borderRadius: "10px",
                border: "none",
                background: "transparent",
                color: "var(--text-muted, #94a3b8)",
                fontWeight: 600,
                fontSize: "0.9rem",
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
            >
              Sign In
            </button>
            <button
              type="button"
              style={{
                padding: "10px",
                borderRadius: "10px",
                border: "none",
                background: "linear-gradient(135deg, #10b981 0%, #06b6d4 100%)",
                color: "#ffffff",
                fontWeight: 700,
                fontSize: "0.9rem",
                cursor: "default",
                boxShadow: "0 2px 8px rgba(16, 185, 129, 0.3)",
              }}
            >
              Register
            </button>
          </div>

          <div style={{ marginBottom: "22px" }}>
            <h2 style={{ fontSize: "1.35rem", fontWeight: 700, color: "#ffffff", margin: "0 0 6px" }}>
              Join the Community
            </h2>
            <p style={{ color: "var(--text-dim, #64748b)", fontSize: "0.85rem", margin: 0 }}>
              Create your account in seconds to start voting in live polls.
            </p>
          </div>

          {error && (
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
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: "18px" }}>
              <label style={{
                display: "block",
                fontSize: "0.8rem",
                fontWeight: 600,
                color: "var(--text-muted, #94a3b8)",
                marginBottom: "8px",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}>
                Username
              </label>
              <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                <User size={17} color="var(--text-dim, #64748b)" style={{ position: "absolute", left: "14px" }} />
                <input
                  type="text"
                  required
                  minLength={3}
                  placeholder="e.g. Alex"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="form-input"
                  style={{
                    width: "100%",
                    padding: "12px 14px 12px 42px",
                    background: "rgba(255, 255, 255, 0.04)",
                    border: "1px solid var(--border-subtle, rgba(255, 255, 255, 0.1))",
                    borderRadius: "12px",
                    color: "#ffffff",
                    fontSize: "0.92rem",
                    outline: "none",
                  }}
                />
              </div>
            </div>

            <div style={{ marginBottom: "18px" }}>
              <label style={{
                display: "block",
                fontSize: "0.8rem",
                fontWeight: 600,
                color: "var(--text-muted, #94a3b8)",
                marginBottom: "8px",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}>
                Email Address
              </label>
              <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                <Mail size={17} color="var(--text-dim, #64748b)" style={{ position: "absolute", left: "14px" }} />
                <input
                  type="email"
                  required
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="form-input"
                  style={{
                    width: "100%",
                    padding: "12px 14px 12px 42px",
                    background: "rgba(255, 255, 255, 0.04)",
                    border: "1px solid var(--border-subtle, rgba(255, 255, 255, 0.1))",
                    borderRadius: "12px",
                    color: "#ffffff",
                    fontSize: "0.92rem",
                    outline: "none",
                  }}
                />
              </div>
            </div>

            <div style={{ marginBottom: "24px" }}>
              <label style={{
                display: "block",
                fontSize: "0.8rem",
                fontWeight: 600,
                color: "var(--text-muted, #94a3b8)",
                marginBottom: "8px",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}>
                Password
              </label>
              <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                <Lock size={17} color="var(--text-dim, #64748b)" style={{ position: "absolute", left: "14px" }} />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={6}
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="form-input"
                  style={{
                    width: "100%",
                    padding: "12px 42px 12px 42px",
                    background: "rgba(255, 255, 255, 0.04)",
                    border: "1px solid var(--border-subtle, rgba(255, 255, 255, 0.1))",
                    borderRadius: "12px",
                    color: "#ffffff",
                    fontSize: "0.92rem",
                    outline: "none",
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: "absolute",
                    right: "12px",
                    background: "none",
                    border: "none",
                    color: "var(--text-dim, #64748b)",
                    cursor: "pointer",
                    padding: "4px",
                  }}
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                padding: "13px",
                borderRadius: "12px",
                border: "none",
                background: "linear-gradient(135deg, #10b981 0%, #06b6d4 50%, #8b5cf6 100%)",
                color: "#ffffff",
                fontWeight: 700,
                fontSize: "0.95rem",
                cursor: loading ? "not-allowed" : "pointer",
                boxShadow: "0 4px 18px rgba(16, 185, 129, 0.4)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                transition: "all 0.2s ease",
              }}
            >
              <UserPlus size={18} />
              <span>{loading ? "Creating Account..." : "Create Account"}</span>
            </button>
          </form>

          <p style={{
            textAlign: "center",
            marginTop: "24px",
            color: "var(--text-muted, #94a3b8)",
            fontSize: "0.875rem",
            marginBottom: 0,
          }}>
            Already have an account?{" "}
            <Link
              to="/login"
              style={{
                color: "#38bdf8",
                textDecoration: "none",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};
