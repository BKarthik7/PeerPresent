import { 
  users, 
  teams, 
  presentationSessions, 
  evaluations, 
  aiFeedback, 
  peers,
  type User, 
  type InsertUser, 
  type Team, 
  type InsertTeam,
  type PresentationSession,
  type InsertPresentationSession,
  type Evaluation,
  type InsertEvaluation,
  type AIFeedback,
  type InsertAIFeedback,
  type Peer,
  type InsertPeer
} from "@shared/schema";

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserById(id: number): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Team methods
  getTeam(id: number): Promise<Team | undefined>;
  getAllTeams(): Promise<Team[]>;
  createTeam(team: InsertTeam): Promise<Team>;
  
  // Presentation session methods
  getPresentationSession(id: number): Promise<PresentationSession | undefined>;
  getActivePresentationSession(): Promise<PresentationSession | undefined>;
  createPresentationSession(session: InsertPresentationSession): Promise<PresentationSession>;
  updatePresentationSession(id: number, updates: Partial<PresentationSession>): Promise<PresentationSession>;
  
  // Evaluation methods
  getEvaluation(id: number): Promise<Evaluation | undefined>;
  getEvaluationsBySessionId(sessionId: number): Promise<Evaluation[]>;
  getEvaluationBySessionAndPeer(sessionId: number, peerId: number): Promise<Evaluation | undefined>;
  createEvaluation(evaluation: InsertEvaluation): Promise<Evaluation>;
  
  // AI Feedback methods
  getAIFeedback(id: number): Promise<AIFeedback | undefined>;
  getAIFeedbackBySessionId(sessionId: number): Promise<AIFeedback | undefined>;
  createAIFeedback(feedback: InsertAIFeedback): Promise<AIFeedback>;
  
  // Peer methods
  getPeer(id: number): Promise<Peer | undefined>;
  getPeerByUSN(usn: string): Promise<Peer | undefined>;
  getPeerByUserId(userId: number): Promise<Peer | undefined>;
  createPeer(peer: InsertPeer): Promise<Peer>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private teams: Map<number, Team>;
  private presentationSessions: Map<number, PresentationSession>;
  private evaluations: Map<number, Evaluation>;
  private aiFeedback: Map<number, AIFeedback>;
  private peers: Map<number, Peer>;
  
  private currentUserId: number;
  private currentTeamId: number;
  private currentSessionId: number;
  private currentEvaluationId: number;
  private currentFeedbackId: number;
  private currentPeerId: number;

  constructor() {
    this.users = new Map();
    this.teams = new Map();
    this.presentationSessions = new Map();
    this.evaluations = new Map();
    this.aiFeedback = new Map();
    this.peers = new Map();
    
    this.currentUserId = 1;
    this.currentTeamId = 1;
    this.currentSessionId = 1;
    this.currentEvaluationId = 1;
    this.currentFeedbackId = 1;
    this.currentPeerId = 1;
    
    // Create default admin user
    this.createUser({
      username: "admin",
      password: "admin",
      isAdmin: true
    });
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }
  
  async getUserById(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }
  
  // Team methods
  async getTeam(id: number): Promise<Team | undefined> {
    return this.teams.get(id);
  }
  
  async getAllTeams(): Promise<Team[]> {
    return Array.from(this.teams.values());
  }
  
  async createTeam(insertTeam: InsertTeam): Promise<Team> {
    const id = this.currentTeamId++;
    const team: Team = { ...insertTeam, id };
    this.teams.set(id, team);
    return team;
  }
  
  // Presentation session methods
  async getPresentationSession(id: number): Promise<PresentationSession | undefined> {
    return this.presentationSessions.get(id);
  }
  
  async getActivePresentationSession(): Promise<PresentationSession | undefined> {
    return Array.from(this.presentationSessions.values()).find(
      (session) => session.isActive,
    );
  }
  
  async createPresentationSession(insertSession: InsertPresentationSession): Promise<PresentationSession> {
    // End any active sessions first
    const activeSession = await this.getActivePresentationSession();
    if (activeSession) {
      await this.updatePresentationSession(activeSession.id, {
        isActive: false,
        endTime: new Date()
      });
    }
    
    const id = this.currentSessionId++;
    const session: PresentationSession = { 
      ...insertSession, 
      id,
      endTime: null
    };
    this.presentationSessions.set(id, session);
    return session;
  }
  
  async updatePresentationSession(id: number, updates: Partial<PresentationSession>): Promise<PresentationSession> {
    const session = this.presentationSessions.get(id);
    if (!session) {
      throw new Error(`Presentation session with ID ${id} not found`);
    }
    
    const updatedSession = { ...session, ...updates };
    this.presentationSessions.set(id, updatedSession);
    return updatedSession;
  }
  
  // Evaluation methods
  async getEvaluation(id: number): Promise<Evaluation | undefined> {
    return this.evaluations.get(id);
  }
  
  async getEvaluationsBySessionId(sessionId: number): Promise<Evaluation[]> {
    return Array.from(this.evaluations.values()).filter(
      (evaluation) => evaluation.sessionId === sessionId,
    );
  }
  
  async getEvaluationBySessionAndPeer(sessionId: number, peerId: number): Promise<Evaluation | undefined> {
    return Array.from(this.evaluations.values()).find(
      (evaluation) => evaluation.sessionId === sessionId && evaluation.peerId === peerId,
    );
  }
  
  async createEvaluation(insertEvaluation: InsertEvaluation): Promise<Evaluation> {
    const id = this.currentEvaluationId++;
    const evaluation: Evaluation = { ...insertEvaluation, id };
    this.evaluations.set(id, evaluation);
    return evaluation;
  }
  
  // AI Feedback methods
  async getAIFeedback(id: number): Promise<AIFeedback | undefined> {
    return this.aiFeedback.get(id);
  }
  
  async getAIFeedbackBySessionId(sessionId: number): Promise<AIFeedback | undefined> {
    return Array.from(this.aiFeedback.values()).find(
      (feedback) => feedback.sessionId === sessionId,
    );
  }
  
  async createAIFeedback(insertFeedback: InsertAIFeedback): Promise<AIFeedback> {
    const id = this.currentFeedbackId++;
    const feedback: AIFeedback = { ...insertFeedback, id };
    this.aiFeedback.set(id, feedback);
    return feedback;
  }
  
  // Peer methods
  async getPeer(id: number): Promise<Peer | undefined> {
    return this.peers.get(id);
  }
  
  async getPeerByUSN(usn: string): Promise<Peer | undefined> {
    return Array.from(this.peers.values()).find(
      (peer) => peer.usn === usn,
    );
  }
  
  async getPeerByUserId(userId: number): Promise<Peer | undefined> {
    return Array.from(this.peers.values()).find(
      (peer) => peer.userId === userId,
    );
  }
  
  async createPeer(insertPeer: InsertPeer): Promise<Peer> {
    const id = this.currentPeerId++;
    const peer: Peer = { ...insertPeer, id };
    this.peers.set(id, peer);
    return peer;
  }
}

export const storage = new MemStorage();
