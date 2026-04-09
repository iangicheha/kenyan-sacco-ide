import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, json, boolean, decimal, longtext } from "drizzle-orm/mysql-core";
import { relations } from "drizzle-orm";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin", "analyst", "reviewer"]).default("analyst").notNull(),
  institution: varchar("institution", { length: 255 }), // Name of financial institution
  institutionType: mysqlEnum("institutionType", ["sacco", "bank", "microfinance", "insurance", "investment", "other"]),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Sessions table: represents a user's workspace with uploaded documents
 */
export const sessions = mysqlTable("sessions", {
  id: varchar("id", { length: 64 }).primaryKey(), // nanoid
  userId: int("userId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  status: mysqlEnum("status", ["active", "archived", "completed"]).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Session = typeof sessions.$inferSelect;
export type InsertSession = typeof sessions.$inferInsert;

/**
 * Documents table: uploaded files (XLSX, CSV, PDF, Word)
 */
export const documents = mysqlTable("documents", {
  id: varchar("id", { length: 64 }).primaryKey(),
  sessionId: varchar("sessionId", { length: 64 }).notNull(),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  fileType: mysqlEnum("fileType", ["xlsx", "csv", "pdf", "docx"]).notNull(),
  fileSize: int("fileSize"),
  s3Key: varchar("s3Key", { length: 512 }), // S3 storage reference
  uploadedAt: timestamp("uploadedAt").defaultNow().notNull(),
});

export type Document = typeof documents.$inferSelect;
export type InsertDocument = typeof documents.$inferInsert;

/**
 * Spreadsheet graphs: in-memory cell graph serialized to JSON
 */
export const spreadsheetGraphs = mysqlTable("spreadsheetGraphs", {
  id: varchar("id", { length: 64 }).primaryKey(),
  sessionId: varchar("sessionId", { length: 64 }).notNull(),
  documentId: varchar("documentId", { length: 64 }).notNull(),
  graphData: longtext("graphData").notNull(), // JSON serialized cell graph
  activeSheet: varchar("activeSheet", { length: 255 }).default("Sheet1").notNull(),
  rowCount: int("rowCount").default(0).notNull(),
  colCount: int("colCount").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SpreadsheetGraph = typeof spreadsheetGraphs.$inferSelect;
export type InsertSpreadsheetGraph = typeof spreadsheetGraphs.$inferInsert;

/**
 * Pending operations: AI-proposed changes awaiting user approval
 */
export const pendingOperations = mysqlTable("pendingOperations", {
  id: varchar("id", { length: 64 }).primaryKey(),
  sessionId: varchar("sessionId", { length: 64 }).notNull(),
  tool: varchar("tool", { length: 64 }).notNull(), // e.g., write_formula, write_value
  address: varchar("address", { length: 64 }).notNull(), // e.g., D7
  sheet: varchar("sheet", { length: 255 }).default("Sheet1").notNull(),
  oldValue: text("oldValue"),
  oldFormula: text("oldFormula"),
  newValue: text("newValue"),
  newFormula: text("newFormula"),
  rationale: text("rationale").notNull(),
  affectedCells: json("affectedCells").notNull(), // JSON array of affected cell addresses
  status: mysqlEnum("status", ["pending", "accepted", "rejected"]).default("pending").notNull(),
  decidedBy: varchar("decidedBy", { length: 64 }), // user ID who approved/rejected
  decidedAt: timestamp("decidedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PendingOperation = typeof pendingOperations.$inferSelect;
export type InsertPendingOperation = typeof pendingOperations.$inferInsert;

/**
 * Audit logs: immutable record of all operations for compliance
 */
export const auditLogs = mysqlTable("auditLogs", {
  id: varchar("id", { length: 64 }).primaryKey(),
  sessionId: varchar("sessionId", { length: 64 }).notNull(),
  userId: int("userId").notNull(),
  action: varchar("action", { length: 255 }).notNull(), // e.g., OPERATION_ACCEPTED, FILE_UPLOADED
  operationId: varchar("operationId", { length: 64 }),
  details: json("details").notNull(), // Structured metadata
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = typeof auditLogs.$inferInsert;

/**
 * Conversation history: persisted chat messages for each session
 */
export const conversationHistory = mysqlTable("conversationHistory", {
  id: varchar("id", { length: 64 }).primaryKey(),
  sessionId: varchar("sessionId", { length: 64 }).notNull(),
  role: mysqlEnum("role", ["user", "assistant", "system"]).notNull(),
  content: longtext("content").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ConversationMessage = typeof conversationHistory.$inferSelect;
export type InsertConversationMessage = typeof conversationHistory.$inferInsert;

/**
 * Versions: snapshots of spreadsheet state for model comparison
 */
export const versions = mysqlTable("versions", {
  id: varchar("id", { length: 64 }).primaryKey(),
  sessionId: varchar("sessionId", { length: 64 }).notNull(),
  versionNumber: int("versionNumber").notNull(),
  graphSnapshot: longtext("graphSnapshot").notNull(), // JSON serialized cell graph
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Version = typeof versions.$inferSelect;
export type InsertVersion = typeof versions.$inferInsert;

/**
 * Flagged cells: anomalies detected by AI (ghost accounts, phantom savings, etc.)
 */
export const flaggedCells = mysqlTable("flaggedCells", {
  id: varchar("id", { length: 64 }).primaryKey(),
  sessionId: varchar("sessionId", { length: 64 }).notNull(),
  address: varchar("address", { length: 64 }).notNull(),
  sheet: varchar("sheet", { length: 255 }).default("Sheet1").notNull(),
  flagType: mysqlEnum("flagType", ["ghost_account", "phantom_savings", "unremitted_deduction", "compliance_breach", "data_anomaly"]).notNull(),
  rationale: text("rationale").notNull(),
  resolved: boolean("resolved").default(false).notNull(),
  resolvedAt: timestamp("resolvedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type FlaggedCell = typeof flaggedCells.$inferSelect;
export type InsertFlaggedCell = typeof flaggedCells.$inferInsert;