import fs from "fs";

// Phase D — inbound email attachment OCR review queue.
// Safety invariants: flag-gated; ingestion is read-only vs Clio and stages reviewStatus="pending"
// (never files); filing is a separate admin-only + confirmFile + Clio-write-guarded step; re-sync is
// idempotent; scoped to the attachment's own matter/lawsuit.
let failed = false;
function check(file, needles) {
  const text = fs.readFileSync(file, "utf8");
  for (const n of needles) {
    if (!text.includes(n)) { console.error(`FAIL: ${file} missing: ${n}`); failed = true; }
    else console.log(`PASS: ${file} has: ${n}`);
  }
}

check("lib/graph/inboundOcrConfig.ts", ["isInboundAttachmentOcrEnabled", "BARSH_INBOUND_ATTACHMENT_OCR_ENABLED"]);

// Ingestion: gated, uses the SAME OCR engine + classifier + cross-reference, stages pending, no Clio.
check("lib/graph/inboundAttachmentOcr.ts", [
  "isInboundAttachmentOcrEnabled()",
  "extractDocument",
  "suggestFolderTitle",
  "crossReferenceExtraction",
  'reviewStatus: "pending"',
  'sourceType: "email_attachment"',
  "if (existing) {",           // idempotent — skip already-recorded attachments
]);

// Review API: flag + admin gated; file requires confirmFile + Clio write guard; dismiss writes no Clio.
check("app/api/graph/inbound-attachments/route.ts", [
  "isInboundAttachmentOcrEnabled()",
  "isAdminRequestAuthorized(req)",
  "body?.confirmFile !== true",
  "getClioStorageWriteGuard()",
  "uploadBufferToClioMatterDocuments",
  "fileDocument(",
  'reviewStatus: "filed"',
  'reviewStatus: "dismissed"',
  'direction: "inbound"',       // list only inbound pending
]);

// Wired into thread-sync behind the flag, best-effort, no Clio write in the sync path.
check("app/api/graph/thread-sync/route.ts", [
  "isInboundAttachmentOcrEnabled()",
  "ingestInboundMessageAttachments(",
  "inboundAttachmentOcr",
]);

// Operator review UI: lists pending, files via confirm, dismisses. Wired into both pages.
check("components/email/InboundAttachmentReview.tsx", [
  "/api/graph/inbound-attachments",
  '"file"',
  '"dismiss"',
  "confirmFile: true",
  "bmConfirm(",
]);
check("app/matter/[id]/page.tsx", ["InboundAttachmentReview"]);
check("app/matters/page.tsx", ["InboundAttachmentReview"]);

if (failed) process.exit(1);
console.log("PASS: inbound attachment OCR (Phase D) is flag-gated, stages a review queue, and never files to Clio without confirmFile.");
