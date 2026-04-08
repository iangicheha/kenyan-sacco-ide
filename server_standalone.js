import express from 'express';
import multer from 'multer';
import csv from 'csv-parser';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import Groq from 'groq-sdk';
import { nanoid } from 'nanoid';

import {
  initSession,
  runAgentTurn,
  acceptOperation,
  rejectOperation,
  exportSession,
  getAuditLog,
  getPendingOperations,
  getCellHistory,
  getSessionSummary,
} from './server/semantic_engine.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3001;

// Initialize Groq client with API key from environment
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || 'your_groq_api_key_here',
});

app.use(cors());
app.use(express.json());

// Standalone "agent spreadsheet" endpoints need the raw file buffer.
const uploadMemory = multer({ storage: multer.memoryStorage() });
// Legacy CSV upload path still uses disk.
const uploadDisk = multer({ dest: 'uploads/' });
let currentMergedData = { members: [], mpesaTransactions: [], auditLogs: [] };

// ── New Meridian-style routes (Meridian spreadsheet IDE) ───────────────────────

/**
 * POST /upload
 * Multipart form-data: file=<xlsx|csv> (or files[]=...; first file wins)
 * Optional: sessionId (body or query). If missing, server generates one.
 */
app.post('/upload', uploadMemory.any(), async (req, res) => {
  try {
    const files = req.files ?? [];
    const first = Array.isArray(files) ? files[0] : null;

    if (!first) {
      return res.status(400).json({ message: 'No file uploaded. Use multipart form-data field "file".' });
    }

    const sessionId =
      (req.body && typeof req.body.sessionId === 'string' && req.body.sessionId.trim()) ||
      (typeof req.query.sessionId === 'string' && req.query.sessionId.trim()) ||
      nanoid(12);

    const result = initSession(sessionId, first.buffer, first.originalname ?? 'upload.xlsx');
    return res.status(200).json(result);
  } catch (error) {
    console.error('[upload] error', error);
    return res.status(500).json({
      message: 'Failed to initialise session.',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /chat
 * Body: { sessionId: string, message: string }
 */
app.post('/chat', async (req, res) => {
  try {
    const { sessionId, message } = req.body ?? {};
    if (!sessionId || typeof sessionId !== 'string') {
      return res.status(400).json({ message: 'sessionId is required.' });
    }
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ message: 'message is required.' });
    }

    const result = await runAgentTurn(sessionId, message);
    return res.status(200).json(result);
  } catch (error) {
    console.error('[chat] error', error);
    return res.status(500).json({
      message: 'Chat failed.',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /accept
 * Body: { sessionId: string, operationId: string }
 */
app.post('/accept', (req, res) => {
  try {
    const { sessionId, operationId } = req.body ?? {};
    if (!sessionId || typeof sessionId !== 'string') {
      return res.status(400).json({ message: 'sessionId is required.' });
    }
    if (!operationId || typeof operationId !== 'string') {
      return res.status(400).json({ message: 'operationId is required.' });
    }

    const result = acceptOperation(sessionId, operationId);
    return res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    console.error('[accept] error', error);
    return res.status(500).json({
      message: 'Accept failed.',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /reject
 * Body: { sessionId: string, operationId: string }
 */
app.post('/reject', (req, res) => {
  try {
    const { sessionId, operationId } = req.body ?? {};
    if (!sessionId || typeof sessionId !== 'string') {
      return res.status(400).json({ message: 'sessionId is required.' });
    }
    if (!operationId || typeof operationId !== 'string') {
      return res.status(400).json({ message: 'operationId is required.' });
    }

    const result = rejectOperation(sessionId, operationId);
    return res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    console.error('[reject] error', error);
    return res.status(500).json({
      message: 'Reject failed.',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /export?sessionId=...
 * Returns: XLSX buffer as a download.
 */
app.get('/export', (req, res) => {
  try {
    const sessionId = typeof req.query.sessionId === 'string' ? req.query.sessionId : '';
    if (!sessionId) {
      return res.status(400).json({ message: 'sessionId query param is required.' });
    }

    const buffer = exportSession(sessionId);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="meridian_export_${sessionId}.xlsx"`);
    return res.status(200).send(buffer);
  } catch (error) {
    console.error('[export] error', error);
    return res.status(500).json({
      message: 'Export failed.',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /audit-log?sessionId=...
 * Returns: audit entries for SASRA traceability.
 */
app.get('/audit-log', (req, res) => {
  try {
    const sessionId = typeof req.query.sessionId === 'string' ? req.query.sessionId : '';
    if (!sessionId) {
      return res.status(400).json({ message: 'sessionId query param is required.' });
    }
    return res.status(200).json({ sessionId, auditLog: getAuditLog(sessionId) });
  } catch (error) {
    console.error('[audit-log] error', error);
    return res.status(500).json({
      message: 'Failed to load audit log.',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /pending?sessionId=...
 * Returns: currently pending operations for the diff panel.
 */
app.get('/pending', (req, res) => {
  try {
    const sessionId = typeof req.query.sessionId === 'string' ? req.query.sessionId : '';
    if (!sessionId) {
      return res.status(400).json({ message: 'sessionId query param is required.' });
    }
    return res.status(200).json({
      sessionId,
      pending: getPendingOperations(sessionId),
    });
  } catch (error) {
    console.error('[pending] error', error);
    return res.status(500).json({
      message: 'Failed to load pending operations.',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /cell-history?sessionId=...&address=D47&sheet=Loans
 * Returns: audit timeline for a specific cell.
 */
app.get('/cell-history', (req, res) => {
  try {
    const sessionId = typeof req.query.sessionId === 'string' ? req.query.sessionId : '';
    const address = typeof req.query.address === 'string' ? req.query.address : '';
    const sheet = typeof req.query.sheet === 'string' ? req.query.sheet : undefined;

    if (!sessionId) {
      return res.status(400).json({ message: 'sessionId query param is required.' });
    }
    if (!address) {
      return res.status(400).json({ message: 'address query param is required.' });
    }

    return res.status(200).json({
      sessionId,
      address: address.toUpperCase(),
      sheet: sheet ?? null,
      history: getCellHistory(sessionId, address, sheet),
    });
  } catch (error) {
    console.error('[cell-history] error', error);
    return res.status(500).json({
      message: 'Failed to load cell history.',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /summary?sessionId=...
 * Returns: high-level operation counters for dashboard widgets.
 */
app.get('/summary', (req, res) => {
  try {
    const sessionId = typeof req.query.sessionId === 'string' ? req.query.sessionId : '';
    if (!sessionId) {
      return res.status(400).json({ message: 'sessionId query param is required.' });
    }

    const summary = getSessionSummary(sessionId);
    if (!summary) {
      return res.status(404).json({ message: 'Session not found.' });
    }

    return res.status(200).json({ sessionId, summary });
  } catch (error) {
    console.error('[summary] error', error);
    return res.status(500).json({
      message: 'Failed to load session summary.',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ── Legacy API routes (kept intact for now) ───────────────────────────────────

app.post('/api/upload', uploadDisk.array('files'), async (req, res) => {
  if (!req.files || req.files.length === 0) return res.status(400).send('No files uploaded.');
  const members = [];
  const mpesaTransactions = [];
  for (const file of req.files) {
    const results = [];
    await new Promise((resolve) => {
      fs.createReadStream(file.path).pipe(csv()).on('data', (d) => results.push(d)).on('end', resolve);
    });
    results.forEach(row => {
      if (row.memberId || row['Member ID']) {
        members.push({
          memberId: row.memberId || row['Member ID'],
          name: row.name || row['Name'],
          phoneNumber: row.phoneNumber || row['Phone Number'],
          expectedContribution: parseFloat(row.expectedContribution || 0),
          recordedPayments: parseFloat(row.recordedPayments || 0),
        });
      } else if (row.transactionId || row['Transaction ID']) {
        mpesaTransactions.push({
          transactionId: row.transactionId || row['Transaction ID'],
          phoneNumber: row.phoneNumber || row['Phone Number'],
          amount: parseFloat(row.amount || 0),
          date: new Date(row.date).toISOString(),
        });
      }
    });
    fs.unlinkSync(file.path);
  }
  currentMergedData = { members, mpesaTransactions, auditLogs: [] };
  res.json({ message: 'Success', data: currentMergedData });
});

app.post('/api/ai/chat', async (req, res) => {
  const { message } = req.body;
  try {
    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'user',
          content: `You are Meridian AI, a financial intelligence expert for Kenyan SACCOs. Provide concise, actionable financial insights. Message: ${message}`,
        },
      ],
      max_tokens: 1024,
    });

    const aiResponse = response.choices[0]?.message?.content || 'No response generated';
    res.json({ response: aiResponse });
  } catch (error) {
    console.error('Groq API Error:', error);
    res.status(500).json({ error: error.message || 'AI reasoning failed' });
  }
});

app.post('/api/audit', async (req, res) => {
  try {
    // Perform forensic audit using Groq AI
    const auditPrompt = `
    Analyze this SACCO financial data for discrepancies:
    Members: ${JSON.stringify(currentMergedData.members)}
    M-Pesa Transactions: ${JSON.stringify(currentMergedData.mpesaTransactions)}
    
    Identify:
    1. Phantom Savings (recorded but no M-Pesa proof)
    2. Ghost Accounts (M-Pesa payments with no member record)
    3. Discrepancies in amounts
    
    Format as JSON with findings array.
    `;

    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: auditPrompt }],
      max_tokens: 2048,
    });

    const auditResult = response.choices[0]?.message?.content || 'No audit findings';
    res.json({ auditFindings: auditResult, data: currentMergedData });
  } catch (error) {
    console.error('Audit Error:', error);
    res.status(500).json({ error: error.message || 'Audit failed' });
  }
});

app.post('/api/generate-report', async (req, res) => {
  try {
    const reportPrompt = `
    Generate a professional boardroom report summary for this SACCO audit:
    Data: ${JSON.stringify(currentMergedData)}
    
    Include:
    1. Executive Summary
    2. Key Findings
    3. Risk Assessment
    4. Recommendations
    
    Format as markdown.
    `;

    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: reportPrompt }],
      max_tokens: 2048,
    });

    const reportContent = response.choices[0]?.message?.content || 'No report generated';
    res.json({ report: reportContent });
  } catch (error) {
    console.error('Report Generation Error:', error);
    res.status(500).json({ error: error.message || 'Report generation failed' });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'Meridian AI API is running', timestamp: new Date().toISOString() });
});

app.listen(port, () => {
  console.log(`🚀 Meridian AI API Server running on port ${port}`);
  console.log(`📊 Using Groq Cloud API with DeepSeek-R1-Distill-Llama-70B`);
  console.log(`⚡ Lightning-fast financial intelligence for Kenyan SACCOs`);
});
