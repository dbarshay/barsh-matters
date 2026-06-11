import fs from "node:fs";

const pagePath = "app/matters/page.tsx";
const page = fs.readFileSync(pagePath, "utf8");

let failures = 0;
function check(label, ok) {
  if (ok) console.log(`PASS: ${label}`);
  else {
    failures += 1;
    console.error(`FAIL: ${label}`);
  }
}

check("settlement document launch mode exists", page.includes("masterDocumentLaunchMode") || page.includes("settlementRecordId"));
check("settlement document record id state exists", page.includes("masterDocumentSettlementRecordId") || page.includes("settlementRecordId"));
check("settlement document preview endpoint is used", page.includes("/api/settlements/documents-preview"));
check("settlement record save exists", page.includes("/api/settlements/local-record"));
check("payment due tickler creation exists", page.includes("createMasterSettlementPaymentDueTickler"));
check("settlement document dialog launch exists", page.includes("launchMasterDocumentGenerationDialog"));
check("preview/edit/finalize delivery workflow exists", page.includes("Preview") && page.includes("Finalize") && page.includes("Email Finalized Document"));
check("settlement delivery exposes Email Finalized Document", page.includes("Email Finalized Document"));
check("settlement delivery exposes Print Finalized Document", page.includes("Print Finalized Document"));
check("settlement delivery exposes Send to Print Queue", page.includes("Send to Print Queue"));
check("document picker has explicit Continue action", page.includes("Continue"));
check("selected template fallback exists", page.includes("displayedSelectedTemplate") || page.includes("selectedTemplate"));
check("temporary void shortcut not exposed in document delivery", !page.includes("temporary void shortcut"));

if (failures) {
  console.error(`FAIL: settlement document workflow UI safety failed (${failures})`);
  process.exit(1);
}
console.log("PASS: settlement document workflow UI safety passed for current finalized-delivery contract.");
