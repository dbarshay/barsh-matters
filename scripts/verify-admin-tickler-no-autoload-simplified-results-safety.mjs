import fs from "node:fs";

const page = fs.readFileSync("app/admin/ticklers/page.tsx", "utf8");
const failures = [];

function mustInclude(label, needle) {
  if (!page.includes(needle)) failures.push(`missing ${label}: ${needle}`);
}

function mustNotInclude(label, needle) {
  if (page.includes(needle)) failures.push(`forbidden ${label}: ${needle}`);
}

mustInclude("searched state", "const [searched, setSearched] = useState(false)");
mustInclude("tickler kind options state", "const [ticklerKindOptions, setTicklerKindOptions] = useState<string[]>([])");
mustInclude("tickler filter options loader", "async function loadTicklerFilterOptions()");
mustInclude("filter options endpoint call", "/api/admin/ticklers/search?kind=all&status=all&limit=1");
mustInclude("launch loads tickler filter options", "void loadTicklerFilterOptions();");
mustInclude("kind dropdown uses option state", "ticklerKindOptions.length ? ticklerKindOptions");
mustInclude("search function sets searched", "setSearched(true);");
mustInclude("launch loads reference options", "void loadReferenceOptions();");
mustInclude("pre-search empty-state copy", "Enter criteria and click Search Ticklers.");
mustInclude("clear resets searched", "setSearched(false);");
mustInclude("clear resets result", "setResult(null);");

const useEffectMatch = page.match(/useEffect\(\(\) => \{[\s\S]*?\}, \[\]\);/);
if (!useEffectMatch) {
  failures.push("missing launch useEffect");
} else if (useEffectMatch[0].includes("void loadTicklers();")) {
  failures.push("launch useEffect must not call result-loading loadTicklers");
}

const tableStart = page.indexOf("<table");
const tableEnd = page.indexOf("</table>", tableStart);
const table = tableStart >= 0 && tableEnd > tableStart ? page.slice(tableStart, tableEnd) : "";

if (!table) failures.push("missing result table");

[
  "Due",
  "Type",
  "Matter",
  "Master Lawsuit",
  "Provider",
  "Patient",
  "Insurer",
].forEach((header) => {
  if (!table.includes(`>${header}</th>`)) failures.push(`missing result table header ${header}`);
});

[
  ">Status</th>",
  ">Title</th>",
  ">Priority</th>",
].forEach((oldHeader) => {
  if (table.includes(oldHeader)) failures.push(`old result table header still present: ${oldHeader}`);
});

mustInclude("result provider caseData cell", "(tickler as any).caseData?.provider || \"—\"");
mustInclude("result patient caseData cell", "(tickler as any).caseData?.patient || \"—\"");
mustInclude("result insurer caseData cell", "(tickler as any).caseData?.insurer || \"—\"");
mustInclude("result matter caseData cell", "(tickler as any).caseData?.matter || tickler.displayNumber || tickler.matterId || \"—\"");
mustInclude("result master lawsuit caseData cell", "(tickler as any).caseData?.masterLawsuit || tickler.masterLawsuitId || \"—\"");

mustNotInclude("title description detail in result table", "tickler.description ? <div");
mustNotInclude("priority result cell", "{tickler.priority || \"—\"}</td>");

if (failures.length) {
  console.error("FAIL: admin tickler no-autoload/simplified-results verifier failed");
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}

console.log("PASS: Admin Ticklers does not auto-load results and visible results use the requested seven columns.");
