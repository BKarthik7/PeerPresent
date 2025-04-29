import { useState, useEffect } from "react";

export const wsUrl = (() => {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/ws`;
})();

export function useSocket(url: string): [WebSocket | null, boolean] {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!url) {
      console.log("No WebSocket URL provided, not connecting");
      return;
    }

    console.log("Connecting to WebSocket:", url);
    let ws: WebSocket;
    
    try {
      ws = new WebSocket(url);
      
      ws.addEventListener("open", () => {
        console.log("WebSocket connected successfully");
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
    } catch (error) {
      console.error("Error creating WebSocket:", error);
      setConnected(false);
      
      // Attempt to reconnect after a delay on connection error
      setTimeout(() => {
        console.log("Attempting to reconnect after error...");
        setSocket(null);
      }, 5000);
      
      return;
    }

    return () => {
      if (ws && ws.readyState !== WebSocket.CLOSED) {
        ws.close();
      }
    };
  }, [url]);

  return [socket, connected];
}
