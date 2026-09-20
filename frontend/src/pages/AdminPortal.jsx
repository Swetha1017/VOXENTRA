import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import { 
  Shield, Plus, Edit2, Trash2, ToggleLeft, ToggleRight, Clock, 
  BarChart3, Users, MessageSquare, AlertTriangle, CheckCircle2, 
  X, Lock, Mail, ArrowRight, ArrowLeft, Share2, Sparkles, RefreshCw,
  Pause, Play, Archive, Check, Layers, Award, History, Key, CheckSquare, EyeOff
} from "lucide-react";
import { showToast } from "../components/Toast";

export const AdminPortal = ({ navigate: propNavigate }) => {
  const routerNavigate = useNavigate();
  const navigate = (to) => {
    if (typeof to === "string") {
      if (to === "home") routerNavigate("/home");
      else if (to === "polls" || to === "voting") routerNavigate("/voting");
      else if (to === "games") routerNavigate("/games");
      else if (to === "dashboard") routerNavigate("/dashboard");
      else if (to.startsWith("poll-")) routerNavigate(`/poll/${to.replace("poll-", "")}`);
      else routerNavigate(to.startsWith("/") ? to : `/${to}`);
    } else if (propNavigate) {
      propNavigate(to);
    } else {
      routerNavigate(to);
    }
  };
  const { user, isAdmin, adminLogin, logout } = useAuth();
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  // Admin Navigation Tabs: "pools", "create_pool", "analytics", "moderation"
  const [activeTab, setActiveTab] = useState("pools");
  const [polls, setPolls] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // ==========================================
  // DURATION CONFIGURATION (25 min to 2 hrs / 120 min)
  // ==========================================
  const formatDuration = (mins) => {
    const m = Number(mins);
    if (isNaN(m) || m < 25) return `${m || 0}m (Min 25m)`;
    if (m === 60) return "1 hour (Default)";
    if (m === 120) return "2 hours (Max)";
    if (m > 60) {
      const hours = Math.floor(m / 60);
      const remaining = m % 60;
      return remaining > 0 ? `${hours}h ${remaining}m` : `${hours} hour${hours > 1 ? "s" : ""}`;
    }
    return `${m} mins`;
  };

  const DURATION_PRESETS = [
    { value: 25, label: "25m (Min)" },
    { value: 30, label: "30m" },
    { value: 45, label: "45m" },
    { value: 60, label: "1h (60m Default)" },
    { value: 90, label: "1.5h (90m)" },
    { value: 120, label: "2h (Max)" },
  ];

  // Helper for boundary proximity warnings
  const getDurationWarning = (mins, isEscalated) => {
    const m = Number(mins);
    if (isEscalated) {
      return {
        type: "escalation",
        text: "🚨 Escalation Override Active: Custom duration approved by authorization key.",
      };
    }
    if (m <= 30) {
      return {
        type: "warning",
        text: "⚠️ Rapid Ballot Warning: Short duration (≤ 30 mins). Participants must act promptly.",
      };
    }
    if (m >= 110) {
      return {
        type: "warning",
        text: "⚠️ Extended Window Warning: Approaching maximum 2-hour ceiling (≥ 110 mins). Ensure sustained engagement.",
      };
    }
    return null;
  };

  // ==========================================
  // AUDIT LOG STATE & HANDLERS
  // ==========================================
  const [auditModalOpen, setAuditModalOpen] = useState(false);
  const [auditPoll, setAuditPoll] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);

  const handleViewAuditLogs = async (poll) => {
    setAuditPoll(poll);
    setAuditModalOpen(true);
    setAuditLoading(true);
    try {
      const res = await api.get(`/api/admin/polls/${poll.id}/audit-logs`);
      setAuditLogs(res?.audit_logs || []);
    } catch (err) {
      showToast("Failed to load audit logs: " + err.message, "error");
    } finally {
      setAuditLoading(false);
    }
  };

  // ==========================================
  // QUICK CREATE POLL MODAL STATE
  // ==========================================
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [quickCreateForm, setQuickCreateForm] = useState({
    title: "",
    category: "Artificial Intelligence",
    description: "",
    duration: 60,
    options: ["", "", ""],
    selectionType: "single",
    maxSelections: 2,
    visibility: "public",
    allowedUserGroups: ["all"],
    resultVisibility: "realtime",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    isEscalated: false,
    escalationCode: "",
    escalationReason: "",
  });
  const [quickCreateError, setQuickCreateError] = useState("");
  const [quickCreateLoading, setQuickCreateLoading] = useState(false);

  const handleQuickOptionChange = (idx, val) => {
    const updated = [...quickCreateForm.options];
    updated[idx] = val;
    setQuickCreateForm((prev) => ({ ...prev, options: updated }));
  };

  const addQuickOptionField = () => {
    if (quickCreateForm.options.length < 8) {
      setQuickCreateForm((prev) => ({ ...prev, options: [...prev.options, ""] }));
    }
  };

  const removeQuickOptionField = (idx) => {
    if (quickCreateForm.options.length > 2) {
      setQuickCreateForm((prev) => ({
        ...prev,
        options: prev.options.filter((_, i) => i !== idx),
      }));
    }
  };

  const handleQuickCreateSubmit = async (e) => {
    e.preventDefault();
    setQuickCreateError("");

    if (!quickCreateForm.title.trim() || quickCreateForm.title.trim().length < 3) {
      setQuickCreateError("Pool title / question must be at least 3 characters long");
      return;
    }

    const cleanOpts = quickCreateForm.options.map((o) => o.trim()).filter(Boolean);
    if (cleanOpts.length < 2) {
      setQuickCreateError("Please provide at least 2 non-empty options");
      return;
    }

    const unique = new Set(cleanOpts.map((o) => o.toLowerCase()));
    if (unique.size !== cleanOpts.length) {
      setQuickCreateError("Options must be unique (no duplicates)");
      return;
    }

    const dur = Number(quickCreateForm.duration);
    if (!quickCreateForm.isEscalated && (dur < 25 || dur > 120)) {
      setQuickCreateError("Poll duration must be between 25 minutes and 2 hours (120 minutes)");
      return;
    }

    if (quickCreateForm.isEscalated) {
      if (!quickCreateForm.escalationCode.trim() || !quickCreateForm.escalationReason.trim()) {
        setQuickCreateError("Escalation override requires the authorization code and business justification");
        return;
      }
    }

    setQuickCreateLoading(true);
    try {
      await api.post("/api/admin/polls", {
        title: quickCreateForm.title.trim(),
        description: quickCreateForm.description.trim(),
        category: quickCreateForm.category,
        duration_minutes: dur,
        options: cleanOpts,
        entry_requirement: "Free / Open to All",
        reward_structure: "Winner Takes All XP",
        selection_type: quickCreateForm.selectionType,
        max_selections: Number(quickCreateForm.maxSelections),
        visibility: quickCreateForm.visibility,
        allowed_user_groups: quickCreateForm.allowedUserGroups,
        result_visibility: quickCreateForm.resultVisibility,
        timezone: quickCreateForm.timezone,
        escalation_code: quickCreateForm.isEscalated ? quickCreateForm.escalationCode.trim() : "",
        escalation_reason: quickCreateForm.isEscalated ? quickCreateForm.escalationReason.trim() : "",
      });

      showToast("Voting pool successfully created and published live!");
      setShowCreateModal(false);
      setQuickCreateForm({
        title: "",
        category: "Artificial Intelligence",
        description: "",
        duration: 60,
        options: ["", "", ""],
        selectionType: "single",
        maxSelections: 2,
        visibility: "public",
        allowedUserGroups: ["all"],
        resultVisibility: "realtime",
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        isEscalated: false,
        escalationCode: "",
        escalationReason: "",
      });
      loadAdminData();
    } catch (err) {
      setQuickCreateError(err.message || "Failed to create pool");
    } finally {
      setQuickCreateLoading(false);
    }
  };

  // ==========================================
  // CREATE POOL WIZARD STATE
  // ==========================================
  const [wizardStep, setWizardStep] = useState(1); // 1: Basics, 2: Params, 3: Options, 4: Preview
  const [poolName, setPoolName] = useState("");
  const [poolCategory, setPoolCategory] = useState("Artificial Intelligence");
  const [poolDesc, setPoolDesc] = useState("");
  const [poolEntryReq, setPoolEntryReq] = useState("Free / Open to All");
  const [poolMinParticipants, setPoolMinParticipants] = useState(5);
  const [poolMaxParticipants, setPoolMaxParticipants] = useState(250);
  const [poolDuration, setPoolDuration] = useState(60); // minutes (25 min to 120 min)
  const [poolAutoClose, setPoolAutoClose] = useState(true);
  const [poolReward, setPoolReward] = useState("Winner Takes All XP");
  const [poolOptions, setPoolOptions] = useState(["", "", ""]);
  const [poolConfirmed, setPoolConfirmed] = useState(false);
  const [wizardError, setWizardError] = useState("");

  // Advanced Wizard Settings
  const [poolSelectionType, setPoolSelectionType] = useState("single");
  const [poolMaxSelections, setPoolMaxSelections] = useState(2);
  const [poolVisibility, setPoolVisibility] = useState("public");
  const [poolAllowedGroups, setPoolAllowedGroups] = useState(["all"]);
  const [poolResultVisibility, setPoolResultVisibility] = useState("realtime");
  const [poolTimezone, setPoolTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
  const [poolIsEscalated, setPoolIsEscalated] = useState(false);
  const [poolEscalationCode, setPoolEscalationCode] = useState("");
  const [poolEscalationReason, setPoolEscalationReason] = useState("");

  // ==========================================
  // EDIT POOL STATE & HANDLERS
  // ==========================================
  const [editingPoll, setEditingPoll] = useState(null);
  const [editForm, setEditForm] = useState({
    title: "",
    category: "Artificial Intelligence",
    description: "",
    duration: 60,
    isActive: true,
    options: ["", ""],
    selectionType: "single",
    maxSelections: 2,
    visibility: "public",
    allowedUserGroups: ["all"],
    resultVisibility: "realtime",
    timezone: "UTC",
    isEscalated: false,
    escalationCode: "",
    escalationReason: "",
  });
  const [editError, setEditError] = useState("");
  const [editLoading, setEditLoading] = useState(false);

  const handleStartEdit = (poll) => {
    setEditingPoll(poll);
    setEditError("");
    const opts = poll.options && poll.options.length >= 2
      ? poll.options.map((o) => (typeof o === "string" ? o : o.text))
      : ["", ""];
    
    setEditForm({
      title: poll.title || "",
      category: poll.category || "Artificial Intelligence",
      description: poll.description || "",
      duration: poll.duration_minutes || 60,
      isActive: poll.is_active !== undefined ? poll.is_active : true,
      options: opts,
      selectionType: poll.selection_type || "single",
      maxSelections: poll.max_selections || 2,
      visibility: poll.visibility || "public",
      allowedUserGroups: poll.allowed_user_groups || ["all"],
      resultVisibility: poll.result_visibility || "realtime",
      timezone: poll.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      isEscalated: poll.is_escalated || false,
      escalationCode: "",
      escalationReason: poll.escalation_reason || "",
    });
  };

  const handleEditOptionChange = (idx, val) => {
    const updated = [...editForm.options];
    updated[idx] = val;
    setEditForm((prev) => ({ ...prev, options: updated }));
  };

  const addEditOptionField = () => {
    if (editForm.options.length < 10) {
      setEditForm((prev) => ({ ...prev, options: [...prev.options, ""] }));
    }
  };

  const removeEditOptionField = (idx) => {
    if (editForm.options.length > 2) {
      setEditForm((prev) => ({
        ...prev,
        options: prev.options.filter((_, i) => i !== idx),
      }));
    }
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setEditError("");

    if (!editForm.title.trim() || editForm.title.trim().length < 3) {
      setEditError("Pool Name / Question must be at least 3 characters long");
      return;
    }

    const editDuration = Number(editForm.duration);
    if (!editForm.isEscalated && (isNaN(editDuration) || editDuration < 25 || editDuration > 120)) {
      setEditError("Poll duration must be between 25 minutes and 2 hours (120 minutes)");
      return;
    }

    if (editForm.isEscalated) {
      if (!editForm.escalationCode.trim() || !editForm.escalationReason.trim()) {
        setEditError("Escalation override requires authorization code (VOXENTRA_OVERRIDE_AUTH) and justification");
        return;
      }
    }

    const payload = {
      title: editForm.title.trim(),
      description: editForm.description.trim(),
      category: editForm.category,
      duration_minutes: editDuration,
      is_active: editForm.isActive,
      selection_type: editForm.selectionType,
      max_selections: Number(editForm.maxSelections),
      visibility: editForm.visibility,
      allowed_user_groups: editForm.allowedUserGroups,
      result_visibility: editForm.resultVisibility,
      timezone: editForm.timezone,
      escalation_code: editForm.isEscalated ? editForm.escalationCode.trim() : "",
      escalation_reason: editForm.isEscalated ? editForm.escalationReason.trim() : "",
    };

    // STRICT ZERO-VOTE OPTION IMMUTABILITY GUARD
    const totalVotesRecorded = editingPoll.total_votes || 0;
    if (totalVotesRecorded === 0) {
      const cleanOpts = editForm.options.map((o) => o.trim()).filter(Boolean);
      if (cleanOpts.length < 2) {
        setEditError("Please provide at least 2 non-empty options");
        return;
      }
      const unique = new Set(cleanOpts.map((o) => o.toLowerCase()));
      if (unique.size !== cleanOpts.length) {
        setEditError("Options must be unique (no duplicates)");
        return;
      }
      payload.options = cleanOpts;
    }

    setEditLoading(true);
    try {
      await api.put(`/api/admin/polls/${editingPoll.id}`, payload);

      showToast("Voting pool updated successfully!");
      setEditingPoll(null);
      loadAdminData();
    } catch (err) {
      setEditError(err.message || "Failed to update pool");
    } finally {
      setEditLoading(false);
    }
  };

  // Fetch Dashboard Data
  const loadAdminData = async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const [pData, aData, cData] = await Promise.all([
        api.get("/api/polls"),
        api.get("/api/admin/analytics"),
        api.get("/api/admin/comments"),
      ]);
      setPolls(pData || []);
      setAnalytics(aData || null);
      setComments(cData || []);
    } catch (err) {
      showToast("Failed to refresh admin data: " + err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      loadAdminData();
    }
  }, [isAdmin]);

  // Handle Admin Login
  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setLoginError("");
    setLoginLoading(true);

    try {
      await adminLogin(adminEmail, adminPassword);
      setAdminEmail("");
      setAdminPassword("");
      showToast("Administrator session authenticated!");
    } catch (err) {
      setLoginError(err.message || "Invalid administrator credentials. Access restricted.");
    } finally {
      setLoginLoading(false);
    }
  };

  // Session Controls: Pause, Resume, End, Archive, Permanent Delete
  const handlePausePoll = async (pollId) => {
    try {
      await api.patch(`/api/admin/polls/${pollId}/pause`);
      showToast("Session paused successfully");
      loadAdminData();
    } catch (err) {
      showToast("Error pausing: " + err.message, "error");
    }
  };

  const handleResumePoll = async (pollId) => {
    try {
      await api.patch(`/api/admin/polls/${pollId}/resume`);
      showToast("Session resumed and open for voting");
      loadAdminData();
    } catch (err) {
      showToast("Error resuming: " + err.message, "error");
    }
  };

  const handleEndPoll = async (pollId) => {
    if (!window.confirm("End this voting session and lock all current vote counts?")) return;
    try {
      await api.patch(`/api/admin/polls/${pollId}/end`);
      showToast("Voting session ended and locked");
      loadAdminData();
    } catch (err) {
      showToast("Error ending session: " + err.message, "error");
    }
  };

  const handleArchivePoll = async (pollId) => {
    if (!window.confirm("Archive this poll? It will be hidden from public view.")) return;
    try {
      await api.delete(`/api/admin/polls/${pollId}`);
      showToast("Poll archived");
      loadAdminData();
    } catch (err) {
      showToast("Error archiving: " + err.message, "error");
    }
  };

  const handlePermanentDeletePoll = async (pollId) => {
    if (!window.confirm("PERMANENT DELETE: This will completely erase this pool and all associated votes. Proceed?")) return;
    try {
      await api.delete(`/api/admin/polls/${pollId}/permanent`);
      showToast("Poll permanently removed");
      loadAdminData();
    } catch (err) {
      showToast("Error deleting: " + err.message, "error");
    }
  };

  // Comment Moderation
  const handleDeleteComment = async (commId) => {
    try {
      await api.delete(`/api/admin/comments/${commId}`);
      showToast("Comment removed by moderator");
      loadAdminData();
    } catch (err) {
      showToast("Error removing comment: " + err.message, "error");
    }
  };

  // ==========================================
  // WIZARD VALIDATION & SUBMISSION
  // ==========================================
  const validateStep = (step) => {
    setWizardError("");
    if (step === 1) {
      if (!poolName.trim() || poolName.trim().length < 3) {
        setWizardError("Pool Name must be at least 3 characters long");
        return false;
      }
    } else if (step === 2) {
      if (poolMinParticipants < 0) {
        setWizardError("Minimum participants cannot be negative");
        return false;
      }
      if (poolMaxParticipants > 0 && poolMaxParticipants < poolMinParticipants) {
        setWizardError("Maximum participants cannot be less than minimum participants");
        return false;
      }
      if (!poolIsEscalated && (poolDuration < 25 || poolDuration > 120)) {
        setWizardError("Poll duration must be between 25 minutes and 2 hours (120 minutes)");
        return false;
      }
      if (poolIsEscalated) {
        if (!poolEscalationCode.trim() || !poolEscalationReason.trim()) {
          setWizardError("Special authorization override requires security key (VOXENTRA_OVERRIDE_AUTH) and reason");
          return false;
        }
      }
    } else if (step === 3) {
      const cleanOpts = poolOptions.map((o) => o.trim()).filter(Boolean);
      if (cleanOpts.length < 2) {
        setWizardError("Please provide at least 2 non-empty voting options");
        return false;
      }
      const unique = new Set(cleanOpts.map((o) => o.toLowerCase()));
      if (unique.size !== cleanOpts.length) {
        setWizardError("Options must be unique (no duplicates)");
        return false;
      }
    }
    return true;
  };

  const handleNextStep = () => {
    if (validateStep(wizardStep)) {
      setWizardStep((s) => s + 1);
    }
  };

  const handlePrevStep = () => {
    setWizardError("");
    setWizardStep((s) => Math.max(1, s - 1));
  };

  const handleCreatePoolSubmit = async (e) => {
    e.preventDefault();
    if (!poolConfirmed) {
      setWizardError("Please check the confirmation box to verify settings");
      return;
    }

    const cleanOpts = poolOptions.map((o) => o.trim()).filter(Boolean);
    setActionLoading(true);

    try {
      await api.post("/api/admin/polls", {
        title: poolName.trim(),
        description: poolDesc.trim(),
        category: poolCategory,
        options: cleanOpts,
        duration_minutes: Number(poolDuration),
        min_participants: Number(poolMinParticipants),
        max_participants: Number(poolMaxParticipants),
        entry_requirement: poolEntryReq,
        reward_structure: poolReward,
        selection_type: poolSelectionType,
        max_selections: Number(poolMaxSelections),
        visibility: poolVisibility,
        allowed_user_groups: poolAllowedGroups,
        result_visibility: poolResultVisibility,
        timezone: poolTimezone,
        escalation_code: poolIsEscalated ? poolEscalationCode.trim() : "",
        escalation_reason: poolIsEscalated ? poolEscalationReason.trim() : "",
      });

      showToast("Voting Pool successfully created and launched live!");
      // Reset wizard
      setPoolName("");
      setPoolDesc("");
      setPoolOptions(["", "", ""]);
      setPoolSelectionType("single");
      setPoolMaxSelections(2);
      setPoolVisibility("public");
      setPoolResultVisibility("realtime");
      setPoolIsEscalated(false);
      setPoolEscalationCode("");
      setPoolEscalationReason("");
      setWizardStep(1);
      setPoolConfirmed(false);
      setActiveTab("pools");
      loadAdminData();
    } catch (err) {
      setWizardError(err.message || "Failed to create pool");
    } finally {
      setActionLoading(false);
    }
  };

  // Option Builder helpers
  const handleOptionChange = (idx, val) => {
    const updated = [...poolOptions];
    updated[idx] = val;
    setPoolOptions(updated);
  };

  const addOptionField = () => {
    if (poolOptions.length < 8) {
      setPoolOptions([...poolOptions, ""]);
    }
  };

  const removeOptionField = (idx) => {
    if (poolOptions.length > 2) {
      setPoolOptions(poolOptions.filter((_, i) => i !== idx));
    }
  };

  // If user is not authenticated as administrator, display designated admin login
  if (!isAdmin) {
    return (
      <div style={{ maxWidth: "460px", margin: "80px auto", padding: "20px" }}>
        <div className="glass-panel" style={{ padding: "40px 32px", textAlign: "center" }}>
          <div style={{
            width: "56px",
            height: "56px",
            borderRadius: "16px",
            background: "linear-gradient(135deg, #06b6d4 0%, #8b5cf6 100%)",
            margin: "0 auto 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 0 25px rgba(139, 92, 246, 0.4)",
          }}>
            <Shield size={28} color="#ffffff" />
          </div>

          <h1 style={{ fontSize: "1.7rem", fontWeight: 900, color: "#ffffff", marginBottom: "8px" }}>
            Voxentra Admin Portal
          </h1>
          <p style={{ fontSize: "0.88rem", color: "var(--text-muted)", marginBottom: "28px" }}>
            Role-based control portal. Authorized administrative personnel only.
          </p>

          {loginError && (
            <div style={{
              background: "rgba(239, 68, 68, 0.15)",
              border: "1px solid rgba(239, 68, 68, 0.35)",
              color: "#fca5a5",
              padding: "10px 14px",
              borderRadius: "10px",
              fontSize: "0.85rem",
              marginBottom: "20px",
              textAlign: "left",
            }}>
              {loginError}
            </div>
          )}

          <form onSubmit={handleAdminLogin} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ textAlign: "left" }}>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "var(--text-dim)", marginBottom: "6px" }}>
                Admin Email
              </label>
              <input
                type="email"
                required
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                placeholder="Enter designated email"
                className="vox-input"
              />
            </div>

            <div style={{ textAlign: "left" }}>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "var(--text-dim)", marginBottom: "6px" }}>
                Security Key / Password
              </label>
              <input
                type="password"
                required
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="Enter admin password"
                className="vox-input"
              />
            </div>

            <button
              type="submit"
              className="btn-vox-primary"
              disabled={loginLoading}
              style={{ padding: "14px", fontSize: "1rem", marginTop: "10px" }}
            >
              {loginLoading ? "Authenticating..." : "Access Control Center"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ========================================================
  // AUTHENTICATED ADMIN DASHBOARD
  // ========================================================
  return (
    <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "36px 20px" }}>
      {/* Admin Header */}
      <div className="glass-panel" style={{
        padding: "24px 32px",
        marginBottom: "28px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: "16px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <div style={{
            width: "44px",
            height: "44px",
            borderRadius: "12px",
            background: "linear-gradient(135deg, #06b6d4 0%, #8b5cf6 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 0 15px rgba(139, 92, 246, 0.4)",
          }}>
            <Shield size={22} color="#ffffff" />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <h1 style={{ fontSize: "1.5rem", fontWeight: 800, color: "#ffffff" }}>
                Admin Control Hub
              </h1>
              <span style={{ background: "rgba(139, 92, 246, 0.2)", color: "#c084fc", padding: "2px 8px", borderRadius: "6px", fontSize: "0.72rem", fontWeight: 800 }}>
                EXCLUSIVE ROLE
              </span>
            </div>
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
              Logged in as {user?.email}
            </p>
          </div>
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          <button className="btn-vox-secondary" onClick={loadAdminData} style={{ padding: "8px 16px", fontSize: "0.85rem" }}>
            <RefreshCw size={14} /> Refresh Data
          </button>
          <button className="btn-vox-secondary" onClick={logout} style={{ padding: "8px 16px", fontSize: "0.85rem" }}>
            Exit Admin
          </button>
        </div>
      </div>

      {/* Admin Navigation Tabs - NO DEMO VIDEO ELEMENTS */}
      <div style={{
        display: "flex",
        gap: "10px",
        marginBottom: "28px",
        borderBottom: "1px solid var(--border-subtle)",
        paddingBottom: "14px",
        flexWrap: "wrap",
      }}>
        <button
          onClick={() => setActiveTab("pools")}
          style={{
            background: activeTab === "pools" ? "rgba(139, 92, 246, 0.2)" : "transparent",
            border: activeTab === "pools" ? "1px solid #8b5cf6" : "1px solid transparent",
            color: activeTab === "pools" ? "#ffffff" : "var(--text-muted)",
            padding: "10px 18px",
            borderRadius: "10px",
            fontWeight: 700,
            fontSize: "0.9rem",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <Layers size={16} /> Pools & Sessions ({polls.length})
        </button>

        <button
          onClick={() => { setActiveTab("create_pool"); setWizardStep(1); }}
          style={{
            background: activeTab === "create_pool" ? "linear-gradient(135deg, rgba(6, 182, 212, 0.3) 0%, rgba(139, 92, 246, 0.3) 100%)" : "rgba(255, 255, 255, 0.03)",
            border: activeTab === "create_pool" ? "1px solid #06b6d4" : "1px solid var(--border-subtle)",
            color: activeTab === "create_pool" ? "#22d3ee" : "var(--text-primary)",
            padding: "10px 18px",
            borderRadius: "10px",
            fontWeight: 800,
            fontSize: "0.9rem",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            boxShadow: activeTab === "create_pool" ? "0 0 15px rgba(6, 182, 212, 0.3)" : "none",
          }}
        >
          <Plus size={16} /> Create Pool (Wizard)
        </button>

        <button
          onClick={() => setActiveTab("analytics")}
          style={{
            background: activeTab === "analytics" ? "rgba(139, 92, 246, 0.2)" : "transparent",
            border: activeTab === "analytics" ? "1px solid #8b5cf6" : "1px solid transparent",
            color: activeTab === "analytics" ? "#ffffff" : "var(--text-muted)",
            padding: "10px 18px",
            borderRadius: "10px",
            fontWeight: 700,
            fontSize: "0.9rem",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <BarChart3 size={16} /> Analytics & Referrals
        </button>

        <button
          onClick={() => setActiveTab("moderation")}
          style={{
            background: activeTab === "moderation" ? "rgba(139, 92, 246, 0.2)" : "transparent",
            border: activeTab === "moderation" ? "1px solid #8b5cf6" : "1px solid transparent",
            color: activeTab === "moderation" ? "#ffffff" : "var(--text-muted)",
            padding: "10px 18px",
            borderRadius: "10px",
            fontWeight: 700,
            fontSize: "0.9rem",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <MessageSquare size={16} /> Live Moderation ({comments.length})
        </button>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: POOLS & SESSIONS MANAGEMENT */}
      {/* ======================================================== */}
      {activeTab === "pools" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Header Action Bar */}
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "12px",
            marginBottom: "6px",
          }}>
            <div>
              <h2 style={{ fontSize: "1.3rem", fontWeight: 800, color: "#ffffff", display: "flex", alignItems: "center", gap: "8px", margin: 0 }}>
                <Layers size={20} color="#c084fc" /> Manage Voting Pools ({polls.length})
              </h2>
              <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", margin: "4px 0 0 0" }}>
                Active sessions, live votes, instant status toggles, and pool configuration.
              </p>
            </div>
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <button
                onClick={loadAdminData}
                className="btn-vox-secondary"
                style={{ padding: "8px 14px", fontSize: "0.82rem", display: "flex", alignItems: "center", gap: "6px" }}
                title="Refresh pool list"
              >
                <RefreshCw size={14} className={loading ? "spin" : ""} /> Refresh
              </button>
              <button
                onClick={() => setShowCreateModal(true)}
                className="btn-vox-primary"
                style={{
                  padding: "8px 18px",
                  fontSize: "0.85rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  boxShadow: "0 0 15px rgba(139, 92, 246, 0.4)",
                }}
              >
                <Plus size={16} /> Create New Pool
              </button>
            </div>
          </div>

          {polls.length === 0 ? (
            <div className="glass-panel" style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
              No pools found. Launch one with the Create Pool Wizard!
            </div>
          ) : (
            polls.map((p) => (
              <div
                key={p.id}
                className="glass-panel"
                style={{
                  padding: "24px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "20px",
                  borderLeft: p.is_active ? "4px solid #10b981" : "4px solid #ef4444",
                }}
              >
                <div style={{ flex: 1, minWidth: "300px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px", flexWrap: "wrap" }}>
                    <span style={{
                      background: p.is_active ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
                      color: p.is_active ? "#34d399" : "#f87171",
                      padding: "2px 8px",
                      borderRadius: "6px",
                      fontSize: "0.72rem",
                      fontWeight: 800,
                    }}>
                      {p.is_active ? "SESSION ACTIVE" : (p.status || "CLOSED").toUpperCase()}
                    </span>
                    <span style={{
                      background: "rgba(6, 182, 212, 0.15)",
                      color: "#22d3ee",
                      padding: "2px 8px",
                      borderRadius: "6px",
                      fontSize: "0.72rem",
                      fontWeight: 700,
                    }}>
                      ⏱️ {p.duration_minutes || 60}m
                    </span>
                    <span style={{
                      background: "rgba(139, 92, 246, 0.15)",
                      color: "#c084fc",
                      padding: "2px 8px",
                      borderRadius: "6px",
                      fontSize: "0.72rem",
                      fontWeight: 700,
                    }}>
                      {p.selection_type === "multiple" ? `Multi-Choice (Max ${p.max_selections || 2})` : "Single Choice"}
                    </span>
                    <span style={{
                      background: "rgba(245, 158, 11, 0.15)",
                      color: "#fbbf24",
                      padding: "2px 8px",
                      borderRadius: "6px",
                      fontSize: "0.72rem",
                      fontWeight: 700,
                    }}>
                      {p.result_visibility === "after_vote" ? "After Vote Reveal" : p.result_visibility === "after_close" ? "After Close Reveal" : p.result_visibility === "never" ? "Confidential" : "Realtime Results"}
                    </span>
                    {p.is_escalated && (
                      <span style={{
                        background: "rgba(239, 68, 68, 0.2)",
                        color: "#f87171",
                        padding: "2px 8px",
                        borderRadius: "6px",
                        fontSize: "0.72rem",
                        fontWeight: 800,
                      }}>
                        🚨 OVERRIDE
                      </span>
                    )}
                    <span style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>
                      {p.category} · Total Votes: {p.total_votes}
                    </span>
                  </div>

                  <h3 style={{ fontSize: "1.15rem", fontWeight: 800, color: "#ffffff", marginBottom: "6px" }}>
                    {p.title}
                  </h3>

                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", fontSize: "0.78rem", color: "var(--text-muted)" }}>
                    <span>Visibility: <strong>{(p.visibility || "public").toUpperCase()}</strong></span>
                    <span>·</span>
                    <span>Entry: <strong>{p.entry_requirement || "Free"}</strong></span>
                    <span>·</span>
                    <span>Reward: <strong>{p.reward_structure || "Winner Takes All"}</strong></span>
                    <span>·</span>
                    <span>Options: <strong>{p.options?.length || 0} choices</strong></span>
                  </div>
                </div>

                {/* Session Control Buttons */}
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <button
                    onClick={() => handleViewAuditLogs(p)}
                    className="btn-vox-secondary"
                    style={{
                      padding: "8px 14px",
                      fontSize: "0.8rem",
                      color: "#c084fc",
                      border: "1px solid rgba(192, 132, 252, 0.4)",
                      background: "rgba(192, 132, 252, 0.08)",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                    title="View poll audit trail & change history"
                  >
                    <History size={14} /> Audit Trail
                  </button>

                  <button
                    onClick={() => handleStartEdit(p)}
                    className="btn-vox-secondary"
                    style={{
                      padding: "8px 14px",
                      fontSize: "0.8rem",
                      color: "#38bdf8",
                      border: "1px solid rgba(56, 189, 248, 0.4)",
                      background: "rgba(56, 189, 248, 0.08)",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                    title="Edit pool details, category, duration & options"
                  >
                    <Edit2 size={14} /> Edit
                  </button>

                  {p.is_active ? (
                    <button
                      onClick={() => handlePausePoll(p.id)}
                      className="btn-vox-secondary"
                      style={{ padding: "8px 14px", fontSize: "0.8rem", color: "#f59e0b" }}
                      title="Pause session"
                    >
                      <Pause size={14} /> Pause
                    </button>
                  ) : (
                    <button
                      onClick={() => handleResumePoll(p.id)}
                      className="btn-vox-secondary"
                      style={{ padding: "8px 14px", fontSize: "0.8rem", color: "#34d399" }}
                      title="Resume session"
                    >
                      <Play size={14} /> Resume
                    </button>
                  )}

                  <button
                    onClick={() => handleEndPoll(p.id)}
                    className="btn-vox-secondary"
                    style={{ padding: "8px 14px", fontSize: "0.8rem" }}
                    title="End and lock voting"
                  >
                    End Session
                  </button>

                  <button
                    onClick={() => handleArchivePoll(p.id)}
                    className="btn-vox-secondary"
                    style={{ padding: "8px 14px", fontSize: "0.8rem" }}
                    title="Archive poll"
                  >
                    <Archive size={14} /> Archive
                  </button>

                  <button
                    onClick={() => handlePermanentDeletePoll(p.id)}
                    style={{
                      background: "rgba(239, 68, 68, 0.12)",
                      border: "1px solid rgba(239, 68, 68, 0.3)",
                      color: "#f87171",
                      borderRadius: "8px",
                      padding: "8px 12px",
                      cursor: "pointer",
                    }}
                    title="Permanently remove"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: "CREATE POOL" 4-STEP WIZARD (REPLACING DEMO VIDEO) */}
      {/* ======================================================== */}
      {activeTab === "create_pool" && (
        <div className="glass-panel" style={{ padding: "36px", maxWidth: "840px", margin: "0 auto" }}>
          {/* Wizard Step Progress Tracker */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "32px", position: "relative" }}>
            {[
              { num: 1, title: "Basics" },
              { num: 2, title: "Parameters & Limits" },
              { num: 3, title: "Options & Rewards" },
              { num: 4, title: "Preview & Launch" },
            ].map((st) => (
              <div key={st.num} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", zIndex: 1 }}>
                <div style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "50%",
                  background: wizardStep === st.num
                    ? "#8b5cf6"
                    : wizardStep > st.num
                    ? "#10b981"
                    : "rgba(255, 255, 255, 0.08)",
                  border: wizardStep === st.num ? "2px solid #c084fc" : "1px solid var(--border-subtle)",
                  color: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 800,
                  fontSize: "0.85rem",
                  boxShadow: wizardStep === st.num ? "0 0 15px rgba(139, 92, 246, 0.5)" : "none",
                }}>
                  {wizardStep > st.num ? <Check size={16} /> : st.num}
                </div>
                <span style={{ fontSize: "0.78rem", fontWeight: 700, color: wizardStep === st.num ? "#ffffff" : "var(--text-dim)" }}>
                  {st.title}
                </span>
              </div>
            ))}
          </div>

          {/* Validation Warning Alert */}
          {wizardError && (
            <div style={{
              background: "rgba(239, 68, 68, 0.15)",
              border: "1px solid rgba(239, 68, 68, 0.35)",
              color: "#fca5a5",
              padding: "10px 16px",
              borderRadius: "10px",
              fontSize: "0.85rem",
              marginBottom: "20px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}>
              <AlertTriangle size={16} />
              <span>{wizardError}</span>
            </div>
          )}

          {/* STEP 1: BASICS */}
          {wizardStep === 1 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <h2 style={{ fontSize: "1.3rem", fontWeight: 800, color: "#ffffff" }}>
                Step 1: Pool Information & Category
              </h2>

              <div>
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "var(--text-dim)", marginBottom: "6px" }}>
                  Pool Name / Voting Question *
                </label>
                <input
                  type="text"
                  value={poolName}
                  onChange={(e) => setPoolName(e.target.value)}
                  placeholder="e.g., Which AI framework offers the fastest local inference?"
                  className="vox-input"
                  required
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "var(--text-dim)", marginBottom: "6px" }}>
                    Category
                  </label>
                  <select
                    value={poolCategory}
                    onChange={(e) => setPoolCategory(e.target.value)}
                    className="vox-input"
                    style={{ background: "#0b0e20" }}
                  >
                    <option value="Artificial Intelligence">Artificial Intelligence</option>
                    <option value="Web Development">Web Development</option>
                    <option value="Gaming & Esports">Gaming & Esports</option>
                    <option value="Cloud Computing">Cloud Computing</option>
                    <option value="Blockchain & Web3">Blockchain & Web3</option>
                    <option value="Mobile Tech">Mobile Tech</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "var(--text-dim)", marginBottom: "6px" }}>
                    Entry Requirements
                  </label>
                  <select
                    value={poolEntryReq}
                    onChange={(e) => setPoolEntryReq(e.target.value)}
                    className="vox-input"
                    style={{ background: "#0b0e20" }}
                  >
                    <option value="Free / Open to All">Free / Open to All</option>
                    <option value="Verified Voters Only">Verified Voters Only</option>
                    <option value="Minimum 50 XP">Minimum 50 XP Required</option>
                    <option value="VIP Grandmaster">VIP Grandmaster Tier</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "var(--text-dim)", marginBottom: "6px" }}>
                  Description / Context (Optional)
                </label>
                <textarea
                  value={poolDesc}
                  onChange={(e) => setPoolDesc(e.target.value)}
                  placeholder="Give participants additional background or rules for this vote..."
                  className="vox-input"
                  rows={3}
                />
              </div>
            </div>
          )}

          {/* STEP 2: PARAMETERS & LIMITS */}
          {wizardStep === 2 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <h2 style={{ fontSize: "1.3rem", fontWeight: 800, color: "#ffffff" }}>
                Step 2: Participant Limits, Governance & Session Duration
              </h2>

              {/* Selection Type & Maximum Selections */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "var(--text-dim)", marginBottom: "6px" }}>
                    Ballot Selection Type
                  </label>
                  <select
                    value={poolSelectionType}
                    onChange={(e) => setPoolSelectionType(e.target.value)}
                    className="vox-input"
                    style={{ background: "#0b0e20" }}
                  >
                    <option value="single">Single Choice (1 Option only)</option>
                    <option value="multiple">Multiple Selection (Multi-choice ballot)</option>
                  </select>
                </div>

                {poolSelectionType === "multiple" ? (
                  <div>
                    <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "var(--text-dim)", marginBottom: "6px" }}>
                      Max Allowed Selections per Voter
                    </label>
                    <input
                      type="number"
                      min="2"
                      max="8"
                      value={poolMaxSelections}
                      onChange={(e) => setPoolMaxSelections(Math.max(2, Number(e.target.value)))}
                      className="vox-input"
                    />
                  </div>
                ) : (
                  <div>
                    <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "var(--text-dim)", marginBottom: "6px" }}>
                      Voter Decision Limit
                    </label>
                    <input
                      type="text"
                      disabled
                      value="Single Option Enforced"
                      className="vox-input"
                      style={{ opacity: 0.6, background: "rgba(255,255,255,0.02)" }}
                    />
                  </div>
                )}
              </div>

              {/* Poll Visibility & Result Visibility */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "var(--text-dim)", marginBottom: "6px" }}>
                    Poll Visibility
                  </label>
                  <select
                    value={poolVisibility}
                    onChange={(e) => setPoolVisibility(e.target.value)}
                    className="vox-input"
                    style={{ background: "#0b0e20" }}
                  >
                    <option value="public">Public (Listed on Platform Feed)</option>
                    <option value="restricted">Restricted (Verified Voters Only)</option>
                    <option value="private">Private (Unlisted Direct Link)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "var(--text-dim)", marginBottom: "6px" }}>
                    Result Visibility Policy
                  </label>
                  <select
                    value={poolResultVisibility}
                    onChange={(e) => setPoolResultVisibility(e.target.value)}
                    className="vox-input"
                    style={{ background: "#0b0e20" }}
                  >
                    <option value="realtime">Real-Time (Voters see live results immediately)</option>
                    <option value="after_vote">After Voting (Revealed only after casting ballot)</option>
                    <option value="after_close">Only After Poll Closes (Hidden until timer expires)</option>
                    <option value="never">Never (Confidential / Administrator Eyes Only)</option>
                  </select>
                </div>
              </div>

              {/* Participant Quorum & Cap */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "var(--text-dim)", marginBottom: "6px" }}>
                    Minimum Participants (Quorum)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={poolMinParticipants}
                    onChange={(e) => setPoolMinParticipants(Number(e.target.value))}
                    className="vox-input"
                  />
                  <span style={{ fontSize: "0.72rem", color: "var(--text-dim)" }}>
                    Minimum votes before pool results are officially declared
                  </span>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "var(--text-dim)", marginBottom: "6px" }}>
                    Maximum Participant Cap (0 = Unlimited)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={poolMaxParticipants}
                    onChange={(e) => setPoolMaxParticipants(Number(e.target.value))}
                    className="vox-input"
                  />
                  <span style={{ fontSize: "0.72rem", color: "var(--text-dim)" }}>
                    Optional cap to create high-stakes voting pools
                  </span>
                </div>
              </div>

              {/* Voting Duration Configuration (25m - 120m) with Boundary Alerts */}
              <div style={{
                background: "rgba(255, 255, 255, 0.02)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "14px",
                padding: "18px",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", flexWrap: "wrap", gap: "6px" }}>
                  <label style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--text-dim)" }}>
                    Voting Duration: <span style={{ color: "#22d3ee", fontWeight: 800 }}>{formatDuration(poolDuration)}</span> ({poolDuration} mins)
                  </label>
                  <span style={{ fontSize: "0.74rem", color: "#22d3ee", background: "rgba(6, 182, 212, 0.12)", padding: "2px 8px", borderRadius: "6px", border: "1px solid rgba(6, 182, 212, 0.3)" }}>
                    Standard Constraint: 25 min – 2 hrs (120m)
                  </span>
                </div>

                {/* Range Slider and Number Input */}
                <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "10px" }}>
                  <input
                    type="range"
                    min={poolIsEscalated ? "1" : "25"}
                    max={poolIsEscalated ? "480" : "120"}
                    step={poolIsEscalated ? "1" : "5"}
                    value={poolDuration}
                    onChange={(e) => setPoolDuration(Number(e.target.value))}
                    style={{ flex: 1, accentColor: "#06b6d4", cursor: "pointer" }}
                  />
                  <input
                    type="number"
                    min="1"
                    max="480"
                    value={poolDuration}
                    onChange={(e) => setPoolDuration(Number(e.target.value))}
                    className="vox-input"
                    style={{ width: "90px", textAlign: "center", padding: "8px" }}
                  />
                  <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>min</span>
                </div>

                {/* Quick Presets */}
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "12px" }}>
                  {DURATION_PRESETS.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setPoolDuration(p.value)}
                      style={{
                        background: poolDuration === p.value ? "rgba(6, 182, 212, 0.3)" : "rgba(255,255,255,0.04)",
                        border: poolDuration === p.value ? "1px solid #06b6d4" : "1px solid var(--border-subtle)",
                        color: poolDuration === p.value ? "#22d3ee" : "#fff",
                        padding: "6px 12px",
                        borderRadius: "8px",
                        fontSize: "0.75rem",
                        fontWeight: poolDuration === p.value ? 700 : 500,
                        cursor: "pointer",
                      }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                {/* Boundary Proximity Warning Alert */}
                {getDurationWarning(poolDuration, poolIsEscalated) && (
                  <div style={{
                    background: getDurationWarning(poolDuration, poolIsEscalated).type === "escalation"
                      ? "rgba(139, 92, 246, 0.15)"
                      : "rgba(245, 158, 11, 0.15)",
                    border: getDurationWarning(poolDuration, poolIsEscalated).type === "escalation"
                      ? "1px solid rgba(139, 92, 246, 0.35)"
                      : "1px solid rgba(245, 158, 11, 0.35)",
                    color: getDurationWarning(poolDuration, poolIsEscalated).type === "escalation" ? "#c084fc" : "#fcd34d",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    fontSize: "0.78rem",
                    fontWeight: 600,
                    marginBottom: "12px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}>
                    {getDurationWarning(poolDuration, poolIsEscalated).text}
                  </div>
                )}

                {/* Local & UTC Timezone Display */}
                <div style={{
                  fontSize: "0.75rem",
                  color: "var(--text-muted)",
                  background: "rgba(255, 255, 255, 0.02)",
                  padding: "8px 12px",
                  borderRadius: "8px",
                  border: "1px solid var(--border-subtle)",
                  display: "flex",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "6px",
                }}>
                  <span>🌐 Timezone: <strong>{poolTimezone}</strong></span>
                  <span>
                    Estimated Close: <strong>{new Date(Date.now() + poolDuration * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} Local</strong> ({new Date(Date.now() + poolDuration * 60000).toISOString().slice(11, 16)} UTC)
                  </span>
                </div>

                {/* Special Authorization Override Drawer */}
                <div style={{ marginTop: "14px", borderTop: "1px dashed var(--border-subtle)", paddingTop: "12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <input
                      type="checkbox"
                      id="poolEscalate"
                      checked={poolIsEscalated}
                      onChange={(e) => setPoolIsEscalated(e.target.checked)}
                      style={{ width: "16px", height: "16px", accentColor: "#ef4444", cursor: "pointer" }}
                    />
                    <label htmlFor="poolEscalate" style={{ fontSize: "0.8rem", color: poolIsEscalated ? "#f87171" : "var(--text-dim)", fontWeight: 700, cursor: "pointer" }}>
                      Require Emergency / Custom Duration Override (&lt; 25m or &gt; 120m)
                    </label>
                  </div>

                  {poolIsEscalated && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "10px", padding: "12px", background: "rgba(239, 68, 68, 0.05)", border: "1px solid rgba(239, 68, 68, 0.2)", borderRadius: "10px" }}>
                      <div>
                        <label style={{ display: "block", fontSize: "0.75rem", color: "#fca5a5", fontWeight: 700, marginBottom: "4px" }}>
                          Authorization Override Key *
                        </label>
                        <input
                          type="password"
                          value={poolEscalationCode}
                          onChange={(e) => setPoolEscalationCode(e.target.value)}
                          placeholder="Enter VOXENTRA_OVERRIDE_AUTH"
                          className="vox-input"
                          style={{ borderColor: "rgba(239, 68, 68, 0.4)" }}
                        />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: "0.75rem", color: "#fca5a5", fontWeight: 700, marginBottom: "4px" }}>
                          Business Justification / Reason *
                        </label>
                        <textarea
                          value={poolEscalationReason}
                          onChange={(e) => setPoolEscalationReason(e.target.value)}
                          placeholder="State the justification for bypassing standard duration limits..."
                          className="vox-input"
                          rows={2}
                          style={{ borderColor: "rgba(239, 68, 68, 0.4)" }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "4px" }}>
                <input
                  type="checkbox"
                  id="autoClose"
                  checked={poolAutoClose}
                  onChange={(e) => setPoolAutoClose(e.target.checked)}
                  style={{ width: "18px", height: "18px", accentColor: "#8b5cf6" }}
                />
                <label htmlFor="autoClose" style={{ fontSize: "0.85rem", color: "var(--text-primary)", cursor: "pointer" }}>
                  Automatically lock & close pool when participant limit is reached
                </label>
              </div>
            </div>
          )}

          {/* STEP 3: OPTIONS & REWARDS */}
          {wizardStep === 3 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <h2 style={{ fontSize: "1.3rem", fontWeight: 800, color: "#ffffff" }}>
                Step 3: Voting Options & Reward Structure
              </h2>

              <div>
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "var(--text-dim)", marginBottom: "6px" }}>
                  Voting Options (Minimum 2, Maximum 8) *
                </label>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {poolOptions.map((opt, i) => (
                    <div key={i} style={{ display: "flex", gap: "8px" }}>
                      <input
                        type="text"
                        value={opt}
                        onChange={(e) => handleOptionChange(i, e.target.value)}
                        placeholder={`Option ${i + 1}`}
                        className="vox-input"
                        style={{ flex: 1 }}
                      />
                      {poolOptions.length > 2 && (
                        <button
                          type="button"
                          onClick={() => removeOptionField(i)}
                          style={{
                            background: "rgba(239, 68, 68, 0.1)",
                            border: "1px solid rgba(239, 68, 68, 0.3)",
                            color: "#f87171",
                            borderRadius: "8px",
                            padding: "0 12px",
                            cursor: "pointer",
                          }}
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {poolOptions.length < 8 && (
                  <button
                    type="button"
                    onClick={addOptionField}
                    className="btn-vox-secondary"
                    style={{ marginTop: "10px", padding: "8px 16px", fontSize: "0.82rem" }}
                  >
                    <Plus size={14} /> Add Option
                  </button>
                )}
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "var(--text-dim)", marginBottom: "6px" }}>
                  Reward Distribution Model
                </label>
                <select
                  value={poolReward}
                  onChange={(e) => setPoolReward(e.target.value)}
                  className="vox-input"
                  style={{ background: "#0b0e20" }}
                >
                  <option value="Winner Takes All XP">Winner Takes All XP (Voters of majority get 3x XP)</option>
                  <option value="Equal XP Split Among Voters">Equal XP Split Among All Participants</option>
                  <option value="Top 3 Voters XP Boost">Top 3 Voters XP Boost (Early voters get 2x bonus)</option>
                  <option value="Participation Trophy Badge">Participation Trophy Badge + Standard XP</option>
                </select>
              </div>
            </div>
          )}

          {/* STEP 4: PREVIEW & CONFIRMATION */}
          {wizardStep === 4 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              <h2 style={{ fontSize: "1.3rem", fontWeight: 800, color: "#ffffff" }}>
                Step 4: Interactive Live Preview & Confirmation
              </h2>

              {/* Realistic Pool Card Preview */}
              <div style={{
                background: "linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(6, 182, 212, 0.1) 100%)",
                border: "2px solid rgba(139, 92, 246, 0.4)",
                borderRadius: "16px",
                padding: "24px",
                boxShadow: "0 0 30px rgba(139, 92, 246, 0.2)",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                  <span style={{ background: "rgba(139, 92, 246, 0.2)", color: "#c084fc", padding: "2px 8px", borderRadius: "6px", fontSize: "0.75rem", fontWeight: 700 }}>
                    {poolCategory}
                  </span>
                  <span style={{ color: "#34d399", fontSize: "0.8rem", fontWeight: 700 }}>
                    ● READY TO LAUNCH · 0 votes
                  </span>
                </div>

                <h3 style={{ fontSize: "1.25rem", fontWeight: 800, color: "#ffffff", marginBottom: "8px" }}>
                  {poolName}
                </h3>
                {poolDesc && (
                  <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "16px" }}>
                    {poolDesc}
                  </p>
                )}

                <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "16px" }}>
                  {poolOptions.filter(Boolean).map((opt, i) => (
                    <div key={i} style={{ background: "rgba(255, 255, 255, 0.04)", border: "1px solid var(--border-subtle)", borderRadius: "8px", padding: "10px 14px", color: "var(--text-primary)", fontSize: "0.88rem" }}>
                      {opt}
                    </div>
                  ))}
                </div>

                <div style={{ display: "flex", gap: "16px", fontSize: "0.78rem", color: "var(--text-dim)", borderTop: "1px solid var(--border-subtle)", paddingTop: "12px" }}>
                  <span>Duration: {poolDuration}m</span>
                  <span>Entry: {poolEntryReq}</span>
                  <span>Reward: {poolReward}</span>
                </div>
              </div>

              {/* Confirmation Checkbox */}
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <input
                  type="checkbox"
                  id="confirmPool"
                  checked={poolConfirmed}
                  onChange={(e) => setPoolConfirmed(e.target.checked)}
                  style={{ width: "20px", height: "20px", accentColor: "#8b5cf6", cursor: "pointer" }}
                />
                <label htmlFor="confirmPool" style={{ fontSize: "0.9rem", color: "#ffffff", fontWeight: 600, cursor: "pointer" }}>
                  I confirm these pool parameters and declare this session ready for live participation.
                </label>
              </div>
            </div>
          )}

          {/* Navigation Controls */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "32px", borderTop: "1px solid var(--border-subtle)", paddingTop: "20px" }}>
            {wizardStep > 1 ? (
              <button className="btn-vox-secondary" onClick={handlePrevStep} style={{ padding: "10px 20px" }}>
                <ArrowLeft size={16} /> Previous
              </button>
            ) : (
              <div />
            )}

            {wizardStep < 4 ? (
              <button className="btn-vox-primary" onClick={handleNextStep} style={{ padding: "10px 24px" }}>
                Next Step <ArrowRight size={16} />
              </button>
            ) : (
              <button
                className="btn-vox-primary"
                onClick={handleCreatePoolSubmit}
                disabled={actionLoading || !poolConfirmed}
                style={{ padding: "12px 32px", fontSize: "1.05rem" }}
              >
                {actionLoading ? "Deploying Pool..." : "🚀 Launch Pool Live"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: ANALYTICS & REFERRAL SOURCES */}
      {/* ======================================================== */}
      {activeTab === "analytics" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {/* Overview Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
            <div className="glass-panel" style={{ padding: "20px", textAlign: "center" }}>
              <Users size={28} color="#8b5cf6" style={{ margin: "0 auto 8px" }} />
              <div style={{ fontSize: "1.8rem", fontWeight: 900, color: "#ffffff" }}>
                {analytics?.total_users || 0}
              </div>
              <span style={{ fontSize: "0.8rem", color: "var(--text-dim)", textTransform: "uppercase" }}>Registered Users</span>
            </div>

            <div className="glass-panel" style={{ padding: "20px", textAlign: "center" }}>
              <Layers size={28} color="#06b6d4" style={{ margin: "0 auto 8px" }} />
              <div style={{ fontSize: "1.8rem", fontWeight: 900, color: "#ffffff" }}>
                {analytics?.total_polls || 0}
              </div>
              <span style={{ fontSize: "0.8rem", color: "var(--text-dim)", textTransform: "uppercase" }}>Active Pools</span>
            </div>

            <div className="glass-panel" style={{ padding: "20px", textAlign: "center" }}>
              <BarChart3 size={28} color="#10b981" style={{ margin: "0 auto 8px" }} />
              <div style={{ fontSize: "1.8rem", fontWeight: 900, color: "#ffffff" }}>
                {analytics?.total_votes || 0}
              </div>
              <span style={{ fontSize: "0.8rem", color: "var(--text-dim)", textTransform: "uppercase" }}>Total Votes Cast</span>
            </div>

            <div className="glass-panel" style={{ padding: "20px", textAlign: "center" }}>
              <MessageSquare size={28} color="#f59e0b" style={{ margin: "0 auto 8px" }} />
              <div style={{ fontSize: "1.8rem", fontWeight: 900, color: "#ffffff" }}>
                {analytics?.total_comments || 0}
              </div>
              <span style={{ fontSize: "0.8rem", color: "var(--text-dim)", textTransform: "uppercase" }}>Community Messages</span>
            </div>
          </div>

          {/* Referral Channel Breakdown */}
          <div className="glass-panel" style={{ padding: "24px" }}>
            <h3 style={{ fontSize: "1.2rem", fontWeight: 800, color: "#ffffff", marginBottom: "16px" }}>
              Social Referral Channels
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "14px" }}>
              {analytics?.referral_stats?.map((ref, i) => (
                <div key={i} style={{ background: "rgba(255, 255, 255, 0.02)", border: "1px solid var(--border-subtle)", borderRadius: "10px", padding: "14px" }}>
                  <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#c084fc", textTransform: "uppercase" }}>
                    {ref.source}
                  </span>
                  <div style={{ fontSize: "1.4rem", fontWeight: 900, color: "#ffffff", marginTop: "4px" }}>
                    {ref.clicks} clicks
                  </div>
                  <span style={{ fontSize: "0.75rem", color: "#34d399" }}>
                    {ref.votes} votes converted
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 4: LIVE COMMENTARY MODERATION */}
      {/* ======================================================== */}
      {activeTab === "moderation" && (
        <div className="glass-panel" style={{ padding: "24px" }}>
          <h2 style={{ fontSize: "1.3rem", fontWeight: 800, color: "#ffffff", marginBottom: "16px" }}>
            Live Stream Commentary Moderation
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {comments.length === 0 ? (
              <div style={{ color: "var(--text-muted)", textAlign: "center", padding: "20px" }}>
                No active comments in stream.
              </div>
            ) : (
              comments.map((c, cIdx) => (
                <div key={`${c.id || "comm"}-${cIdx}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderRadius: "10px", background: "rgba(255, 255, 255, 0.02)", border: "1px solid var(--border-subtle)" }}>
                  <div>
                    <div style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "2px" }}>
                      <span style={{ fontWeight: 700, color: "#ffffff", fontSize: "0.9rem" }}>{c.username}</span>
                      <span style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>Target: {c.target_id}</span>
                    </div>
                    <p style={{ fontSize: "0.85rem", color: "var(--text-primary)", margin: 0 }}>{c.content}</p>
                  </div>
                  <button
                    onClick={() => handleDeleteComment(c.id)}
                    style={{ background: "rgba(239, 68, 68, 0.12)", border: "1px solid rgba(239, 68, 68, 0.3)", color: "#f87171", borderRadius: "6px", padding: "6px 10px", cursor: "pointer" }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: EDIT VOTING POOL */}
      {/* ======================================================== */}
      {editingPoll && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(3, 7, 18, 0.82)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999,
          padding: "20px",
        }}>
          <div
            className="glass-panel"
            style={{
              width: "100%",
              maxWidth: "680px",
              maxHeight: "90vh",
              overflowY: "auto",
              padding: "32px",
              borderRadius: "20px",
              border: "1px solid rgba(56, 189, 248, 0.35)",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 30px rgba(56, 189, 248, 0.2)",
              position: "relative",
            }}
          >
            {/* Modal Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px", borderBottom: "1px solid var(--border-subtle)", paddingBottom: "16px" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
                  <div style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "10px",
                    background: "rgba(56, 189, 248, 0.15)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}>
                    <Edit2 size={18} color="#38bdf8" />
                  </div>
                  <h2 style={{ fontSize: "1.35rem", fontWeight: 800, color: "#ffffff", margin: 0 }}>
                    Edit Voting Pool
                  </h2>
                </div>
                <span style={{ fontSize: "0.78rem", color: "var(--text-dim)" }}>
                  ID: {editingPoll.id} · Created by {editingPoll.creator_name || "Admin"}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setEditingPoll(null)}
                style={{
                  background: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid var(--border-subtle)",
                  color: "var(--text-muted)",
                  borderRadius: "8px",
                  width: "32px",
                  height: "32px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Error Banner */}
            {editError && (
              <div style={{
                background: "rgba(239, 68, 68, 0.15)",
                border: "1px solid rgba(239, 68, 68, 0.35)",
                color: "#fca5a5",
                padding: "10px 16px",
                borderRadius: "10px",
                fontSize: "0.85rem",
                marginBottom: "20px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}>
                <AlertTriangle size={16} />
                <span>{editError}</span>
              </div>
            )}

            {/* Zero-Vote Option Immutability Guard Banner */}
            {(editingPoll.total_votes || 0) > 0 ? (
              <div style={{
                background: "rgba(245, 158, 11, 0.12)",
                border: "1px solid rgba(245, 158, 11, 0.35)",
                color: "#fbbf24",
                padding: "12px 16px",
                borderRadius: "10px",
                fontSize: "0.85rem",
                marginBottom: "20px",
                display: "flex",
                alignItems: "flex-start",
                gap: "10px"
              }}>
                <Lock size={18} style={{ marginTop: "2px", flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: 700 }}>Voting Options Locked ({editingPoll.total_votes} votes recorded)</div>
                  <div style={{ fontSize: "0.78rem", color: "rgba(251, 191, 36, 0.85)", marginTop: "3px" }}>
                    Strict integrity guard active: Answer options cannot be modified, added, or deleted once ballots have been cast. You may still safely adjust title, description, session duration, status, and visibility preferences.
                  </div>
                </div>
              </div>
            ) : (
              <div style={{
                background: "rgba(16, 185, 129, 0.1)",
                border: "1px solid rgba(16, 185, 129, 0.3)",
                color: "#34d399",
                padding: "8px 14px",
                borderRadius: "8px",
                fontSize: "0.8rem",
                marginBottom: "20px",
                display: "flex",
                alignItems: "center",
                gap: "8px"
              }}>
                <CheckCircle2 size={16} />
                <span>0 votes cast: Answer options are fully unlocked and editable.</span>
              </div>
            )}

            <form onSubmit={handleSaveEdit} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              {/* Pool Name / Title */}
              <div>
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "var(--text-dim)", marginBottom: "6px" }}>
                  Pool Name / Voting Question *
                </label>
                <input
                  type="text"
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  placeholder="Pool Title"
                  className="vox-input"
                  required
                />
              </div>

              {/* Category & Status */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "var(--text-dim)", marginBottom: "6px" }}>
                    Category
                  </label>
                  <select
                    value={editForm.category}
                    onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                    className="vox-input"
                    style={{ background: "#0b0e20" }}
                  >
                    <option value="Artificial Intelligence">Artificial Intelligence</option>
                    <option value="Web Development">Web Development</option>
                    <option value="Gaming & Esports">Gaming & Esports</option>
                    <option value="Cloud Computing">Cloud Computing</option>
                    <option value="Blockchain & Web3">Blockchain & Web3</option>
                    <option value="Mobile Tech">Mobile Tech</option>
                    <option value="General">General</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "var(--text-dim)", marginBottom: "6px" }}>
                    Voting Session Status
                  </label>
                  <div
                    onClick={() => setEditForm({ ...editForm, isActive: !editForm.isActive })}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      padding: "10px 14px",
                      borderRadius: "10px",
                      background: editForm.isActive ? "rgba(16, 185, 129, 0.12)" : "rgba(239, 68, 68, 0.12)",
                      border: editForm.isActive ? "1px solid rgba(16, 185, 129, 0.3)" : "1px solid rgba(239, 68, 68, 0.3)",
                      cursor: "pointer",
                      height: "44px",
                      boxSizing: "border-box"
                    }}
                  >
                    {editForm.isActive ? <ToggleRight size={22} color="#34d399" /> : <ToggleLeft size={22} color="#f87171" />}
                    <span style={{ fontSize: "0.85rem", fontWeight: 700, color: editForm.isActive ? "#34d399" : "#f87171" }}>
                      {editForm.isActive ? "Active (Accepting Votes)" : "Paused (Voting Locked)"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div>
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "var(--text-dim)", marginBottom: "6px" }}>
                  Description / Context
                </label>
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  placeholder="Pool description or guidelines..."
                  className="vox-input"
                  rows={2}
                />
              </div>

              {/* Selection Type & Max Selections */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "var(--text-dim)", marginBottom: "6px" }}>
                    Selection Type
                  </label>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      type="button"
                      onClick={() => setEditForm({ ...editForm, selectionType: "single" })}
                      style={{
                        flex: 1,
                        padding: "8px",
                        borderRadius: "8px",
                        fontSize: "0.8rem",
                        fontWeight: editForm.selectionType === "single" ? 700 : 500,
                        background: editForm.selectionType === "single" ? "rgba(56, 189, 248, 0.2)" : "rgba(255,255,255,0.04)",
                        border: editForm.selectionType === "single" ? "1px solid #38bdf8" : "1px solid var(--border-subtle)",
                        color: editForm.selectionType === "single" ? "#38bdf8" : "#fff",
                        cursor: "pointer"
                      }}
                    >
                      Single Selection
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditForm({ ...editForm, selectionType: "multiple" })}
                      style={{
                        flex: 1,
                        padding: "8px",
                        borderRadius: "8px",
                        fontSize: "0.8rem",
                        fontWeight: editForm.selectionType === "multiple" ? 700 : 500,
                        background: editForm.selectionType === "multiple" ? "rgba(56, 189, 248, 0.2)" : "rgba(255,255,255,0.04)",
                        border: editForm.selectionType === "multiple" ? "1px solid #38bdf8" : "1px solid var(--border-subtle)",
                        color: editForm.selectionType === "multiple" ? "#38bdf8" : "#fff",
                        cursor: "pointer"
                      }}
                    >
                      Multiple Selection
                    </button>
                  </div>
                </div>

                {editForm.selectionType === "multiple" ? (
                  <div>
                    <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "var(--text-dim)", marginBottom: "6px" }}>
                      Max Selections Allowed
                    </label>
                    <input
                      type="number"
                      min="2"
                      max={editForm.options.length}
                      value={editForm.maxSelections}
                      onChange={(e) => setEditForm({ ...editForm, maxSelections: Math.max(2, Math.min(editForm.options.length, Number(e.target.value))) })}
                      className="vox-input"
                    />
                  </div>
                ) : (
                  <div>
                    <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "var(--text-dim)", marginBottom: "6px" }}>
                      Ballot Mode
                    </label>
                    <div style={{ padding: "8px 12px", background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-subtle)", borderRadius: "8px", fontSize: "0.8rem", color: "var(--text-muted)" }}>
                      1 Choice per Voter
                    </div>
                  </div>
                )}
              </div>

              {/* Poll Visibility & Result Visibility */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "var(--text-dim)", marginBottom: "6px" }}>
                    Poll Visibility
                  </label>
                  <select
                    value={editForm.visibility}
                    onChange={(e) => setEditForm({ ...editForm, visibility: e.target.value })}
                    className="vox-input"
                    style={{ background: "#0b0e20" }}
                  >
                    <option value="public">Public (All Users)</option>
                    <option value="restricted">Restricted (Designated Groups)</option>
                    <option value="private">Private (Invite / Admin Only)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "var(--text-dim)", marginBottom: "6px" }}>
                    Result Visibility
                  </label>
                  <select
                    value={editForm.resultVisibility}
                    onChange={(e) => setEditForm({ ...editForm, resultVisibility: e.target.value })}
                    className="vox-input"
                    style={{ background: "#0b0e20" }}
                  >
                    <option value="realtime">Real-time (Live percentage bar)</option>
                    <option value="after_vote">After Voting (Hidden until vote cast)</option>
                    <option value="after_close">After Poll Closes Only</option>
                    <option value="never">Never (Admin / Internal Only)</option>
                  </select>
                </div>
              </div>

              {/* Duration: strictly between 25 min and 120 min (2 hrs) */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", flexWrap: "wrap", gap: "6px" }}>
                  <label style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--text-dim)" }}>
                    Session Duration: <span style={{ color: "#38bdf8", fontWeight: 800 }}>{formatDuration(editForm.duration)}</span> ({editForm.duration} mins)
                  </label>
                  <span style={{ fontSize: "0.74rem", color: "#38bdf8", background: "rgba(56, 189, 248, 0.12)", padding: "2px 8px", borderRadius: "6px", border: "1px solid rgba(56, 189, 248, 0.3)" }}>
                    Allowed: 25 min – 2 hrs (120m)
                  </span>
                </div>

                {/* Range Slider & Number Input */}
                <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "10px" }}>
                  <input
                    type="range"
                    min="25"
                    max="120"
                    step="5"
                    value={editForm.duration}
                    onChange={(e) => setEditForm({ ...editForm, duration: Number(e.target.value) })}
                    style={{ flex: 1, accentColor: "#38bdf8", cursor: "pointer" }}
                  />
                  <input
                    type="number"
                    min="25"
                    max="120"
                    value={editForm.duration}
                    onChange={(e) => setEditForm({ ...editForm, duration: Math.max(25, Math.min(120, Number(e.target.value))) })}
                    className="vox-input"
                    style={{ width: "90px", textAlign: "center", padding: "8px" }}
                  />
                  <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>min</span>
                </div>

                {/* Quick Presets */}
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  {DURATION_PRESETS.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setEditForm({ ...editForm, duration: p.value })}
                      style={{
                        background: editForm.duration === p.value ? "rgba(56, 189, 248, 0.25)" : "rgba(255,255,255,0.04)",
                        border: editForm.duration === p.value ? "1px solid #38bdf8" : "1px solid var(--border-subtle)",
                        color: editForm.duration === p.value ? "#38bdf8" : "#fff",
                        padding: "6px 12px",
                        borderRadius: "8px",
                        fontSize: "0.75rem",
                        fontWeight: editForm.duration === p.value ? 700 : 500,
                        cursor: "pointer",
                      }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                {/* Proximity Boundary Warning */}
                {(() => {
                  const warn = getDurationWarning(editForm.duration, editForm.isEscalated);
                  if (!warn) return null;
                  return (
                    <div style={{
                      marginTop: "8px",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      fontSize: "0.78rem",
                      background: warn.type === "escalation" ? "rgba(168, 85, 247, 0.12)" : "rgba(245, 158, 11, 0.12)",
                      border: warn.type === "escalation" ? "1px solid rgba(168, 85, 247, 0.3)" : "1px solid rgba(245, 158, 11, 0.3)",
                      color: warn.type === "escalation" ? "#c084fc" : "#fbbf24",
                    }}>
                      {warn.text}
                    </div>
                  );
                })()}

                {/* Escalation Override Section */}
                <div style={{
                  background: "rgba(255, 255, 255, 0.02)",
                  border: "1px dashed rgba(255, 255, 255, 0.15)",
                  borderRadius: "10px",
                  padding: "12px",
                  marginTop: "12px"
                }}>
                  <div
                    onClick={() => setEditForm({ ...editForm, isEscalated: !editForm.isEscalated })}
                    style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.8rem", fontWeight: 600, color: editForm.isEscalated ? "#c084fc" : "var(--text-dim)" }}>
                      <Key size={14} /> Admin Escalation Override (&lt; 25m or &gt; 120m)
                    </div>
                    <input
                      type="checkbox"
                      checked={editForm.isEscalated}
                      onChange={(e) => setEditForm({ ...editForm, isEscalated: e.target.checked })}
                      style={{ cursor: "pointer" }}
                    />
                  </div>

                  {editForm.isEscalated && (
                    <div style={{ marginTop: "10px", display: "flex", flexDirection: "column", gap: "8px" }}>
                      <div>
                        <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "4px" }}>
                          Custom Duration (Minutes)
                        </label>
                        <input
                          type="number"
                          value={editForm.duration}
                          onChange={(e) => setEditForm({ ...editForm, duration: Number(e.target.value) })}
                          placeholder="e.g. 15 or 180"
                          className="vox-input"
                          style={{ fontSize: "0.8rem", padding: "6px 10px", width: "120px" }}
                        />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "4px" }}>
                          Authorization Code (VOXENTRA_OVERRIDE_AUTH)
                        </label>
                        <input
                          type="password"
                          value={editForm.escalationCode}
                          onChange={(e) => setEditForm({ ...editForm, escalationCode: e.target.value })}
                          placeholder="VOXENTRA_OVERRIDE_AUTH"
                          className="vox-input"
                          style={{ fontSize: "0.8rem", padding: "6px 10px" }}
                        />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "4px" }}>
                          Justification / Business Case
                        </label>
                        <input
                          type="text"
                          value={editForm.escalationReason}
                          onChange={(e) => setEditForm({ ...editForm, escalationReason: e.target.value })}
                          placeholder="e.g. Special executive townhall session authorized by leadership"
                          className="vox-input"
                          style={{ fontSize: "0.8rem", padding: "6px 10px" }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Voting Options */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <label style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--text-dim)" }}>
                    Voting Options {(editingPoll.total_votes || 0) > 0 ? "(Locked - Ballots Cast)" : "(Min 2, Max 10) *"}
                  </label>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                    {editForm.options.length} options
                  </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {editForm.options.map((opt, i) => (
                    <div key={i} style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-dim)", width: "22px" }}>
                        #{i + 1}
                      </span>
                      <input
                        type="text"
                        value={opt}
                        onChange={(e) => handleEditOptionChange(i, e.target.value)}
                        placeholder={`Option ${i + 1}`}
                        className="vox-input"
                        style={{
                          flex: 1,
                          opacity: (editingPoll.total_votes || 0) > 0 ? 0.7 : 1,
                          cursor: (editingPoll.total_votes || 0) > 0 ? "not-allowed" : "text",
                          backgroundColor: (editingPoll.total_votes || 0) > 0 ? "rgba(255,255,255,0.02)" : undefined
                        }}
                        disabled={(editingPoll.total_votes || 0) > 0}
                      />
                      {(editingPoll.total_votes || 0) === 0 && editForm.options.length > 2 && (
                        <button
                          type="button"
                          onClick={() => removeEditOptionField(i)}
                          style={{
                            background: "rgba(239, 68, 68, 0.1)",
                            border: "1px solid rgba(239, 68, 68, 0.3)",
                            color: "#f87171",
                            borderRadius: "8px",
                            padding: "0 12px",
                            height: "42px",
                            cursor: "pointer",
                          }}
                          title="Remove option"
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {(editingPoll.total_votes || 0) === 0 && editForm.options.length < 10 && (
                  <button
                    type="button"
                    onClick={addEditOptionField}
                    className="btn-vox-secondary"
                    style={{ marginTop: "12px", padding: "8px 16px", fontSize: "0.82rem", display: "flex", alignItems: "center", gap: "6px" }}
                  >
                    <Plus size={14} /> Add Option
                  </button>
                )}
              </div>

              {/* Modal Action Buttons */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "16px", borderTop: "1px solid var(--border-subtle)", paddingTop: "20px" }}>
                <button
                  type="button"
                  onClick={() => setEditingPoll(null)}
                  className="btn-vox-secondary"
                  style={{ padding: "10px 20px" }}
                  disabled={editLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-vox-primary"
                  style={{ padding: "10px 24px", display: "flex", alignItems: "center", gap: "8px" }}
                  disabled={editLoading}
                >
                  {editLoading ? <RefreshCw size={16} className="spin" /> : <Check size={16} />}
                  {editLoading ? "Saving Changes..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* QUICK CREATE POOL MODAL */}
      {/* ======================================================== */}
      {showCreateModal && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0, 0, 0, 0.8)",
          backdropFilter: "blur(8px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
          padding: "20px",
        }}>
          <div className="glass-panel" style={{
            maxWidth: "620px",
            width: "100%",
            maxHeight: "92vh",
            overflowY: "auto",
            padding: "32px",
            border: "1px solid rgba(6, 182, 212, 0.35)",
            boxShadow: "0 0 40px rgba(6, 182, 212, 0.2)",
            position: "relative",
          }}>
            {/* Modal Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "10px",
                  background: "linear-gradient(135deg, #06b6d4 0%, #8b5cf6 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}>
                  <Plus size={20} color="#ffffff" />
                </div>
                <div>
                  <h2 style={{ fontSize: "1.25rem", fontWeight: 800, color: "#ffffff", margin: 0 }}>
                    Create Live Voting Pool
                  </h2>
                  <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", margin: "2px 0 0 0" }}>
                    Configure and launch a live voting session with duration control (25m – 2h)
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                style={{
                  background: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid var(--border-subtle)",
                  color: "var(--text-muted)",
                  borderRadius: "8px",
                  padding: "6px",
                  cursor: "pointer",
                }}
              >
                <X size={18} />
              </button>
            </div>

            {quickCreateError && (
              <div style={{
                background: "rgba(239, 68, 68, 0.15)",
                border: "1px solid rgba(239, 68, 68, 0.35)",
                color: "#fca5a5",
                padding: "10px 14px",
                borderRadius: "10px",
                fontSize: "0.85rem",
                marginBottom: "20px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}>
                <AlertTriangle size={16} /> {quickCreateError}
              </div>
            )}

            <form onSubmit={handleQuickCreateSubmit} style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
              {/* Question / Title */}
              <div>
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "var(--text-dim)", marginBottom: "6px" }}>
                  Pool Name / Voting Question *
                </label>
                <input
                  type="text"
                  required
                  value={quickCreateForm.title}
                  onChange={(e) => setQuickCreateForm({ ...quickCreateForm, title: e.target.value })}
                  placeholder="e.g. Which programming language will dominate AI in 2027?"
                  className="vox-input"
                />
              </div>

              {/* Category */}
              <div>
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "var(--text-dim)", marginBottom: "6px" }}>
                  Category
                </label>
                <select
                  value={quickCreateForm.category}
                  onChange={(e) => setQuickCreateForm({ ...quickCreateForm, category: e.target.value })}
                  className="vox-input"
                  style={{ background: "#0b0e20" }}
                >
                  <option value="Artificial Intelligence">Artificial Intelligence</option>
                  <option value="Web Development">Web Development</option>
                  <option value="Gaming & Esports">Gaming & Esports</option>
                  <option value="Cloud Computing">Cloud Computing</option>
                  <option value="Blockchain & Web3">Blockchain & Web3</option>
                  <option value="Mobile Tech">Mobile Tech</option>
                  <option value="General">General</option>
                </select>
              </div>

              {/* Description */}
              <div>
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "var(--text-dim)", marginBottom: "6px" }}>
                  Description / Context (Optional)
                </label>
                <textarea
                  value={quickCreateForm.description}
                  onChange={(e) => setQuickCreateForm({ ...quickCreateForm, description: e.target.value })}
                  placeholder="Provide background context, criteria, or rules for voters..."
                  className="vox-input"
                  rows={2}
                />
              </div>

              {/* Selection Type & Max Selections */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "var(--text-dim)", marginBottom: "6px" }}>
                    Selection Type
                  </label>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      type="button"
                      onClick={() => setQuickCreateForm({ ...quickCreateForm, selectionType: "single" })}
                      style={{
                        flex: 1,
                        padding: "8px",
                        borderRadius: "8px",
                        fontSize: "0.8rem",
                        fontWeight: quickCreateForm.selectionType === "single" ? 700 : 500,
                        background: quickCreateForm.selectionType === "single" ? "rgba(6, 182, 212, 0.25)" : "rgba(255,255,255,0.04)",
                        border: quickCreateForm.selectionType === "single" ? "1px solid #06b6d4" : "1px solid var(--border-subtle)",
                        color: quickCreateForm.selectionType === "single" ? "#22d3ee" : "#fff",
                        cursor: "pointer"
                      }}
                    >
                      Single Choice
                    </button>
                    <button
                      type="button"
                      onClick={() => setQuickCreateForm({ ...quickCreateForm, selectionType: "multiple" })}
                      style={{
                        flex: 1,
                        padding: "8px",
                        borderRadius: "8px",
                        fontSize: "0.8rem",
                        fontWeight: quickCreateForm.selectionType === "multiple" ? 700 : 500,
                        background: quickCreateForm.selectionType === "multiple" ? "rgba(6, 182, 212, 0.25)" : "rgba(255,255,255,0.04)",
                        border: quickCreateForm.selectionType === "multiple" ? "1px solid #06b6d4" : "1px solid var(--border-subtle)",
                        color: quickCreateForm.selectionType === "multiple" ? "#22d3ee" : "#fff",
                        cursor: "pointer"
                      }}
                    >
                      Multi-Choice
                    </button>
                  </div>
                </div>

                {quickCreateForm.selectionType === "multiple" ? (
                  <div>
                    <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "var(--text-dim)", marginBottom: "6px" }}>
                      Max Choices Allowed
                    </label>
                    <input
                      type="number"
                      min="2"
                      max={quickCreateForm.options.length}
                      value={quickCreateForm.maxSelections}
                      onChange={(e) => setQuickCreateForm({ ...quickCreateForm, maxSelections: Math.max(2, Math.min(quickCreateForm.options.length, Number(e.target.value))) })}
                      className="vox-input"
                    />
                  </div>
                ) : (
                  <div>
                    <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "var(--text-dim)", marginBottom: "6px" }}>
                      Ballot Mode
                    </label>
                    <div style={{ padding: "8px 12px", background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-subtle)", borderRadius: "8px", fontSize: "0.8rem", color: "var(--text-muted)" }}>
                      1 Choice per Voter
                    </div>
                  </div>
                )}
              </div>

              {/* Poll Visibility & Result Visibility */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "var(--text-dim)", marginBottom: "6px" }}>
                    Poll Visibility
                  </label>
                  <select
                    value={quickCreateForm.visibility}
                    onChange={(e) => setQuickCreateForm({ ...quickCreateForm, visibility: e.target.value })}
                    className="vox-input"
                    style={{ background: "#0b0e20" }}
                  >
                    <option value="public">Public (All Users)</option>
                    <option value="restricted">Restricted (Designated Groups)</option>
                    <option value="private">Private (Invite Only)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "var(--text-dim)", marginBottom: "6px" }}>
                    Result Visibility
                  </label>
                  <select
                    value={quickCreateForm.resultVisibility}
                    onChange={(e) => setQuickCreateForm({ ...quickCreateForm, resultVisibility: e.target.value })}
                    className="vox-input"
                    style={{ background: "#0b0e20" }}
                  >
                    <option value="realtime">Real-time (Live percentage bar)</option>
                    <option value="after_vote">After Voting (Hidden until vote cast)</option>
                    <option value="after_close">After Poll Closes Only</option>
                    <option value="never">Never (Admin / Internal Only)</option>
                  </select>
                </div>
              </div>

              {/* Session Duration: 25 min to 2 hrs / 120 min */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", flexWrap: "wrap", gap: "6px" }}>
                  <label style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--text-dim)" }}>
                    Session Duration: <span style={{ color: "#22d3ee", fontWeight: 800 }}>{formatDuration(quickCreateForm.duration)}</span> ({quickCreateForm.duration} mins)
                  </label>
                  <span style={{ fontSize: "0.74rem", color: "#22d3ee", background: "rgba(6, 182, 212, 0.12)", padding: "2px 8px", borderRadius: "6px", border: "1px solid rgba(6, 182, 212, 0.3)" }}>
                    Allowed: 25 min – 2 hrs (120m)
                  </span>
                </div>

                {/* Range Slider and Number Input */}
                <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "10px" }}>
                  <input
                    type="range"
                    min="25"
                    max="120"
                    step="5"
                    value={quickCreateForm.duration}
                    onChange={(e) => setQuickCreateForm({ ...quickCreateForm, duration: Number(e.target.value) })}
                    style={{ flex: 1, accentColor: "#06b6d4", cursor: "pointer" }}
                  />
                  <input
                    type="number"
                    min="25"
                    max="120"
                    value={quickCreateForm.duration}
                    onChange={(e) => setQuickCreateForm({ ...quickCreateForm, duration: Math.max(25, Math.min(120, Number(e.target.value))) })}
                    className="vox-input"
                    style={{ width: "90px", textAlign: "center", padding: "8px" }}
                  />
                  <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>min</span>
                </div>

                {/* Quick Presets */}
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  {DURATION_PRESETS.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setQuickCreateForm({ ...quickCreateForm, duration: p.value })}
                      style={{
                        background: quickCreateForm.duration === p.value ? "rgba(6, 182, 212, 0.3)" : "rgba(255,255,255,0.04)",
                        border: quickCreateForm.duration === p.value ? "1px solid #06b6d4" : "1px solid var(--border-subtle)",
                        color: quickCreateForm.duration === p.value ? "#22d3ee" : "#fff",
                        padding: "6px 12px",
                        borderRadius: "8px",
                        fontSize: "0.75rem",
                        fontWeight: quickCreateForm.duration === p.value ? 700 : 500,
                        cursor: "pointer",
                      }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                {/* Proximity Boundary Warning */}
                {(() => {
                  const warn = getDurationWarning(quickCreateForm.duration, quickCreateForm.isEscalated);
                  if (!warn) return null;
                  return (
                    <div style={{
                      marginTop: "8px",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      fontSize: "0.78rem",
                      background: warn.type === "escalation" ? "rgba(168, 85, 247, 0.12)" : "rgba(245, 158, 11, 0.12)",
                      border: warn.type === "escalation" ? "1px solid rgba(168, 85, 247, 0.3)" : "1px solid rgba(245, 158, 11, 0.3)",
                      color: warn.type === "escalation" ? "#c084fc" : "#fbbf24",
                    }}>
                      {warn.text}
                    </div>
                  );
                })()}

                {/* Escalation Override Drawer */}
                <div style={{
                  background: "rgba(255, 255, 255, 0.02)",
                  border: "1px dashed rgba(255, 255, 255, 0.15)",
                  borderRadius: "10px",
                  padding: "12px",
                  marginTop: "12px"
                }}>
                  <div
                    onClick={() => setQuickCreateForm({ ...quickCreateForm, isEscalated: !quickCreateForm.isEscalated })}
                    style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.8rem", fontWeight: 600, color: quickCreateForm.isEscalated ? "#c084fc" : "var(--text-dim)" }}>
                      <Key size={14} /> Admin Escalation Override (&lt; 25m or &gt; 120m)
                    </div>
                    <input
                      type="checkbox"
                      checked={quickCreateForm.isEscalated}
                      onChange={(e) => setQuickCreateForm({ ...quickCreateForm, isEscalated: e.target.checked })}
                      style={{ cursor: "pointer" }}
                    />
                  </div>

                  {quickCreateForm.isEscalated && (
                    <div style={{ marginTop: "10px", display: "flex", flexDirection: "column", gap: "8px" }}>
                      <div>
                        <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "4px" }}>
                          Custom Duration (Minutes)
                        </label>
                        <input
                          type="number"
                          value={quickCreateForm.duration}
                          onChange={(e) => setQuickCreateForm({ ...quickCreateForm, duration: Number(e.target.value) })}
                          placeholder="e.g. 15 or 180"
                          className="vox-input"
                          style={{ fontSize: "0.8rem", padding: "6px 10px", width: "120px" }}
                        />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "4px" }}>
                          Authorization Code (VOXENTRA_OVERRIDE_AUTH)
                        </label>
                        <input
                          type="password"
                          value={quickCreateForm.escalationCode}
                          onChange={(e) => setQuickCreateForm({ ...quickCreateForm, escalationCode: e.target.value })}
                          placeholder="VOXENTRA_OVERRIDE_AUTH"
                          className="vox-input"
                          style={{ fontSize: "0.8rem", padding: "6px 10px" }}
                        />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "4px" }}>
                          Justification / Business Case
                        </label>
                        <input
                          type="text"
                          value={quickCreateForm.escalationReason}
                          onChange={(e) => setQuickCreateForm({ ...quickCreateForm, escalationReason: e.target.value })}
                          placeholder="e.g. Emergency platform poll authorized by director"
                          className="vox-input"
                          style={{ fontSize: "0.8rem", padding: "6px 10px" }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Voting Options */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <label style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--text-dim)" }}>
                    Voting Options (Min 2, Max 8) *
                  </label>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                    {quickCreateForm.options.length} options
                  </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {quickCreateForm.options.map((opt, i) => (
                    <div key={i} style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-dim)", width: "22px" }}>
                        #{i + 1}
                      </span>
                      <input
                        type="text"
                        value={opt}
                        onChange={(e) => handleQuickOptionChange(i, e.target.value)}
                        placeholder={`Option ${i + 1}`}
                        className="vox-input"
                        style={{ flex: 1 }}
                      />
                      {quickCreateForm.options.length > 2 && (
                        <button
                          type="button"
                          onClick={() => removeQuickOptionField(i)}
                          style={{
                            background: "rgba(239, 68, 68, 0.1)",
                            border: "1px solid rgba(239, 68, 68, 0.3)",
                            color: "#f87171",
                            borderRadius: "8px",
                            padding: "0 12px",
                            height: "42px",
                            cursor: "pointer",
                          }}
                          title="Remove option"
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {quickCreateForm.options.length < 8 && (
                  <button
                    type="button"
                    onClick={addQuickOptionField}
                    className="btn-vox-secondary"
                    style={{ marginTop: "12px", padding: "8px 16px", fontSize: "0.82rem", display: "flex", alignItems: "center", gap: "6px" }}
                  >
                    <Plus size={14} /> Add Option
                  </button>
                )}
              </div>

              {/* Modal Action Buttons */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "16px", borderTop: "1px solid var(--border-subtle)", paddingTop: "20px" }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn-vox-secondary"
                  style={{ padding: "10px 20px" }}
                  disabled={quickCreateLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-vox-primary"
                  style={{
                    padding: "10px 24px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    background: "linear-gradient(135deg, #06b6d4 0%, #8b5cf6 100%)",
                    boxShadow: "0 0 20px rgba(6, 182, 212, 0.4)",
                  }}
                  disabled={quickCreateLoading}
                >
                  {quickCreateLoading ? <RefreshCw size={16} className="spin" /> : <Sparkles size={16} />}
                  {quickCreateLoading ? "Creating Pool..." : "Launch Pool Live"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* AUDIT TRAIL HISTORY MODAL */}
      {/* ======================================================== */}
      {auditModalOpen && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0, 0, 0, 0.85)",
          backdropFilter: "blur(10px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1100,
          padding: "20px",
        }}>
          <div className="glass-panel" style={{
            maxWidth: "750px",
            width: "100%",
            maxHeight: "90vh",
            overflowY: "auto",
            padding: "32px",
            border: "1px solid rgba(139, 92, 246, 0.35)",
            boxShadow: "0 0 50px rgba(139, 92, 246, 0.2)",
            position: "relative",
          }}>
            {/* Modal Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "12px",
                  background: "linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}>
                  <History size={22} color="#ffffff" />
                </div>
                <div>
                  <h2 style={{ fontSize: "1.3rem", fontWeight: 800, color: "#ffffff", margin: 0 }}>
                    Administrative Audit Trail
                  </h2>
                  <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", margin: "3px 0 0 0" }}>
                    Immutable modification history for: <span style={{ color: "#c084fc", fontWeight: 600 }}>{auditPoll?.title || "Poll"}</span>
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setAuditModalOpen(false);
                  setAuditPoll(null);
                  setAuditLogs([]);
                }}
                style={{
                  background: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid var(--border-subtle)",
                  color: "var(--text-muted)",
                  borderRadius: "8px",
                  padding: "6px",
                  cursor: "pointer",
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            {auditLoading ? (
              <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
                <RefreshCw size={24} className="spin" style={{ margin: "0 auto 12px" }} />
                <p>Retrieving immutable audit logs...</p>
              </div>
            ) : auditLogs.length === 0 ? (
              <div style={{
                padding: "36px",
                textAlign: "center",
                background: "rgba(255, 255, 255, 0.02)",
                borderRadius: "12px",
                border: "1px dashed var(--border-subtle)"
              }}>
                <History size={32} style={{ color: "var(--text-muted)", margin: "0 auto 10px" }} />
                <p style={{ color: "var(--text-dim)", fontWeight: 600, margin: 0 }}>No administrative modifications recorded yet.</p>
                <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", margin: "4px 0 0" }}>
                  All updates to duration, answer options, and settings will appear in this timeline.
                </p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                {auditLogs.map((log, idx) => (
                  <div
                    key={log.id || idx}
                    style={{
                      background: "rgba(255, 255, 255, 0.03)",
                      border: "1px solid rgba(255, 255, 255, 0.08)",
                      borderRadius: "12px",
                      padding: "16px 20px",
                      position: "relative",
                      transition: "border-color 0.2s",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", flexWrap: "wrap", gap: "8px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{
                          fontSize: "0.75rem",
                          fontWeight: 800,
                          padding: "3px 10px",
                          borderRadius: "6px",
                          letterSpacing: "0.04em",
                          background: log.action?.includes("DURATION")
                            ? "rgba(56, 189, 248, 0.15)"
                            : log.action?.includes("CREATED")
                            ? "rgba(52, 211, 153, 0.15)"
                            : "rgba(168, 85, 247, 0.15)",
                          border: log.action?.includes("DURATION")
                            ? "1px solid rgba(56, 189, 248, 0.35)"
                            : log.action?.includes("CREATED")
                            ? "1px solid rgba(52, 211, 153, 0.35)"
                            : "1px solid rgba(168, 85, 247, 0.35)",
                          color: log.action?.includes("DURATION")
                            ? "#38bdf8"
                            : log.action?.includes("CREATED")
                            ? "#34d399"
                            : "#c084fc",
                        }}>
                          {log.action}
                        </span>

                        {log.is_escalated && (
                          <span style={{
                            fontSize: "0.72rem",
                            fontWeight: 700,
                            padding: "2px 8px",
                            borderRadius: "6px",
                            background: "rgba(239, 68, 68, 0.15)",
                            border: "1px solid rgba(239, 68, 68, 0.35)",
                            color: "#f87171",
                            display: "flex",
                            alignItems: "center",
                            gap: "4px"
                          }}>
                            <Key size={12} /> Escalation Override
                          </span>
                        )}
                      </div>

                      <div style={{ fontSize: "0.76rem", color: "var(--text-muted)", textAlign: "right" }}>
                        <div>{new Date(log.timestamp).toLocaleString()} (Local)</div>
                        <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.4)" }}>{new Date(log.timestamp).toISOString()} (UTC)</div>
                      </div>
                    </div>

                    {/* Actor Details */}
                    <div style={{ fontSize: "0.82rem", color: "var(--text-dim)", marginBottom: "8px" }}>
                      <span style={{ fontWeight: 600, color: "#fff" }}>{log.admin_name || "Admin"}</span>
                      {log.admin_email && <span style={{ color: "var(--text-muted)" }}> ({log.admin_email})</span>}
                    </div>

                    {/* Log Details */}
                    <div style={{ fontSize: "0.85rem", color: "var(--text-main)", marginBottom: log.old_value || log.new_value ? "10px" : "0" }}>
                      {log.details}
                    </div>

                    {/* Value Changes (Old vs New) */}
                    {(log.old_value || log.new_value) && (
                      <div style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        background: "rgba(0, 0, 0, 0.3)",
                        padding: "8px 12px",
                        borderRadius: "8px",
                        fontSize: "0.8rem",
                        fontFamily: "monospace"
                      }}>
                        <span style={{ color: "#f87171" }}>- {log.old_value || "None"}</span>
                        <ArrowRight size={14} style={{ color: "var(--text-muted)" }} />
                        <span style={{ color: "#34d399" }}>+ {log.new_value || "None"}</span>
                      </div>
                    )}

                    {/* Escalation Justification */}
                    {log.is_escalated && log.escalation_reason && (
                      <div style={{
                        marginTop: "8px",
                        fontSize: "0.78rem",
                        color: "#fca5a5",
                        background: "rgba(239, 68, 68, 0.08)",
                        padding: "6px 10px",
                        borderRadius: "6px"
                      }}>
                        <strong>Justification:</strong> {log.escalation_reason}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Close Button */}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "24px", borderTop: "1px solid var(--border-subtle)", paddingTop: "16px" }}>
              <button
                type="button"
                onClick={() => {
                  setAuditModalOpen(false);
                  setAuditPoll(null);
                  setAuditLogs([]);
                }}
                className="btn-vox-secondary"
                style={{ padding: "8px 20px" }}
              >
                Close Audit Trail
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
