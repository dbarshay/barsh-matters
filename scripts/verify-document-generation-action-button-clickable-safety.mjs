import fs from "node:fs";

const checks = [
  {
    pagePath: "app/matter/[id]/page.tsx",
    launcher: "launchMatterDocumentGenerationDialog",
    title: "Open the Direct Matter document generation preview popup.",
    popup: "renderMatterDocumentGenerationPopup",
    label: "Direct Matter",
  },
  {
    pagePath: "app/matters/page.tsx",
    launcher: "launchMasterDocumentGenerationDialog",
    title: "Open the Master Lawsuit document generation preview popup.",
    popup: "renderMasterDocumentGenerationPopup",
    label: "Master Lawsuit",
  },
];

let failures = 0;

function pass(message) {
  console.log(`PASS: ${message}`);
}

function fail(message) {
  failures += 1;
  console.error(`FAIL: ${message}`);
}

for (const check of checks) {
  const page = fs.readFileSync(check.pagePath, "utf8");
  const buttons = [...page.matchAll(/<button[\s\S]*?<\/button>/g)].map((match) => match[0]);
  const matching = buttons.filter((button) => button.includes(check.launcher));

  if (matching.length === 0) {
    fail(`${check.pagePath}: no action button calls ${check.launcher}`);
    continue;
  }

  pass(`${check.pagePath}: found ${matching.length} button(s) calling ${check.launcher}`);

  const button = matching.find((candidate) => candidate.includes("Document Generation")) || matching[0];

  if (button.includes("Document Generation")) pass(`${check.pagePath}: ${check.label} button label is Document Generation`);
  else fail(`${check.pagePath}: ${check.label} button label is not Document Generation`);

  if (button.includes(check.title)) pass(`${check.pagePath}: ${check.label} button title opens popup`);
  else fail(`${check.pagePath}: ${check.label} button missing popup title`);

  if (!button.includes("disabled")) pass(`${check.pagePath}: ${check.label} button is not disabled`);
  else fail(`${check.pagePath}: ${check.label} button contains disabled`);

  if (!button.includes("not-allowed")) pass(`${check.pagePath}: ${check.label} button does not use not-allowed cursor`);
  else fail(`${check.pagePath}: ${check.label} button still uses not-allowed cursor`);

  if (page.includes(check.popup)) pass(`${check.pagePath}: found ${check.label} popup renderer`);
  else fail(`${check.pagePath}: missing ${check.label} popup renderer`);

  if (page.includes("No documents are generated from this popup.")) pass(`${check.pagePath}: no-generation popup language present`);
  else fail(`${check.pagePath}: missing no-generation popup language`);
}

if (failures > 0) {
  console.error(`=== DOCUMENT GENERATION ACTION BUTTON CLICKABLE SAFETY FAILED: ${failures} failure(s) ===`);
  process.exit(1);
}

console.log("=== DOCUMENT GENERATION ACTION BUTTON CLICKABLE SAFETY PASSED ===");
