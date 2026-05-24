import * as DocumentPicker from 'expo-document-picker';
import { categorize } from './categorizer';

// Column name candidates for auto-detection (lowercase)
// Covers HDFC, SBI, ICICI, Axis, generic formats
const DATE_CANDIDATES = ['date', 'txn date', 'transaction date', 'tran date', 'value date', 'posting date', 'trans date'];
const DEBIT_CANDIDATES = [
  'debit', 'debit amount', 'withdrawal', 'withdrawal amount', 'dr', 'dr amount', 'debit(inr)',
  'withdrawal amount(inr)', 'withdrawal amount (inr)', 'withdrawal amount (inr )',  // ICICI variants
];
const CREDIT_CANDIDATES = [
  'credit', 'credit amount', 'deposit', 'deposit amount', 'cr', 'cr amount', 'credit(inr)',
  'deposit amount(inr)', 'deposit amount (inr)', 'deposit amount (inr )',           // ICICI variants
];
const DESC_CANDIDATES = ['description', 'narration', 'particulars', 'transaction remarks', 'remarks', 'details', 'transaction details', 'trans description'];
const AMOUNT_CANDIDATES = ['amount', 'transaction amount', 'trans amount'];
const MERCHANT_CANDIDATES = ['merchant', 'payee', 'beneficiary', 'vendor'];

// Extract a human-readable merchant from UPI/bank description strings
// Handles formats: UPI/Merchant/vpa@bank/..., VIN/Merchant/ref, INF/INFT/ref/PersonName
function extractMerchant(description: string): string {
  const parts = description.split('/').map((p) => p.trim()).filter((p) => p.length > 0);
  if (parts.length <= 1) return description.trim() || 'Unknown';

  const prefix = parts[0].toUpperCase();

  // UPI, VIN (Visa), VSI, BIL: merchant name is the second segment
  if (['UPI', 'VIN', 'VSI', 'BIL', 'ATM'].includes(prefix) && parts[1]) {
    return parts[1].trim();
  }

  // INF/INFT (incoming fund transfer): person name is the last meaningful segment
  if (prefix === 'INF' || parts[1]?.toUpperCase() === 'INFT') {
    // Last segment that isn't a numeric ref
    const name = [...parts].reverse().find((p) => !/^\d+$/.test(p));
    return name ?? parts[parts.length - 1];
  }

  return parts[0].trim() || 'Unknown';
}

export interface ParsedRow {
  date: string;
  amount: number;
  description: string;
  merchant: string;
  isDebit: boolean;
  category: string;
}

export interface ImportResult {
  rows: ParsedRow[];
  errors: string[];
  fileName: string;
}

// Minimal CSV parser — handles quoted fields with embedded commas/newlines
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  let i = 0;

  while (i < normalized.length) {
    const row: string[] = [];
    while (i < normalized.length) {
      if (normalized[i] === '"') {
        let cell = '';
        i++;
        while (i < normalized.length) {
          if (normalized[i] === '"' && normalized[i + 1] === '"') {
            cell += '"';
            i += 2;
          } else if (normalized[i] === '"') {
            i++;
            break;
          } else {
            cell += normalized[i++];
          }
        }
        row.push(cell.trim());
        if (normalized[i] === ',') i++;
        else break;
      } else {
        const commaIdx = normalized.indexOf(',', i);
        const newlineIdx = normalized.indexOf('\n', i);
        const end = commaIdx === -1 ? newlineIdx : newlineIdx === -1 ? commaIdx : Math.min(commaIdx, newlineIdx);
        if (end === -1) {
          row.push(normalized.slice(i).trim());
          i = normalized.length;
          break;
        }
        row.push(normalized.slice(i, end).trim());
        i = end + 1;
        if (normalized[end] === '\n') break;
      }
    }
    if (row.length > 0 && row.some((c) => c)) rows.push(row);
  }
  return rows;
}

function findCol(headers: string[], candidates: string[]): number {
  return headers.findIndex((h) => candidates.includes(h.toLowerCase().trim()));
}

function parseDate(raw: string): string {
  const s = raw.trim();
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return new Date(s).toISOString();
  // DD/MM/YYYY or DD-MM-YYYY
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (m) {
    const [, d, mo, y] = m;
    const year = y.length === 2 ? `20${y}` : y;
    const parsed = new Date(`${year}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`);
    if (!isNaN(parsed.getTime())) return parsed.toISOString();
  }
  const fallback = new Date(s);
  return isNaN(fallback.getTime()) ? new Date().toISOString() : fallback.toISOString();
}

function parseAmount(raw: string): number {
  if (!raw) return 0;
  const clean = raw.replace(/[₹$£,\s]/g, '');
  return Math.abs(parseFloat(clean) || 0);
}

export function parseCSVText(text: string, fileName = 'import.csv'): ImportResult {
  const errors: string[] = [];
  const rows: ParsedRow[] = [];
  const allRows = parseCSV(text);

  // Find the header row — first row whose cells match known column names
  let headerIdx = 0;
  for (let i = 0; i < Math.min(10, allRows.length); i++) {
    const lower = allRows[i].map((c) => c.toLowerCase().trim());
    const hasDate = lower.some((c) => DATE_CANDIDATES.includes(c));
    const hasAmt = lower.some((c) => [...DEBIT_CANDIDATES, ...AMOUNT_CANDIDATES].includes(c));
    if (hasDate || hasAmt) { headerIdx = i; break; }
  }

  const headers = allRows[headerIdx].map((h) => h.toLowerCase().trim());
  const dateCol = findCol(headers, DATE_CANDIDATES);
  const debitCol = findCol(headers, DEBIT_CANDIDATES);
  const creditCol = findCol(headers, CREDIT_CANDIDATES);
  const descCol = findCol(headers, DESC_CANDIDATES);
  const amountCol = findCol(headers, AMOUNT_CANDIDATES);
  const merchantCol = findCol(headers, MERCHANT_CANDIDATES);

  if (dateCol === -1) errors.push('No date column found. Expected: Date, Txn Date, Transaction Date');
  if (debitCol === -1 && amountCol === -1) errors.push('No amount column found. Expected: Debit, Amount, Withdrawal');
  if (descCol === -1) errors.push('No description column found. Expected: Description, Narration, Particulars');
  if (errors.length > 0) return { rows, errors, fileName };

  for (let i = headerIdx + 1; i < allRows.length; i++) {
    const row = allRows[i];
    if (row.every((c) => !c.trim())) continue;

    try {
      const dateRaw = dateCol >= 0 ? row[dateCol] ?? '' : '';
      const descRaw = descCol >= 0 ? row[descCol] ?? '' : '';
      const merchantRaw = merchantCol >= 0 ? row[merchantCol] ?? '' : '';

      let amount = 0;
      let isDebit = true;

      if (debitCol >= 0 && creditCol >= 0) {
        const dr = parseAmount(row[debitCol] ?? '');
        const cr = parseAmount(row[creditCol] ?? '');
        if (dr > 0) { amount = dr; isDebit = true; }
        else if (cr > 0) { amount = cr; isDebit = false; }
        else continue;
      } else if (debitCol >= 0) {
        amount = parseAmount(row[debitCol] ?? '');
        if (amount <= 0) continue;
        isDebit = true;
      } else if (amountCol >= 0) {
        const raw = row[amountCol] ?? '';
        amount = parseAmount(raw);
        // Negative amount = credit
        isDebit = !raw.trim().startsWith('-');
        if (amount <= 0) continue;
      }

      const merchant = merchantRaw || extractMerchant(descRaw);
      const category = categorize(merchant, descRaw);

      rows.push({
        date: parseDate(dateRaw),
        amount,
        description: descRaw,
        merchant,
        isDebit,
        category,
      });
    } catch {
      // Skip malformed rows silently
    }
  }

  return { rows, errors, fileName };
}

export async function pickAndParseCSV(): Promise<ImportResult | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['text/csv', 'text/plain', 'application/csv', 'application/vnd.ms-excel', '*/*'],
    copyToCacheDirectory: true,
  });

  if (result.canceled || !result.assets?.[0]) return null;

  const asset = result.assets[0];
  // fetch() works on both web (blob: URLs) and native (file: URIs)
  const response = await fetch(asset.uri);
  const text = await response.text();

  return parseCSVText(text, asset.name ?? 'import.csv');
}
