import express from 'express';
import multer from 'multer';
import csv from 'csv-parser';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Member, MpesaTransaction, AuditLog, MergedData } from '../shared/types';
import { MeridianSemanticEngine } from './semantic_engine';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3001;

app.use(express.json());

// Set up multer for file uploads
const upload = multer({ dest: 'uploads/' });

// Temporary storage for processed data
let currentMergedData: MergedData = { members: [], mpesaTransactions: [], auditLogs: [] };

// API endpoint for file uploads
app.post('/api/upload', upload.array('files'), async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).send('No files uploaded.');
  }

  const uploadedFiles = req.files as Express.Multer.File[];
  const members: Member[] = [];
  const mpesaTransactions: MpesaTransaction[] = [];

  for (const file of uploadedFiles) {
    const results: any[] = [];
    const filePath = path.join(__dirname, '..', file.path);

    await new Promise<void>((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', () => {
          // Attempt to infer file type based on headers or content
          if (results.some(row => row.memberId || row['Member ID'])) {
            results.forEach(row => {
              members.push({
                memberId: row.memberId || row['Member ID'],
                name: row.name || row['Name'],
                phoneNumber: MeridianSemanticEngine.normalizePhone(row.phoneNumber || row['Phone Number']),
                expectedContribution: parseFloat(row.expectedContribution || row['Expected Contribution'] || '0'),
                recordedPayments: parseFloat(row.recordedPayments || row['Recorded Payments'] || '0'),
              });
            });
          } else if (results.some(row => row.transactionId || row['Transaction ID'] || row.mpesaCode || row['M-Pesa Code'])) {
            results.forEach(row => {
              mpesaTransactions.push({
                transactionId: row.transactionId || row['Transaction ID'] || row.mpesaCode || row['M-Pesa Code'],
                phoneNumber: MeridianSemanticEngine.normalizePhone(row.phoneNumber || row['Phone Number']),
                amount: parseFloat(row.amount || row['Amount'] || '0'),
                date: new Date(row.date || row['Date']).toISOString(),
                type: (row.type || row['Type'] || 'PAYMENT').toUpperCase() as 'PAYMENT' | 'WITHDRAWAL' | 'DEPOSIT',
              });
            });
          }
          fs.unlinkSync(filePath); // Clean up uploaded file
          resolve();
        })
        .on('error', (error) => {
          fs.unlinkSync(filePath); // Clean up uploaded file on error
          reject(error);
        });
    });
  }

  currentMergedData = { members, mpesaTransactions, auditLogs: [] };
  res.status(200).json({ message: 'Files uploaded and parsed successfully.', data: currentMergedData });
});

// API endpoint for audit analysis
app.post('/api/audit', (req, res) => {
  const auditLogs = MeridianSemanticEngine.analyzeForensics(currentMergedData.members, currentMergedData.mpesaTransactions);
  currentMergedData.auditLogs = auditLogs;
  res.status(200).json({ message: 'Audit analysis complete.', auditLogs: currentMergedData.auditLogs });
});

// Basic health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).send('Server is running');
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
