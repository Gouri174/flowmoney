/**
 * PDF importer — supports:
 *   • Google Pay transaction statement PDF
 *   • ICICI Bank savings account statement PDF
 *
 * Works on web (Vercel) via pdfjs-dist.
 * On native (iOS/Android), shows a helpful error.
 */
import { Platform } from 'react-native';
import { categorize } from './categorizer';
import type { ParsedRow } from './csvImporter';

export type PdfType = 'gpay' | 'icici' | 'unknown';

export interface PdfImportResult {
  rows: ParsedRow[];
  errors: string[];
  fileName: string;
  type: PdfType;
}

// ── Month map for GPay date parsing ─────────────────────────────────────────
const MONTH_MAP: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

function rupee(str: string): number {
  return parseFloat(str.replace(/[₹,\s]/g, '')) || 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// GOOGLE PAY PDF PARSER
// Each transaction block (line-by-line):
//   "DD Mon, YYYY"
//   "HH:MM AM/PM"
//   "Paid to MERCHANT"  or  "Received from MERCHANT"
//   "UPI Transaction ID: XXXXXXXXXX"
//   "Paid by/to BANK NAME"
//   "₹AMOUNT"
// ─────────────────────────────────────────────────────────────────────────────
function parseGPayPdf(text: string): ParsedRow[] {
  const rows: ParsedRow[] = [];
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  let i = 0;
  while (i < lines.length) {
    // Match date line: "01 May, 2026"
    const dateMatch = lines[i]?.match(/^(\d{1,2})\s+(\w{3,9}),\s+(\d{4})$/);
    if (!dateMatch) { i++; continue; }

    const day = parseInt(dateMatch[1]);
    const monthIdx = MONTH_MAP[dateMatch[2].toLowerCase().slice(0, 3)];
    const year = parseInt(dateMatch[3]);
    if (monthIdx === undefined) { i++; continue; }

    // Time line: "08:31 AM"
    const timeStr = lines[i + 1] ?? '';
    const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    let hours = timeMatch ? parseInt(timeMatch[1]) : 0;
    const mins = timeMatch ? parseInt(timeMatch[2]) : 0;
    if (timeMatch) {
      const meridiem = timeMatch[3].toUpperCase();
      if (meridiem === 'PM' && hours !== 12) hours += 12;
      if (meridiem === 'AM' && hours === 12) hours = 0;
    }
    const date = new Date(year, monthIdx, day, hours, mins);

    // Description: "Paid to X" / "Received from X"
    const descLine = lines[i + 2] ?? '';
    const isPaid = descLine.startsWith('Paid to ');
    const isReceived = descLine.startsWith('Received from ');
    if (!isPaid && !isReceived) { i++; continue; }

    const merchant = isPaid
      ? descLine.replace('Paid to ', '').trim()
      : descLine.replace('Received from ', '').trim();

    // UPI Transaction ID line: "UPI Transaction ID: 122411907966"
    const upiLine = lines[i + 3] ?? '';
    const upiMatch = upiLine.match(/UPI Transaction ID:\s*(\d+)/i);
    if (!upiMatch) { i++; continue; }
    const upiId = upiMatch[1];

    // Amount line: search next few lines for ₹AMOUNT
    let amount = 0;
    let skipAhead = 4;
    for (let k = 4; k <= 6; k++) {
      const amtMatch = lines[i + k]?.match(/₹([\d,]+(?:\.\d{1,2})?)/);
      if (amtMatch) { amount = rupee(amtMatch[1]); skipAhead = k; break; }
    }
    if (amount <= 0) { i++; continue; }

    rows.push({
      date: date.toISOString(),
      merchant,
      amount,
      description: descLine,
      isDebit: isPaid,
      // Use UPI ID so duplicates across GPay + ICICI PDFs are caught
      category: categorize(merchant, descLine),
    });

    // Store upiId on the row object for external_id generation in AppContext
    (rows[rows.length - 1] as any).__upiId = upiId;

    i += skipAhead + 1;
  }
  return rows;
}

// ─────────────────────────────────────────────────────────────────────────────
// ICICI BANK PDF PARSER  (coordinate-based column detection)
// Table columns: DATE | MODE | PARTICULARS | DEPOSITS | WITHDRAWALS | BALANCE
// ─────────────────────────────────────────────────────────────────────────────
function parseIciciPdf(
  items: Array<{ str: string; x: number; y: number }>
): ParsedRow[] {
  if (items.length === 0) return [];

  // Group items by row (3pt y-tolerance)
  const rowMap = new Map<number, Array<{ str: string; x: number }>>();
  for (const item of items) {
    if (!item.str.trim()) continue;
    const key = Math.round(item.y / 3) * 3;
    const arr = rowMap.get(key) ?? [];
    arr.push({ str: item.str, x: item.x });
    rowMap.set(key, arr);
  }

  // Sort top-to-bottom (y increases downward after flip)
  const sortedRows = [...rowMap.entries()].sort((a, b) => a[0] - b[0]);

  // Auto-detect column boundaries from header row
  let depositX = 400, withdrawX = 480, balanceX = 555, particularsMaxX = 385;
  for (const [, rowItems] of sortedRows) {
    const upper = rowItems.map(i => i.str.toUpperCase());
    if (upper.includes('DEPOSITS') || upper.includes('WITHDRAWALS')) {
      const d = rowItems.find(i => i.str.toUpperCase() === 'DEPOSITS');
      const w = rowItems.find(i => i.str.toUpperCase() === 'WITHDRAWALS');
      const b = rowItems.find(i => i.str.toUpperCase() === 'BALANCE');
      if (d) depositX = d.x;
      if (w) withdrawX = w.x;
      if (b) balanceX = b.x;
      particularsMaxX = depositX - 8;
      break;
    }
  }

  const rows: ParsedRow[] = [];
  let currentDate: Date | null = null;
  let currentParticulars = '';
  let currentDeposit = 0;
  let currentWithdraw = 0;
  let currentBalance: number | null = null;

  function flush() {
    if (!currentDate) return;
    if (currentDeposit === 0 && currentWithdraw === 0) return;
    if (!currentParticulars.trim()) return;
    if (/POSDEC CHG|TDS CHG|SERVICE CHARGE|B\/F$/i.test(currentParticulars.trim())) {
      currentDate = null; return;
    }

    const amount = currentDeposit > 0 ? currentDeposit : currentWithdraw;
    const isDebit = currentWithdraw > 0;
    const merchant = extractIciciMerchant(currentParticulars);

    // Extract UPI TXN ID for cross-source dedup
    const upiIdMatch = currentParticulars.match(/\/(\d{10,12})\//);
    const upiId = upiIdMatch?.[1];

    const row: ParsedRow & { __upiId?: string } = {
      date: currentDate.toISOString(),
      merchant,
      amount,
      description: currentParticulars.trim(),
      isDebit,
      category: categorize(merchant, currentParticulars),
    };
    if (upiId) row.__upiId = upiId;
    rows.push(row);

    currentDate = null;
    currentParticulars = '';
    currentDeposit = 0;
    currentWithdraw = 0;
    currentBalance = null;
  }

  for (const [, rowItems] of sortedRows) {
    const sorted = [...rowItems].sort((a, b) => a.x - b.x);
    const allText = sorted.map(i => i.str).join(' ');

    // Skip header/footer lines
    if (/Page \d+ of \d+|Statement of Transactions|ACCOUNT TYPE|TOTAL DEPOSITS/i.test(allText)) continue;
    if (/DATE.*PARTICULARS|DEPOSITS.*WITHDRAWALS|BALANCE$/i.test(allText)) continue;
    if (/Note:|www\.icicibank|Legends for|Sincerely|Team ICICI|REGD ADDRESS/i.test(allText)) continue;

    // Check for date at leftmost position
    const left = sorted[0];
    const dateMatch = left?.str.match(/^(\d{2})-(\d{2})-(\d{4})$/);

    if (dateMatch) {
      flush(); // save previous row
      const [, day, mon, yr] = dateMatch;
      currentDate = new Date(parseInt(yr), parseInt(mon) - 1, parseInt(day));
      currentParticulars = '';
      currentDeposit = 0;
      currentWithdraw = 0;
      currentBalance = null;
    }

    if (!currentDate) continue;

    // Classify each item in the row by x-position
    for (const item of sorted) {
      if (item === left && dateMatch) continue; // skip date itself

      const numVal = parseFloat(item.str.replace(/,/g, ''));
      const isNum = /^[\d,]+\.\d{2}$/.test(item.str.replace(/,/g, '').trim()) && !isNaN(numVal);

      if (isNum) {
        if (item.x >= balanceX) {
          currentBalance = numVal;
        } else if (item.x >= withdrawX) {
          if (currentWithdraw === 0) currentWithdraw = numVal;
        } else if (item.x >= depositX) {
          if (currentDeposit === 0) currentDeposit = numVal;
        }
        // Numbers inside particulars zone = ref numbers, skip
      } else if (item.x < particularsMaxX) {
        currentParticulars += (currentParticulars ? ' ' : '') + item.str;
      }
    }
  }
  flush(); // flush last row

  return rows;
}

// Extract clean merchant name from ICICI PARTICULARS
// Format: UPI/SHORT/vpa@bank/.../BANK/TXN_ID/HASH/FULL_MERCHANT_NAME
function extractIciciMerchant(particulars: string): string {
  const p = particulars.trim();
  const parts = p.split('/').map(s => s.trim()).filter(s => s.length > 0);
  const prefix = (parts[0] ?? '').toUpperCase().trim();

  if (['UPI', 'BIL', 'VIN', 'VSI'].includes(prefix)) {
    // Walk backwards — the last human-readable segment is the full merchant name
    for (let i = parts.length - 1; i >= 1; i--) {
      const seg = parts[i].trim();
      if (
        seg.length > 1 &&
        !/^[A-F0-9]{16,}$/i.test(seg) &&           // not a hex hash
        !/^\d+$/.test(seg) &&                        // not a pure number
        !/^(ICICI|HDFC|AXIS|SBI|YES|KOTAK|AIRTEL|NSDL|PAYTM)\s?(BANK|PAY|PAYME)?$/i.test(seg) // not a bank name
      ) {
        return seg;
      }
    }
    return parts[1] || 'Unknown';
  }

  if (/^NEFT/i.test(prefix)) {
    const raw = p.replace(/^NEFT-[A-Z0-9]+-?/i, '');
    const words = raw.split(/[\s\-]+/).filter(w => w.length > 1);
    const seen = new Set<string>();
    const out: string[] = [];
    for (const w of words) {
      if (!seen.has(w.toUpperCase())) { seen.add(w.toUpperCase()); out.push(w); }
      if (out.length >= 5) break;
    }
    return out.join(' ') || 'NEFT Transfer';
  }

  if (/RFND|REFUND/i.test(p)) return 'Refund';
  if (/POSDEC/i.test(p)) return 'Bank Charges';
  if (/ICICI DIRECT/i.test(p)) return 'ICICI Direct';

  if (parts.length >= 2) return parts[1];
  return parts[0] || 'Unknown';
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN ENTRY POINTS
// ─────────────────────────────────────────────────────────────────────────────
export async function parsePdfFile(uri: string, fileName = 'statement.pdf'): Promise<PdfImportResult> {
  if (Platform.OS !== 'web') {
    return {
      rows: [], fileName, type: 'unknown',
      errors: ['PDF import is only supported in the web browser. Open flowmoney-ten.vercel.app on your computer.'],
    };
  }

  try {
    // Dynamic import keeps native bundle unaffected
    const pdfjsLib = await import('pdfjs-dist');

    // Use official CDN worker — avoids bundling the heavy worker JS
    (pdfjsLib as any).GlobalWorkerOptions.workerSrc =
      `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${(pdfjsLib as any).version}/pdf.worker.min.mjs`;

    const response = await fetch(uri);
    if (!response.ok) throw new Error(`Failed to fetch PDF (${response.status})`);
    const buffer = await response.arrayBuffer();

    const pdf = await (pdfjsLib as any).getDocument({ data: buffer }).promise;

    // Collect all text items with (x, y) coordinates across all pages
    const allItems: Array<{ str: string; x: number; y: number }> = [];
    let fullText = '';
    let pageOffset = 0;

    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();

      for (const item of content.items) {
        if (!('str' in item) || !item.str.trim()) continue;
        const x = item.transform[4];
        const y = viewport.height - item.transform[5] + pageOffset; // flip y; stack pages
        allItems.push({ str: item.str, x, y });
        fullText += item.str + '\n';
      }
      pageOffset += viewport.height + 20; // 20pt gap between pages
    }

    // Auto-detect PDF type
    let type: PdfType = 'unknown';
    if (/Google Pay|UPI Transaction ID/i.test(fullText)) type = 'gpay';
    else if (/WITHDRAWALS|ICICI Bank|Savings Account/i.test(fullText)) type = 'icici';

    let rows: ParsedRow[] = [];
    if (type === 'gpay') rows = parseGPayPdf(fullText);
    else if (type === 'icici') rows = parseIciciPdf(allItems);

    return {
      rows,
      errors: rows.length === 0
        ? ['No transactions found. Please upload a Google Pay or ICICI Bank statement PDF.']
        : [],
      fileName,
      type,
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
