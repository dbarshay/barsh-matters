import fs from "node:fs";

const page = fs.readFileSync("app/admin/ticklers/page.tsx", "utf8");
const failures = [];

function mustInclude(label, needle) {
  if (!page.includes(needle)) failures.push(`missing ${label}: ${needle}`);
}

function mustNotInclude(label, needle) {
  if (page.includes(needle)) failures.push(`forbidden ${label}: ${needle}`);
}

mustInclude("enter key handler", "function handleTicklerSearchKeyDown");
mustInclude("Enter key check", 'event.key !== "Enter"');
mustInclude("prevents default submit behavior", "event.preventDefault();");
mustInclude("Enter launches tickler search", "void loadTicklers();");
mustInclude("Type / Kind uses Enter handler", "onKeyDown={handleTicklerSearchKeyDown} style={inputStyle}>");
mustInclude("Provider field uses Enter handler", 'onKeyDown={handleTicklerSearchKeyDown} placeholder="Provider or client"');
mustInclude("Patient field uses Enter handler", 'onKeyDown={handleTicklerSearchKeyDown} placeholder="Patient name"');
mustInclude("Insurer field uses Enter handler", 'onKeyDown={handleTicklerSearchKeyDown} placeholder="Insurer"');
mustInclude("Claim field uses Enter handler", 'onKeyDown={handleTicklerSearchKeyDown} placeholder="Claim number"');
mustInclude("Search button remains", "Search Ticklers");

mustNotInclude("form submit wrapper", "<form");
mustNotInclude("page POST write", 'method: "POST"');
mustNotInclude("Run Ticklers button", "Run Ticklers");
mustNotInclude("Process Ticklers button", "Process Ticklers");

if (failures.length) {
  console.error("FAIL: admin tickler Enter-search verifier failed");
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}

console.log("PASS: Admin Ticklers search launches with Enter from filter inputs without adding write/runner behavior.");
