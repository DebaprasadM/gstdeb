"use client";

export interface ScannedField<T> {
  value: T;
  /** 0-100. Below 60 is flagged for review. */
  confidence: number;
}

export interface ScannedLine {
  description: ScannedField<string>;
  quantity: ScannedField<number>;
  rate: ScannedField<number>;
  hsn: ScannedField<string>;
}

export interface ScannedInvoice {
  invoiceNumber: ScannedField<string>;
  invoiceDate: ScannedField<string>; // YYYY-MM-DD or ""
  partyName: ScannedField<string>;
  partyGstin: ScannedField<string>;
  taxableValue: ScannedField<number>;
  totalValue: ScannedField<number>;
  lines: ScannedLine[];
  overall: number;
  rawText: string;
}

const GSTIN_RE = /\b\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]\b/;
const empty = <T,>(value: T): ScannedField<T> => ({ value, confidence: 0 });

function num(s: string): number {
  const n = Number(s.replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

/** DD/MM/YYYY, DD-MM-YY, YYYY-MM-DD → YYYY-MM-DD. */
function parseDate(text: string): ScannedField<string> {
  const m =
    text.match(/\b(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})\b/) ??
    text.match(/\b(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})\b/);
  if (!m) return empty("");
  let d: string, mo: string, y: string;
  if (m[1]!.length === 4) [y, mo, d] = [m[1]!, m[2]!, m[3]!];
  else [d, mo, y] = [m[1]!, m[2]!, m[3]!];
  if (y.length === 2) y = (Number(y) > 30 ? "19" : "20") + y;
  const dd = d.padStart(2, "0"), mm = mo.padStart(2, "0");
  if (Number(mm) > 12 || Number(dd) > 31) return empty("");
  return { value: `${y}-${mm}-${dd}`, confidence: 70 };
}

function nearKeyword(lines: string[], keys: string[]): string | null {
  for (const ln of lines) {
    const low = ln.toLowerCase();
    if (keys.some((k) => low.includes(k))) return ln;
  }
  return null;
}

function lastAmount(line: string | null): ScannedField<number> {
  if (!line) return empty(0);
  const all = line.match(/[\d,]+\.\d{2}|[\d,]+/g);
  if (!all?.length) return empty(0);
  return { value: num(all[all.length - 1]!), confidence: 55 };
}

export function parseInvoiceText(text: string): ScannedInvoice {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  const gstinM = text.toUpperCase().match(GSTIN_RE);
  // Invoice no: prefer explicit label, else a short alphanumeric token.
  let invNo = "";
  let invConf = 0;
  const invLine = nearKeyword(lines, ["invoice no", "inv no", "invoice #", "bill no", "voucher no"]);
  if (invLine) {
    const m = invLine.match(/(?:no\.?|#|:)\s*([A-Z0-9][A-Z0-9\-\/]{1,24})/i);
    if (m) { invNo = m[1]!.toUpperCase(); invConf = 65; }
  }
  if (!invNo) {
    const tok = lines.flatMap((l) => l.match(/\b[A-Z]{1,4}[-/]\d{2,8}\b/g) ?? [])[0];
    if (tok) { invNo = tok.toUpperCase(); invConf = 40; }
  }

  const date = parseDate(text);

  // Party: line near "billed to / buyer / customer", else first ALL-CAPS-ish line.
  let party = "", partyConf = 0;
  const partyLine = nearKeyword(lines, ["billed to", "buyer", "customer", "consignee", "party"]);
  if (partyLine) {
    const after = partyLine.split(/billed to|buyer|customer|consignee|party/i)[1]?.replace(/^[:\-\s]+/, "").trim();
    if (after && after.length > 2) { party = after.slice(0, 80); partyConf = 55; }
  }
  if (!party) {
    const cand = lines.find((l) => /^[A-Z][A-Za-z .&]{4,60}$/.test(l) && !/invoice|tax|gst|total|date|bill/i.test(l));
    if (cand) { party = cand; partyConf = 35; }
  }

  const totalLn = nearKeyword(lines, ["grand total", "net payable", "net amount", "invoice value", "amount payable", "total amount"]);
  const total = lastAmount(totalLn);
  const taxLn = nearKeyword(lines, ["taxable", "sub total", "subtotal", "assessable"]);
  const taxable = lastAmount(taxLn);

  // Item lines: "desc ... qty x rate" pattern (best effort).
  const itemLines: ScannedLine[] = [];
  for (const ln of lines) {
    if (itemLines.length >= 8) break;
    const m = ln.match(/^(.{3,60}?)\s+(\d+(?:\.\d+)?)\s*[xX×]\s*([\d,]+(?:\.\d{1,2})?)\s*$/);
    if (!m || /total|tax|gst|discount|round|amount|invoice|date|hsn/i.test(m[1]!)) continue;
    itemLines.push({
      description: { value: m[1]!.trim(), confidence: 45 },
      quantity: { value: num(m[2]!), confidence: 60 },
      rate: { value: num(m[3]!), confidence: 60 },
      hsn: { value: "", confidence: 0 }
    });
  }

  const confs = [invConf, date.confidence, partyConf, total.confidence, taxable.confidence].filter((c) => c > 0);
  const overall = confs.length ? Math.round(confs.reduce((a, c) => a + c, 0) / confs.length) : 0;

  return {
    invoiceNumber: { value: invNo, confidence: invConf },
    invoiceDate: date,
    partyName: { value: party, confidence: partyConf },
    partyGstin: gstinM ? { value: gstinM[0], confidence: 85 } : empty(""),
    taxableValue: taxable,
    totalValue: total,
    lines: itemLines,
    overall,
    rawText: text
  };
}

export type OcrProgress = (pct: number, status: string) => void;

/** Lazy-loads tesseract.js (keeps initial bundle small) and recognizes English text. */
export async function recognizeImage(file: Blob, onProgress: OcrProgress): Promise<{ text: string; confidence: number }> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng");
  try {
    onProgress(10, "Reading photo…");
    const { data } = await worker.recognize(file, {}, {
      logger: (m: { status?: string; progress?: number }) => {
        if (typeof m.progress === "number") onProgress(Math.round(10 + m.progress * 85), m.status === "recognizing text" ? "Reading lines…" : "Preparing…");
      }
    } as never);
    onProgress(100, "Done");
    const words = (data as { words?: Array<{ confidence?: number }> }).words ?? [];
    const confs = words.map((w) => w.confidence ?? 0).filter((c) => c > 0);
    const mean = confs.length ? confs.reduce((a, c) => a + c, 0) / confs.length : 0;
    return { text: data.text ?? "", confidence: Math.round(mean) };
  } finally {
    await worker.terminate().catch(() => {});
  }
}

export function scanInvoice(file: Blob, onProgress: OcrProgress): Promise<ScannedInvoice> {
  return recognizeImage(file, onProgress).then(({ text, confidence }) => {
    const parsed = parseInvoiceText(text);
    // Blend OCR engine confidence with heuristic confidence.
    parsed.overall = Math.round((parsed.overall + confidence) / 2);
    return parsed;
  });
}
