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

  const required = [
    ["Document Generation label", "Document Generation"],
    ["popup title", check.title],
    ["indigo background", 'background: "#4f46e5"'],
    ["white text", 'color: "#ffffff"'],
    ["indigo border", 'border: "1px solid #4338ca"'],
    ["button shadow", 'boxShadow: "0 10px 22px rgba(79, 70, 229, 0.28)"'],
    ["pointer cursor", 'cursor: "pointer"'],
  ];

  for (const [label, needle] of required) {
    if (button.includes(needle)) pass(`${check.pagePath}: ${check.label} button has ${label}`);
    else fail(`${check.pagePath}: ${check.label} button missing ${label}`);
  }

  const forbiddenInButton = ["not-allowed", "disabled", 'pointerEvents: "none"'];
  for (const needle of forbiddenInButton) {
    if (!button.includes(needle)) pass(`${check.pagePath}: ${check.label} button does not contain ${needle}`);
    else fail(`${check.pagePath}: ${check.label} button contains forbidden ${needle}`);
  }

  if (page.includes(check.popup)) pass(`${check.pagePath}: found ${check.label} popup renderer`);
  else fail(`${check.pagePath}: missing ${check.label} popup renderer`);

  if (page.includes(check.popup)) pass(`${check.pagePath}: ${check.label} popup renderer remains present`);
  else fail(`${check.pagePath}: missing ${check.label} popup renderer`);
}

if (failures > 0) {
  console.error(`=== DOCUMENT GENERATION ACTION BUTTON CLICKABLE SAFETY FAILED: ${failures} failure(s) ===`);
  process.exit(1);
}

console.log("=== DOCUMENT GENERATION ACTION BUTTON CLICKABLE SAFETY PASSED ===");
