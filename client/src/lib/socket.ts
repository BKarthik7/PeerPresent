import { useState, useEffect } from "react";

export const wsUrl = (() => {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/ws`;
})();

export function useSocket(url: string): [WebSocket | null, boolean] {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);

  useEffect(() => {
    if (!url) {
      console.log("No WebSocket URL provided, not connecting");
      return;
    }

    let ws: WebSocket;
    let reconnectTimer: NodeJS.Timeout | null = null;
    let destroyed = false; // Flag to track if the effect cleanup has run
    
    const connect = () => {
      if (destroyed) return;
      
      console.log(`Connecting to WebSocket (attempt ${reconnectAttempt + 1}):`, url);
      
      try {
        ws = new WebSocket(url);
        
        ws.addEventListener("open", () => {
          console.log("WebSocket connected successfully");
          setConnected(true);
          setReconnectAttempt(0); // Reset reconnect attempts on successful connection
        });
    
        ws.addEventListener("close", (event) => {
          if (destroyed) return;
          
          console.log(`WebSocket disconnected with code: ${event.code}, reason: ${event.reason || 'none'}`);
          setConnected(false);
          
          // Calculate exponential backoff delay (capped at 30 seconds)
          const backoffDelay = Math.min(1000 * Math.pow(1.5, reconnectAttempt), 30000);
          console.log(`Reconnecting in ${backoffDelay / 1000} seconds...`);
          
          // Attempt to reconnect with exponential backoff
          reconnectTimer = setTimeout(() => {
            setReconnectAttempt(prev => prev + 1);
            setSocket(null); // This will trigger the effect to run again
          }, backoffDelay);
        });
    
        ws.addEventListener("error", (error) => {
          console.error("WebSocket error:", error);
          // Error handling is done by the close event which follows
        });
    
        setSocket(ws);
      } catch (error) {
        console.error("Error creating WebSocket:", error);
        setConnected(false);
        
        if (!destroyed) {
          // Attempt to reconnect after a delay on connection error
          reconnectTimer = setTimeout(() => {
            setReconnectAttempt(prev => prev + 1);
            setSocket(null);
          }, 5000);
        }
      }
    };

    connect();

    return () => {
      destroyed = true;
      
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
      
      if (ws && ws.readyState !== WebSocket.CLOSED) {
        ws.close();
      }
    };
  }, [url, reconnectAttempt]);

  return [socket, connected];
}
