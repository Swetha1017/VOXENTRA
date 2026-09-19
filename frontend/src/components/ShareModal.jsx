import React, { useState, useEffect } from "react";
import QRCode from "qrcode";
import { X, Copy, Check, Share2, QrCode, ArrowRight, ExternalLink, Sparkles } from "lucide-react";
import { api } from "../api/client";
import { showToast } from "./Toast";

export const ShareModal = ({ poll, game, isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [joinCodeInput, setJoinCodeInput] = useState("");

  const targetTitle = poll?.title || game?.title || "Voxentra Live Arena";
  const targetId = poll?.id ? `poll-${poll.id}` : game?.id ? `games` : "home";
  const sessionCode = (poll?.id ? poll.id.slice(-4) : game?.id ? game.id.slice(0, 4) : "VOX7").toUpperCase();
  const shareUrl = `${window.location.origin}/#${targetId}?code=${sessionCode}`;

  useEffect(() => {
    if (isOpen) {
      QRCode.toDataURL(shareUrl, {
        width: 220,
        margin: 2,
        color: {
          dark: "#ffffff",
          light: "#0b0e20",
        },
      })
        .then((url) => setQrDataUrl(url))
        .catch((err) => console.error(err));

      // Track referral click for analytics
      api.post(`/api/polls/referral/share_view`, {}).catch(() => {});
    }
  }, [isOpen, shareUrl]);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    showToast("Invitation link copied to clipboard!");
    setTimeout(() => setCopied(false), 2200);
  };

  const handleSocialShare = (platform) => {
    const text = encodeURIComponent(`Vote & Play live on Voxentra: "${targetTitle}"`);
    const encodedUrl = encodeURIComponent(`${shareUrl}&src=${platform}`);
    let url = "";

    if (platform === "whatsapp") {
      url = `https://api.whatsapp.com/send?text=${text}%20${encodedUrl}`;
    } else if (platform === "facebook") {
      url = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
    } else if (platform === "twitter") {
      url = `https://twitter.com/intent/tweet?text=${text}&url=${encodedUrl}`;
    } else if (platform === "instagram") {
      // Instagram doesn't have direct web link sharing; copy link and notify user
      navigator.clipboard.writeText(`${targetTitle} - Join live: ${shareUrl}`);
      showToast("Link copied! Paste into Instagram Stories or Bio 📸", "info");
      return;
    } else if (platform === "telegram") {
      url = `https://t.me/share/url?url=${encodedUrl}&text=${text}`;
    } else if (platform === "linkedin") {
      url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`;
    }

    if (url) {
      window.open(url, "_blank", "noopener,noreferrer");
      api.post(`/api/polls/referral/${platform}`, {}).catch(() => {});
    }
  };

  const handleJoinByCode = (e) => {
    e.preventDefault();
    const clean = joinCodeInput.trim().toUpperCase();
    if (!clean) return;
    window.location.hash = `poll-${clean}`;
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "520px" }}>
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: "18px",
            right: "18px",
            background: "rgba(255, 255, 255, 0.05)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "50%",
            width: "32px",
            height: "32px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--text-muted)",
            cursor: "pointer",
          }}
        >
          <X size={18} />
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
          <div style={{
            width: "42px",
            height: "42px",
            borderRadius: "12px",
            background: "linear-gradient(135deg, #06b6d4 0%, #8b5cf6 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 0 15px rgba(139, 92, 246, 0.4)",
          }}>
            <Share2 size={20} color="#ffffff" />
          </div>
          <div>
            <h3 style={{ fontSize: "1.3rem", fontWeight: 800, color: "#ffffff" }}>Share & Invite Friends</h3>
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
              Invite friends to vote and play! Earn bonus XP for every voter you invite.
            </p>
          </div>
        </div>

        {/* Live Invitation Preview Card */}
        <div style={{
          background: "linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(6, 182, 212, 0.08) 100%)",
          border: "1px solid rgba(139, 92, 246, 0.25)",
          borderRadius: "14px",
          padding: "16px",
          marginBottom: "18px",
          display: "flex",
          alignItems: "center",
          gap: "16px",
        }}>
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt="Scan QR"
              style={{
                width: "90px",
                height: "90px",
                borderRadius: "10px",
                border: "2px solid #8b5cf6",
                boxShadow: "0 0 15px rgba(139, 92, 246, 0.3)",
              }}
            />
          ) : (
            <div style={{ width: "90px", height: "90px", display: "flex", alignItems: "center", justifyContent: "center", background: "#0b0e20", borderRadius: "10px" }}>
              <QrCode size={36} color="#8b5cf6" />
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: "0.72rem", background: "rgba(6, 182, 212, 0.15)", color: "#22d3ee", padding: "2px 8px", borderRadius: "9999px", fontWeight: 700 }}>
              SESSION CODE: {sessionCode}
            </span>
            <h4 style={{ fontSize: "0.95rem", fontWeight: 700, color: "#ffffff", marginTop: "6px", marginBottom: "4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {targetTitle}
            </h4>
            <p style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
              Scan QR code with smartphone to vote instantly without typing URL
            </p>
          </div>
        </div>

        {/* Copy Link Input */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "18px" }}>
          <input
            type="text"
            readOnly
            value={shareUrl}
            className="vox-input"
            style={{ fontSize: "0.85rem", background: "rgba(0, 0, 0, 0.4)", flex: 1 }}
          />
          <button
            className="btn-vox-primary"
            onClick={handleCopy}
            style={{ whiteSpace: "nowrap", padding: "10px 18px", display: "flex", alignItems: "center", gap: "6px" }}
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
            <span>{copied ? "Copied!" : "Copy Link"}</span>
          </button>
        </div>

        {/* Social Share Buttons */}
        <div style={{ marginBottom: "18px" }}>
          <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", marginBottom: "10px", letterSpacing: "0.05em" }}>
            Direct Social Platforms
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px" }}>
            <button
              onClick={() => handleSocialShare("whatsapp")}
              style={{
                padding: "10px",
                borderRadius: "10px",
                background: "rgba(37, 211, 102, 0.12)",
                border: "1px solid rgba(37, 211, 102, 0.3)",
                color: "#25d366",
                fontWeight: 600,
                fontSize: "0.8rem",
                cursor: "pointer",
              }}
            >
              WhatsApp
            </button>

            <button
              onClick={() => handleSocialShare("facebook")}
              style={{
                padding: "10px",
                borderRadius: "10px",
                background: "rgba(24, 119, 242, 0.12)",
                border: "1px solid rgba(24, 119, 242, 0.3)",
                color: "#1877f2",
                fontWeight: 600,
                fontSize: "0.8rem",
                cursor: "pointer",
              }}
            >
              Facebook
            </button>

            <button
              onClick={() => handleSocialShare("twitter")}
              style={{
                padding: "10px",
                borderRadius: "10px",
                background: "rgba(255, 255, 255, 0.08)",
                border: "1px solid rgba(255, 255, 255, 0.2)",
                color: "#ffffff",
                fontWeight: 600,
                fontSize: "0.8rem",
                cursor: "pointer",
              }}
            >
              X / Twitter
            </button>

            <button
              onClick={() => handleSocialShare("instagram")}
              style={{
                padding: "10px",
                borderRadius: "10px",
                background: "rgba(225, 48, 108, 0.12)",
                border: "1px solid rgba(225, 48, 108, 0.3)",
                color: "#e1306c",
                fontWeight: 600,
                fontSize: "0.8rem",
                cursor: "pointer",
              }}
            >
              Instagram
            </button>
          </div>
        </div>

        {/* Quick Join Session Code Input */}
        <form onSubmit={handleJoinByCode} style={{ display: "flex", gap: "8px", background: "rgba(0,0,0,0.3)", padding: "12px", borderRadius: "12px", border: "1px solid var(--border-subtle)" }}>
          <input
            type="text"
            placeholder="Have a 4-letter Code? e.g. 7XQ9"
            value={joinCodeInput}
            onChange={(e) => setJoinCodeInput(e.target.value)}
            className="vox-input"
            style={{ fontSize: "0.85rem", textTransform: "uppercase" }}
          />
          <button type="submit" className="btn-vox-secondary" style={{ padding: "8px 16px", whiteSpace: "nowrap" }}>
            Join Session <ArrowRight size={14} />
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: "14px" }}>
          <span className="script-accent" style={{ fontSize: "1.2rem" }}>
            Small Votes, Big Impact 💜
          </span>
        </div>
      </div>
    </div>
  );
};
