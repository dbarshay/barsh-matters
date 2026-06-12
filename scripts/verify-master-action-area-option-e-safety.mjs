import fs from "fs";

const page = fs.readFileSync("app/matters/page.tsx", "utf8");
const failures = [];

for (const token of [
  'const [masterActionGroup, setMasterActionGroup] = useState<"payments" | "settlement" | "documents" | "court_dates" | null>(null);',
  'data-barsh-master-actions-outer-section="true"',
  'data-barsh-master-actions-section-heading="true"',
  'data-barsh-master-action-area-option-e="true"',
  'data-barsh-master-action-tab-row="true"',
  'data-barsh-master-action-panel="true"',
  'background: "transparent"',
  'boxShadow: "none"',
  '{ key: "payments", label: "Payments", fill: "#16a34a", soft: "#f0fdf4", text: "#166534" }',
  '{ key: "settlement", label: "Settlement", fill: "#1e3a8a", soft: "#eff6ff", text: "#1e3a8a" }',
  '{ key: "documents", label: "Documents", fill: "#8b5e3c", soft: "#f8efe7", text: "#7c4a22" }',
  '{ key: "court_dates", label: "Court Dates", fill: "#ea580c", soft: "#fff7ed", text: "#c2410c" }',
  'data-barsh-master-action-tab={key}',
  'masterActionGroup === "payments"',
  'masterActionGroup === "settlement"',
  'masterActionGroup === "documents"',
  'masterActionGroup === "court_dates"',
  'data-barsh-master-action-section="court-dates"',
  'data-barsh-master-add-new-court-date-placeholder="true"',
  'data-barsh-master-view-edit-court-dates-placeholder="true"',
  'Add New Court Date',
  'View / Edit Court Dates',
  'background: "#fff7ed", color: "#c2410c"',
]) {
  if (!page.includes(token)) failures.push(`missing master Actions / Court Dates token: ${token}`);
}

const areaStart = page.indexOf('data-barsh-master-action-area-option-e="true"');
const areaEnd = page.indexOf('{masterCloseDialogOpen && (', areaStart);
const area = areaStart >= 0 && areaEnd > areaStart ? page.slice(areaStart, areaEnd) : "";

if (!area) failures.push("could not isolate master Actions area");

for (const forbidden of [
  "Payment Actions",
  "Matter Actions",
  "Document Activity",
]) {
  if (area.includes(forbidden)) failures.push(`old/non-final master Actions wording still appears: ${forbidden}`);
}

if (failures.length) {
  console.error("FAIL: master action area option E safety");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("PASS: master action area option E safety");
