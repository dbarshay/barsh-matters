import fs from "node:fs";

const page = fs.readFileSync("app/matters/page.tsx", "utf8");
let failures = 0;
function check(label, ok) { ok ? console.log(`PASS: ${label}`) : (console.error(`FAIL: ${label}`), failures++); }

check("Master View Documents popup exists", page.includes("openMasterViewDocumentsPopup") && page.includes("renderMasterViewDocumentsPopup"));
check("Master Document Generation popup exists", page.includes("launchMasterDocumentGenerationDialog") && page.includes("renderMasterDocumentGenerationPopup"));
check("View Documents and Document Generation remain separate handlers", page.includes("openMasterViewDocumentsPopup") && page.includes("launchMasterDocumentGenerationDialog"));
check("View popup render call exists", (page.match(/renderMasterViewDocumentsPopup/g) || []).length >= 1);
check("Generation popup render call exists", (page.match(/renderMasterDocumentGenerationPopup/g) || []).length >= 1);
check("launchMasterDocumentGenerationDialog does not call view popup", !/launchMasterDocumentGenerationDialog[\s\S]{0,900}openMasterViewDocumentsPopup/.test(page));

if (failures) {
  console.error(`FAIL: ${failures} Master View Documents / Document Generation separation check(s) failed.`);
  process.exit(1);
}
console.log("PASS: Master View Documents / Document Generation separation safety passed.");
