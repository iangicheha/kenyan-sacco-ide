import express from 'express';
import multer from 'multer';
import csv from 'csv-parser';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import Groq from 'groq-sdk';

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

const upload = multer({ dest: 'uploads/' });
let currentMergedData = { members: [], mpesaTransactions: [], auditLogs: [] };

app.post('/api/upload', upload.array('files'), async (req, res) => {
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
