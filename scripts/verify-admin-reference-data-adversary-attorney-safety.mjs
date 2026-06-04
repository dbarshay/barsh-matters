#!/usr/bin/env node

import fs from "fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function pass(message) {
  console.log(`PASS: ${message}`);
}

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exitCode = 1;
}

function mustContain(label, text, needle) {
  if (text.includes(needle)) {
    pass(label);
  } else {
    fail(`${label}: missing ${needle}`);
  }
}

function mustNotContain(label, text, needle) {
  if (!text.includes(needle)) {
    pass(label);
  } else {
    fail(`${label}: unexpectedly contains ${needle}`);
  }
}

const adminPage = read("app/admin/reference-data/page.tsx");
const entitiesRoute = read("app/api/reference-data/entities/route.ts");
const importPreviewRoute = read("app/api/reference-data/import-preview/route.ts");
const importConfirmRoute = read("app/api/reference-data/import-confirm/route.ts");
const importHistoryRoute = read("app/api/reference-data/import-history/route.ts");
const cleanupPreviewRoute = read("app/api/reference-data/import-cleanup-preview/route.ts");
const cleanupConfirmRoute = read("app/api/reference-data/import-cleanup-confirm/route.ts");
const referenceData = read("lib/referenceData.ts");
const referenceImport = read("lib/referenceImport.ts");

console.log("RESULT: verify Admin Reference Data adversary attorney safety");

mustContain(
  "Admin Reference Data exposes Adversary Attorneys type",
  adminPage,
  '{ value: "adversary_attorney", label: "Adversary Attorneys" }'
);

mustContain(
  "Admin Reference Data uses selectedType state",
  adminPage,
  'const [selectedType, setSelectedType] = useState("individual");'
);

mustContain(
  "Admin Reference Data renders selectedType dropdown",
  adminPage,
  "value={selectedType}"
);

mustContain(
  "Admin Reference Data renders dynamic type options",
  adminPage,
  "typeOptions.map((option) =>"
);

mustContain(
  "Admin Reference Data derives selected type label from typeOptions",
  adminPage,
  "typeOptions.find((option) => option.value === selectedType)?.label || selectedType"
);

mustContain(
  "Admin Reference Data loads rows by selectedType",
  adminPage,
  "async function loadRows("
);

mustContain(
  "Admin Reference Data sends selectedType to entities create",
  adminPage,
  "type: selectedType"
);

mustContain(
  "Admin Reference Data sends selectedType to import preview",
  adminPage,
  'fetch("/api/reference-data/import-preview"'
);

mustContain(
  "Admin Reference Data sends selectedType to import confirm",
  adminPage,
  'fetch("/api/reference-data/import-confirm"'
);

mustContain(
  "Admin Reference Data reloads import history by selectedType",
  adminPage,
  "void loadImportHistory(selectedType);"
);

mustContain(
  "Admin Reference Data loads cleanup preview by selectedType",
  adminPage,
  "async function loadCleanupPreview(nextType = selectedType"
);

mustContain(
  "Admin Reference Data supports row edit PATCH",
  adminPage,
  'fetch("/api/reference-data/entities",'
);

mustContain(
  "Admin Reference Data supports aliases through local alias route",
  adminPage,
  'fetch("/api/reference-data/aliases",'
);

mustContain(
  "Reference helper includes adversary_attorney type",
  referenceData,
  '"adversary_attorney"'
);

mustContain(
  "Reference helper labels adversary_attorney",
  referenceData,
  'adversary_attorney: "Adversary Attorneys"'
);

mustContain(
  "Entities route returns dynamic reference type options",
  entitiesRoute,
  "typeOptions: referenceTypeOptions()"
);

mustContain(
  "Entities route normalizes submitted reference type",
  entitiesRoute,
  "normalizeReferenceEntityType"
);

mustContain(
  "Import preview route accepts posted type",
  importPreviewRoute,
  "type: body?.type"
);

mustContain(
  "Import confirm route uses preview type",
  importConfirmRoute,
  "type: preview.type"
);

mustContain(
  "Import history route returns dynamic type options",
  importHistoryRoute,
  "typeOptions: referenceTypeOptions()"
);

mustContain(
  "Cleanup preview route returns dynamic type options",
  cleanupPreviewRoute,
  "typeOptions: referenceTypeOptions()"
);

mustContain(
  "Cleanup confirm route is type-scoped",
  cleanupConfirmRoute,
  "normalizeReferenceEntityType"
);

mustContain(
  "Reference import normalizes type",
  referenceImport,
  "const type = normalizeReferenceEntityType(input.type);"
);

mustContain(
  "Reference import marks local reference data",
  referenceImport,
  "localBarshMattersReferenceData: true"
);

mustContain(
  "Reference import forbids Clio data changes",
  referenceImport,
  "noClioRecordsChanged: true"
);

for (const [label, text] of [
  ["Admin page", adminPage],
  ["Entities route", entitiesRoute],
  ["Import preview route", importPreviewRoute],
  ["Import confirm route", importConfirmRoute],
  ["Import history route", importHistoryRoute],
  ["Cleanup preview route", cleanupPreviewRoute],
  ["Cleanup confirm route", cleanupConfirmRoute],
  ["Reference import helper", referenceImport],
]) {
  mustNotContain(`${label} must not call clioFetch`, text, "clioFetch(");
  mustNotContain(`${label} must not call Clio token helper`, text, "getClioAccessToken");
  mustNotContain(`${label} must not use ClaimIndex rebuild wording`, text, "rebuild ClaimIndex");
  mustNotContain(`${label} must not use ClaimIndex rebuild wording lowercase`, text, "claimindex rebuild");
}

if (process.exitCode) {
  console.error("FAILURES=1");
  process.exit(process.exitCode);
}

console.log("FAILURES=0");
