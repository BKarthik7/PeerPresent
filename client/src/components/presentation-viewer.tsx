import { useRef, useState, useEffect } from "react";
import { usePresentation } from "@/contexts/presentation-context";
import { Button } from "@/components/ui/button";
import { Maximize2 } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useSocket } from "@/lib/socket";

export function PresentationViewer() {
  const { 
    activeSession, 
    activeTeam, 
    timerSeconds,
    isScreenSharing
  } = usePresentation();
  
  const { user } = useAuth();
  const [socket, connected] = useSocket();
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const handleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Initialize WebRTC for receiving screen share
  useEffect(() => {
    if (!socket || !connected || user?.isAdmin) return;
    
    // Initialize peer connection if not admin (only peers receive screen share)
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ],
    });
    
    peerConnectionRef.current = pc;
    
    // Handle incoming tracks (screen share)
    pc.ontrack = (event) => {
      console.log("Received remote track:", event.streams[0]);
      if (videoRef.current) {
        videoRef.current.srcObject = event.streams[0];
      }
    };
    
    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
          type: "ice_candidate",
          payload: {
            candidate: event.candidate,
          },
        }));
      }
    };
    
    // Handle WebRTC signaling messages
    const handleRTCMessage = async (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        
        // Handle offer (from admin sharing screen)
        if (data.type === "offer" && pc.signalingState !== "have-remote-offer") {
          console.log("Received offer:", data.payload.sdp);
          await pc.setRemoteDescription(new RTCSessionDescription(data.payload.sdp));
          
          // Create and send answer
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({
              type: "answer",
              payload: {
                sdp: pc.localDescription
              }
            }));
          }
        }
        
        // Handle ICE candidates (from admin)
        if (data.type === "ice_candidate" && data.payload.candidate) {
          console.log("Received ICE candidate");
          pc.addIceCandidate(new RTCIceCandidate(data.payload.candidate))
            .catch(err => console.error("Error adding ICE candidate:", err));
        }
      } catch (err) {
        console.error("Error handling RTC message:", err);
      }
    };
    
    if (socket) {
      socket.addEventListener("message", handleRTCMessage);
    }
    
    return () => {
      if (socket) {
        socket.removeEventListener("message", handleRTCMessage);
      }
      
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }
    };
  }, [socket, connected, user]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Format timer as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div 
      ref={containerRef}
      className="flex-grow bg-black p-4 flex items-center justify-center relative"
    >
      <div className="w-full h-full flex items-center justify-center">
        {!isScreenSharing ? (
          <div className="text-center text-white opacity-80">
            <div className="text-6xl mb-4">📊</div>
            <h3 className="text-xl font-google-sans font-medium mb-2">No Active Presentation</h3>
            <p className="text-sm text-gray-300">
              {activeSession 
                ? "Waiting for the presenter to share their screen." 
                : "Waiting for a presentation to start."}
            </p>
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              className="max-w-full max-h-full object-contain"
            ></video>
          </div>
        )}
      </div>
      
      {/* Presentation Info */}
      {activeSession && activeTeam && (
        <div className="absolute bottom-4 left-4 bg-black bg-opacity-70 text-white px-3 py-2 rounded-md text-sm">
          <div>{activeTeam.name}: {activeTeam.projectTitle}</div>
          <div className="text-xs opacity-75">{formatTime(timerSeconds)} elapsed</div>
        </div>
      )}
      
      {/* Full Screen Button */}
      <Button 
        variant="ghost" 
        size="icon"
        className="absolute bottom-4 right-4 bg-black bg-opacity-70 text-white rounded-md hover:bg-black hover:bg-opacity-90"
        onClick={handleFullscreen}
      >
        <Maximize2 className="h-5 w-5" />
      </Button>
    </div>
  );
}
