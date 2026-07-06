#!/usr/bin/env node
import fs from "node:fs";
const read = (p) => fs.readFileSync(p, "utf8");
let failures = 0;
const pass = (m) => console.log(`PASS: ${m}`);
const fail = (m) => { console.error(`FAIL: ${m}`); failures += 1; };
const must = (label, text, needle) => (text.includes(needle) ? pass(`${label}`) : fail(`${label}: missing ${needle}`));

console.log("=== VERIFY FINALIZE AUTO-FILE SAFETY ===");

const lib = read("lib/documents/templateFiling.ts");
const update = read("app/api/documents/templates/update/route.ts");
const adminPage = read("app/admin/document-templates/[key]/page.tsx");
const preview = read("app/api/documents/finalize-preview/route.ts");
const finalize = read("app/api/documents/finalize/route.ts");
const pkg = read("package.json");

// Mapping helper.
must("lib: readTemplateFilingTarget", lib, "export function readTemplateFilingTarget");
must("lib: isTemplateFilingMapped", lib, "export function isTemplateFilingMapped");
must("lib: validateTemplateFilingTarget", lib, "export function validateTemplateFilingTarget");
must("lib: validates title allowed", lib, "isTitleAllowed");

// Template record stores the mapping (admin-editable), validated.
must("update: validates filing target", update, "validateTemplateFilingTarget");
must("update: persists folderKey", update, "filedFolderKey:");
must("update: persists titleKey", update, "filedTitleKey:");

// Admin UI exposes folder/title pickers.
must("admin: auto-file section", adminPage, "Auto-file target");
must("admin: folder picker field", adminPage, "filedFolderKey");
must("admin: title picker field", adminPage, "filedTitleKey");
must("admin: lists terminal folders", adminPage, "listTerminalFolders");

// finalize-preview threads the template key.
must("preview: templateKey passed", preview, "templateKey: template.key");

// finalize enforces mapping + auto-files.
must("finalize: checks mapping", finalize, "isTemplateFilingMapped");
must("finalize: blocks unmapped (422)", finalize, "unmappedTemplates");
must("finalize: reads filing target", finalize, "readTemplateFilingTarget");
must("finalize: files the document", finalize, "fileDocument(prisma");
must("finalize: sourceType template", finalize, 'sourceType: "template"');

// Block must precede the upload loop (no upload before mapping is enforced).
const blockIdx = finalize.indexOf("unmappedTemplates");
const uploadIdx = finalize.indexOf("uploadBufferToClioMatterDocuments({");
if (blockIdx > -1 && uploadIdx > -1 && blockIdx < uploadIdx) pass("finalize: mapping block precedes upload");
else fail("finalize: mapping block must precede upload");

must("package.json registers verifier", pkg, "verify:finalize-autofile-safety");

if (failures) { console.error(`=== FINALIZE AUTO-FILE SAFETY FAILED: ${failures} ===`); process.exit(1); }
console.log("=== FINALIZE AUTO-FILE SAFETY PASSED ===");
