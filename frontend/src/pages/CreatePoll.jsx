import React, { useState } from "react";
import { api } from "../api/client";
import { Plus, Trash2, HelpCircle, ArrowRight, AlertCircle, CheckCircle2 } from "lucide-react";

export const CreatePoll = ({ navigate }) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleOptionChange = (index, value) => {
    const updated = [...options];
    updated[index] = value;
    setOptions(updated);
  };

  const addOption = () => {
    if (options.length < 10) {
      setOptions([...options, ""]);
    }
  };

  const removeOption = (index) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setError("Please enter a question or title for your poll.");
      return;
    }

    const cleanOptions = options.map((o) => o.trim()).filter(Boolean);
    if (cleanOptions.length < 2) {
      setError("At least two non-empty options are required.");
      return;
    }

    // Check duplicates
    const unique = new Set(cleanOptions.map((o) => o.toLowerCase()));
    if (unique.size !== cleanOptions.length) {
      setError("All options must be unique.");
      return;
    }

    setLoading(true);
    try {
      const poll = await api.post("/api/polls", {
        title: cleanTitle,
        description: description.trim(),
        options: cleanOptions,
      });

      // Navigate straight to the created live poll
      navigate(`poll-${poll.id}`);
    } catch (err) {
      setError(err.message || "Failed to create poll");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: "640px", margin: "40px auto", padding: "0 16px" }}>
      <div className="glass-card" style={{ padding: "36px" }}>
        <div style={{ marginBottom: "28px" }}>
          <h2 style={{ fontSize: "1.75rem", fontWeight: 700 }}>Create a Live Poll</h2>
          <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginTop: "4px" }}>
            Ask a question, define choices, and share the live stream link with your audience.
          </p>
        </div>

        {error && (
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "12px",
            background: "rgba(244, 63, 94, 0.15)",
            border: "1px solid rgba(244, 63, 94, 0.3)",
            borderRadius: "var(--radius-md)",
            color: "#fda4af",
            fontSize: "0.85rem",
            marginBottom: "20px",
          }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Question / Title */}
          <div style={{ marginBottom: "20px" }}>
            <label className="form-label">
              Poll Question <span style={{ color: "var(--accent-rose)" }}>*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. What is your favorite backend programming language?"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="form-input"
            />
          </div>

          {/* Description (Optional) */}
          <div style={{ marginBottom: "24px" }}>
            <label className="form-label">Context or Description (Optional)</label>
            <textarea
              placeholder="Add extra context or instructions for voters..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="form-input"
              rows={2}
              style={{ resize: "vertical" }}
            />
          </div>

          {/* Options List */}
          <div style={{ marginBottom: "28px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <label className="form-label" style={{ marginBottom: 0 }}>
                Voting Options (Min 2, Max 10)
              </label>
              <span style={{ fontSize: "0.8rem", color: "var(--text-dim)" }}>
                {options.length} of 10
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {options.map((opt, idx) => (
                <div key={idx} style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <span style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "6px",
                    background: "rgba(255, 255, 255, 0.05)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    color: "var(--text-muted)",
                    flexShrink: 0,
                  }}>
                    {String.fromCharCode(65 + idx)}
                  </span>
                  <input
                    type="text"
                    required
                    placeholder={`Option ${idx + 1}`}
                    value={opt}
                    onChange={(e) => handleOptionChange(idx, e.target.value)}
                    className="form-input"
                  />
                  {options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeOption(idx)}
                      style={{
                        padding: "8px",
                        background: "rgba(244, 63, 94, 0.1)",
                        border: "none",
                        borderRadius: "var(--radius-sm)",
                        color: "#fda4af",
                      }}
                      title="Remove option"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {options.length < 10 && (
              <button
                type="button"
                onClick={addOption}
                className="btn-secondary"
                style={{ marginTop: "12px", width: "100%", justifyContent: "center" }}
              >
                <Plus size={16} />
                <span>Add Another Option</span>
              </button>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary"
            style={{ width: "100%", justifyContent: "center", padding: "14px", fontSize: "1rem" }}
          >
            {loading ? "Publishing Poll..." : "Publish Live Poll"}
            <ArrowRight size={18} />
          </button>
        </form>
      </div>
    </div>
  );
};
