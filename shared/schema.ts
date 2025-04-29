import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User schema for authentication
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  isAdmin: boolean("is_admin").default(false),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  isAdmin: true,
});

// Team schema for presentation teams
export const teams = pgTable("teams", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  projectTitle: text("project_title").notNull(),
  members: jsonb("members").notNull().$type<Array<{ name: string; usn: string }>>(),
  createdBy: integer("created_by").notNull(),
});

export const insertTeamSchema = createInsertSchema(teams).pick({
  name: true,
  projectTitle: true,
  members: true,
  createdBy: true,
});

// Presentation session schema
export const presentationSessions = pgTable("presentation_sessions", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").notNull(),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time"),
  isActive: boolean("is_active").default(true),
  createdBy: integer("created_by").notNull(),
});

export const insertPresentationSessionSchema = createInsertSchema(presentationSessions).pick({
  teamId: true,
  startTime: true,
  isActive: true,
  createdBy: true,
});

// Evaluation schema for peer reviews
export const evaluations = pgTable("evaluations", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull(),
  peerId: integer("peer_id").notNull(),
  technicalContent: integer("technical_content").notNull(),
  presentationSkills: integer("presentation_skills").notNull(),
  projectDemo: integer("project_demo").notNull(),
  positivePoints: text("positive_points"),
  negativePoints: text("negative_points"),
  submittedAt: timestamp("submitted_at").notNull(),
});

export const insertEvaluationSchema = createInsertSchema(evaluations).pick({
  sessionId: true,
  peerId: true,
  technicalContent: true,
  presentationSkills: true,
  projectDemo: true,
  positivePoints: true,
  negativePoints: true,
  submittedAt: true,
});

// AI Feedback schema
export const aiFeedback = pgTable("ai_feedback", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull().unique(),
  strengths: jsonb("strengths").notNull().$type<string[]>(),
  improvements: jsonb("improvements").notNull().$type<string[]>(),
  overallScore: integer("overall_score").notNull(),
  generatedAt: timestamp("generated_at").notNull(),
});

export const insertAiFeedbackSchema = createInsertSchema(aiFeedback).pick({
  sessionId: true,
  strengths: true,
  improvements: true,
  overallScore: true,
  generatedAt: true,
});

// Peer schema for non-admin users
export const peers = pgTable("peers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  usn: text("usn").notNull().unique(),
  userId: integer("user_id").notNull().unique(),
});

export const insertPeerSchema = createInsertSchema(peers).pick({
  name: true,
  usn: true,
  userId: true,
});

// Type definitions
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Team = typeof teams.$inferSelect;
export type InsertTeam = z.infer<typeof insertTeamSchema>;

export type PresentationSession = typeof presentationSessions.$inferSelect;
export type InsertPresentationSession = z.infer<typeof insertPresentationSessionSchema>;

export type Evaluation = typeof evaluations.$inferSelect;
export type InsertEvaluation = z.infer<typeof insertEvaluationSchema>;

export type AIFeedback = typeof aiFeedback.$inferSelect;
export type InsertAIFeedback = z.infer<typeof insertAiFeedbackSchema>;

export type Peer = typeof peers.$inferSelect;
export type InsertPeer = z.infer<typeof insertPeerSchema>;

// Additional validation schemas for client usage
export const peerLoginSchema = z.object({
  name: z.string().min(1, "Name is required"),
  usn: z.string().min(1, "USN is required"),
});

export const adminLoginSchema = z.object({
  password: z.string().min(1, "Password is required"),
});

export const evaluationFormSchema = z.object({
  technicalContent: z.number().min(1).max(10),
  presentationSkills: z.number().min(1).max(10), 
  projectDemo: z.number().min(1).max(10),
  positivePoints: z.string().optional(),
  negativePoints: z.string().optional(),
});

export type PeerLogin = z.infer<typeof peerLoginSchema>;
export type AdminLogin = z.infer<typeof adminLoginSchema>;
export type EvaluationForm = z.infer<typeof evaluationFormSchema>;

// WebSocket message types
export type WSMessage = {
  type: string;
  payload: any;
};
