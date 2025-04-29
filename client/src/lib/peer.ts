import { useEffect, useState } from "react";
import { useSocket } from "./socket";

// Simple WebRTC peer connection wrapper
export function usePeer(isInitiator: boolean = false): {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  error: Error | null;
  startScreenSharing: () => Promise<void>;
  stopScreenSharing: () => void;
} {
  const [socket, connected] = useSocket();
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [peerConnection, setPeerConnection] = useState<RTCPeerConnection | null>(null);
  const [error, setError] = useState<Error | null>(null);

  // Initialize WebRTC peer connection
  useEffect(() => {
    if (!connected || !socket) return;

    try {
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
        ],
      });

      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.send(JSON.stringify({
            type: "ice_candidate",
            payload: {
              candidate: event.candidate,
            },
          }));
        }
      };

      // Handle remote stream
      pc.ontrack = (event) => {
        setRemoteStream(event.streams[0]);
      };

      // Handle negotiation needed
      pc.onnegotiationneeded = async () => {
        if (isInitiator) {
          try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socket.send(JSON.stringify({
              type: "offer",
              payload: {
                sdp: pc.localDescription,
              },
            }));
          } catch (err) {
            setError(err as Error);
            console.error("Error creating offer:", err);
          }
        }
      };

      setPeerConnection(pc);

      // Handle WebRTC signaling messages
      const handleMessage = (event: MessageEvent) => {
        const message = JSON.parse(event.data);

        switch (message.type) {
          case "offer":
            handleOffer(pc, message.payload.sdp);
            break;
          case "answer":
            handleAnswer(pc, message.payload.sdp);
            break;
          case "ice_candidate":
            handleIceCandidate(pc, message.payload.candidate);
            break;
        }
      };

      socket.addEventListener("message", handleMessage);

      return () => {
        socket.removeEventListener("message", handleMessage);
        pc.close();
      };
    } catch (err) {
      setError(err as Error);
      console.error("Error setting up peer connection:", err);
    }
  }, [connected, socket, isInitiator]);

  // Handle incoming offer
  const handleOffer = async (pc: RTCPeerConnection, sdp: RTCSessionDescription) => {
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      
      if (socket) {
        socket.send(JSON.stringify({
          type: "answer",
          payload: {
            sdp: pc.localDescription,
          },
        }));
      }
    } catch (err) {
      setError(err as Error);
      console.error("Error handling offer:", err);
    }
  };

  // Handle incoming answer
  const handleAnswer = async (pc: RTCPeerConnection, sdp: RTCSessionDescription) => {
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    } catch (err) {
      setError(err as Error);
      console.error("Error handling answer:", err);
    }
  };

  // Handle incoming ICE candidate
  const handleIceCandidate = async (pc: RTCPeerConnection, candidate: RTCIceCandidate) => {
    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      setError(err as Error);
      console.error("Error handling ICE candidate:", err);
    }
  };

  // Start screen sharing
  const startScreenSharing = async () => {
    try {
      if (!peerConnection) {
        throw new Error("Peer connection not initialized");
      }

      // Get screen sharing stream
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });

      // Add tracks to peer connection
      stream.getTracks().forEach((track) => {
        if (!peerConnection) return;
        peerConnection.addTrack(track, stream);
      });

      setLocalStream(stream);

      // Handle when user stops sharing screen
      stream.getVideoTracks()[0].onended = () => {
        stopScreenSharing();
      };
    } catch (err) {
      setError(err as Error);
      console.error("Error starting screen sharing:", err);
    }
  };

  // Stop screen sharing
  const stopScreenSharing = () => {
    if (localStream) {
      localStream.getTracks().forEach((track) => {
        track.stop();
      });
      setLocalStream(null);
    }
  };

  return {
    localStream,
    remoteStream,
    error,
    startScreenSharing,
    stopScreenSharing,
  };
}
