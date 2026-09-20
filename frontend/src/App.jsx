import React, { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { Navbar } from "./components/Navbar";
import { AuthModal } from "./components/AuthModal";
import { Home } from "./pages/Home";
import { PollView } from "./pages/PollView";
import { Games } from "./pages/Games";
import { Leaderboard } from "./pages/Leaderboard";
import { Dashboard } from "./pages/Dashboard";
import { AdminPortal } from "./pages/AdminPortal";
import { About } from "./pages/About";
import { CreatePoll } from "./pages/CreatePoll";
import { ToastContainer } from "./components/Toast";
import { Check } from "lucide-react";

const AppContent = () => {
  const { loading } = useAuth();
  const [route, setRoute] = useState("home");
  const [pollId, setPollId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  const parseHash = () => {
    const hash = window.location.hash.replace(/^#/, "");
    if (!hash || hash === "/" || hash === "home") {
      setRoute("home");
      setPollId(null);
    } else if (hash.startsWith("poll-")) {
      setRoute("poll");
      const raw = hash.replace("poll-", "");
      const cleanPollId = raw.split("?")[0];
      setPollId(cleanPollId || "active");
    } else if (hash === "poll" || hash === "live-poll") {
      setRoute("poll");
      setPollId("active");
    } else if (hash === "polls" || hash === "explore") {
      setRoute("polls");
      setPollId(null);
      setTimeout(() => {
        const el = document.getElementById("live-now-section");
        if (el) el.scrollIntoView({ behavior: "smooth" });
      }, 100);
    } else if (hash === "create-poll") {
      setRoute("create-poll");
      setPollId(null);
    } else if (["games", "leaderboard", "dashboard", "about", "admin", "admin-login"].includes(hash)) {
      setRoute(hash);
      setPollId(null);
    } else {
      setRoute("home");
      setPollId(null);
    }
  };

  useEffect(() => {
    parseHash();
    window.addEventListener("hashchange", parseHash);
    return () => window.removeEventListener("hashchange", parseHash);
  }, []);

  const navigate = (to) => {
    window.location.hash = to;
  };

  if (loading) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--text-muted)",
        fontSize: "1.1rem",
        background: "var(--bg-primary)",
      }}>
        Initializing Voxentra...
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Global Navbar */}
      <Navbar currentRoute={route} navigate={navigate} onSearch={setSearchQuery} />

      {/* Main Routed Content */}
      <main style={{ flex: 1 }}>
        {route === "home" && <Home navigate={navigate} searchQuery={searchQuery} />}
        {route === "polls" && <Home navigate={navigate} searchQuery={searchQuery} />}
        {route === "poll" && <PollView pollId={pollId} navigate={navigate} />}
        {route === "create-poll" && <CreatePoll navigate={navigate} />}
        {route === "games" && <Games navigate={navigate} />}
        {route === "leaderboard" && <Leaderboard navigate={navigate} />}
        {route === "about" && <About navigate={navigate} />}
        {route === "dashboard" && <Dashboard navigate={navigate} />}
        {(route === "admin" || route === "admin-login") && <AdminPortal navigate={navigate} />}
      </main>

      {/* Global Auth Modal for Seamless Sign up / Sign in */}
      <AuthModal />

      {/* Global Action Toast Container */}
      <ToastContainer />

      {/* Footer matching Voxentra design */}
      <footer style={{
        borderTop: "1px solid var(--border-subtle)",
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
          {/* Footer Logo & Tagline */}
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
              <div style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>
                💜 Your Voice Drives What's Next
              </div>
            </div>
          </div>

          {/* Footer Links */}
          <div style={{ display: "flex", alignItems: "center", gap: "24px", fontSize: "0.85rem", color: "var(--text-muted)" }}>
            <button onClick={() => navigate("home")} style={{ background: "none", color: "inherit" }}>Home</button>
            <button onClick={() => navigate("polls")} style={{ background: "none", color: "inherit" }}>Explore</button>
            <button onClick={() => navigate("games")} style={{ background: "none", color: "inherit" }}>Games</button>
            <button onClick={() => navigate("leaderboard")} style={{ background: "none", color: "inherit" }}>Leaderboard</button>
            <button onClick={() => navigate("about")} style={{ background: "none", color: "inherit" }}>About</button>
            <button onClick={() => navigate("admin")} style={{ background: "none", color: "var(--text-dim)", fontSize: "0.78rem" }}>Admin Access</button>
          </div>

          {/* Right Signature Note */}
          <div style={{ fontSize: "0.85rem", color: "var(--text-dim)" }}>
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
      <AppContent />
    </AuthProvider>
  );
}

export default App;
