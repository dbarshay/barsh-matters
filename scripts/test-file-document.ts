// Headless test of the Phase 3 filing logic (lib/documents/fileDocument.ts) against Neon.
// No UI, no real documents needed. Uses a throwaway matterId and cleans up after itself.
//
//   npx tsx scripts/test-file-document.ts

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
    const value = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, "");
    if (key && process.env[key] == null) process.env[key] = value;
  }
}
loadLocalEnvFile(".env.local");
loadLocalEnvFile(".env");

const TEST_MATTER = 900777;

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: string) {
  if (cond) {
    passed++;
    console.log(`  ✅ ${name}`);
  } else {
    failed++;
    console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

async function main() {
  const { PrismaClient } = await import("@prisma/client");
  const { PrismaPg } = await import("@prisma/adapter-pg");
  const { Pool } = await import("pg");
  const { fileDocument } = await import("@/lib/documents/fileDocument");
  const { FREEHAND_TITLE_KEY } = await import("@/lib/documents/folderTaxonomy");

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

  const base = { matterId: TEST_MATTER, clioDocumentId: "TEST-DOC", sourceType: "scan" as const };

  try {
    // Clean any leftovers from a previous run.
    await db.filedDocument.deleteMany({ where: { matterId: TEST_MATTER } });
    await db.auditLog.deleteMany({ where: { matterId: TEST_MATTER, action: "document.filed" } });

    console.log("Enforcement:");
    const badFolder = await fileDocument(db, { ...base, folderKey: "nope.nope", titleKey: "bill" });
    check("unknown folder rejected", !badFolder.ok && /Unknown terminal folder/.test((badFolder as any).error));

    const badTitle = await fileDocument(db, { ...base, folderKey: "claim_documents.bills", titleKey: "not_a_title" });
    check("uncontrolled title rejected", !badTitle.ok && /not allowed/.test((badTitle as any).error));

    console.log("Label composition + dedup:");
    const bill1 = await fileDocument(db, { ...base, folderKey: "claim_documents.bills", titleKey: "bill" });
    check("first Bill filed as 'Bill'", bill1.ok && (bill1 as any).document.titleLabel === "Bill", bill1.ok ? (bill1 as any).document.titleLabel : (bill1 as any).error);
    const bill2 = await fileDocument(db, { ...base, folderKey: "claim_documents.bills", titleKey: "bill" });
    check("second Bill → 'Bill (2)'", bill2.ok && (bill2 as any).document.titleLabel === "Bill (2)", bill2.ok ? (bill2 as any).document.titleLabel : "");
    const bill3 = await fileDocument(db, { ...base, folderKey: "claim_documents.bills", titleKey: "bill" });
    check("third Bill → 'Bill (3)'", bill3.ok && (bill3 as any).document.titleLabel === "Bill (3)", bill3.ok ? (bill3 as any).document.titleLabel : "");

    console.log("Prompt fields + templates:");
    const reqMissing = await fileDocument(db, { ...base, folderKey: "claim_documents.verification.requests", titleKey: "request_dated", fields: {} });
    check("missing required date rejected", !reqMissing.ok && /Missing required field/.test((reqMissing as any).error));
    const reqOk = await fileDocument(db, { ...base, folderKey: "claim_documents.verification.requests", titleKey: "request_dated", fields: { date: "07/01/2026" } });
    check("Request Dated composed label", reqOk.ok && (reqOk as any).document.titleLabel === "Request Dated 07/01/2026", reqOk.ok ? (reqOk as any).document.titleLabel : (reqOk as any).error);

    const awardOk = await fileDocument(db, { ...base, folderKey: "arbitration.awards", titleKey: "award", fields: { date: "07/02/2026", outcome: "Win", principal: "5000" } });
    check("Award templated label + lawsuit level", awardOk.ok && (awardOk as any).document.titleLabel === "Award — Win — 07/02/2026" && (awardOk as any).document.level === "lawsuit", awardOk.ok ? (awardOk as any).document.titleLabel : (awardOk as any).error);

    console.log("Freehand:");
    const freehandEmpty = await fileDocument(db, { ...base, folderKey: "claim_documents.miscellaneous", titleKey: FREEHAND_TITLE_KEY });
    check("freehand without text rejected", !freehandEmpty.ok && /Freehand title requires text/.test((freehandEmpty as any).error));
    const freehandOk = await fileDocument(db, { ...base, folderKey: "claim_documents.miscellaneous", titleKey: FREEHAND_TITLE_KEY, freehandTitle: "Investigator Notes" });
    check("freehand uses typed title", freehandOk.ok && (freehandOk as any).document.titleLabel === "Investigator Notes", freehandOk.ok ? (freehandOk as any).document.titleLabel : (freehandOk as any).error);
    // freehand allowed only where enabled — Bills has no freehand.
    const freehandDisallowed = await fileDocument(db, { ...base, folderKey: "claim_documents.bills", titleKey: FREEHAND_TITLE_KEY, freehandTitle: "x" });
    check("freehand rejected where not allowed", !freehandDisallowed.ok);

    console.log("Duplicate-hash guard:");
    const dup1 = await fileDocument(db, { ...base, folderKey: "claim_documents.denials", titleKey: "nf10", fileHash: "deadbeef" });
    check("first hashed file filed", dup1.ok);
    const dup2 = await fileDocument(db, { ...base, folderKey: "claim_documents.denials", titleKey: "nf10", fileHash: "deadbeef" });
    check("duplicate hash warns", !dup2.ok && (dup2 as any).duplicate === true && (dup2 as any).status === 409);
    const dup3 = await fileDocument(db, { ...base, folderKey: "claim_documents.denials", titleKey: "nf10", fileHash: "deadbeef", confirmDuplicate: true });
    check("duplicate accepted on confirm", dup3.ok);

    console.log("Persistence + audit:");
    const filedCount = await db.filedDocument.count({ where: { matterId: TEST_MATTER, status: "active" } });
    const auditCount = await db.auditLog.count({ where: { matterId: TEST_MATTER, action: "document.filed" } });
    // Successful files: bill1,2,3 + reqOk + awardOk + freehandOk + dup1 + dup3 = 8
    check("8 FiledDocument rows written", filedCount === 8, `got ${filedCount}`);
    check("8 audit entries written", auditCount === 8, `got ${auditCount}`);

    // Cleanup.
    await db.filedDocument.deleteMany({ where: { matterId: TEST_MATTER } });
    await db.auditLog.deleteMany({ where: { matterId: TEST_MATTER, action: "document.filed" } });
    console.log("\nCleaned up test rows.");
  } finally {
    await pool.end();
  }

  console.log(`\n${failed === 0 ? "✅ ALL PASS" : "❌ FAILURES"} — ${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
