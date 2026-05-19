import fs from "node:fs";

const pagePath = "app/matters/page.tsx";
const page = fs.readFileSync(pagePath, "utf8");

let failures = 0;

function pass(message) {
  console.log(`PASS: ${message}`);
}

function fail(message) {
  failures += 1;
  console.error(`FAIL: ${message}`);
}

const buttonRegex = /<button[\s\S]*?<\/button>/g;
const buttons = [...page.matchAll(buttonRegex)].map((match) => match[0]);
const matching = buttons.filter((button) => button.includes('data-docgen-action="master"'));

if (matching.length !== 1) {
  fail(`${pagePath}: expected exactly one master docgen action button, found ${matching.length}`);
} else {
  const button = matching[0];
  pass(`${pagePath}: found exactly one master docgen action button`);

  const requiredInButton = [
    "Document Generation",
    "launchMasterDocumentGenerationDialog",
    "onMouseDown",
    "onClick",
    "Open the Master Lawsuit document generation preview popup.",
    'cursor: "pointer"',
    'pointerEvents: "auto"',
  ];

  for (const needle of requiredInButton) {
    if (button.includes(needle)) pass(`${pagePath}: action button contains ${needle}`);
    else fail(`${pagePath}: action button missing ${needle}`);
  }

  const forbiddenInButton = ["not-allowed", "disabled", 'pointerEvents: "none"'];
  for (const needle of forbiddenInButton) {
    if (!button.includes(needle)) pass(`${pagePath}: action button does not contain ${needle}`);
    else fail(`${pagePath}: action button contains forbidden ${needle}`);
  }
}

const requiredInPage = [
  "setMasterDocumentGenerationPopupOpen(true)",
  'setActiveMasterWorkspaceTab("documents")',
  "await loadMasterDocumentDataPreview()",
  "renderMasterDocumentGenerationPopup",
  "Master Lawsuit Document Generation Preview",
];

for (const needle of requiredInPage) {
  if (page.includes(needle)) pass(`${pagePath}: page contains ${needle}`);
  else fail(`${pagePath}: page missing ${needle}`);
}

if (failures > 0) {
  console.error(`=== MASTER DOCUMENT GENERATION ACTION BUTTON CLICKABLE VERIFICATION FAILED: ${failures} failure(s) ===`);
  process.exit(1);
}

console.log("=== MASTER DOCUMENT GENERATION ACTION BUTTON CLICKABLE VERIFICATION PASSED ===");
