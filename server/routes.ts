import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { generateAIFeedback } from "./ai";
import { z } from "zod";
import { 
  insertPeerSchema, 
  insertTeamSchema,
  insertEvaluationSchema,
  peerLoginSchema
} from "@shared/schema";

// Extend Express Request to include session
declare module 'express-session' {
  interface SessionData {
    userId?: number;
    isAdmin?: boolean;
  }
}

// Simplify request type with session
type RequestWithSession = Request & { 
  session: {
    userId?: number;
    isAdmin?: boolean;
    destroy: (callback: (err: Error | null) => void) => void;
  } 
};

type Client = {
  socket: WebSocket;
  userId: number;
  isAdmin: boolean;
};

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  
  // Create WebSocket server
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  // Store connected clients
  const clients: Map<WebSocket, Client> = new Map();
  
  // Store presentation state
  let activeSession: any = null;
  let activeTeam: any = null;
  let timerSeconds: number = 0;
  let isTimerRunning: boolean = false;
  let timerInterval: NodeJS.Timeout | null = null;
  
  // ===== REST API ROUTES =====
  
  // Auth routes
  app.post("/api/auth/admin-login", async (req: RequestWithSession, res) => {
    try {
      const { password } = req.body;
      
      // In a real application, this should be a secure password check
      if (password !== "admin") {
        return res.status(401).json({ message: "Invalid admin password" });
      }
      
      // Create or get admin user
      const adminUser = await storage.getUserByUsername("admin");
      let userId = 0;
      
      if (!adminUser) {
        const newUser = await storage.createUser({ 
          username: "admin", 
          password: "admin_secure_hash", // Would be hashed in production
          isAdmin: true 
        });
        userId = newUser.id;
      } else {
        userId = adminUser.id;
      }
      
      // Set user in session
      req.session.userId = userId;
      req.session.isAdmin = true;
      
      res.json({ id: userId, username: "admin", isAdmin: true });
    } catch (error) {
      console.error("Admin login error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.post("/api/auth/peer-login", async (req: RequestWithSession, res) => {
    try {
      const validatedData = peerLoginSchema.parse(req.body);
      const { name, usn } = validatedData;
      
      // Check if peer exists
      let peer = await storage.getPeerByUSN(usn);
      
      if (!peer) {
        // Create a new user for the peer
        const newUser = await storage.createUser({
          username: usn,
          password: "peer_user", // Would be hashed in production
          isAdmin: false
        });
        
        // Create the peer record
        peer = await storage.createPeer({
          name,
          usn,
          userId: newUser.id
        });
      }
      
      // Set user in session
      req.session.userId = peer.userId;
      req.session.isAdmin = false;
      
      // Get user info
      const user = await storage.getUser(peer.userId);
      
      res.json({ 
        id: peer.userId, 
        username: user?.username, 
        isAdmin: false 
      });
    } catch (error) {
      console.error("Peer login error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.post("/api/auth/logout", (req: RequestWithSession, res) => {
    req.session.destroy((err) => {
      if (err) {
        console.error("Logout error:", err);
        return res.status(500).json({ message: "Failed to logout" });
      }
      res.json({ message: "Logged out successfully" });
    });
  });
  
  app.get("/api/auth/me", async (req: RequestWithSession, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    try {
      const user = await storage.getUser(req.session.userId);
      
      if (!user) {
        req.session.destroy(() => {});
        return res.status(401).json({ message: "User not found" });
      }
      
      // If user is not admin, get peer details
      if (!user.isAdmin) {
        const peer = await storage.getPeerByUserId(user.id);
        if (peer) {
          return res.json({
            id: user.id,
            username: user.username,
            isAdmin: user.isAdmin,
            name: peer.name,
            usn: peer.usn
          });
        }
      }
      
      res.json({
        id: user.id,
        username: user.username,
        isAdmin: user.isAdmin
      });
    } catch (error) {
      console.error("Auth check error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Team routes
  app.post("/api/teams", async (req: RequestWithSession, res) => {
    try {
      if (!req.session.userId || !req.session.isAdmin) {
        return res.status(403).json({ message: "Not authorized" });
      }
      
      const { teams } = req.body;
      
      if (!Array.isArray(teams)) {
        return res.status(400).json({ message: "Teams must be an array" });
      }
      
      const savedTeams = [];
      
      for (const team of teams) {
        const validatedTeam = insertTeamSchema.parse({
          ...team,
          createdBy: req.session.userId
        });
        
        const savedTeam = await storage.createTeam(validatedTeam);
        savedTeams.push(savedTeam);
      }
      
      res.json(savedTeams);
    } catch (error) {
      console.error("Team upload error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.get("/api/teams", async (req, res) => {
    try {
      const teams = await storage.getAllTeams();
      res.json(teams);
    } catch (error) {
      console.error("Get teams error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // ===== WEBSOCKET HANDLERS =====
  
  wss.on('connection', async (ws, req) => {
    console.log('Client connected');
    
    // Function to get peers list
    const getPeersList = async (): Promise<{ id: number; name: string }[]> => {
      const connectedPeers: { id: number; name: string }[] = [];
      const nonAdminClients = Array.from(clients.values()).filter(c => !c.isAdmin && c.userId > 0);
      
      for (const c of nonAdminClients) {
        try {
          const peer = await storage.getPeerByUserId(c.userId);
          if (peer) {
            connectedPeers.push({
              id: peer.id,
              name: peer.name
            });
          }
        } catch (error) {
          console.error("Error getting peer info:", error);
        }
      }
      
      return connectedPeers;
    };
    
    // Function to send state updates to a client
    const sendState = async (client: WebSocket) => {
      if (client.readyState === WebSocket.OPEN) {
        // Send session update if active
        if (activeSession && activeTeam) {
          client.send(JSON.stringify({
            type: "session_update",
            payload: {
              session: activeSession,
              team: activeTeam
            }
          }));
        }
        
        // Send timer update
        client.send(JSON.stringify({
          type: "timer_update",
          payload: {
            seconds: timerSeconds,
            isRunning: isTimerRunning
          }
        }));
        
        // If the client is admin, send connected peers info
        const currentClient = clients.get(client);
        if (currentClient && currentClient.isAdmin) {
          const peersList = await getPeersList();
          
          client.send(JSON.stringify({
            type: "peers_update",
            payload: {
              peers: peersList
            }
          }));
        }
      }
    };
    
    // Get session info
    let userId = 0;
    let isAdmin = false;
    
    // Try to get user from session
    if (req.url?.includes('?')) {
      const params = new URLSearchParams(req.url.split('?')[1]);
      const sessionId = params.get('sessionId');
      
      if (sessionId) {
        console.log(`WebSocket connection with sessionId: ${sessionId}`);
        // Validate the session ID
        try {
          const sessionIdNum = parseInt(sessionId);
          if (!isNaN(sessionIdNum)) {
            const user = await storage.getUserById(sessionIdNum);
            if (user) {
              console.log(`Found user for session ID: ${sessionId}, isAdmin: ${user.isAdmin}`);
              userId = user.id;
              isAdmin = user.isAdmin || false;
            } else {
              console.log(`No user found for session ID: ${sessionId}`);
            }
          } else {
            console.log(`Invalid session ID format: ${sessionId}`);
          }
        } catch (error) {
          console.error("Error getting user from session:", error);
        }
      } else {
        console.log("No sessionId provided in WebSocket connection URL");
      }
    } else {
      console.log("No query parameters in WebSocket connection URL");
    }
    
    // Store client info
    clients.set(ws, { socket: ws, userId, isAdmin });
    
    // Send current state to the client
    sendState(ws);
    
    // Broadcast peer list update to admins if a non-admin connected
    if (!isAdmin && userId > 0) {
      console.log(`New peer connected with userId: ${userId}`);
      
      // Get updated peer list
      const peersList = await getPeersList();
      
      // Send update to all admin clients
      clients.forEach((c, socket) => {
        if (c.isAdmin && socket.readyState === WebSocket.OPEN) {
          console.log(`Broadcasting peer update to admin`);
          socket.send(JSON.stringify({
            type: "peers_update",
            payload: {
              peers: peersList
            }
          }));
        }
      });
    }
    
    // Handle messages from client
    ws.on('message', async (message) => {
      try {
        const client = clients.get(ws);
        if (!client) return;
        
        const data = JSON.parse(message.toString());
        console.log('Received:', data);
        
        switch (data.type) {
          case "get_state":
            sendState(ws);
            break;
            
          case "start_presentation":
            // Only admins can start presentations
            if (!client.isAdmin) {
              ws.send(JSON.stringify({
                type: "error",
                payload: { message: "Only admins can start presentations" }
              }));
              return;
            }
            
            const { teamId } = data.payload;
            const team = await storage.getTeam(teamId);
            
            if (!team) {
              ws.send(JSON.stringify({
                type: "error",
                payload: { message: "Team not found" }
              }));
              return;
            }
            
            // Create new session
            const newSession = await storage.createPresentationSession({
              teamId,
              startTime: new Date(),
              isActive: true,
              createdBy: client.userId
            });
            
            activeSession = newSession;
            activeTeam = team;
            timerSeconds = 0;
            isTimerRunning = false;
            
            // Reset timer if running
            if (timerInterval) {
              clearInterval(timerInterval);
              timerInterval = null;
            }
            
            // Broadcast to all clients
            clients.forEach((c, socket) => {
              if (socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({
                  type: "session_update",
                  payload: {
                    session: activeSession,
                    team: activeTeam
                  }
                }));
                
                socket.send(JSON.stringify({
                  type: "timer_update",
                  payload: {
                    seconds: timerSeconds,
                    isRunning: isTimerRunning
                  }
                }));
              }
            });
            break;
            
          case "end_presentation":
            // Only admins can end presentations
            if (!client.isAdmin) {
              ws.send(JSON.stringify({
                type: "error",
                payload: { message: "Only admins can end presentations" }
              }));
              return;
            }
            
            if (!activeSession) {
              ws.send(JSON.stringify({
                type: "error",
                payload: { message: "No active presentation to end" }
              }));
              return;
            }
            
            // Get evaluations for the session
            const evaluations = await storage.getEvaluationsBySessionId(activeSession.id);
            
            // Generate AI feedback if there are evaluations
            if (evaluations.length > 0) {
              try {
                const feedback = await generateAIFeedback(evaluations, activeTeam);
                await storage.createAIFeedback({
                  sessionId: activeSession.id,
                  strengths: feedback.strengths,
                  improvements: feedback.improvements,
                  overallScore: feedback.overallScore,
                  generatedAt: new Date()
                });
                
                // Send feedback to all clients
                clients.forEach((c, socket) => {
                  if (socket.readyState === WebSocket.OPEN) {
                    socket.send(JSON.stringify({
                      type: "feedback_update",
                      payload: { feedback }
                    }));
                  }
                });
              } catch (error) {
                console.error("Error generating AI feedback:", error);
              }
            }
            
            // Update session as ended
            await storage.updatePresentationSession(activeSession.id, {
              endTime: new Date(),
              isActive: false
            });
            
            // Stop timer
            if (timerInterval) {
              clearInterval(timerInterval);
              timerInterval = null;
            }
            isTimerRunning = false;
            
            // Reset active session and team
            activeSession = null;
            activeTeam = null;
            
            // Broadcast to all clients
            clients.forEach((c, socket) => {
              if (socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({
                  type: "session_end"
                }));
                
                socket.send(JSON.stringify({
                  type: "timer_update",
                  payload: {
                    seconds: 0,
                    isRunning: false
                  }
                }));
              }
            });
            break;
            
          case "submit_evaluation":
            // Ensure a session is active
            if (!activeSession) {
              ws.send(JSON.stringify({
                type: "error",
                payload: { message: "No active presentation to evaluate" }
              }));
              return;
            }
            
            // Ensure the user is not an admin
            if (client.isAdmin) {
              ws.send(JSON.stringify({
                type: "error",
                payload: { message: "Admins cannot submit evaluations" }
              }));
              return;
            }
            
            // Check if already submitted
            const existingEvaluation = await storage.getEvaluationBySessionAndPeer(
              activeSession.id,
              client.userId
            );
            
            if (existingEvaluation) {
              ws.send(JSON.stringify({
                type: "error",
                payload: { message: "You have already submitted an evaluation for this presentation" }
              }));
              return;
            }
            
            // Create evaluation
            const evaluationData = {
              ...data.payload,
              peerId: client.userId,
              sessionId: activeSession.id,
              submittedAt: new Date()
            };
            
            const validatedEvaluation = insertEvaluationSchema.parse(evaluationData);
            const savedEvaluation = await storage.createEvaluation(validatedEvaluation);
            
            // Get all evaluations for this session
            const sessionEvaluations = await storage.getEvaluationsBySessionId(activeSession.id);
            
            // Calculate averages
            const avgTechnicalContent = sessionEvaluations.reduce((sum, evaluation) => sum + evaluation.technicalContent, 0) / sessionEvaluations.length;
            const avgPresentationSkills = sessionEvaluations.reduce((sum, evaluation) => sum + evaluation.presentationSkills, 0) / sessionEvaluations.length;
            const avgProjectDemo = sessionEvaluations.reduce((sum, evaluation) => sum + evaluation.projectDemo, 0) / sessionEvaluations.length;
            const avgOverall = (avgTechnicalContent + avgPresentationSkills + avgProjectDemo) / 3;
            
            // Broadcast evaluation update to admins
            clients.forEach((c, socket) => {
              if (c.isAdmin && socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({
                  type: "evaluation_update",
                  payload: {
                    evaluations: sessionEvaluations,
                    averages: {
                      technicalContent: avgTechnicalContent,
                      presentationSkills: avgPresentationSkills,
                      projectDemo: avgProjectDemo,
                      overall: avgOverall
                    }
                  }
                }));
              }
            });
            
            // Acknowledge submission to client
            ws.send(JSON.stringify({
              type: "evaluation_submitted",
              payload: { success: true }
            }));
            break;
            
          case "timer_start":
            // Only admins can control timer
            if (!client.isAdmin) {
              ws.send(JSON.stringify({
                type: "error",
                payload: { message: "Only admins can control the timer" }
              }));
              return;
            }
            
            if (!activeSession) {
              ws.send(JSON.stringify({
                type: "error",
                payload: { message: "No active presentation" }
              }));
              return;
            }
            
            isTimerRunning = true;
            
            // Start timer
            if (!timerInterval) {
              timerInterval = setInterval(() => {
                timerSeconds++;
                
                // Broadcast timer update
                clients.forEach((c, socket) => {
                  if (socket.readyState === WebSocket.OPEN) {
                    socket.send(JSON.stringify({
                      type: "timer_update",
                      payload: {
                        seconds: timerSeconds,
                        isRunning: isTimerRunning
                      }
                    }));
                  }
                });
              }, 1000);
            }
            
            // Broadcast timer state
            clients.forEach((c, socket) => {
              if (socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({
                  type: "timer_update",
                  payload: {
                    seconds: timerSeconds,
                    isRunning: isTimerRunning
                  }
                }));
              }
            });
            break;
            
          case "timer_pause":
            // Only admins can control timer
            if (!client.isAdmin) {
              ws.send(JSON.stringify({
                type: "error",
                payload: { message: "Only admins can control the timer" }
              }));
              return;
            }
            
            isTimerRunning = false;
            
            // Stop timer
            if (timerInterval) {
              clearInterval(timerInterval);
              timerInterval = null;
            }
            
            // Broadcast timer state
            clients.forEach((c, socket) => {
              if (socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({
                  type: "timer_update",
                  payload: {
                    seconds: timerSeconds,
                    isRunning: isTimerRunning
                  }
                }));
              }
            });
            break;
            
          case "timer_reset":
            // Only admins can control timer
            if (!client.isAdmin) {
              ws.send(JSON.stringify({
                type: "error",
                payload: { message: "Only admins can control the timer" }
              }));
              return;
            }
            
            // Reset timer
            timerSeconds = 0;
            isTimerRunning = false;
            
            if (timerInterval) {
              clearInterval(timerInterval);
              timerInterval = null;
            }
            
            // Broadcast timer state
            clients.forEach((c, socket) => {
              if (socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({
                  type: "timer_update",
                  payload: {
                    seconds: timerSeconds,
                    isRunning: isTimerRunning
                  }
                }));
              }
            });
            break;
            
          case "screen_share_start":
            // Only admins can share screen
            if (!client.isAdmin) {
              ws.send(JSON.stringify({
                type: "error",
                payload: { message: "Only admins can share screen" }
              }));
              return;
            }
            
            // Broadcast screen share start
            clients.forEach((c, socket) => {
              if (!c.isAdmin && socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({
                  type: "screen_share_start"
                }));
              }
            });
            break;
            
          case "screen_share_stop":
            // Only admins can stop screen share
            if (!client.isAdmin) {
              ws.send(JSON.stringify({
                type: "error",
                payload: { message: "Only admins can stop screen share" }
              }));
              return;
            }
            
            // Broadcast screen share stop
            clients.forEach((c, socket) => {
              if (!c.isAdmin && socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({
                  type: "screen_share_stop"
                }));
              }
            });
            break;
        }
      } catch (error) {
        console.error("WebSocket message error:", error);
      }
    });
    
    // Handle disconnection
    ws.on('close', async (code, reason) => {
      const client = clients.get(ws);
      const clientType = client?.isAdmin ? 'admin' : (client && client.userId > 0 ? 'peer' : 'unknown');
      console.log(`Client disconnected: ${clientType} with userId: ${client?.userId ?? 'none'}, code: ${code}, reason: ${reason || 'none'}`);
      
      clients.delete(ws);
      
      // If a peer disconnected, notify all admins
      if (client && !client.isAdmin && client.userId > 0) {
        console.log(`Peer disconnected with userId: ${client.userId}, notifying admins`);
        
        // Get updated peer list
        const peersList = await getPeersList();
        console.log(`Updated peer list: ${JSON.stringify(peersList)}`);
        
        // Send update to all admin clients
        let adminCount = 0;
        clients.forEach((c, socket) => {
          if (c.isAdmin && socket.readyState === WebSocket.OPEN) {
            adminCount++;
            socket.send(JSON.stringify({
              type: "peers_update",
              payload: {
                peers: peersList
              }
            }));
          }
        });
        console.log(`Notified ${adminCount} admins about peer disconnection`);
      }
    });
  });

  return httpServer;
}
