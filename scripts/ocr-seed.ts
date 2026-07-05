// OCR SEEDING — Stage 1 (run where you HAVE the sample forms; needs Azure creds).
//
//   npx tsx scripts/ocr-seed.ts [inputDir] [read|layout] [--force]
//   default inputDir = ocr-samples/inbox   default mode = layout
//
// For each document in inputDir it runs the OCR engine ONCE and caches the raw extraction result
// to ocr-samples/cache/<sha256>.json (keyed by file bytes, so re-runs skip already-seeded files
// unless --force). This builds a local corpus you can then map/tune against offline with
// scripts/ocr-review.ts — no need to re-OCR (saves Azure cost + time) or keep the forms around.
//
// ocr-samples/ is git-ignored (PHI). Keep it local.

import fs from "fs";
import path from "path";
import crypto from "crypto";

function loadLocalEnvFile(fileName: string) {
  const filePath = path.join(process.cwd(), fileName);
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, "");
    if (key && process.env[key] == null) process.env[key] = value;
  }
}
loadLocalEnvFile(".env.local");
loadLocalEnvFile(".env");

const SAMPLES_DIR = path.join(process.cwd(), "ocr-samples");
const CACHE_DIR = path.join(SAMPLES_DIR, "cache");
const SUPPORTED = new Set([".pdf", ".png", ".jpg", ".jpeg", ".tif", ".tiff", ".bmp"]);

function guessContentType(file: string): string {
  const ext = path.extname(file).toLowerCase();
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".tif" || ext === ".tiff") return "image/tiff";
  if (ext === ".bmp") return "image/bmp";
  return "application/octet-stream";
}

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const positional = args.filter((a) => !a.startsWith("--"));
  const inputDir = path.resolve(positional[0] || path.join(SAMPLES_DIR, "inbox"));
  const mode = positional[1] === "read" ? "read" : "layout";

  if (!fs.existsSync(inputDir)) {
    console.error(`Input dir not found: ${inputDir}\nCreate it and drop sample forms in, e.g.:`);
    console.error(`  mkdir -p ocr-samples/inbox && cp /path/to/*.pdf ocr-samples/inbox/`);
    process.exit(1);
  }
  fs.mkdirSync(CACHE_DIR, { recursive: true });

  const { extractDocument, getOcrReadiness } = await import("@/lib/ocr");
  const readiness = getOcrReadiness();
  console.log(`OCR readiness: ${JSON.stringify(readiness)} | mode=${mode}`);
  if (!readiness.ready) {
    console.error("Azure not configured — set AZURE_DOCINTEL_ENDPOINT/KEY in .env.local first.");
    process.exit(1);
  }

  const files = fs
    .readdirSync(inputDir)
    .filter((f) => SUPPORTED.has(path.extname(f).toLowerCase()))
    .sort();
  if (files.length === 0) {
    console.log(`No supported files in ${inputDir} (${[...SUPPORTED].join(", ")}).`);
    return;
  }

  let seeded = 0;
  let skipped = 0;
  let failed = 0;
  const manifest: Record<string, { fileName: string; mode: string; seededAt: string }> = fs.existsSync(
    path.join(SAMPLES_DIR, "manifest.json"),
  )
    ? JSON.parse(fs.readFileSync(path.join(SAMPLES_DIR, "manifest.json"), "utf8"))
    : {};

  for (const f of files) {
    const full = path.join(inputDir, f);
    const bytes = fs.readFileSync(full);
    const fileHash = crypto.createHash("sha256").update(bytes).digest("hex");
    const cachePath = path.join(CACHE_DIR, `${fileHash}.json`);

    if (fs.existsSync(cachePath) && !force) {
      console.log(`  = skip (cached): ${f}`);
      skipped++;
      continue;
    }

    process.stdout.write(`  → OCR ${f} … `);
    try {
      const result = await extractDocument(
        { base64: bytes.toString("base64"), contentType: guessContentType(full), fileName: f },
        mode,
      );
      // Drop the bulky raw provider payload; mapping only needs text/keyValues/tables.
      const { raw, ...slim } = result;
      const record = {
        fileName: f,
        fileHash,
        byteSize: bytes.length,
        mode,
        seededAt: new Date().toISOString(),
        result: slim,
      };
      fs.writeFileSync(cachePath, JSON.stringify(record, null, 2));
      manifest[fileHash] = { fileName: f, mode, seededAt: record.seededAt };
      console.log(`ok (${slim.keyValues.length} kv, ${slim.tables.length} tables, ${slim.pageCount}p)`);
      seeded++;
    } catch (err) {
      console.log(`FAILED: ${(err as Error).message}`);
      failed++;
    }
  }

  fs.writeFileSync(path.join(SAMPLES_DIR, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log(`\nDone. seeded=${seeded} skipped=${skipped} failed=${failed}. Cache: ${CACHE_DIR}`);
  console.log(`Next: npx tsx scripts/ocr-review.ts   (maps + writes ocr-samples/review.md, no Azure needed)`);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
