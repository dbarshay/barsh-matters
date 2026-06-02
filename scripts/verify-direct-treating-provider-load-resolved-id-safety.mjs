import fs from "fs";

const file = "app/matter/[id]/page.tsx";
const text = fs.readFileSync(file, "utf8");

let failed = false;

function requireText(label, needle) {
  if (!text.includes(needle)) {
    console.error(`FAIL: missing ${label}`);
    failed = true;
  } else {
    console.log(`PASS: ${label}`);
  }
}

function forbidText(label, needle) {
  if (text.includes(needle)) {
    console.error(`FAIL: forbidden ${label}`);
    failed = true;
  } else {
    console.log(`PASS: forbidden ${label} absent`);
  }
}

requireText(
  "treating provider loader resolves numeric matter id",
  "async function loadClaimIndexTreatingProviderField() {\n    const numericMatterId = resolvedNumericMatterId();\n    if (!numericMatterId) return;"
);

requireText(
  "treating provider GET uses numeric matter id",
  "matterId=${encodeURIComponent(String(numericMatterId))}&fieldName=treating_provider"
);

requireText(
  "treating provider save uses numeric matter id variable",
  'matterId: numericMatterId,\n          matterDisplayNumber: textValue(matter?.displayNumber || matter?.display_number || matterId),\n          fieldName: "treating_provider"'
);

forbidText(
  "old treating provider GET used route param matterId",
  "matterId=${encodeURIComponent(String(matterId))}&fieldName=treating_provider"
);

forbidText(
  "old treating provider save used inline resolved id without guard",
  'matterId: resolvedNumericMatterId(),\n          matterDisplayNumber: textValue(matter?.displayNumber || matter?.display_number || matterId),\n          fieldName: "treating_provider"'
);

if (failed) process.exit(1);

console.log("PASS: direct treating provider load/save uses resolved numeric matter id.");
