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
const docgenButtons = buttons.filter((button) => button.includes("launchMasterDocumentGenerationDialog"));

if (docgenButtons.length === 0) {
  fail(`${pagePath}: could not find a button containing launchMasterDocumentGenerationDialog`);
} else {
  pass(`${pagePath}: found ${docgenButtons.length} button(s) containing launchMasterDocumentGenerationDialog`);

  const button = docgenButtons[0];

  if (button.includes("Document Generation")) {
    pass(`${pagePath}: button shows Document Generation label`);
  } else {
    fail(`${pagePath}: button does not show Document Generation label`);
  }

  if (button.includes("Open the Master Lawsuit document generation preview popup.")) {
    pass(`${pagePath}: button has popup title`);
  } else {
    fail(`${pagePath}: button missing popup title`);
  }

  if (!button.includes("not-allowed")) {
    pass(`${pagePath}: button does not use not-allowed cursor`);
  } else {
    fail(`${pagePath}: button still uses not-allowed cursor`);
  }

  if (!button.includes("disabled")) {
    pass(`${pagePath}: button is not disabled`);
  } else {
    fail(`${pagePath}: button still contains disabled`);
  }
}

const required = [
  "launchMasterDocumentGenerationDialog",
  "setMasterDocumentGenerationPopupOpen(true)",
  "await loadMasterDocumentDataPreview()",
  "renderMasterDocumentGenerationPopup",
  "Master Lawsuit Document Generation Preview",
  "Open the Master Lawsuit document generation preview popup.",
];

for (const needle of required) {
  if (page.includes(needle)) pass(`${pagePath}: found ${needle}`);
  else fail(`${pagePath}: missing ${needle}`);
}

if (failures > 0) {
  console.error(`=== MASTER DOCUMENT GENERATION ACTION BUTTON CLICKABLE VERIFICATION FAILED: ${failures} failure(s) ===`);
  process.exit(1);
}

console.log("=== MASTER DOCUMENT GENERATION ACTION BUTTON CLICKABLE VERIFICATION PASSED ===");
