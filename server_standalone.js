import express from 'express';
import multer from 'multer';
import csv from 'csv-parser';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import fetch from 'node-fetch';
import cors from 'cors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3001;

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
    const response = await fetch('http://127.0.0.1:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'deepseek-r1:1.5b',
        prompt: `You are Meridian AI expert. Message: ${message}`,
        stream: false
      })
    });
    const data = await response.json();
    res.json({ response: data.response });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => console.log(`API Server on ${port}`));
