import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export const LoadingScreen = ({ message = "Loading Voxentra..." }) => (
  <div style={{
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "16px",
    background: "var(--bg-primary, #070914)",
    color: "var(--text-muted, #94a3b8)",
    fontSize: "1.05rem",
    fontWeight: 600,
  }}>
    <div style={{
      width: "48px",
      height: "48px",
      borderRadius: "14px",
      background: "linear-gradient(135deg, #06b6d4 0%, #8b5cf6 50%, #ec4899 100%)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      boxShadow: "0 0 24px rgba(139, 92, 246, 0.6)",
      animation: "pulse 2s infinite ease-in-out",
    }}>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M4 4L12 20L20 4H15L12 12L9 4H4Z" fill="#ffffff" />
      </svg>
    </div>
    <span>{message}</span>
  </div>
);

/**
 * Protects routes requiring user authentication.
 * If not authenticated, immediately navigates to /login.
 */
export const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingScreen message="Verifying session..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

/**
 * Route guard for Login and Register pages.
 * If user is already authenticated, redirects straight to /home.
 */
export const PublicOnlyRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <LoadingScreen message="Preparing authentication..." />;
  }

  if (isAuthenticated) {
    return <Navigate to="/home" replace />;
  }

  return children;
};

/**
 * Route guard for Admin portal and poll creation.
 * If user is not admin, redirects to /home.
 */
export const AdminRoute = ({ children }) => {
  const { isAuthenticated, isAdmin, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingScreen message="Verifying administrator clearance..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!isAdmin) {
    return <Navigate to="/home" replace />;
  }

  return children;
};
