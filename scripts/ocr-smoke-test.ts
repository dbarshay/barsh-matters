// OCR engine smoke test — run a real file through the active provider (Azure when configured).
//
//   npx tsx scripts/ocr-smoke-test.ts <path-to-file> [read|layout]
//
// Loads .env.local the same way prisma.config.ts does, so AZURE_DOCINTEL_* are picked up.
// With no Azure creds set it exercises the stub (offline) so the wiring can be tested anytime.

import fs from "fs";
import path from "path";

function loadLocalEnvFile(fileName: string) {
  const filePath = path.join(process.cwd(), fileName);
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, "");
    if (key && process.env[key] == null) process.env[key] = value;
  }
}

loadLocalEnvFile(".env.local");
loadLocalEnvFile(".env");

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
  const save = args.includes("--save");
  const doMap = args.includes("--map");
  const positional = args.filter((a) => !a.startsWith("--"));
  const [filePath, modeArg] = positional;
  if (!filePath) {
    console.error(
      "Usage: npx tsx scripts/ocr-smoke-test.ts <path-to-file> [read|layout] [--map] [--save]",
    );
    process.exit(1);
  }
  const mode = modeArg === "read" ? "read" : "layout";

  // Imported after env load; config reads process.env at call time regardless.
  // These barrels are DB-free, so they import cleanly in a plain script (no server-only guard).
  const { extractDocument, getOcrReadiness, getOcrProvider } = await import("@/lib/ocr");

  const readiness = getOcrReadiness();
  console.log("Provider:", getOcrProvider().name, "| readiness:", JSON.stringify(readiness));
  if (!readiness.ready && readiness.provider === "azure") {
    console.log("(Azure not configured — running stub. Set AZURE_DOCINTEL_ENDPOINT/KEY to hit Azure.)");
  }

  const bytes = fs.readFileSync(path.resolve(filePath));
  const base64 = bytes.toString("base64");
  console.log(`File: ${filePath} (${bytes.length} bytes) | mode: ${mode}\n`);

  const started = Date.now();
  const result = await extractDocument(
    { base64, contentType: guessContentType(filePath), fileName: path.basename(filePath) },
    mode,
  );
  const ms = Date.now() - started;

  console.log("=== RESULT ===");
  console.log("provider     :", result.provider);
  console.log("model        :", result.model);
  console.log("pages        :", result.pageCount);
  console.log("meanConfidence:", result.meanConfidence);
  console.log("elapsed ms   :", ms);
  console.log("keyValues    :", result.keyValues.length);
  for (const kv of result.keyValues.slice(0, 15)) {
    console.log(`   - ${kv.key} = ${kv.value}  (conf ${kv.confidence ?? "n/a"})`);
  }
  console.log("tables       :", result.tables.length);
  console.log("\n--- text preview (first 800 chars) ---");
  console.log(result.text.slice(0, 800));

  if (doMap) {
    const { mapBillToIntakeFields } = await import("@/lib/ocr/mapping");
    const mapped = mapBillToIntakeFields(result);
    console.log("\n=== MAPPED INTAKE FIELDS (operator verifies; case type = operator pick) ===");
    for (const [field, mf] of Object.entries(mapped)) {
      const conf = mf.confidence == null ? "n/a" : mf.confidence.toFixed(2);
      const flag = mf.value == null ? "  (missing)" : mf.confidence != null && mf.confidence < 0.5 ? "  ⚠ low" : "";
      console.log(
        `   ${field.padEnd(13)} = ${String(mf.value ?? "—").padEnd(24)} conf ${conf}  [${mf.source ?? "-"}]${flag}`,
      );
    }
  }

  if (save) {
    // Persist via a direct pg-adapter PrismaClient (mirrors lib/prisma.ts) so we avoid the
    // `server-only` guard that lib/prisma.ts carries — that guard blocks plain-script imports.
    const { PrismaClient } = await import("@prisma/client");
    const { PrismaPg } = await import("@prisma/adapter-pg");
    const { Pool } = await import("pg");
    const { buildOcrExtractionData } = await import("@/lib/ocr/persistData");

    const url =
      process.env.POSTGRES_DATABASE_URL_UNPOOLED ||
      process.env.POSTGRES_URL_NON_POOLING ||
      process.env.DATABASE_URL ||
      "";
    const pool = new Pool({
      connectionString: url,
      ssl: url.includes("sslmode=require") ? undefined : { rejectUnauthorized: true },
    });
    const db = new PrismaClient({ adapter: new PrismaPg(pool) });
    try {
      const row = await db.ocrExtraction.create({
        data: buildOcrExtractionData({
          input: {
            base64,
            contentType: guessContentType(filePath),
            fileName: path.basename(filePath),
          },
          result,
          mode,
          sourceType: "adhoc",
        }),
      });
      console.log(`\nPersisted OcrExtraction row: id=${row.id} fileHash=${row.fileHash}`);
    } finally {
      await pool.end();
    }
  }
}

main().catch((err) => {
  console.error("Smoke test failed:", err);
  process.exit(1);
});
