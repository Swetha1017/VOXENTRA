import React from "react";
import { BrowserRouter, Routes, Route, Navigate, Outlet, useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { Navbar } from "./components/Navbar";
import { AuthModal } from "./components/AuthModal";
import { ToastContainer } from "./components/Toast";
import { ProtectedRoute, PublicOnlyRoute, AdminRoute } from "./components/ProtectedRoute";

// Pages
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { Home } from "./pages/Home";
import { VotingPage } from "./pages/VotingPage";
import { PollView } from "./pages/PollView";
import { Games } from "./pages/Games";
import { Leaderboard } from "./pages/Leaderboard";
import { Dashboard } from "./pages/Dashboard";
import { AdminPortal } from "./pages/AdminPortal";
import { About } from "./pages/About";
import { CreatePoll } from "./pages/CreatePoll";

/**
 * Authenticated Layout:
 * Only rendered for authenticated users.
 * Displays global Navbar, main routed outlet, modals, toast container, and footer.
 */
const AuthenticatedLayout = () => {
  const navigate = useNavigate();

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Global Navbar */}
      <Navbar />

      {/* Main Routed Content */}
      <main style={{ flex: 1 }}>
        <Outlet />
      </main>

      {/* Global Auth Modal */}
      <AuthModal />

      {/* Global Toast Container */}
      <ToastContainer />

      {/* Modern Voxentra Footer */}
      <footer style={{
        borderTop: "1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))",
        padding: "36px 24px",
        background: "rgba(6, 8, 18, 0.95)",
        marginTop: "auto",
      }}>
        <div style={{
          maxWidth: "1280px",
          margin: "0 auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "20px",
        }}>
          {/* Brand Logo & Tagline */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{
              width: "34px",
              height: "34px",
              borderRadius: "9px",
              background: "linear-gradient(135deg, #06b6d4 0%, #8b5cf6 50%, #ec4899 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 0 14px rgba(139, 92, 246, 0.5)",
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M4 4L12 20L20 4H15L12 12L9 4H4Z" fill="#ffffff" />
              </svg>
            </div>
            <div>
              <div style={{ fontWeight: 800, color: "#ffffff", fontSize: "1.1rem" }}>
                Voxentra
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-dim, #64748b)" }}>
                💜 Your Voice Drives What's Next
              </div>
            </div>
          </div>

          {/* Footer Quick Links */}
          <div style={{ display: "flex", alignItems: "center", gap: "24px", fontSize: "0.85rem", color: "var(--text-muted, #94a3b8)", flexWrap: "wrap" }}>
            <button onClick={() => navigate("/home")} style={{ background: "none", border: "none", color: "inherit", cursor: "pointer" }}>Home</button>
            <button onClick={() => navigate("/voting")} style={{ background: "none", border: "none", color: "inherit", cursor: "pointer" }}>Explore Polls</button>
            <button onClick={() => navigate("/games")} style={{ background: "none", border: "none", color: "inherit", cursor: "pointer" }}>Games</button>
            <button onClick={() => navigate("/dashboard")} style={{ background: "none", border: "none", color: "inherit", cursor: "pointer" }}>Dashboard</button>
            <button onClick={() => navigate("/leaderboard")} style={{ background: "none", border: "none", color: "inherit", cursor: "pointer" }}>Leaderboard</button>
            <button onClick={() => navigate("/about")} style={{ background: "none", border: "none", color: "inherit", cursor: "pointer" }}>About</button>
            <button onClick={() => navigate("/admin")} style={{ background: "none", border: "none", color: "var(--text-dim, #64748b)", fontSize: "0.78rem", cursor: "pointer" }}>Admin Access</button>
          </div>

          {/* Right Signature Note */}
          <div style={{ fontSize: "0.85rem", color: "var(--text-dim, #64748b)" }}>
            Empowering Democratic Opinions & Live Polls 💜
          </div>
        </div>
      </footer>
    </div>
  );
};

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Authentication Pages (Only visible before login) */}
          <Route
            path="/login"
            element={
              <PublicOnlyRoute>
                <Login />
              </PublicOnlyRoute>
            }
          />
          <Route
            path="/register"
            element={
              <PublicOnlyRoute>
                <Register />
              </PublicOnlyRoute>
            }
          />

          {/* Root Path: Redirects to /home if authenticated, or /login if unauthenticated */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Navigate to="/home" replace />
              </ProtectedRoute>
            }
          />

          {/* Protected Application Routes (Requires login) */}
          <Route
            element={
              <ProtectedRoute>
                <AuthenticatedLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/home" element={<Home />} />
            <Route path="/voting" element={<VotingPage />} />
            <Route path="/polls" element={<VotingPage />} />
            <Route path="/poll/:id" element={<PollView />} />
            <Route path="/games" element={<Games />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/about" element={<About />} />

            {/* Admin-only Routes */}
            <Route
              path="/admin"
              element={
                <AdminRoute>
                  <AdminPortal />
                </AdminRoute>
              }
            />
            <Route
              path="/create-poll"
              element={
                <AdminRoute>
                  <CreatePoll />
                </AdminRoute>
              }
            />
          </Route>

          {/* Catch-all: redirect to / */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
