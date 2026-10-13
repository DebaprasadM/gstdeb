// One-time setup: self-host Tesseract assets under public/tess/ so bill
// scanning never depends on a third-party CDN at scan time.
// - worker + core files are COPIED from local node_modules (no network).
// - eng.traineddata.gz is downloaded once and cached (skipped when present).
// Safe to re-run; wired as `postinstall` (dev + Vercel build).
import { createWriteStream, existsSync, mkdirSync, copyFileSync, statSync, readdirSync } from "node:fs";
import { get } from "node:https";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "public", "tess");
mkdirSync(outDir, { recursive: true });

// Resolve the real installed locations (npm hoisting varies).
const coreDir = dirname(require.resolve("tesseract.js-core/package.json"));
const workerSrc = join(dirname(require.resolve("tesseract.js/package.json")), "dist", "worker.min.js");

const CORES = [
  "tesseract-core-lstm.js", "tesseract-core-lstm.wasm", "tesseract-core-lstm.wasm.js",
  "tesseract-core-simd-lstm.js", "tesseract-core-simd-lstm.wasm", "tesseract-core-simd-lstm.wasm.js",
  "tesseract-core-relaxedsimd-lstm.js", "tesseract-core-relaxedsimd-lstm.wasm", "tesseract-core-relaxedsimd-lstm.wasm.js"
];

const sameSize = (a, b) => existsSync(b) && statSync(b).size === statSync(a).size;
for (const [src, name] of [[workerSrc, "worker.min.js"], ...CORES.map((f) => [join(coreDir, f), f])]) {
  const dst = join(outDir, name);
  if (!existsSync(src)) { console.warn(`[fetch-tess] missing: ${src} (skipped)`); continue; }
  if (sameSize(src, dst)) { console.log(`[fetch-tess] up to date: ${name}`); continue; }
  copyFileSync(src, dst);
  console.log(`[fetch-tess] copied: ${name} (${(statSync(dst).size / 1048576).toFixed(1)} MB)`);
}

const TRAINED = join(outDir, "eng.traineddata.gz");
if (existsSync(TRAINED) && statSync(TRAINED).size > 1000000) {
  console.log("[fetch-tess] up to date: eng.traineddata.gz");
  process.exit(0);
}

const URL = "https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng/4.0.0/eng.traineddata.gz";
console.log(`[fetch-tess] downloading eng.traineddata (~5MB one-time)…`);
get(URL, (res) => {
  if (res.statusCode !== 200 || !res.headers["content-length"]) {
    // Follow github/jsdelivr redirect if needed (one hop).
    const loc = res.headers.location;
    if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && loc) {
      get(loc, (r2) => pipeToFile(r2));
      return;
    }
    console.error(`[fetch-tess] download failed: HTTP ${res.statusCode} (scan falls back to CDN at runtime)`);
    process.exit(0);
  }
  pipeToFile(res);

  function pipeToFile(r) {
    const ws = createWriteStream(TRAINED);
    r.pipe(ws);
    ws.on("finish", () => {
      console.log(`[fetch-tess] saved eng.traineddata.gz (${(statSync(TRAINED).size / 1048576).toFixed(1)} MB)`);
      process.exit(0);
    });
    ws.on("error", (e) => {
      console.error("[fetch-tess] write failed:", e.message);
      process.exit(0);
    });
  }
}).on("error", (e) => {
  console.error("[fetch-tess] download failed (scan falls back to CDN at runtime):", e.message);
  process.exit(0);
});
