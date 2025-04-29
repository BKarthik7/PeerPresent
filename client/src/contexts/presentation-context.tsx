import React, { createContext, useContext, useState, useEffect } from "react";
import { useSocket } from "@/lib/socket";
import { useAuth } from "./auth-context";
import { useToast } from "@/hooks/use-toast";
import { wsUrl } from "@/lib/socket";
import type { Team, PresentationSession, Evaluation, AIFeedback } from "@shared/schema";

// Define custom types for the window object
declare global {
  interface Window {
    screenShareStream: MediaStream | null;
    rtcPeer: RTCPeerConnection | null;
  }
}

// Initialize window global variables
window.screenShareStream = window.screenShareStream || null;
window.rtcPeer = window.rtcPeer || null;

type MemberType = { name: string; usn: string };

type PresentationContextType = {
  activeSession: PresentationSession | null;
  activeTeam: Team | null;
  evaluations: Evaluation[];
  feedback: AIFeedback | null;
  isScreenSharing: boolean;
  peers: { id: number; name: string }[];
  startScreenShare: () => Promise<MediaStream | null>;
  stopScreenShare: () => void;
  submitEvaluation: (evaluation: Omit<Evaluation, "id" | "sessionId" | "peerId" | "submittedAt">) => Promise<void>;
  startPresentation: (teamId: number) => Promise<void>;
  endPresentation: () => Promise<void>;
  uploadTeams: (teams: Omit<Team, "id" | "createdBy">[]) => Promise<void>;
  averageScores: {
    technicalContent: number;
    presentationSkills: number;
    projectDemo: number;
    overall: number;
  } | null;
  timerSeconds: number;
  isTimerRunning: boolean;
  startTimer: () => void;
  pauseTimer: () => void;
  resetTimer: () => void;
  hasSubmittedEvaluation: boolean;
};

const defaultAverageScores = {
  technicalContent: 0,
  presentationSkills: 0,
  projectDemo: 0,
  overall: 0
};

const PresentationContext = createContext<PresentationContextType | undefined>(undefined);

export function PresentationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { toast } = useToast();
  // Only connect to WebSocket if user is authenticated
  const socketUrl = user && user.id ? `${wsUrl}?sessionId=${user.id}` : '';
  // Connect to WebSocket when the user is authenticated
  const [socket, connected] = useSocket(socketUrl);
  
  const [activeSession, setActiveSession] = useState<PresentationSession | null>(null);
  const [activeTeam, setActiveTeam] = useState<Team | null>(null);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [feedback, setFeedback] = useState<AIFeedback | null>(null);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [peers, setPeers] = useState<{ id: number; name: string }[]>([]);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timerInterval, setTimerInterval] = useState<NodeJS.Timeout | null>(null);
  const [hasSubmittedEvaluation, setHasSubmittedEvaluation] = useState(false);
  const [averageScores, setAverageScores] = useState<PresentationContextType["averageScores"]>(null);

  useEffect(() => {
    if (!socket || !connected) return;

    const handleSessionUpdate = (data: { session: PresentationSession; team: Team }) => {
      setActiveSession(data.session);
      setActiveTeam(data.team);
      setEvaluations([]);
      setFeedback(null);
      setHasSubmittedEvaluation(false);
      setAverageScores(null);
      resetTimer();
    };

    const handleSessionEnd = () => {
      setActiveSession(null);
      setActiveTeam(null);
      setIsScreenSharing(false);
      setHasSubmittedEvaluation(false);
      setAverageScores(null);
      resetTimer();
    };

    const handleEvaluationUpdate = (data: { evaluations: Evaluation[]; averages: typeof defaultAverageScores }) => {
      setEvaluations(data.evaluations);
      setAverageScores(data.averages);
    };

    const handleFeedbackUpdate = (data: { feedback: AIFeedback }) => {
      setFeedback(data.feedback);
    };

    const handlePeersUpdate = (data: { peers: { id: number; name: string }[] }) => {
      setPeers(data.peers);
    };

    const handleTimerUpdate = (data: { seconds: number; isRunning: boolean }) => {
      setTimerSeconds(data.seconds);
      setIsTimerRunning(data.isRunning);
    };

    const handleScreenShareStart = () => {
      toast({
        title: "Screen sharing started",
        description: "The presenter has started sharing their screen",
      });
    };

    const handleScreenShareStop = () => {
      toast({
        title: "Screen sharing stopped",
        description: "The presenter has stopped sharing their screen",
      });
    };
    
    const handleStartEvaluation = (data: { teamId: number, teamName: string, projectTitle: string }) => {
      if (user?.isAdmin) return; // Only peers should see this
      
      toast({
        title: "Evaluation Started",
        description: `The admin has requested evaluations for ${data.teamName}. Please submit your feedback.`,
      });
    };

    const handleSocketMessage = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data);
        console.log("WS message:", message);

        switch (message.type) {
          case "session_update":
            handleSessionUpdate(message.payload);
            break;
          case "session_end":
            handleSessionEnd();
            break;
          case "evaluation_update":
            handleEvaluationUpdate(message.payload);
            break;
          case "feedback_update":
            handleFeedbackUpdate(message.payload);
            break;
          case "peers_update":
            handlePeersUpdate(message.payload);
            break;
          case "timer_update":
            handleTimerUpdate(message.payload);
            break;
          case "screen_share_start":
            if (!user?.isAdmin) { // Only show this toast for non-admin users (peers)
              handleScreenShareStart();
            }
            break;
          case "screen_share_stop":
            if (!user?.isAdmin) { // Only show this toast for non-admin users (peers)
              handleScreenShareStop();
            }
            break;
          case "start_evaluation":
            handleStartEvaluation(message.payload);
            break;
          case "error":
            toast({
              title: "Error",
              description: message.payload?.message || "An error occurred",
              variant: "destructive",
            });
            break;
        }
      } catch (error) {
        console.error("Error handling WebSocket message:", error);
      }
    };

    socket.addEventListener("message", handleSocketMessage);

    // Request initial state when connecting, but only if socket is in OPEN state
    if (connected && socket.readyState === WebSocket.OPEN) {
      try {
        socket.send(JSON.stringify({ type: "get_state" }));
      } catch (error) {
        console.error("Error sending initial state request:", error);
      }
    }

    return () => {
      if (socket) {
        socket.removeEventListener("message", handleSocketMessage);
      }
    };
  }, [socket, connected, toast, user]);

  // Handle local timer when it's running
  useEffect(() => {
    if (isTimerRunning && !timerInterval) {
      const interval = setInterval(() => {
        setTimerSeconds(prev => prev + 1);
      }, 1000);
      setTimerInterval(interval);
    } else if (!isTimerRunning && timerInterval) {
      clearInterval(timerInterval);
      setTimerInterval(null);
    }

    return () => {
      if (timerInterval) {
        clearInterval(timerInterval);
      }
    };
  }, [isTimerRunning, timerInterval]);

  const startScreenShare = async () => {
    try {
      if (!socket || !connected) {
        throw new Error("Not connected to server");
      }

      const peer = window.rtcPeer;
      if (!peer) {
        // Initialize peer if not already initialized
        const pc = new RTCPeerConnection({
          iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:stun1.l.google.com:19302" },
          ],
        });
        
        window.rtcPeer = pc;
        
        // Handle ICE candidates
        pc.onicecandidate = (event) => {
          if (event.candidate && socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({
              type: "ice_candidate",
              payload: {
                candidate: event.candidate,
              },
            }));
          }
        };
        
        // Set up message handlers for WebRTC signaling
        if (socket) {
          const handleRTCMessage = (event: MessageEvent) => {
            try {
              const data = JSON.parse(event.data);
              
              if (data.type === "answer" && pc.signalingState !== "stable") {
                pc.setRemoteDescription(new RTCSessionDescription(data.payload.sdp));
              }
              
              if (data.type === "ice_candidate") {
                pc.addIceCandidate(new RTCIceCandidate(data.payload.candidate));
              }
            } catch (err) {
              console.error("Error handling RTC message:", err);
            }
          };
          
          socket.addEventListener("message", handleRTCMessage);
        }
      }

      // Request screen sharing permission from browser
      const mediaStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });

      // Store the media stream for later reference
      window.screenShareStream = mediaStream;
      
      // Add tracks to peer connection
      // Notify server that screen sharing has started
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ 
          type: "screen_share_start"
        }));
      } else {
        console.warn("Socket not open, unable to send screen share start message");
      }
      
      // Handle WebRTC if peer connection exists
      if (window.rtcPeer) {
        mediaStream.getTracks().forEach(track => {
          if (window.rtcPeer) {
            window.rtcPeer.addTrack(track, mediaStream);
          }
        });
        
        // Create and send offer
        const offer = await window.rtcPeer.createOffer();
        await window.rtcPeer.setLocalDescription(offer);
          
        // Send the WebRTC offer if socket is open
        if (socket.readyState === WebSocket.OPEN && window.rtcPeer.localDescription) {
          socket.send(JSON.stringify({
            type: "offer",
            payload: {
              sdp: window.rtcPeer.localDescription
            }
          }));
        }
      }
      
      setIsScreenSharing(true);

      // Handle when user stops sharing screen
      const tracks = mediaStream.getTracks();
      tracks.forEach(track => {
        track.onended = () => {
          stopScreenShare();
        };
      });

      console.log("Screen sharing started successfully");
      toast({
        title: "Screen sharing started",
        description: "Your screen is now being shared with connected peers",
      });
      
      return mediaStream;
    } catch (error) {
      console.error("Screen sharing error:", error);
      toast({
        title: "Screen sharing failed",
        description: error instanceof Error ? error.message : "Failed to start screen sharing",
        variant: "destructive",
      });
      return null;
    }
  };

  const stopScreenShare = () => {
    // Stop all tracks in the media stream
    if (window.screenShareStream) {
      window.screenShareStream.getTracks().forEach((track: MediaStreamTrack) => {
        track.stop();
      });
      window.screenShareStream = null;
    }

    if (socket && connected) {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "screen_share_stop" }));
      } else {
        console.warn("Socket not open, unable to send screen share stop message");
      }
      setIsScreenSharing(false);
      
      toast({
        title: "Screen sharing stopped",
        description: "Your screen is no longer being shared",
      });
    }
  };

  const submitEvaluation = async (evaluation: Omit<Evaluation, "id" | "sessionId" | "peerId" | "submittedAt">) => {
    try {
      if (!socket || !connected) {
        throw new Error("Not connected to server");
      }

      if (!activeSession) {
        throw new Error("No active presentation session");
      }

      if (!user) {
        throw new Error("You must be logged in to submit an evaluation");
      }

      const payload = {
        ...evaluation,
        sessionId: activeSession.id,
        submittedAt: new Date().toISOString(),
      };

      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ 
          type: "submit_evaluation", 
          payload 
        }));
      } else {
        throw new Error("WebSocket connection not open. Please try again.");
      }

      setHasSubmittedEvaluation(true);
      
      toast({
        title: "Evaluation submitted",
        description: "Thank you for your feedback!",
      });
    } catch (error) {
      console.error("Evaluation submission error:", error);
      toast({
        title: "Submission failed",
        description: error instanceof Error ? error.message : "Failed to submit evaluation",
        variant: "destructive",
      });
    }
  };

  const startPresentation = async (teamId: number) => {
    try {
      if (!socket || !connected) {
        throw new Error("Not connected to server");
      }

      if (!user?.isAdmin) {
        throw new Error("Only admins can start presentations");
      }

      socket.send(JSON.stringify({ 
        type: "start_presentation", 
        payload: { teamId } 
      }));

    } catch (error) {
      console.error("Start presentation error:", error);
      toast({
        title: "Failed to start presentation",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
      throw error;
    }
  };

  const endPresentation = async () => {
    try {
      if (!socket || !connected) {
        throw new Error("Not connected to server");
      }

      if (!user?.isAdmin) {
        throw new Error("Only admins can end presentations");
      }

      if (!activeSession) {
        throw new Error("No active presentation to end");
      }

      socket.send(JSON.stringify({ 
        type: "end_presentation", 
        payload: { sessionId: activeSession.id } 
      }));

    } catch (error) {
      console.error("End presentation error:", error);
      toast({
        title: "Failed to end presentation",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
      throw error;
    }
  };

  const uploadTeams = async (teams: Omit<Team, "id" | "createdBy">[]) => {
    try {
      if (!user?.isAdmin) {
        throw new Error("Only admins can upload teams");
      }

      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teams }),
        credentials: "include",
      });

      if (!res.ok) {
        const error = await res.text();
        throw new Error(error || "Failed to upload teams");
      }

      toast({
        title: "Teams uploaded",
        description: `Successfully uploaded ${teams.length} teams`,
      });
    } catch (error) {
      console.error("Team upload error:", error);
      toast({
        title: "Team upload failed",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
      throw error;
    }
  };

  const startTimer = () => {
    if (socket && connected && user?.isAdmin) {
      socket.send(JSON.stringify({ type: "timer_start" }));
    }
  };

  const pauseTimer = () => {
    if (socket && connected && user?.isAdmin) {
      socket.send(JSON.stringify({ type: "timer_pause" }));
    }
  };

  const resetTimer = () => {
    if (socket && connected && user?.isAdmin) {
      socket.send(JSON.stringify({ type: "timer_reset" }));
    } else {
      setTimerSeconds(0);
      setIsTimerRunning(false);
      if (timerInterval) {
        clearInterval(timerInterval);
        setTimerInterval(null);
      }
    }
  };

  return (
    <PresentationContext.Provider
      value={{
        activeSession,
        activeTeam,
        evaluations,
        feedback,
        isScreenSharing,
        peers,
        startScreenShare,
        stopScreenShare,
        submitEvaluation,
        startPresentation,
        endPresentation,
        uploadTeams,
        averageScores,
        timerSeconds,
        isTimerRunning,
        startTimer,
        pauseTimer,
        resetTimer,
        hasSubmittedEvaluation,
      }}
    >
      {children}
    </PresentationContext.Provider>
  );
}

export function usePresentation() {
  const context = useContext(PresentationContext);
  if (context === undefined) {
    throw new Error("usePresentation must be used within a PresentationProvider");
  }
  return context;
}
