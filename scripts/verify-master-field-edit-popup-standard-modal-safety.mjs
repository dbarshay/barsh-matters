import fs from "fs";

const page = fs.readFileSync("app/matters/page.tsx", "utf8");
const globals = fs.readFileSync("app/globals.css", "utf8");
const failures = [];

function requireToken(haystack, token, label) {
  if (haystack.includes(token) === false) failures.push("missing " + label + ": " + token);
}

const dialogStart = page.indexOf("data-barsh-master-info-edit-standard-modal=\"true\"");
const dialogEnd = page.indexOf("{masterSettlementFormOpen && activeMasterWorkspaceTab === \"payments\"", dialogStart);
const dialog = dialogStart >= 0 && dialogEnd > dialogStart ? page.slice(dialogStart, dialogEnd) : "";

if (dialog === "") failures.push("could not isolate master field edit modal region");

for (const token of [
  "data-barsh-master-info-edit-standard-modal=\"true\"",
  "data-barsh-standard-modal-overlay=\"true\"",
  "data-barsh-standard-modal-shell=\"compact-field-edit\"",
  "data-barsh-standard-modal-header=\"true\"",
  "data-barsh-standard-modal-title=\"true\"",
  "data-barsh-standard-modal-subtitle=\"true\"",
  "data-barsh-standard-modal-close=\"removed\"",
  "data-barsh-standard-modal-current-card=\"true\"",
  "gridTemplateColumns: \"32px minmax(0, 1fr) 32px\"",
  "background: \"#1e3a8a\"",
  "borderBottom: \"1px solid #1e3a8a\"",
  "onKeyDown={(event) => { if (event.key === \"Escape\")",
  "Confirm Edit",
]) requireToken(dialog, token, "master field edit popup token");

for (const token of [
  "/* BARSH MATTERS STANDARD MODAL SYSTEM */",
  "BARSH MATTERS FIELD EDIT HEADER RIM FINAL FIX",
  "BARSH MATTERS FIELD EDIT MODAL EMPTY ROW SUPPRESSION",
  "form > div:empty",
  "[data-barsh-standard-modal-overlay=\"true\"]",
  "[data-barsh-standard-modal-shell]",
  "[data-barsh-standard-modal-header=\"true\"]",
  "[data-barsh-standard-modal-title=\"true\"]",
  "[data-barsh-standard-modal-subtitle=\"true\"]",
  "[data-barsh-standard-modal-current-card=\"true\"]",
]) requireToken(globals, token, "standard modal CSS token");

const shellHookCount = (page.match(/data-barsh-standard-modal-shell=\"compact-field-edit\"/g) || []).length;
if (shellHookCount !== 1) failures.push("expected exactly one compact field-edit shell hook, found " + shellHookCount);

for (const forbidden of [
  "data-barsh-standard-modal-close=\"true\"",
  "Master Lawsuit field edit · Local save.",
  "Master Lawsuit cost entry · Local save.",
  "height: 0",
  "minHeight: 0",
  "background: \"#eff6ff\"",
  "border: \"1px solid #93c5fd\"",
  "borderRadius: 22",
  "fontSize: 26",
]) {
  if (dialog.includes(forbidden)) failures.push("master field edit popup region still has forbidden token: " + forbidden);
}

if (failures.length > 0) {
  console.error("FAIL: master field edit popup standard modal safety");
  for (const failure of failures) console.error("- " + failure);
  process.exit(1);
}

console.log("PASS: master field edit popup standard modal safety");
