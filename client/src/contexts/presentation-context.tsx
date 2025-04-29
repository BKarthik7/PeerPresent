import React, { createContext, useContext, useState, useEffect } from "react";
import { useSocket } from "@/lib/socket";
import { useAuth } from "./auth-context";
import { useToast } from "@/hooks/use-toast";
import { wsUrl } from "@/lib/socket";
import type { Team, PresentationSession, Evaluation, AIFeedback } from "@shared/schema";

type MemberType = { name: string; usn: string };

type PresentationContextType = {
  activeSession: PresentationSession | null;
  activeTeam: Team | null;
  evaluations: Evaluation[];
  feedback: AIFeedback | null;
  isScreenSharing: boolean;
  peers: { id: number; name: string }[];
  startScreenShare: () => Promise<void>;
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
  // Construct WebSocket URL with sessionId if user is authenticated
  const socketUrl = user ? `${wsUrl}?sessionId=${user.id}` : wsUrl;
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

    socket.addEventListener("message", (event) => {
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
          handleScreenShareStart();
          break;
        case "screen_share_stop":
          handleScreenShareStop();
          break;
      }
    });

    // Request initial state when connecting
    if (connected) {
      socket.send(JSON.stringify({ type: "get_state" }));
    }

    return () => {
      if (socket) {
        socket.removeEventListener("message", () => {});
      }
    };
  }, [socket, connected, toast]);

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

      if (!activeSession) {
        throw new Error("No active presentation session");
      }

      // Request screen sharing permission from browser
      const mediaStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });

      // Notify server that screen sharing has started
      socket.send(JSON.stringify({ type: "screen_share_start" }));
      setIsScreenSharing(true);

      // Handle when user stops sharing screen
      const tracks = mediaStream.getTracks();
      tracks.forEach(track => {
        track.onended = () => {
          stopScreenShare();
        };
      });

      // The actual WebRTC connection would be handled in peer.ts
      // This is simplified for this implementation

    } catch (error) {
      console.error("Screen sharing error:", error);
      toast({
        title: "Screen sharing failed",
        description: error instanceof Error ? error.message : "Failed to start screen sharing",
        variant: "destructive",
      });
    }
  };

  const stopScreenShare = () => {
    if (socket && connected) {
      socket.send(JSON.stringify({ type: "screen_share_stop" }));
      setIsScreenSharing(false);
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

      socket.send(JSON.stringify({ 
        type: "submit_evaluation", 
        payload 
      }));

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
