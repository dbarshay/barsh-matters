import fs from "fs";

const page = fs.readFileSync("app/matters/page.tsx", "utf8");

const required = [
  'activeMasterWorkspaceTab === "payments"\n                  ? "Lawsuit Bills"',
  '"Close Review Bills"',
];

const forbidden = [
  'activeMasterWorkspaceTab === "documents"\n                  ? "Lawsuit Bills"',
];

const failures = [];

for (const marker of required) {
  if (!page.includes(marker)) failures.push(`missing required marker: ${marker}`);
}

for (const marker of forbidden) {
  if (page.includes(marker)) failures.push(`forbidden unreachable comparison still present: ${marker}`);
}

if (failures.length) {
  console.error("FAIL: master workspace tab type narrowing verifier failed");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("PASS: master workspace bill-list title avoids unreachable documents-tab comparison.");
