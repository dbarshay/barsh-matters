import fs from "fs";

const page = fs.readFileSync("app/matter/[id]/page.tsx", "utf8");
const failures = [];

const start = page.indexOf('data-barsh-direct-dos-edit-standard-modal="true"');
const end = page.indexOf('{directFieldEditModal && directFieldEditModal !== "claimAmount" && directFieldEditModal !== "dos" && (', start);
const region = start >= 0 && end > start ? page.slice(start, end) : "";

if (region === "") failures.push("could not isolate direct DOS popup region");

for (const token of [
  'data-barsh-direct-dos-edit-standard-modal="true"',
  'data-barsh-direct-dos-current-card="true"',
  'Current',
  'background: "#1e3a8a"',
  'color: "#ffffff"',
  'textAlign: "center"',
  'Confirm Edit',
  'type="submit"',
  'onSubmit={(event) =>',
  'onKeyDown={(event) => { if (event.key === "Escape")',
  'borderTop: "1px solid #e2e8f0"',
]) {
  if (region.includes(token) === false) failures.push("missing direct DOS popup token: " + token);
}

for (const forbidden of [
  "This updates DOS Start and DOS End locally",
  "borderRadius: 22",
  'background: "#16a34a"',
  ">\n                Save\n              </button>",
]) {
  if (region.includes(forbidden)) failures.push("direct DOS popup still has old token: " + forbidden);
}

if (failures.length) {
  console.error("FAIL: direct DOS popup standard modal safety");
  for (const failure of failures) console.error("- " + failure);
  process.exit(1);
}

console.log("PASS: direct DOS popup standard modal safety");
