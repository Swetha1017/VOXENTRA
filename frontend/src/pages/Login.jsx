import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { LogIn, Mail, Lock, Eye, EyeOff, AlertCircle, Sparkles, Shield, User } from "lucide-react";

export const Login = () => {
  const navigate = useNavigate();
  const { login, adminLogin } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (email.trim().toLowerCase() === "swetha4110@gmail.com") {
        await adminLogin(email.trim(), password);
      } else {
        await login(email.trim(), password);
      }
      navigate("/home", { replace: true });
    } catch (err) {
      setError(err.message || "Failed to sign in. Please verify your email and password.");
    } finally {
      setLoading(false);
    }
  };

  const handleDemoFill = (type) => {
    if (type === "admin") {
      setEmail("swetha4110@gmail.com");
      setPassword("segu7624");
    } else {
      setEmail("voter@voxentra.com");
      setPassword("voxentra2026");
    }
    setError("");
  };

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px 16px",
      background: "radial-gradient(circle at 50% 20%, rgba(139, 92, 246, 0.15) 0%, rgba(6, 182, 212, 0.08) 35%, #070914 80%)",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Background ambient lighting */}
      <div style={{
        position: "absolute",
        top: "-100px",
        left: "50%",
        transform: "translateX(-50%)",
        width: "600px",
        height: "350px",
        background: "radial-gradient(ellipse at center, rgba(99, 102, 241, 0.25), transparent 70%)",
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
            background: "linear-gradient(135deg, #06b6d4 0%, #8b5cf6 50%, #ec4899 100%)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 0 32px rgba(139, 92, 246, 0.6)",
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
              style={{
                padding: "10px",
                borderRadius: "10px",
                border: "none",
                background: "linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)",
                color: "#ffffff",
                fontWeight: 700,
                fontSize: "0.9rem",
                cursor: "default",
                boxShadow: "0 2px 8px rgba(37, 99, 235, 0.3)",
              }}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => navigate("/register")}
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
              Register
            </button>
          </div>

          <div style={{ marginBottom: "22px" }}>
            <h2 style={{ fontSize: "1.35rem", fontWeight: 700, color: "#ffffff", margin: "0 0 6px" }}>
              Welcome Back
            </h2>
            <p style={{ color: "var(--text-dim, #64748b)", fontSize: "0.85rem", margin: 0 }}>
              Sign in to vote, participate in live polls, and play games.
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
                  placeholder="••••••••"
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
                background: "linear-gradient(135deg, #06b6d4 0%, #8b5cf6 50%, #ec4899 100%)",
                color: "#ffffff",
                fontWeight: 700,
                fontSize: "0.95rem",
                cursor: loading ? "not-allowed" : "pointer",
                boxShadow: "0 4px 18px rgba(139, 92, 246, 0.4)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                transition: "all 0.2s ease",
              }}
            >
              <LogIn size={18} />
              <span>{loading ? "Signing in..." : "Sign In to VOXENTRA"}</span>
            </button>
          </form>

          {/* Quick Demo Credentials for Rapid Testing */}
          <div style={{
            marginTop: "24px",
            paddingTop: "20px",
            borderTop: "1px solid rgba(255, 255, 255, 0.08)",
          }}>
            <div style={{
              fontSize: "0.75rem",
              color: "var(--text-dim, #64748b)",
              textAlign: "center",
              marginBottom: "10px",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}>
              Quick Fill Credentials
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              <button
                type="button"
                onClick={() => handleDemoFill("voter")}
                style={{
                  padding: "8px 10px",
                  borderRadius: "8px",
                  background: "rgba(255, 255, 255, 0.04)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  color: "var(--text-muted, #94a3b8)",
                  fontSize: "0.78rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                }}
              >
                <User size={13} color="#06b6d4" />
                <span>Demo Voter</span>
              </button>
              <button
                type="button"
                onClick={() => handleDemoFill("admin")}
                style={{
                  padding: "8px 10px",
                  borderRadius: "8px",
                  background: "rgba(255, 255, 255, 0.04)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  color: "var(--text-muted, #94a3b8)",
                  fontSize: "0.78rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                }}
              >
                <Shield size={13} color="#ec4899" />
                <span>Admin Login</span>
              </button>
            </div>
          </div>

          <p style={{
            textAlign: "center",
            marginTop: "24px",
            color: "var(--text-muted, #94a3b8)",
            fontSize: "0.875rem",
            marginBottom: 0,
          }}>
            New to VOXENTRA?{" "}
            <Link
              to="/register"
              style={{
                color: "#38bdf8",
                textDecoration: "none",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};
