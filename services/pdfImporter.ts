/**
 * PDF importer — supports:
 *   • Google Pay transaction statement PDF
 *   • Any Indian bank statement PDF with standard table format
 *     (ICICI, HDFC, SBI, Axis, Kotak, YES Bank, IndusInd, Federal, etc.)
 *
 * Uses pdfjs-dist for text extraction with coordinates.
 * Web only — shows a helpful error on native.
 */
import { Platform } from 'react-native';
import { categorize } from './categorizer';
import type { ParsedRow } from './csvImporter';

export type PdfType = 'gpay' | 'bank' | 'unknown';

export interface PdfImportResult {
  rows: ParsedRow[];
  errors: string[];
  fileName: string;
  type: PdfType;
  bankName?: string;
}

// ── Month name → 0-indexed ──────────────────────────────────────────────────
const MONTH_IDX: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

function rupee(str: string): number {
  return parseFloat(str.replace(/[₹,\s]/g, '')) || 0;
}

// ── Date parser (handles any Indian bank format) ────────────────────────────
function parseAnyDate(str: string): Date | null {
  const s = str.trim();
  // DD-MM-YYYY  or  DD/MM/YYYY  or  DD-MM-YY  or  DD/MM/YY
  let m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m) {
    const yr = m[3].length === 2 ? `20${m[3]}` : m[3];
    const d = new Date(`${yr}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`);
    if (!isNaN(d.getTime())) return d;
  }
  // YYYY-MM-DD
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) { const d = new Date(s); if (!isNaN(d.getTime())) return d; }
  // DD MMM YYYY  or  DD-MMM-YYYY  or  DD MMM YY
  m = s.match(/^(\d{1,2})[\s\-]([A-Za-z]{3})[\s\-](\d{2,4})$/);
  if (m) {
    const yr = m[3].length === 2 ? `20${m[3]}` : m[3];
    const mon = MONTH_IDX[m[2].toLowerCase()];
    if (mon !== undefined) return new Date(parseInt(yr), mon, parseInt(m[1]));
  }
  return null;
}

function isDateStr(s: string): boolean {
  return parseAnyDate(s) !== null;
}
function isAmountStr(s: string): boolean {
  return /^[\d,]+\.\d{2}$/.test(s.replace(/[₹\s,]/g, '').trim());
}
function parseAmountStr(s: string): number {
  return parseFloat(s.replace(/[₹,\s]/g, '')) || 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// GOOGLE PAY PDF PARSER
// ─────────────────────────────────────────────────────────────────────────────
function parseGPayPdf(text: string): ParsedRow[] {
  const rows: ParsedRow[] = [];
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  let i = 0;
  while (i < lines.length) {
    const dateMatch = lines[i]?.match(/^(\d{1,2})\s+(\w{3,9}),\s+(\d{4})$/);
    if (!dateMatch) { i++; continue; }

    const day = parseInt(dateMatch[1]);
    const mon = MONTH_IDX[dateMatch[2].toLowerCase().slice(0, 3)];
    const yr = parseInt(dateMatch[3]);
    if (mon === undefined) { i++; continue; }

    const timeStr = lines[i + 1] ?? '';
    const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    let hours = timeMatch ? parseInt(timeMatch[1]) : 0;
    const mins = timeMatch ? parseInt(timeMatch[2]) : 0;
    if (timeMatch) {
      if (timeMatch[3].toUpperCase() === 'PM' && hours !== 12) hours += 12;
      if (timeMatch[3].toUpperCase() === 'AM' && hours === 12) hours = 0;
    }

    const descLine = lines[i + 2] ?? '';
    const isPaid = descLine.startsWith('Paid to ');
    const isReceived = descLine.startsWith('Received from ');
    if (!isPaid && !isReceived) { i++; continue; }

    const merchant = isPaid
      ? descLine.replace('Paid to ', '').trim()
      : descLine.replace('Received from ', '').trim();

    const upiLine = lines[i + 3] ?? '';
    const upiMatch = upiLine.match(/UPI Transaction ID:\s*(\d+)/i);
    if (!upiMatch) { i++; continue; }

    let amount = 0;
    let skipAhead = 4;
    for (let k = 4; k <= 6; k++) {
      const amtMatch = lines[i + k]?.match(/₹([\d,]+(?:\.\d{1,2})?)/);
      if (amtMatch) { amount = rupee(amtMatch[1]); skipAhead = k; break; }
    }
    if (amount <= 0) { i++; continue; }

    const row: ParsedRow & { __upiId?: string } = {
      date: new Date(yr, mon, day, hours, mins).toISOString(),
      merchant,
      amount,
      description: descLine,
      isDebit: isPaid,
      category: categorize(merchant, descLine),
    };
    row.__upiId = upiMatch[1];
    rows.push(row);
    i += skipAhead + 1;
  }
  return rows;
}

// ─────────────────────────────────────────────────────────────────────────────
// UNIVERSAL BANK STATEMENT PDF PARSER
//
// Strategy:
//   1. Group text items by row using y-coordinate
//   2. Find the header row by matching known column name patterns
//   3. Record x-positions of: date, description, debit, credit, balance columns
//   4. For every subsequent data row: classify each cell by x-position
//   5. Handle multi-line description rows (continuation lines)
// ─────────────────────────────────────────────────────────────────────────────

// Column header keyword patterns — covers all major Indian banks
const COL_HEADER = {
  date:   /^(date|txn\s*date|trans?\.?\s*date|tran\s*date|value\s*dt\.?|posting\s*date|transaction\s*date|entry\s*date)$/i,
  desc:   /^(narration|particulars|description|details?|transaction\s*details?|trans?\s*desc\.?|remarks?|cheque\s*details?|reference)$/i,
  debit:  /^(debit|dr\.?|withdrawal|withdrawal\s*amt\.?|debit\s*amt\.?|debit\s*amount|withdrawals?|amount\s*dr\.?)$/i,
  credit: /^(credit|cr\.?|deposit|deposit\s*amt\.?|credit\s*amt\.?|credit\s*amount|deposits?|amount\s*cr\.?)$/i,
  balance:/^(balance|bal\.?|closing\s*balance|running\s*balance|available\s*balance)$/i,
};

interface Cols {
  dateX: number;        // start of date col (usually leftmost)
  descMaxX: number;     // description col ends before debit col
  debitX: number;       // debit col starts here
  creditX: number;      // credit col starts here
  balanceX: number;     // balance col starts here
}

function detectColumns(
  sortedRows: [number, Array<{ str: string; x: number }>][]
): Cols | null {
  for (const [, rowItems] of sortedRows) {
    const matches = { date: -1, desc: -1, debit: -1, credit: -1, balance: -1 };
    let found = 0;

    for (const item of rowItems) {
      const s = item.str.trim();
      for (const [key, re] of Object.entries(COL_HEADER) as [keyof typeof COL_HEADER, RegExp][]) {
        if (re.test(s) && matches[key] === -1) {
          matches[key] = item.x;
          found++;
        }
      }
    }

    // Need at least: debit + balance (or credit + balance) to proceed
    if (found >= 2 && matches.balance > 0 && (matches.debit > 0 || matches.credit > 0)) {
      // If only one of debit/credit found, estimate the other
      if (matches.debit === -1 && matches.credit > 0) matches.debit = matches.credit - 60;
      if (matches.credit === -1 && matches.debit > 0) matches.credit = matches.debit + 60;

      // desc ends just before the first amount column
      const firstAmtX = Math.min(
        ...[matches.debit, matches.credit].filter(x => x > 0)
      );
      const descEnd = firstAmtX - 5;

      return {
        dateX: matches.date >= 0 ? matches.date : 0,
        descMaxX: descEnd,
        debitX: matches.debit > 0 ? matches.debit : firstAmtX,
        creditX: matches.credit > 0 ? matches.credit : firstAmtX + 60,
        balanceX: matches.balance,
      };
    }
  }
  return null;
}

// Skip rows that are clearly not transaction data
const SKIP_ROW_RE = /page\s*\d+\s*(of|\/)\s*\d+|statement\s*(of\s*)?trans|opening\s*balance|closing\s*balance|total\s*(debit|credit|amount)|account\s*(number|no\.?|type)|customer\s*(id|name)|sincerely|dear\s+customer|ifsc|micr|nominee|^b\/f\s*$/i;

function parseBankStatementPdf(
  items: Array<{ str: string; x: number; y: number }>
): ParsedRow[] {
  if (items.length === 0) return [];

  // Group items by row (4pt y-tolerance)
  const rowMap = new Map<number, Array<{ str: string; x: number }>>();
  for (const item of items) {
    if (!item.str.trim()) continue;
    const key = Math.round(item.y / 4) * 4;
    const arr = rowMap.get(key) ?? [];
    arr.push({ str: item.str, x: item.x });
    rowMap.set(key, arr);
  }
  const sortedRows = [...rowMap.entries()].sort((a, b) => a[0] - b[0]);

  // Find column layout
  const cols = detectColumns(sortedRows);
  if (!cols) return []; // no recognizable table structure

  const rows: ParsedRow[] = [];
  let pendingDate: Date | null = null;
  let pendingDesc = '';
  let pendingDebit = 0;
  let pendingCredit = 0;

  function flush() {
    if (!pendingDate) return;
    if (pendingDebit === 0 && pendingCredit === 0) return;
    if (!pendingDesc.trim()) return;

    const isDebit = pendingDebit > 0;
    const amount = isDebit ? pendingDebit : pendingCredit;
    const merchant = extractMerchant(pendingDesc);

    // Extract UPI TXN ID for cross-source dedup
    const upiIdMatch = pendingDesc.match(/\/(\d{10,12})\//);

    const row: ParsedRow & { __upiId?: string } = {
      date: pendingDate.toISOString(),
      merchant,
      amount,
      description: pendingDesc.trim(),
      isDebit,
      category: categorize(merchant, pendingDesc),
    };
    if (upiIdMatch?.[1]) row.__upiId = upiIdMatch[1];
    rows.push(row);

    pendingDate = null;
    pendingDesc = '';
    pendingDebit = 0;
    pendingCredit = 0;
  }

  // Some banks put date on its own line, others inline with description
  // We handle both: if leftmost item is a date, start a new row
  for (const [, rowItems] of sortedRows) {
    const sorted = [...rowItems].sort((a, b) => a.x - b.x);
    const rowText = sorted.map(i => i.str).join(' ');

    if (SKIP_ROW_RE.test(rowText.trim())) continue;

    // Check if any header col keyword present → skip
    let isHeaderRow = false;
    for (const re of Object.values(COL_HEADER)) {
      if (sorted.some(i => re.test(i.str.trim()))) { isHeaderRow = true; break; }
    }
    if (isHeaderRow) continue;

    // Classify each item
    let rowDate: Date | null = null;
    let rowDesc = '';
    let rowDebit = 0;
    let rowCredit = 0;
    let rowHasBalance = false;

    for (const item of sorted) {
      const s = item.str.trim();
      if (!s) continue;

      // Balance column → just marks end of row, don't use value
      if (item.x >= cols.balanceX) {
        if (isAmountStr(s)) rowHasBalance = true;
        continue;
      }

      // Debit column
      if (item.x >= cols.debitX && item.x < cols.creditX) {
        if (isAmountStr(s) && parseAmountStr(s) > 0) rowDebit = parseAmountStr(s);
        continue;
      }

      // Credit column
      if (item.x >= cols.creditX && item.x < cols.balanceX) {
        if (isAmountStr(s) && parseAmountStr(s) > 0) rowCredit = parseAmountStr(s);
        continue;
      }

      // Description / date zone (x < debitX)
      if (item.x < cols.descMaxX) {
        // Is it a date?
        const d = parseAnyDate(s);
        if (d && !rowDate) {
          rowDate = d;
        } else if (!isAmountStr(s)) {
          rowDesc += (rowDesc ? ' ' : '') + s;
        }
      }
    }

    // If this row starts a new transaction (has a date)
    if (rowDate) {
      flush(); // save previous
      pendingDate = rowDate;
      pendingDesc = rowDesc;
      pendingDebit = rowDebit;
      pendingCredit = rowCredit;
    } else if (pendingDate) {
      // Continuation line — append description, merge amounts
      if (rowDesc) pendingDesc += ' ' + rowDesc;
      if (rowDebit > 0 && pendingDebit === 0) pendingDebit = rowDebit;
      if (rowCredit > 0 && pendingCredit === 0) pendingCredit = rowCredit;
    }
  }
  flush();

  return rows;
}

// ── Universal merchant extractor ────────────────────────────────────────────
// Handles:
//   UPI/SHORT/vpa@bank/.../TXN_ID/HASH/FULL_MERCHANT  (ICICI, Axis)
//   UPI-TXN_ID-MERCHANT-VPA-BANK                      (HDFC)
//   NEFT/IMPS-REF-MERCHANT                             (all banks)
//   ATM...                                             (ATM withdrawal)
//   Plain text description                             (non-UPI)
function extractMerchant(description: string): string {
  const d = description.trim();

  // Slash-separated UPI (ICICI/Axis style)
  if (/^(UPI|BIL|VIN|VSI)\//i.test(d)) {
    const parts = d.split('/').map(s => s.trim()).filter(s => s.length > 0);
    // Walk backward: last non-hash, non-numeric, non-bank-name segment
    for (let i = parts.length - 1; i >= 1; i--) {
      const seg = parts[i];
      if (
        seg.length > 1 &&
        !/^[A-F0-9]{16,}$/i.test(seg) &&
        !/^\d+$/.test(seg) &&
        !/^(ICICI|HDFC|AXIS|SBI|YES|KOTAK|AIRTEL|NSDL|PAYTM|INDUS|FEDERAL|BOB|PNB|CANARA)\s*(BANK|PAY)?$/i.test(seg)
      ) return seg;
    }
    return parts[1] || 'Unknown';
  }

  // Hyphen-separated UPI (HDFC style): UPI-TXNID-MERCHANT-VPA-BANK or UPI/MERCHANT-VPA
  if (/^UPI[-\/]/i.test(d)) {
    const parts = d.split(/[-\/]/).map(s => s.trim()).filter(s => s.length > 0);
    for (const seg of parts.slice(1)) {
      if (seg.length > 2 && !/^\d+$/.test(seg) && !/^(UPI|BANK|PAY)$/i.test(seg)) return seg;
    }
  }

  // NEFT/IMPS: NEFT-REF-MERCHANT or NEFT/REF/MERCHANT
  if (/^(NEFT|IMPS|RTGS)/i.test(d)) {
    const raw = d.replace(/^(NEFT|IMPS|RTGS)[-\/][A-Z0-9]+[-\/]?/i, '');
    const words = raw.split(/[\s\-\/]+/).filter(w => w.length > 1);
    const seen = new Set<string>();
    const out: string[] = [];
    for (const w of words) {
      if (!/^\d+$/.test(w) && !seen.has(w.toUpperCase())) {
        seen.add(w.toUpperCase()); out.push(w);
      }
      if (out.length >= 5) break;
    }
    return out.join(' ') || d.split(/[-\/]/)[0] || 'Transfer';
  }

  // ATM
  if (/^ATM/i.test(d)) return 'ATM Withdrawal';

  // Bank charges
  if (/CHG|CHARGE|GST|FEE|PENALTY|INTEREST/i.test(d)) return 'Bank Charges';

  // Refund
  if (/RFND|REFUND|REVERSAL|RVSL/i.test(d)) return 'Refund';

  // Fallback: take first meaningful segment (up to 40 chars)
  const clean = d.replace(/^[\w]+[-\/]/, '').replace(/\s{2,}/g, ' ').trim();
  return clean.slice(0, 40) || 'Unknown';
}

// ─────────────────────────────────────────────────────────────────────────────
// BANK NAME DETECTOR
// ─────────────────────────────────────────────────────────────────────────────
function detectBankName(text: string): string {
  if (/ICICI/i.test(text)) return 'ICICI Bank';
  if (/HDFC/i.test(text)) return 'HDFC Bank';
  if (/State Bank|SBI/i.test(text)) return 'SBI';
  if (/Axis Bank/i.test(text)) return 'Axis Bank';
  if (/Kotak/i.test(text)) return 'Kotak Bank';
  if (/YES BANK/i.test(text)) return 'YES Bank';
  if (/IndusInd/i.test(text)) return 'IndusInd Bank';
  if (/Federal Bank/i.test(text)) return 'Federal Bank';
  if (/Bank of Baroda|BOB/i.test(text)) return 'Bank of Baroda';
  if (/Punjab National|PNB/i.test(text)) return 'PNB';
  if (/Canara Bank/i.test(text)) return 'Canara Bank';
  if (/RBL Bank/i.test(text)) return 'RBL Bank';
  if (/IDFC/i.test(text)) return 'IDFC Bank';
  if (/AU Small/i.test(text)) return 'AU Small Finance Bank';
  return 'Bank';
}

// ─────────────────────────────────────────────────────────────────────────────
// CDN LOADER — loads pdfjs v3 UMD build as a <script> tag.
// This completely avoids Metro bundler trying to bundle pdfjs-dist
// (which fails due to dynamic require() calls with computed IDs).
// ─────────────────────────────────────────────────────────────────────────────
const PDFJS_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
const PDFJS_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

function loadPdfjsFromCdn(): Promise<any> {
  // Return cached instance if already loaded
  if (typeof window !== 'undefined' && (window as any).__flowPdfjs) {
    return Promise.resolve((window as any).__flowPdfjs);
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = PDFJS_CDN;
    script.async = true;
    script.onload = () => {
      const lib = (window as any).pdfjsLib;
      if (!lib) { reject(new Error('pdfjsLib not found after script load')); return; }
      lib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
      (window as any).__flowPdfjs = lib;
      resolve(lib);
    };
    script.onerror = () => reject(new Error('Failed to load PDF.js from CDN. Check your internet connection.'));
    document.head.appendChild(script);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN ENTRY POINT
// ─────────────────────────────────────────────────────────────────────────────
export async function parsePdfFile(uri: string, fileName = 'statement.pdf'): Promise<PdfImportResult> {
  if (Platform.OS !== 'web') {
    return {
      rows: [], fileName, type: 'unknown',
      errors: ['PDF import works in the web browser only. Open flowmoney-ten.vercel.app on your computer.'],
    };
  }

  try {
    // Load pdfjs from CDN via <script> tag — avoids Metro bundler dynamic-require errors.
    // Uses pdfjs v3 UMD build (exposes window.pdfjsLib).
    const pdfjsLib = await loadPdfjsFromCdn();

    const response = await fetch(uri);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const buffer = await response.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;

    const allItems: Array<{ str: string; x: number; y: number }> = [];
    let fullText = '';
    let pageOffset = 0;

    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();

      for (const item of content.items as any[]) {
        if (!item.str?.trim()) continue;
        const x = item.transform[4];
        const y = viewport.height - item.transform[5] + pageOffset;
        allItems.push({ str: item.str, x, y });
        fullText += item.str + '\n';
      }
      pageOffset += viewport.height + 20;
    }

    // Detect PDF type
    let type: PdfType = 'unknown';
    if (/Google Pay|UPI Transaction ID/i.test(fullText)) type = 'gpay';
    else if (/debit|credit|withdrawal|deposit|balance|narration|particulars/i.test(fullText)) type = 'bank';

    let rows: ParsedRow[] = [];
    let bankName: string | undefined;

    if (type === 'gpay') {
      rows = parseGPayPdf(fullText);
    } else if (type === 'bank') {
      bankName = detectBankName(fullText);
      rows = parseBankStatementPdf(allItems);
    }

    return {
      rows,
      errors: rows.length === 0
        ? [`No transactions found in this PDF. Supported: Google Pay statements, and bank statements from ICICI, HDFC, SBI, Axis, Kotak, YES Bank, and others with standard table format.`]
        : [],
      fileName,
      type,
      bankName,
    };
  } catch (err: any) {
    return {
      rows: [],
      errors: [`Could not read PDF: ${err?.message ?? 'Unknown error'}`],
      fileName,
      type: 'unknown',
    };
  }
}

export async function pickAndParsePdf(): Promise<PdfImportResult | null> {
  const DocumentPicker = await import('expo-document-picker');
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/pdf', '*/*'],
    copyToCacheDirectory: true,
  });
  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];
  return parsePdfFile(asset.uri, asset.name ?? 'statement.pdf');
}
