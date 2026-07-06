#!/usr/bin/env node
import fs from "node:fs";

function read(p) {
  return fs.readFileSync(p, "utf8");
}
let failures = 0;
const pass = (m) => console.log(`PASS: ${m}`);
const fail = (m) => {
  console.error(`FAIL: ${m}`);
  failures += 1;
};
const must = (label, text, needle) =>
  text.includes(needle) ? pass(`${label}: ${needle}`) : fail(`${label}: missing ${needle}`);

console.log("=== VERIFY UPLOAD DOCS SAFETY ===");

const config = read("lib/documents/uploadDocsConfig.ts");
const search = read("app/api/documents/upload/matter-search/route.ts");
const upload = read("app/api/documents/upload/route.ts");
const page = read("app/admin/documents/upload/page.tsx");
const header = read("app/components/BarshHeaderActions.tsx");
const pkg = read("package.json");

// Feature flag.
must("config flag fn", config, "export function isUploadDocsEnabled");
must("config flag env", config, "BARSH_UPLOAD_DOCS_ENABLED");

// Matter search: admin + flag gated, BRL-scoped, read-only.
must("search flag-gated", search, "isUploadDocsEnabled()");
must("search admin-gated", search, "isAdminRequestAuthorized(req)");
must("search BRL scope", search, "buildBarshMatterDisplayNumberScopeWhere()");

// Upload commit: gating.
must("upload flag-gated", upload, "isUploadDocsEnabled()");
must("upload admin-gated", upload, "isAdminRequestAuthorized(req)");

// Upload commit: Clio live-write guard, fail-closed BEFORE any write.
must("upload reads write guard", upload, "getClioStorageWriteGuard()");
must("upload requires live flag", upload, "guard.liveClioWriteEnabled");
must("upload fails closed 403", upload, "clioWriteDisabled");

// Upload commit: duplicate pre-check occurs before Clio upload (no dup bytes to Clio).
const dupIdx = upload.indexOf("filedDocument.findFirst");
const uploadIdx = upload.indexOf("uploadBufferToClioMatterDocuments({");
if (dupIdx > -1 && uploadIdx > -1 && dupIdx < uploadIdx) pass("dup pre-check precedes Clio upload");
else fail("dup pre-check must precede Clio upload");

// Upload commit: real upload + BM filing + OCR backfill.
must("upload calls guarded folder resolve", upload, "resolveClioMatterFolderWithGuard(targetInput)");
must("upload calls clio upload", upload, "uploadBufferToClioMatterDocuments(");
must("upload records BM filing", upload, "fileDocument(prisma");
must("upload backfills ocr clioDocumentId", upload, "clioDocumentId");
must("upload sets sourceType upload", upload, 'sourceType: "upload"');

// Page: 3-step flow + posts to the upload API + matter search.
must("page posts to upload api", page, "/api/documents/upload");
must("page uses matter search", page, "/api/documents/upload/matter-search");
must("page uses ocr prefill", page, "/api/documents/ocr-prefill");

// Header button.
must("header upload-docs link", header, "/admin/documents/upload");

// Registered.
must("package.json registers verifier", pkg, "verify:upload-docs-safety");

if (failures) {
  console.error(`=== UPLOAD DOCS SAFETY FAILED: ${failures} failure(s) ===`);
  process.exit(1);
}
console.log("=== UPLOAD DOCS SAFETY PASSED ===");
