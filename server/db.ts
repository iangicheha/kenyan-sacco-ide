import { eq, and, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { 
  InsertUser, users, 
  sessions, InsertSession,
  documents, InsertDocument,
  spreadsheetGraphs, InsertSpreadsheetGraph,
  pendingOperations, InsertPendingOperation,
  auditLogs, InsertAuditLog,
  conversationHistory, InsertConversationMessage,
  versions, InsertVersion,
  flaggedCells, InsertFlaggedCell
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ── User queries ──────────────────────────────────────────────────────────

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod", "institution"] as const;
    type TextField = (typeof textFields)[number];
    const enumFields = ["institutionType"] as const;
    type EnumField = (typeof enumFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    const assignEnumNullable = (field: EnumField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    enumFields.forEach(assignEnumNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ── Session queries ───────────────────────────────────────────────────────

export async function createSession(session: InsertSession) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(sessions).values(session);
  return session;
}

export async function getSession(sessionId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.select().from(sessions).where(eq(sessions.id, sessionId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserSessions(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(sessions).where(eq(sessions.userId, userId)).orderBy(desc(sessions.updatedAt));
}

export async function updateSession(sessionId: string, updates: Partial<InsertSession>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(sessions).set({ ...updates, updatedAt: new Date() }).where(eq(sessions.id, sessionId));
}

// ── Document queries ──────────────────────────────────────────────────────

export async function createDocument(doc: InsertDocument) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(documents).values(doc);
  return doc;
}

export async function getSessionDocuments(sessionId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(documents).where(eq(documents.sessionId, sessionId));
}

// ── Spreadsheet graph queries ─────────────────────────────────────────────

export async function createSpreadsheetGraph(graph: InsertSpreadsheetGraph) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(spreadsheetGraphs).values(graph);
  return graph;
}

export async function getSpreadsheetGraph(graphId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.select().from(spreadsheetGraphs).where(eq(spreadsheetGraphs.id, graphId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getSessionGraphs(sessionId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(spreadsheetGraphs).where(eq(spreadsheetGraphs.sessionId, sessionId));
}

export async function updateSpreadsheetGraph(graphId: string, updates: Partial<InsertSpreadsheetGraph>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(spreadsheetGraphs).set({ ...updates, updatedAt: new Date() }).where(eq(spreadsheetGraphs.id, graphId));
}

// ── Pending operations queries ────────────────────────────────────────────

export async function createPendingOperation(op: InsertPendingOperation) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(pendingOperations).values(op);
  return op;
}

export async function getPendingOperations(sessionId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(pendingOperations).where(
    and(eq(pendingOperations.sessionId, sessionId), eq(pendingOperations.status, "pending"))
  );
}

export async function getPendingOperation(operationId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.select().from(pendingOperations).where(eq(pendingOperations.id, operationId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updatePendingOperation(operationId: string, updates: Partial<InsertPendingOperation>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(pendingOperations).set(updates).where(eq(pendingOperations.id, operationId));
}

// ── Audit log queries ─────────────────────────────────────────────────────

export async function createAuditLog(log: InsertAuditLog) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(auditLogs).values(log);
  return log;
}

export async function getSessionAuditLogs(sessionId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(auditLogs).where(eq(auditLogs.sessionId, sessionId)).orderBy(desc(auditLogs.timestamp));
}

// ── Conversation history queries ──────────────────────────────────────────

export async function createConversationMessage(msg: InsertConversationMessage) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(conversationHistory).values(msg);
  return msg;
}

export async function getSessionConversationHistory(sessionId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(conversationHistory).where(eq(conversationHistory.sessionId, sessionId));
}

// ── Version queries ───────────────────────────────────────────────────────

export async function createVersion(version: InsertVersion) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(versions).values(version);
  return version;
}

export async function getSessionVersions(sessionId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(versions).where(eq(versions.sessionId, sessionId)).orderBy(desc(versions.createdAt));
}

// ── Flagged cells queries ─────────────────────────────────────────────────

export async function createFlaggedCell(flag: InsertFlaggedCell) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(flaggedCells).values(flag);
  return flag;
}

export async function getSessionFlaggedCells(sessionId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(flaggedCells).where(eq(flaggedCells.sessionId, sessionId));
}
