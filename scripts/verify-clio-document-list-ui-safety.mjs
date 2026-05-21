import fs from "node:fs";

const directPath = "app/matter/[id]/page.tsx";
const masterPath = "app/matters/page.tsx";

const direct = fs.readFileSync(directPath, "utf8");
const master = fs.readFileSync(masterPath, "utf8");

function hasOrderedNear(source, anchor, first, second, window = 3000) {
  const anchorIndex = source.indexOf(anchor);
  if (anchorIndex === -1) return false;
  const start = Math.max(0, anchorIndex - window);
  const end = Math.min(source.length, anchorIndex + window);
  const chunk = source.slice(start, end);
  const a = chunk.indexOf(first);
  const b = chunk.indexOf(second);
  return a !== -1 && b !== -1 && a < b;
}

function chunkAround(source, anchor, before = 2500, after = 2500) {
  const idx = source.indexOf(anchor);
  if (idx === -1) return "";
  return source.slice(Math.max(0, idx - before), Math.min(source.length, idx + after));
}

const directActionChunk = chunkAround(direct, "Open the Direct Matter document generation preview popup.", 2200, 1000);
const masterActionChunk = chunkAround(master, "Open the Master Lawsuit Clio document picker.", 500, 2200);
const masterGenerationChunk = chunkAround(master, "Document Generation", 1200, 1200);

const checks = [
  {
    label: "Direct Matter has Clio document state and refresh panel",
    pass:
      direct.includes("matterClioDocumentsLoading") &&
      direct.includes("matterClioDocumentsResult") &&
      direct.includes("loadMatterClioDocuments") &&
      direct.includes("renderMatterClioDocumentsPanel") &&
      direct.includes("Refresh Clio Documents"),
  },
  {
    label: "Direct Matter calls read-only document list route by matterId",
    pass:
      direct.includes("/api/documents/clio-matter-documents?matterId=") &&
      direct.includes('cache: "no-store"'),
  },
  {
    label: "Direct Matter has separate View Documents action above Document Generation",
    pass:
      directActionChunk.includes("Open the Direct Matter Clio document picker.") &&
      directActionChunk.includes("openMatterViewDocumentsPopup") &&
      directActionChunk.includes("Open the Direct Matter document generation preview popup.") &&
      directActionChunk.includes("launchMatterDocumentGenerationDialog"),
  },
  {
    label: "Direct Matter View Documents popup renders Clio document picker",
    pass:
      direct.includes("matterViewDocumentsPopupOpen") &&
      direct.includes("renderMatterViewDocumentsPopup") &&
      direct.includes("selectedMatterViewDocument") &&
      direct.includes("Document opening/viewing will be wired to a safe Clio retrieval route next"),
  },
  {
    label: "Direct Matter Document Generation still switches to Documents workspace",
    pass:
      direct.includes("async function launchMatterDocumentGenerationDialog") &&
      direct.includes('setActiveWorkspaceTab("documents");') &&
      direct.includes("setMatterDocumentGenerationPopupOpen(true);"),
  },
  {
    label: "Direct Matter Clio document panel renders for already-aggregated matters",
    pass:
      direct.includes('{activeWorkspaceTab === "documents" && alreadyAggregated && renderMatterClioDocumentsPanel()}'),
  },
  {
    label: "Master has Clio document state and refresh panel",
    pass:
      master.includes("masterClioDocumentsLoading") &&
      master.includes("masterClioDocumentsResult") &&
      master.includes("loadMasterClioDocuments") &&
      master.includes("renderMasterClioDocumentsPanel") &&
      master.includes("Refresh Clio Documents"),
  },
  {
    label: "Master calls read-only document list route by masterLawsuitId",
    pass:
      master.includes("/api/documents/clio-matter-documents?masterLawsuitId=") &&
      master.includes('cache: "no-store"'),
  },
  {
    label: "Master has separate View Documents action above Document Generation",
    pass:
      masterActionChunk.includes("Open the Master Lawsuit Clio document picker.") &&
      masterActionChunk.includes("openMasterViewDocumentsPopup") &&
      masterActionChunk.includes("Document Generation") &&
      masterActionChunk.includes("launchMasterDocumentGenerationDialog"),
  },
  {
    label: "Master View Documents button does not call generation handler",
    pass:
      !chunkAround(master, "Open the Master Lawsuit Clio document picker.", 100, 900).includes("launchMasterDocumentGenerationDialog"),
  },
  {
    label: "Master Document Generation button does not call View Documents popup",
    pass:
      !masterGenerationChunk.includes("openMasterViewDocumentsPopup"),
  },
  {
    label: "Master Document Generation no longer forces main Documents workspace",
    pass:
      !chunkAround(master, "async function launchMasterDocumentGenerationDialog", 0, 900).includes('setActiveMasterWorkspaceTab("documents")'),
  },
  {
    label: "Master View Documents popup renders Clio document picker",
    pass:
      master.includes("masterViewDocumentsPopupOpen") &&
      master.includes("renderMasterViewDocumentsPopup") &&
      master.includes("selectedMasterViewDocument") &&
      master.includes("Pick a document from the mapped Clio master matter Documents tab"),
  },
  {
    label: "Master panel warns mapped Clio master matter is required",
    pass:
      master.includes("If no mapped Clio master matter exists, the API fails closed"),
  },
  {
    label: "UI only uses GET fetches and does not add document mutation calls",
    pass:
      !direct.includes("clio-matter-documents\", { method: \"POST\"") &&
      !master.includes("clio-matter-documents\", { method: \"POST\"") &&
      !direct.includes("clio-matter-documents', { method: 'POST'") &&
      !master.includes("clio-matter-documents', { method: 'POST'"),
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
  console.error(`\nFAIL: ${failed} Clio document list UI safety check(s) failed.`);
  process.exit(1);
}

console.log("\nPASS: Direct and Master View Documents popups are separated from Document Generation and wired read-only.");
