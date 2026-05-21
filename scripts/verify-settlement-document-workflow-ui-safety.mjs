import fs from "node:fs";

const pagePath = "app/matters/page.tsx";
const page = fs.readFileSync(pagePath, "utf8");

let failed = false;

function check(label, ok) {
  if (ok) {
    console.log(`PASS: ${label}`);
  } else {
    failed = true;
    console.error(`FAIL: ${label}`);
  }
}

check("settlement document launch mode exists", page.includes('useState<"lawsuit" | "settlement">("lawsuit")'));
check("settlement document record id state exists", page.includes("masterDocumentSettlementRecordId"));
check("settlement document preview endpoint is used", page.includes("/api/settlements/documents-preview"));
check("commit settlement creates payment due tickler", page.includes("await createMasterSettlementPaymentDueTickler(savedSettlementRecordId)"));
check("commit settlement launches settlement document dialog", page.includes('mode: "settlement"') && page.includes("settlementRecordId: savedSettlementRecordId"));
check("preview panel is visible when workflow stage is preview", page.includes('{masterDocumentWorkflowStage === "preview" && displayedSelectedTemplate && ('));
check("edit panel is visible when workflow stage is edit", page.includes('{masterDocumentWorkflowStage === "edit" && displayedSelectedTemplate && ('));
check("old preview false guard removed", !page.includes('{false && masterDocumentWorkflowStage === "preview"'));
check("old edit false guard removed", !page.includes('{false && masterDocumentWorkflowStage === "edit"'));
check("preview copy no longer says placeholder state", !page.includes("no PDF or final file is generated in this placeholder state"));
check("edit copy no longer says no Word integration is faked", !page.includes("No Word integration is faked here"));
check("delivery still exposes Email Document", page.includes('actionButton("Email Document"'));
check("delivery still exposes Print Document", page.includes('actionButton("Print Document"'));
check("delivery still exposes Send to Print Queue", page.includes('actionButton("Send to Print Queue"'));
check("print queue copy accurately says backend not yet writing records", page.includes("not yet writing queue records"));

check("document picker matches displayed settlement options", page.includes("const match = displayedTemplateOptions.find"));
check("document picker has explicit Continue action", page.includes('"Continue"') && page.includes("Continue to preview or edit the selected document."));

check("selected template falls back to typed/displayed label", page.includes("option.label.toLowerCase() === masterDocumentTemplateQuery.trim().toLowerCase()"));
check("selected template reuses displayedSelectedTemplate", page.includes("const selectedTemplate =\n      displayedSelectedTemplate || null;"));



if (failed) {
  process.exit(1);
}

console.log("PASS: settlement document workflow UI safety verifier");
