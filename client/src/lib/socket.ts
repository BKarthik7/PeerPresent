import { useState, useEffect } from "react";

export const wsUrl = (() => {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/ws`;
})();

export function useSocket(url: string): [WebSocket | null, boolean] {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const ws = new WebSocket(url);

    ws.addEventListener("open", () => {
      console.log("WebSocket connected");
      setConnected(true);
    });

    ws.addEventListener("close", () => {
      console.log("WebSocket disconnected");
      setConnected(false);
      
      // Attempt to reconnect after a delay
      setTimeout(() => {
        console.log("Attempting to reconnect...");
        setSocket(null);
      }, 3000);
    });

    ws.addEventListener("error", (error) => {
      console.error("WebSocket error:", error);
    });

    setSocket(ws);

    return () => {
      ws.close();
    };
  }, [url]);

  return [socket, connected];
}
