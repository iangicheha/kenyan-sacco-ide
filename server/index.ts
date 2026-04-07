import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import cors from 'cors';
import Groq from 'groq-sdk';
import XLSX from 'xlsx';

import { Member, MpesaTransaction, AuditLog, MergedData } from '../shared/types';
import { MeridianSemanticEngine } from './semantic_engine';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3001;
const PREVIEW_ROW_LIMIT = 500;
const PREVIEW_PAGE_SIZE = 500;

app.use(cors());
app.use(express.json());

// Set up multer for file uploads
const upload = multer({ dest: 'uploads/' });

// Temporary storage for processed data
let currentMergedData: MergedData = { members: [], mpesaTransactions: [], auditLogs: [] };

function buildSafeLogPreview(input: unknown, maxLength = 80): string {
  if (typeof input !== 'string') return '[non-string payload]';
  const condensed = input.replace(/\s+/g, ' ').trim();
  if (!condensed) return '[empty message]';
  return condensed.length > maxLength ? `${condensed.slice(0, maxLength)}...` : condensed;
}

function parseNumeric(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function toIsoDateOrNow(value: unknown): string {
  const parsed = new Date(String(value ?? ''));
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function columnIndexToName(index: number): string {
  let n = index + 1;
  let name = '';
  while (n > 0) {
    const remainder = (n - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
}

function readTabularRows(filePath: string, extension: string): { sheetName: string; rows: Record<string, unknown>[] } {
  if (!['.csv', '.xlsx', '.xls'].includes(extension)) {
    return { sheetName: 'Sheet1', rows: [] };
  }

  const workbook = XLSX.readFile(filePath, {
    raw: false,
    cellDates: true,
  });

  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return { sheetName: 'Sheet1', rows: [] };

  const firstSheet = workbook.Sheets[firstSheetName];
  return {
    sheetName: firstSheetName,
    rows: XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, { defval: '' }),
  };
}

function readWorkbookSheets(filePath: string, extension: string): Array<{ sheetName: string; rows: Record<string, unknown>[] }> {
  if (!['.csv', '.xlsx', '.xls'].includes(extension)) {
    return [];
  }

  if (extension === '.csv') {
    const { sheetName, rows } = readTabularRows(filePath, extension);
    return [{ sheetName, rows }];
  }

  const workbook = XLSX.readFile(filePath, {
    raw: false,
    cellDates: true,
  });

  return workbook.SheetNames.map((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
    return { sheetName, rows };
  });
}

function extractSheetStructuredPreview(
  sheet: XLSX.WorkSheet
): { headers: string[]; previewRows: Array<Record<string, string>> } {
  const ref = sheet['!ref'];
  if (!ref) return { headers: [], previewRows: [] };

  const range = XLSX.utils.decode_range(ref);
  const columnCount = range.e.c - range.s.c + 1;
  const rowCount = range.e.r - range.s.r + 1;

  const readCellText = (r: number, c: number): string => {
    const cellRef = XLSX.utils.encode_cell({ r, c });
    const cell = sheet[cellRef];
    if (!cell) return '';
    if ((cell as { f?: string }).f) return `=${(cell as { f: string }).f}`;
    if (typeof cell.w === 'string') return cell.w;
    if (cell.v === undefined || cell.v === null) return '';
    return String(cell.v);
  };

  const headers = Array.from({ length: columnCount }).map((_, idx) => {
    const value = readCellText(range.s.r, range.s.c + idx).trim();
    return value || `Column ${idx + 1}`;
  });

  const previewRows: Array<Record<string, string>> = [];
  for (let rowOffset = 1; rowOffset < rowCount; rowOffset++) {
    const rowObj: Record<string, string> = {};
    for (let colOffset = 0; colOffset < columnCount; colOffset++) {
      const colName = columnIndexToName(colOffset);
      rowObj[colName] = readCellText(range.s.r + rowOffset, range.s.c + colOffset);
    }
    previewRows.push(rowObj);
  }

  return { headers, previewRows };
}

function buildNormalizedPreviewRows(
  rows: Record<string, unknown>[],
  headers: string[],
  limit = PREVIEW_ROW_LIMIT
): Array<Record<string, string>> {
  const previewRows = rows.slice(0, limit);
  return previewRows.map((row) => {
    const result: Record<string, string> = {};
    headers.forEach((header, idx) => {
      const colName = columnIndexToName(idx);
      result[colName] = String(row[header] ?? '');
    });
    return result;
  });
}

type ParsedFilePayload = {
  fileName: string;
  defaultSheetName: string;
  kind: 'members' | 'transactions' | 'unknown';
  sheets: Array<{
    sheetName: string;
    headers: string[];
    previewRows: Array<Record<string, string>>;
    totalRows: number;
    previewTruncated: boolean;
  }>;
};

type CachedFilePreview = {
  fileName: string;
  sheetName: string;
  headers: string[];
  rows: Array<Record<string, string>>;
};

const parsedPreviewCache = new Map<string, CachedFilePreview>();

// API endpoint for file uploads
app.post('/api/upload', upload.array('files'), async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).send('No files uploaded.');
  }

  const uploadedFiles = req.files as Express.Multer.File[];
  const members: Member[] = [];
  const mpesaTransactions: MpesaTransaction[] = [];
  const unsupportedFiles: string[] = [];
  const parsedFiles: ParsedFilePayload[] = [];

  try {
    for (const file of uploadedFiles) {
      const filePath = path.join(__dirname, '..', file.path);
      const ext = path.extname(file.originalname || file.path).toLowerCase();
      if (!['.csv', '.xlsx', '.xls'].includes(ext)) {
        unsupportedFiles.push(file.originalname);
        continue;
      }

      const workbookSheets = readWorkbookSheets(filePath, ext);
      if (workbookSheets.length === 0) continue;
      const workbook = XLSX.readFile(filePath, { raw: false, cellDates: true });

      const parsedSheets = workbookSheets
        .map(({ sheetName, rows }) => {
          if (rows.length === 0) return null;
          const workbookSheet = workbook.Sheets[sheetName];
          const structured = workbookSheet
            ? extractSheetStructuredPreview(workbookSheet)
            : { headers: [], previewRows: [] };
          const hasStructuredRows = structured.previewRows.length > 0;
          const headers = structured.headers.length > 0
            ? structured.headers
            : Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
          const normalizedFallbackRows = buildNormalizedPreviewRows(rows, headers, rows.length);
          const normalizedAllRows = hasStructuredRows ? structured.previewRows : normalizedFallbackRows;
          const normalizedPreviewRows = normalizedAllRows.slice(0, PREVIEW_ROW_LIMIT);
          parsedPreviewCache.set(`${file.originalname}::${sheetName}`, {
            fileName: file.originalname,
            sheetName,
            headers,
            rows: normalizedAllRows,
          });

          return {
            sheetName,
            headers,
            previewRows: normalizedPreviewRows,
            totalRows: rows.length,
            previewTruncated: rows.length > PREVIEW_ROW_LIMIT,
            allRows: rows,
          };
        })
        .filter(Boolean) as Array<{
          sheetName: string;
          headers: string[];
          previewRows: Array<Record<string, string>>;
          totalRows: number;
          previewTruncated: boolean;
          allRows: Record<string, unknown>[];
        }>;

      if (parsedSheets.length === 0) continue;

      const allRows = parsedSheets.flatMap((sheet) => sheet.allRows);
      const hasMembers = allRows.some((row) => row.memberId || row['Member ID']);
      const hasTransactions = allRows.some((row) => row.transactionId || row['Transaction ID'] || row.mpesaCode || row['M-Pesa Code']);

      if (hasMembers) {
        allRows.forEach((row) => {
          if (!(row.memberId || row['Member ID'])) return;
          members.push({
            memberId: String(row.memberId || row['Member ID'] || ''),
            name: String(row.name || row['Name'] || ''),
            phoneNumber: MeridianSemanticEngine.normalizePhone(String(row.phoneNumber || row['Phone Number'] || '')),
            expectedContribution: parseNumeric(row.expectedContribution || row['Expected Contribution']),
            recordedPayments: parseNumeric(row.recordedPayments || row['Recorded Payments']),
          });
        });
      }

      if (hasTransactions) {
        allRows.forEach((row) => {
          if (!(row.transactionId || row['Transaction ID'] || row.mpesaCode || row['M-Pesa Code'])) return;
          mpesaTransactions.push({
            transactionId: String(row.transactionId || row['Transaction ID'] || row.mpesaCode || row['M-Pesa Code'] || ''),
            phoneNumber: MeridianSemanticEngine.normalizePhone(String(row.phoneNumber || row['Phone Number'] || '')),
            amount: parseNumeric(row.amount || row['Amount']),
            date: toIsoDateOrNow(row.date || row['Date']),
            type: String(row.type || row['Type'] || 'PAYMENT').toUpperCase() as 'PAYMENT' | 'WITHDRAWAL' | 'DEPOSIT',
          });
        });
      }

      parsedFiles.push({
        fileName: file.originalname,
        defaultSheetName: parsedSheets[0].sheetName,
        kind: hasMembers ? 'members' : hasTransactions ? 'transactions' : 'unknown',
        sheets: parsedSheets.map(({ allRows: _allRows, ...sheet }) => sheet),
      });
    }

    currentMergedData = { members, mpesaTransactions, auditLogs: [] };
    res.status(200).json({
      message: 'Files uploaded and parsed successfully.',
      data: currentMergedData,
      unsupportedFiles,
      parsedFiles,
    });
  } catch (error) {
    console.error('[Upload] Parsing error', error);
    return res.status(500).json({
      message: 'Failed to parse uploaded files.',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  } finally {
    for (const file of uploadedFiles) {
      const filePath = path.join(__dirname, '..', file.path);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
  }
});

// API endpoint for progressive preview loading
app.get('/api/upload/preview', (req, res) => {
  const fileName = String(req.query.fileName || '');
  const sheetName = String(req.query.sheetName || '');
  const offset = Number(req.query.offset || 0);
  const limit = Number(req.query.limit || PREVIEW_PAGE_SIZE);

  if (!fileName || !sheetName) {
    return res.status(400).json({ message: 'fileName and sheetName are required' });
  }

  const cached = parsedPreviewCache.get(`${fileName}::${sheetName}`);
  if (!cached) {
    return res.status(404).json({ message: 'File preview not found. Please upload again.' });
  }

  const safeOffset = Number.isFinite(offset) && offset >= 0 ? offset : 0;
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(limit, PREVIEW_PAGE_SIZE) : PREVIEW_PAGE_SIZE;
  const rows = cached.rows.slice(safeOffset, safeOffset + safeLimit);
  const nextOffset = safeOffset + rows.length;

  return res.status(200).json({
    fileName: cached.fileName,
    sheetName: cached.sheetName,
    headers: cached.headers,
    rows,
    offset: safeOffset,
    nextOffset,
    totalRows: cached.rows.length,
    hasMore: nextOffset < cached.rows.length,
  });
});

// API endpoint for audit analysis
app.post('/api/audit', (req, res) => {
  const auditLogs = MeridianSemanticEngine.analyzeForensics(currentMergedData.members, currentMergedData.mpesaTransactions);
  currentMergedData.auditLogs = auditLogs;
  res.status(200).json({ message: 'Audit analysis complete.', auditLogs: currentMergedData.auditLogs });
});

// API endpoint for AI reasoning using Groq Cloud API
app.post('/api/ai/chat', async (req, res) => {
  const { message } = req.body;
  const messageLength = typeof message === 'string' ? message.length : 0;
  const messagePreview = buildSafeLogPreview(message);

  console.log('[AI Chat] Request received', { messageLength, messagePreview });
  
  try {
    const groq = new Groq({
      apiKey: process.env.GROQ_API_KEY,
    });

    console.log('[AI Chat] Calling Groq API');
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `You are Meridian AI, a financial forensic expert for Kenyan SACCOs. You analyze member data and M-Pesa transactions to detect fraud, phantom savings, and regulatory violations. Provide concise, professional financial insights.`
        },
        {
          role: 'user',
          content: `Context: ${JSON.stringify(currentMergedData.auditLogs.slice(0, 5))}
          
Member Summary: ${currentMergedData.members.length} members, Total Recorded Payments: KES ${currentMergedData.members.reduce((sum, m) => sum + m.recordedPayments, 0).toLocaleString()}
Transaction Summary: ${currentMergedData.mpesaTransactions.length} transactions, Total M-Pesa: KES ${currentMergedData.mpesaTransactions.reduce((sum, t) => sum + t.amount, 0).toLocaleString()}

User Question: ${message}`
        }
      ],
      model: 'llama-3.3-70b-versatile',
      max_tokens: 1024,
    });

    const response = chatCompletion.choices[0]?.message?.content || 'No response generated';
    console.log('[AI Chat] Response generated', {
      responseLength: response.length,
      responsePreview: buildSafeLogPreview(response, 50),
    });
    res.status(200).json({ response });
  } catch (error) {
    console.error('[AI Chat] Groq error', error);
    res.status(500).json({ message: 'AI Reasoning failed.', error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// API endpoint for generating PDF report
app.post('/api/generate-report', (req, res) => {
  const pythonProcess = spawn('python3', [path.join(__dirname, 'generate_pdf.py')]);
  let pdfPath = '';
  let errorOutput = '';

  pythonProcess.stdin.write(JSON.stringify(currentMergedData));
  pythonProcess.stdin.end();

  pythonProcess.stdout.on('data', (data) => {
    pdfPath += data.toString().trim();
  });

  pythonProcess.stderr.on('data', (data) => {
    errorOutput += data.toString();
  });

  pythonProcess.on('close', (code) => {
    if (code !== 0) {
      console.error(`Python script exited with code ${code}: ${errorOutput}`);
      return res.status(500).json({ message: 'Failed to generate PDF report.', error: errorOutput });
    }
    if (fs.existsSync(pdfPath)) {
      res.download(pdfPath, 'Meridian_AI_Audit_Report.pdf', (err) => {
        if (err) {
          console.error('Error sending file:', err);
          res.status(500).json({ message: 'Error sending PDF file.', error: err.message });
        } else {
          fs.unlinkSync(pdfPath); // Clean up generated PDF
        }
      });
    } else {
      res.status(500).json({ message: 'Generated PDF file not found.', path: pdfPath });
    }
  });
});

// Basic health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).send('Server is running');
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
