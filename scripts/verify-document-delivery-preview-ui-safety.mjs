import fs from "node:fs";

let failures = 0;

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function mustContain(path, text, needle) {
  if (!text.includes(needle)) {
    console.error(`FAIL ${path}: missing ${needle}`);
    failures += 1;
  }
}

function mustNotContain(path, text, needle) {
  if (text.includes(needle)) {
    console.error(`FAIL ${path}: must not contain ${needle}`);
    failures += 1;
  }
}

console.log("=== DOCUMENT DELIVERY PREVIEW UI SAFETY VERIFICATION ===");

const directPath = "app/matter/[id]/page.tsx";
const masterPath = "app/matters/page.tsx";
const direct = read(directPath);
const master = read(masterPath);

for (const [path, text, source] of [
  [directPath, direct, 'source: "direct_matter"'],
  [masterPath, master, 'source: "master_lawsuit"'],
]) {
  mustContain(path, text, "/api/documents/delivery-draft-preview");
  mustContain(path, text, source);
  mustContain(path, text, "Document Email Draft Preview Only");
  mustContain(path, text, "No Outlook draft was created");
  mustContain(path, text, "No email was sent");
  mustContain(path, text, "No Clio record, database record, document, or print-queue record was changed");
  mustContain(path, text, "Ready for future Graph draft creation");
  mustNotContain(path, text, "window.location.href = buildMailtoHref(context);");
}

mustNotContain(directPath, direct, "buildMailtoHref,");
mustNotContain(masterPath, master, "buildMailtoHref,");

if (failures > 0) {
  console.error(`=== DOCUMENT DELIVERY PREVIEW UI SAFETY FAILED: ${failures} failure(s) ===`);
  process.exit(1);
}

console.log("=== DOCUMENT DELIVERY PREVIEW UI SAFETY PASSED ===");
