import * as DocumentPicker from 'expo-document-picker';
import { categorize } from './categorizer';
import type { ParsedRow } from './csvImporter';

// Google Pay Takeout JSON structure
interface TakeoutTransaction {
  'Transaction Date'?: string;
  'Transaction ID'?: string;
  Description?: string;
  'Paid to'?: string;
  'Received from'?: string;
  Amount?: string;
  Status?: string;
  'Payment Method'?: string;
}

function parseAmount(raw: string): number {
  return Math.abs(parseFloat(raw.replace(/[₹+\-,\s]/g, '')) || 0);
}

function parseDate(raw: string): string {
  const d = new Date(raw);
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

export interface TakeoutResult {
  rows: ParsedRow[];
  errors: string[];
  fileName: string;
}

export function parseTakeoutJSON(text: string, fileName = 'takeout.json'): TakeoutResult {
  const errors: string[] = [];
  const rows: ParsedRow[] = [];

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    errors.push('Invalid JSON file. Please export from Google Takeout and select the GPay JSON file.');
    return { rows, errors, fileName };
  }

  // Takeout can be an array directly or nested under a key
  const txns: TakeoutTransaction[] = Array.isArray(data)
    ? (data as TakeoutTransaction[])
    : (data as Record<string, unknown[]>)['transactions'] as TakeoutTransaction[]
      ?? (data as Record<string, unknown[]>)['Transaction List'] as TakeoutTransaction[]
      ?? [];

  if (!txns || txns.length === 0) {
    errors.push('No transactions found. Make sure you selected the GPay Takeout JSON file.');
    return { rows, errors, fileName };
  }

  for (const txn of txns) {
    try {
      if (txn.Status && !['Completed', 'SUCCESS', 'success'].includes(txn.Status)) continue;

      const amountRaw = txn.Amount ?? '';
      const amount = parseAmount(amountRaw);
      if (amount <= 0) continue;

      const isDebit = !amountRaw.trim().startsWith('+');
      const merchant = (isDebit ? txn['Paid to'] : txn['Received from']) ?? txn.Description ?? 'Unknown';
      const description = txn.Description ?? merchant;
      const date = parseDate(txn['Transaction Date'] ?? '');
      const category = categorize(merchant, description);

      rows.push({ date, amount, description, merchant, isDebit, category });
    } catch {
      // skip malformed rows
    }
  }

  return { rows, errors, fileName };
}

export async function pickAndParseTakeout(): Promise<TakeoutResult | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'text/plain', '*/*'],
    copyToCacheDirectory: true,
  });

  if (result.canceled || !result.assets?.[0]) return null;

  const asset = result.assets[0];
  const response = await fetch(asset.uri);
  const text = await response.text();

  return parseTakeoutJSON(text, asset.name ?? 'takeout.json');
}
