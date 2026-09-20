import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { LogIn, Mail, Lock, Eye, EyeOff, AlertCircle, Sparkles, Key, CheckCircle, X } from "lucide-react";

export const Login = () => {
  const navigate = useNavigate();
  const { login, adminLogin, resetPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Secure Password Reset Modal state
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState("");
  const [resetSuccess, setResetSuccess] = useState("");

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

  const handleResetSubmit = async (e) => {
    e.preventDefault();
    setResetError("");
    setResetSuccess("");
    setResetLoading(true);
    try {
      const res = await resetPassword(resetEmail.trim(), resetToken.trim(), newPassword);
      setResetSuccess(res.message || "Password updated successfully. All credentials masked: ••••••••••••");
      setResetToken("");
      setNewPassword("");
    } catch (err) {
      setResetError(err.message || "Unable to reset password. Please verify the reset token.");
    } finally {
      setResetLoading(false);
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
            <Sparkles size={15} color="#06b6d4" />
            <span>Next-Gen Real-Time Democratic Intelligence</span>
          </p>
        </div>

        {/* Glassmorphic Login Card */}
        <div style={{
          background: "rgba(15, 23, 42, 0.75)",
          backdropFilter: "blur(20px)",
          border: "1px solid var(--border-subtle, rgba(255, 255, 255, 0.1))",
          borderRadius: "24px",
          padding: "36px 32px",
          boxShadow: "0 20px 50px rgba(0, 0, 0, 0.5), 0 0 40px rgba(139, 92, 246, 0.1)",
        }}>
          <div style={{ marginBottom: "24px" }}>
            <h2 style={{
              fontSize: "1.35rem",
              fontWeight: 800,
              color: "#ffffff",
              margin: "0 0 6px",
              letterSpacing: "-0.01em",
            }}>
              Sign In
            </h2>
            <p style={{
              color: "var(--text-dim, #64748b)",
              fontSize: "0.875rem",
              margin: 0,
            }}>
              Enter your credentials to access live polling sessions.
            </p>
          </div>

          {error && (
            <div style={{
              background: "rgba(239, 68, 68, 0.12)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              borderRadius: "12px",
              padding: "12px 14px",
              marginBottom: "20px",
              display: "flex",
              alignItems: "flex-start",
              gap: "10px",
            }}>
              <AlertCircle size={18} color="#ef4444" style={{ flexShrink: 0, marginTop: "2px" }} />
              <span style={{ color: "#fca5a5", fontSize: "0.85rem", lineHeight: 1.4 }}>
                {error}
              </span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: "20px" }}>
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
                  placeholder="voter@domain.com"
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
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <label style={{
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  color: "var(--text-muted, #94a3b8)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  margin: 0,
                }}>
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setShowResetModal(true);
                    setResetError("");
                    setResetSuccess("");
                    if (email) setResetEmail(email);
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#38bdf8",
                    fontSize: "0.78rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    padding: 0,
                    textDecoration: "none",
                  }}
                >
                  Forgot password?
                </button>
              </div>
              <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                <Lock size={17} color="var(--text-dim, #64748b)" style={{ position: "absolute", left: "14px" }} />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="••••••••••••"
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

      {/* Password Reset Modal - Strictly Masked with Tokens */}
      {showResetModal && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(3, 7, 18, 0.85)",
          backdropFilter: "blur(12px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
          padding: "16px",
        }}>
          <div style={{
            width: "100%",
            maxWidth: "420px",
            background: "rgba(15, 23, 42, 0.95)",
            border: "1px solid rgba(255, 255, 255, 0.12)",
            borderRadius: "20px",
            padding: "28px 24px",
            boxShadow: "0 25px 60px rgba(0, 0, 0, 0.6)",
            position: "relative",
          }}>
            <button
              onClick={() => setShowResetModal(false)}
              style={{
                position: "absolute",
                top: "18px",
                right: "18px",
                background: "none",
                border: "none",
                color: "var(--text-dim, #64748b)",
                cursor: "pointer",
                padding: "4px",
              }}
            >
              <X size={20} />
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
              <div style={{
                width: "38px",
                height: "38px",
                borderRadius: "10px",
                background: "rgba(6, 182, 212, 0.15)",
                border: "1px solid rgba(6, 182, 212, 0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}>
                <Key size={18} color="#06b6d4" />
              </div>
              <div>
                <h3 style={{ fontSize: "1.1rem", fontWeight: 800, color: "#ffffff", margin: 0 }}>
                  Secure Password Reset
                </h3>
                <p style={{ fontSize: "0.78rem", color: "var(--text-dim, #64748b)", margin: 0 }}>
                  Token-verified credential recovery with masked payloads
                </p>
              </div>
            </div>

            {resetError && (
              <div style={{
                background: "rgba(239, 68, 68, 0.1)",
                border: "1px solid rgba(239, 68, 68, 0.25)",
                borderRadius: "10px",
                padding: "10px 12px",
                marginBottom: "16px",
                color: "#fca5a5",
                fontSize: "0.8rem",
              }}>
                {resetError}
              </div>
            )}

            {resetSuccess && (
              <div style={{
                background: "rgba(16, 185, 129, 0.1)",
                border: "1px solid rgba(16, 185, 129, 0.25)",
                borderRadius: "10px",
                padding: "10px 12px",
                marginBottom: "16px",
                color: "#6ee7b7",
                fontSize: "0.8rem",
                display: "flex",
                alignItems: "flex-start",
                gap: "8px",
              }}>
                <CheckCircle size={16} color="#10b981" style={{ flexShrink: 0, marginTop: "2px" }} />
                <span>{resetSuccess}</span>
              </div>
            )}

            <form onSubmit={handleResetSubmit}>
              <div style={{ marginBottom: "14px" }}>
                <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "6px", fontWeight: 600 }}>
                  Account Email
                </label>
                <input
                  type="email"
                  required
                  placeholder="voter@domain.com"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    background: "rgba(255, 255, 255, 0.04)",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    borderRadius: "10px",
                    color: "#ffffff",
                    fontSize: "0.88rem",
                    outline: "none",
                  }}
                />
              </div>

              <div style={{ marginBottom: "14px" }}>
                <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "6px", fontWeight: 600 }}>
                  Reset Token (Masked)
                </label>
                <input
                  type="password"
                  required
                  placeholder="••••••••••••"
                  value={resetToken}
                  onChange={(e) => setResetToken(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    background: "rgba(255, 255, 255, 0.04)",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    borderRadius: "10px",
                    color: "#ffffff",
                    fontSize: "0.88rem",
                    outline: "none",
                  }}
                />
              </div>

              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "6px", fontWeight: 600 }}>
                  New Password
                </label>
                <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                  <input
                    type={showNewPassword ? "text" : "password"}
                    required
                    minLength={6}
                    placeholder="••••••••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 38px 10px 12px",
                      background: "rgba(255, 255, 255, 0.04)",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      borderRadius: "10px",
                      color: "#ffffff",
                      fontSize: "0.88rem",
                      outline: "none",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    style={{
                      position: "absolute",
                      right: "10px",
                      background: "none",
                      border: "none",
                      color: "var(--text-dim)",
                      cursor: "pointer",
                      padding: "4px",
                    }}
                  >
                    {showNewPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  type="button"
                  onClick={() => setShowResetModal(false)}
                  style={{
                    flex: 1,
                    padding: "10px",
                    borderRadius: "10px",
                    background: "rgba(255, 255, 255, 0.05)",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    color: "var(--text-muted)",
                    fontWeight: 600,
                    fontSize: "0.85rem",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resetLoading}
                  style={{
                    flex: 2,
                    padding: "10px",
                    borderRadius: "10px",
                    background: "linear-gradient(135deg, #06b6d4 0%, #8b5cf6 100%)",
                    border: "none",
                    color: "#ffffff",
                    fontWeight: 700,
                    fontSize: "0.85rem",
                    cursor: resetLoading ? "not-allowed" : "pointer",
                  }}
                >
                  {resetLoading ? "Updating..." : "Update Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
