import fs from "node:fs";

const page = fs.readFileSync("app/admin/ticklers/page.tsx", "utf8");
const optionsRoute = fs.readFileSync("app/api/reference-data/options/route.ts", "utf8");

const failures = [];

function mustInclude(label, haystack, needle) {
  if (!haystack.includes(needle)) failures.push(`missing ${label}: ${needle}`);
}

function mustNotInclude(label, haystack, needle) {
  if (haystack.includes(needle)) failures.push(`forbidden ${label}: ${needle}`);
}

mustInclude("reference options route supports provider_client", optionsRoute, 'provider_client: "provider_client"');
mustInclude("reference options route supports insurer_company", optionsRoute, 'insurer: "insurer_company"');
mustInclude("reference options route supports denial_reason", optionsRoute, 'denial_reason: "denial_reason"');
mustInclude("reference options route supports closed_reason", optionsRoute, 'closed_reason: "closed_reason"');
mustInclude("reference options route supports court_venue", optionsRoute, 'court_venue: "court_venue"');

mustInclude("reference option types map", page, "const referenceOptionTypes =");
mustInclude("provider option type", page, 'provider: "provider_client"');
mustInclude("insurer option type", page, 'insurer: "insurer_company"');
mustInclude("denial reason option type", page, 'denialReason: "denial_reason"');
mustInclude("closed reason option type", page, 'closedReason: "closed_reason"');
mustInclude("court option type", page, 'court: "court_venue"');
mustInclude("reference option loader", page, "async function loadReferenceOptions()");
mustInclude("reference options endpoint", page, "/api/reference-data/options?type=");
mustInclude("datalist renderer", page, "function renderReferenceDatalist");
mustInclude("provider datalist", page, 'list="admin-tickler-provider-options"');
mustInclude("insurer datalist", page, 'list="admin-tickler-insurer-options"');
mustInclude("denial reason datalist", page, 'list="admin-tickler-denial-reason-options"');
mustInclude("closed reason datalist", page, 'list="admin-tickler-closed-reason-options"');
mustInclude("court datalist", page, 'list="admin-tickler-court-options"');

mustInclude("patient remains free text", page, 'placeholder="Patient name"');
mustInclude("claim remains free text", page, 'placeholder="Claim number"');
mustInclude("status remains free text", page, 'placeholder="Matter status"');
mustInclude("matter number remains free text", page, 'placeholder="BRL30121"');

mustNotInclude("Run Ticklers button", page, "Run Ticklers");
mustNotInclude("Process Ticklers button", page, "Process Ticklers");
mustNotInclude("page POST write", page, 'method: "POST"');
mustNotInclude("page PATCH write", page, 'method: "PATCH"');
mustNotInclude("page DELETE write", page, 'method: "DELETE"');

if (failures.length) {
  console.error("FAIL: admin tickler reference dropdown verifier failed");
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}

console.log("PASS: admin tickler search uses reference-data dropdowns for table-backed fields and remains read-only.");
