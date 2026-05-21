import fs from "node:fs";

const failures = [];

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function check(label, condition) {
  if (condition) {
    console.log(`PASS: ${label}`);
  } else {
    console.error(`FAIL: ${label}`);
    failures.push(label);
  }
}

const helper = read("lib/documents/templateImport.ts");
const preview = read("app/api/documents/templates/import-preview/route.ts");
const confirm = read("app/api/documents/templates/import-confirm/route.ts");
const pkg = read("package.json");

check("helper defines preview safety", helper.includes("safetyTemplateImportPreview"));
check("helper defines confirm safety", helper.includes("safetyTemplateImportConfirm"));
check("helper normalizes import rows", helper.includes("normalizeTemplateImportRows"));
check("helper supports seeded template rows", helper.includes("seededTemplateImportRows"));
check("helper blocks final production without production ready", helper.includes("finalProductionDocument cannot be true unless productionTemplateReady is true"));

check("preview route exists", preview.includes("document-template-import-preview"));
check("preview route reads existing template keys", preview.includes("prisma.documentTemplate.findMany"));
check("preview route is preview only", preview.includes("previewOnly: true"));
check("preview route does not write templates", !preview.includes("documentTemplate.upsert") && !preview.includes("documentTemplate.create") && !preview.includes("documentTemplate.update"));

check("confirm route exists", confirm.includes("document-template-import-confirm"));
check("confirm route requires confirm true", confirm.includes("confirm !== true") || confirm.includes("confirm: true"));
check("confirm route blocks invalid preview", confirm.includes("if (!preview.ok)"));
check("confirm route writes DocumentTemplate", confirm.includes("tx.documentTemplate.upsert"));
check("confirm route writes DocumentTemplateVersion", confirm.includes("tx.documentTemplateVersion.create"));
check("confirm route writes DocumentTemplateMergeField", confirm.includes("tx.documentTemplateMergeField.upsert"));
check("confirm route uses transaction", confirm.includes("prisma.$transaction"));
check("confirm route metadata includes production readiness", confirm.includes("productionTemplateReady") && confirm.includes("finalProductionDocument"));

for (const [label, text] of [["preview", preview], ["confirm", confirm], ["helper", helper]]) {
  check(`${label} does not import Clio`, !text.includes("@/lib/clio") && !text.includes("uploadDocumentToClio"));
  check(`${label} does not generate documents`, !text.includes("Packer.toBuffer") && !text.includes("new Document("));
  check(`${label} does not send email`, !text.includes("sendMail(") && !text.includes("graphFetchJson"));
  check(`${label} does not write print queue`, !text.includes("documentPrintQueueItem.create"));
}

check("package script registered", pkg.includes("verify:document-template-import-routes-safety"));

if (failures.length) {
  console.error(`FAIL: document template import routes safety verifier (${failures.length} failure(s))`);
  process.exit(1);
}

console.log("PASS: document template import routes safety verifier");
