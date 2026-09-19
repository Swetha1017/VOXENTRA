import React, { useState, useEffect } from "react";
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";

let toastHandler = null;

export const showToast = (message, type = "success", duration = 3000) => {
  if (toastHandler) {
    toastHandler(message, type, duration);
  }
};

export const ToastContainer = () => {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    toastHandler = (message, type = "success", duration = 3000) => {
      const id = Date.now() + Math.random().toString(36).substring(2);
      setToasts((prev) => [...prev, { id, message, type }]);

      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    };

    return () => {
      toastHandler = null;
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: "24px",
        right: "24px",
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        maxWidth: "380px",
        pointerEvents: "none",
      }}
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="animate-fade-in"
          style={{
            pointerEvents: "auto",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            padding: "12px 18px",
            borderRadius: "12px",
            background:
              toast.type === "error"
                ? "rgba(239, 68, 68, 0.92)"
                : toast.type === "info"
                ? "rgba(6, 182, 212, 0.92)"
                : "rgba(16, 185, 129, 0.92)",
            color: "#ffffff",
            boxShadow: "0 10px 25px rgba(0, 0, 0, 0.4)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(255, 255, 255, 0.2)",
            fontSize: "0.9rem",
            fontWeight: 600,
          }}
        >
          {toast.type === "error" && <AlertTriangle size={18} />}
          {toast.type === "info" && <Info size={18} />}
          {toast.type === "success" && <CheckCircle2 size={18} />}
          <span style={{ flex: 1 }}>{toast.message}</span>
          <button
            onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
            style={{
              background: "none",
              border: "none",
              color: "rgba(255, 255, 255, 0.8)",
              cursor: "pointer",
              padding: "2px",
            }}
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
};
