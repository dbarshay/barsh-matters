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

const buttonMatches = [...page.matchAll(/<button[\s\S]*?<\/button>/g)].map((m) => m[0]);
const docgenButtons = buttonMatches.filter((button) => button.includes("launchMasterDocumentGenerationDialog"));

check("master docgen launcher exists", page.includes("launchMasterDocumentGenerationDialog"));
check("master docgen popup opens", page.includes("setMasterDocumentGenerationPopupOpen(true)"));
check("master docgen preview loader exists", page.includes("loadMasterDocumentDataPreview"));
check("master docgen popup renderer exists", page.includes("renderMasterDocumentGenerationPopup"));
check("master docgen label/title exists", page.includes("Master Lawsuit Document Generation") || page.includes("Document Generation"));
check("master docgen has at least one button", docgenButtons.length >= 1);
check("master docgen button is not globally disabled", docgenButtons.some((button) => !button.includes("pointerEvents: \"none\"") && !button.includes("disabled={true}")));

if (failures) {
  console.error(`FAIL: master document generation action button clickable failed (${failures})`);
  process.exit(1);
}
console.log("PASS: master document generation action button clickable safety passed.");
