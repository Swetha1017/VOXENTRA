import { useEffect, useState, useRef } from "react";
import { getWSUrl } from "../api/client";

export const usePollWebSocket = (pollId) => {
  const [isConnected, setIsConnected] = useState(false);
  const [liveUpdate, setLiveUpdate] = useState(null);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  useEffect(() => {
    if (!pollId) return;

    let isMounted = true;

    const connect = () => {
      const url = getWSUrl(pollId);
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!isMounted) return;
        setIsConnected(true);
      };

      ws.onmessage = (event) => {
        if (!isMounted) return;
        try {
          const data = JSON.parse(event.data);
          setLiveUpdate(data);
        } catch (e) {
          console.error("Failed to parse WS message", e);
        }
      };

      ws.onclose = () => {
        if (!isMounted) return;
        setIsConnected(false);
        // Attempt reconnect after 3 seconds
        reconnectTimeoutRef.current = setTimeout(connect, 3000);
      };

      ws.onerror = (err) => {
        console.warn("WebSocket encountered error:", err);
        ws.close();
      };
    };

    connect();

    return () => {
      isMounted = false;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [pollId]);

  return { isConnected, liveUpdate };
};
