import fs from "node:fs";

const path = "app/matters/page.tsx";
const source = fs.readFileSync(path, "utf8");

function chunkAround(anchor, before = 2500, after = 2500) {
  const idx = source.indexOf(anchor);
  if (idx === -1) return "";
  return source.slice(Math.max(0, idx - before), Math.min(source.length, idx + after));
}

function functionChunk(name) {
  let idx = source.indexOf(`async function ${name}`);
  if (idx === -1) idx = source.indexOf(`function ${name}`);
  if (idx === -1) return "";
  const nextFunction = source.indexOf("\n  function ", idx + 1);
  const nextAsync = source.indexOf("\n  async function ", idx + 1);
  const ends = [nextFunction, nextAsync].filter((n) => n !== -1);
  const end = ends.length ? Math.min(...ends) : source.length;
  return source.slice(idx, end);
}

const viewTitle = "Open the Master Lawsuit Clio document picker.";
const genTitle = "Open the Master Lawsuit document generation preview popup.";
const closeTitle = "Close Lawsuit workflow will be wired after payment/settlement safety checks.";

const actionChunk = chunkAround(closeTitle, 3200, 1400);
const viewButtonChunk = chunkAround(viewTitle, 200, 900);
const genButtonChunk = chunkAround(genTitle, 200, 900);
const openChunk = functionChunk("openMasterViewDocumentsPopup");
const launchChunk = functionChunk("launchMasterDocumentGenerationDialog");
const workspaceChunk = chunkAround("Read-only preview shell", 0, 2200);

const checks = [
  {
    label: "Master View Documents button exists above generation button",
    pass:
      actionChunk.includes(viewTitle) &&
      actionChunk.includes(genTitle) &&
      actionChunk.indexOf(viewTitle) < actionChunk.indexOf(genTitle),
  },
  {
    label: "Master View Documents button calls only openMasterViewDocumentsPopup",
    pass:
      viewButtonChunk.includes("openMasterViewDocumentsPopup") &&
      !viewButtonChunk.includes("launchMasterDocumentGenerationDialog"),
  },
  {
    label: "Master Document Generation button calls only launchMasterDocumentGenerationDialog",
    pass:
      genButtonChunk.includes("launchMasterDocumentGenerationDialog") &&
      !genButtonChunk.includes("openMasterViewDocumentsPopup"),
  },
  {
    label: "openMasterViewDocumentsPopup does not open generation popup",
    pass:
      openChunk.includes("setMasterViewDocumentsPopupOpen(true)") &&
      !openChunk.includes("setMasterDocumentGenerationPopupOpen(true)"),
  },
  {
    label: "launchMasterDocumentGenerationDialog does not open view popup or force Documents workspace",
    pass:
      launchChunk.includes("setMasterDocumentGenerationPopupOpen(true)") &&
      !launchChunk.includes("setMasterViewDocumentsPopupOpen(true)") &&
      !launchChunk.includes('setActiveMasterWorkspaceTab("documents")'),
  },
  {
    label: "Master view popup render call exists exactly once",
    pass: (source.match(/\{renderMasterViewDocumentsPopup\(\)\}/g) || []).length === 1,
  },
  {
    label: "Master generation popup render call exists exactly once",
    pass: (source.match(/\{renderMasterDocumentGenerationPopup\(\)\}/g) || []).length === 1,
  },
  {
    label: "Master popups are mounted in visible Lawsuit Actions area",
    pass:
      actionChunk.includes("{renderMasterViewDocumentsPopup()}") &&
      actionChunk.includes("{renderMasterDocumentGenerationPopup()}"),
  },
  {
    label: "Master popups are not mounted inside hidden non-payments workspace card",
    pass:
      !workspaceChunk.includes("{renderMasterViewDocumentsPopup()}") &&
      !workspaceChunk.includes("{renderMasterDocumentGenerationPopup()}"),
  },
];

let failed = 0;
for (const check of checks) {
  if (check.pass) {
    console.log(`PASS: ${check.label}`);
  } else {
    failed += 1;
    console.log(`FAIL: ${check.label}`);
  }
}

if (failed) {
  console.error(`\nFAIL: ${failed} Master View Documents / Document Generation separation check(s) failed.`);
  process.exit(1);
}

console.log("\nPASS: Master View Documents and Document Generation buttons are separated and mounted in the visible action area.");
