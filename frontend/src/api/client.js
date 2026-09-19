export const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";

export const getWSUrl = (pollId) => {
  const customWs = import.meta.env.VITE_WS_URL;
  if (customWs) {
    return `${customWs}/ws/polls/${pollId}`;
  }
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  if (import.meta.env.DEV) {
    return `ws://localhost:8080/ws/polls/${pollId}`;
  }
  return `${protocol}//${window.location.host}/ws/polls/${pollId}`;
};

export const getPollWSUrl = getWSUrl;

export const getGlobalWSUrl = () => {
  const customWs = import.meta.env.VITE_WS_URL;
  if (customWs) {
    return `${customWs}/ws/live`;
  }
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  if (import.meta.env.DEV) {
    return `ws://localhost:8080/ws/live`;
  }
  return `${protocol}//${window.location.host}/ws/live`;
};

const getHeaders = () => {
  const headers = {
    "Content-Type": "application/json",
  };
  const token = localStorage.getItem("voxentra_token") || localStorage.getItem("token");
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
};

export const api = {
  async get(endpoint) {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      headers: getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Request failed");
    return data;
  },

  async post(endpoint, body) {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: "POST",
      headers: getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Request failed");
    return data;
  },

  async put(endpoint, body) {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: "PUT",
      headers: getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Request failed");
    return data;
  },

  async patch(endpoint, body) {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: "PATCH",
      headers: getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Request failed");
    return data;
  },

  async delete(endpoint) {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: "DELETE",
      headers: getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Request failed");
    return data;
  },
};
