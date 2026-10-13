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
  gstRate: ScannedField<number>;
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

  // Item lines — two shapes:
  //  A) full table row: "Desc HSN qty x rate gst% amount"
  //  B) short row: "Desc qty x rate" (at line end)
  const ALLOWED_GST = [0, 0.1, 0.25, 1, 1.5, 3, 5, 7.5, 12, 18, 28];
  const itemLines: ScannedLine[] = [];
  const pushLine = (desc: string, hsn: string, qty: number, rate: number, gst: number | null, conf: number) => {
    if (itemLines.length >= 8 || !(qty > 0) || !(rate >= 0)) return;
    itemLines.push({
      description: { value: desc.trim().slice(0, 120), confidence: conf },
      quantity: { value: qty, confidence: 60 },
      rate: { value: rate, confidence: 60 },
      hsn: { value: hsn, confidence: hsn ? 65 : 0 },
      gstRate: { value: gst ?? 18, confidence: gst !== null && ALLOWED_GST.includes(gst) ? 60 : 0 }
    });
  };
  for (const ln of lines) {
    if (/total|tax|gst|discount|round|amount|invoice|date|cgst|sgst|igst|taxable|grand/i.test(ln)) continue;
    const full = ln.match(/^(.{3,60}?)\s+(\d{4,8})\s+(\d+(?:\.\d+)?)\s*[xX×]\s*([\d,]+(?:\.\d{1,2})?)\s+(\d+(?:\.\d+)?)\s+([\d,]+(?:\.\d{1,2})?)\s*$/);
    if (full) {
      const qty = num(full[3]!), rate = num(full[4]!), amt = num(full[6]!);
      if (Math.abs(qty * rate - amt) > Math.max(1, amt * 0.02)) continue; // amount must agree
      const g = Number(full[5]);
      pushLine(full[1]!, full[2]!, qty, rate, ALLOWED_GST.includes(g) ? g : null, 55);
      continue;
    }
    const short = ln.match(/^(.{3,60}?)\s+(\d+(?:\.\d+)?)\s*[xX×]\s*([\d,]+(?:\.\d{1,2})?)\s*$/);
    if (short) pushLine(short[1]!, "", num(short[2]!), num(short[3]!), null, 40);
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

export class ScanCancelled extends Error {
  constructor() { super("Scan cancelled"); this.name = "ScanCancelled"; }
}

const MAX_DIM = 1200;

/** Downscale + grayscale large camera photos (3-5x faster OCR, same bill accuracy). */
export async function preprocessImage(file: Blob): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIM / Math.max(bmp.width, bmp.height));
    if (scale >= 1) {
      // Still normalize small images to grayscale JPEG for consistency.
      const c0 = document.createElement("canvas");
      c0.width = bmp.width; c0.height = bmp.height;
      const x0 = c0.getContext("2d");
      if (!x0) return file;
      x0.filter = "grayscale(1) contrast(1.08)";
      x0.drawImage(bmp, 0, 0);
      const out: Blob | null = await new Promise((res) => c0.toBlob(res, "image/jpeg", 0.85));
      bmp.close();
      return out ?? file;
    }
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.filter = "grayscale(1) contrast(1.08)";
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close();
    const out: Blob | null = await new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.85));
    return out ?? file;
  } catch {
    return file;
  }
}

type WorkerLike = {
  recognize: (img: Blob, opts?: unknown, logger?: unknown) => Promise<{ data: { text?: string; words?: Array<{ confidence?: number }> } }>;
  terminate: () => Promise<void>;
};

let workerPromise: Promise<WorkerLike> | null = null;
let scanToken = 0;

/** Cancel in-flight scan (abandons result; worker is recycled on next scan). */
export function cancelScan(): void {
  scanToken++;
  const w = workerPromise;
  workerPromise = null;
  if (w) void w.then((wk) => wk.terminate().catch(() => {}));
}

async function getWorker(onProgress: OcrProgress): Promise<WorkerLike> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import("tesseract.js");
      onProgress(4, "Downloading OCR engine (first time only)…");
      const worker = (await createWorker("eng", undefined, {
        logger: (m: { status?: string; progress?: number }) => {
          if (typeof m.progress === "number" && (m.status ?? "").includes("loading")) {
            onProgress(Math.round(m.progress * 10), "Downloading OCR engine (first time only)…");
          }
        }
      } as never)) as unknown as WorkerLike;
      return worker;
    })().catch((e) => {
      workerPromise = null;
      throw e;
    });
  }
  return workerPromise;
}

/** Warm the engine while the user fills the form, so Scan starts instantly. */
export function prewarmOcr(): void {
  try {
    void getWorker(() => {}).catch(() => { workerPromise = null; });
  } catch { /* best effort */ }
}

const SCAN_TIMEOUT_MS = 60000;

/** Lazy-loads tesseract.js (keeps initial bundle small) and recognizes English text. */
export async function recognizeImage(file: Blob, onProgress: OcrProgress): Promise<{ text: string; confidence: number }> {
  const myToken = scanToken;
  const started = Date.now();
  const elapsed = () => `${Math.round((Date.now() - started) / 1000)}s`;
  const worker = await getWorker(onProgress);
  if (myToken !== scanToken) throw new ScanCancelled();
  onProgress(12, "Shrinking photo for speed…");
  const small = await preprocessImage(file);
  if (myToken !== scanToken) throw new ScanCancelled();
  onProgress(16, "Reading photo…");
  const job = worker.recognize(small, {}, {
    logger: (m: { status?: string; progress?: number }) => {
      if (myToken !== scanToken) return;
      if (typeof m.progress === "number") {
        onProgress(Math.min(96, Math.round(16 + m.progress * 80)), `Reading photo… (${elapsed()})`);
      }
    }
  } as never);
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => {
      workerPromise = null;
      worker.terminate().catch(() => {});
      reject(new Error("Scan timed out after 60s — try a smaller, well-lit photo or enter manually."));
    }, SCAN_TIMEOUT_MS)
  );
  try {
    const { data } = await Promise.race([job, timeout]);
    if (myToken !== scanToken) throw new ScanCancelled();
    onProgress(100, "Done");
    const words = data.words ?? [];
    const confs = words.map((w) => w.confidence ?? 0).filter((c) => c > 0);
    const mean = confs.length ? confs.reduce((a, c) => a + c, 0) / confs.length : 0;
    return { text: data.text ?? "", confidence: Math.round(mean) };
  } catch (e) {
    workerPromise = null;
    throw e;
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
