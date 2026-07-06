import fs from "node:fs";

const directPath = "app/matter/[id]/page.tsx";
const masterPath = "app/matters/page.tsx";
const direct = fs.readFileSync(directPath, "utf8");
const master = fs.readFileSync(masterPath, "utf8");

let failures = 0;
function check(label, ok) {
  if (ok) console.log(`PASS: ${label}`);
  else { failures += 1; console.error(`FAIL: ${label}`); }
}

check("Direct Matter keeps Clio document state", direct.includes("matterClioDocumentsLoading") && direct.includes("matterClioDocumentsResult"));
check("Direct Matter keeps read-only document loader", direct.includes("loadMatterClioDocuments") && direct.includes("/api/documents/clio-matter-documents?"));
check("Direct Matter View Documents renders the BM folder tree", direct.includes("FolderTree") && direct.includes("renderMatterViewDocumentsPopup"));
check("Direct Matter keeps View Documents popup", direct.includes("matterViewDocumentsPopupOpen") && direct.includes("renderMatterViewDocumentsPopup"));
check("Direct Matter keeps document generation popup separate", direct.includes("launchMatterDocumentGenerationDialog") && direct.includes("renderMatterDocumentGenerationPopup"));
check("Master keeps Clio document state", master.includes("masterClioDocumentsLoading") && master.includes("masterClioDocumentsResult"));
check("Master keeps read-only document loader", master.includes("loadMasterClioDocuments") && master.includes("/api/documents/clio-matter-documents?masterLawsuitId="));
check("Master keeps View Documents popup", master.includes("masterViewDocumentsPopupOpen") && master.includes("renderMasterViewDocumentsPopup"));
check("Master keeps document generation popup separate", master.includes("launchMasterDocumentGenerationDialog") && master.includes("renderMasterDocumentGenerationPopup"));
check("UI only uses GET document-list fetches", !direct.includes("clio-matter-documents\", { method: \"POST\"") && !master.includes("clio-matter-documents\", { method: \"POST\""));

if (failures) {
  console.error(`FAIL: ${failures} Clio document list UI safety check(s) failed.`);
  process.exit(1);
}
console.log("PASS: Clio document list UI safety passed. The Golden Rule allows Clio document listing/viewing/retrieval.");
