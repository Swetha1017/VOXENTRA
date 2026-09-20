import React, { createContext, useContext, useState, useEffect } from "react";
import { api } from "../api/client";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(
    localStorage.getItem("voxentra_token") || localStorage.getItem("token") || null
  );
  const [loading, setLoading] = useState(true);
  const [authModal, setAuthModal] = useState({ isOpen: false, mode: "register", redirectPollId: null });

  useEffect(() => {
    const fetchUser = async () => {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const userData = await api.get("/api/auth/me");
        setUser(userData);
      } catch (err) {
        console.warn("Session expired or invalid, clearing authentication state:", err.message);
        logout();
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, [token]);

  const login = async (email, password) => {
    const data = await api.post("/api/auth/login", { email, password });
    localStorage.setItem("voxentra_token", data.token);
    setToken(data.token);
    setUser(data.user);
    closeAuthModal();
    return data.user;
  };

  const adminLogin = async (email, password) => {
    const data = await api.post("/api/auth/admin-login", { email, password });
    localStorage.setItem("voxentra_token", data.token);
    setToken(data.token);
    setUser(data.user);
    return data.user;
  };

  const register = async (username, email, password) => {
    const data = await api.post("/api/auth/register", { username, email, password });
    localStorage.setItem("voxentra_token", data.token);
    setToken(data.token);
    setUser(data.user);
    closeAuthModal();
    return data.user;
  };

  const resetPassword = async (email, token, newPassword) => {
    const data = await api.post("/api/auth/reset-password", {
      email,
      token,
      new_password: newPassword,
    });
    return data;
  };

  const logout = () => {
    localStorage.removeItem("voxentra_token");
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
  };

  const openAuthModal = (mode = "register", redirectPollId = null) => {
    setAuthModal({ isOpen: true, mode, redirectPollId });
  };

  const closeAuthModal = () => {
    setAuthModal((prev) => ({ ...prev, isOpen: false }));
  };

  const isAdmin = user?.role === "admin" || user?.email === "swetha4110@gmail.com";

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        adminLogin,
        register,
        resetPassword,
        logout,
        isAuthenticated: !!user,
        isAdmin,
        authModal,
        openAuthModal,
        closeAuthModal,
        setUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    return {
      user: null,
      token: null,
      loading: false,
      login: async () => {},
      adminLogin: async () => {},
      register: async () => {},
      logout: () => {},
      isAuthenticated: false,
      isAdmin: false,
      authModal: { isOpen: false, mode: "register", redirectPollId: null },
      openAuthModal: () => {},
      closeAuthModal: () => {},
      setUser: () => {},
    };
  }
  return context;
};
