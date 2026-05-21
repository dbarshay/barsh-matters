import fs from "node:fs";

const path = "lib/documents/artifactContract.ts";
const text = fs.readFileSync(path, "utf8");
const failures = [];

function check(label, condition) {
  if (condition) {
    console.log(`PASS: ${label}`);
  } else {
    console.error(`FAIL: ${label}`);
    failures.push(label);
  }
}

check("artifact contract file exists", text.includes("buildDocumentArtifactContract"));
check("placeholder helper exists", text.includes("buildPlaceholderSeededDocxRouteArtifact"));
check("template repository helper exists", text.includes("buildTemplateRepositoryDocxRouteArtifact"));
check("workflow sources include settlement", text.includes('"settlement"'));
check("workflow sources include master lawsuit", text.includes('"master-lawsuit"'));
check("workflow sources include direct matter", text.includes('"direct-matter"'));
check("template source includes placeholder seeded", text.includes('"placeholder-seeded"'));
check("template source includes template repository db", text.includes('"template-repository-db"'));
check("template source includes uploaded production template", text.includes('"uploaded-production-template"'));
check("production readiness fields exist", text.includes("productionTemplateReady") && text.includes("finalProductionDocument"));
check("PDF readiness fields exist", text.includes("finalizedPdfGenerated") && text.includes("pdfDownloadUrl"));
check("delivery readiness fields exist", text.includes("deliveryReadiness"));
check("safety flags exist", text.includes("noProductionTemplatePretended") && text.includes("noPdfPretended") && text.includes("noClioUploadPretended"));
check("placeholder helper cannot mark final production", text.includes("productionTemplateReady: false") && text.includes("finalProductionDocument: false"));
check("content type helper exists", text.includes("contentTypeForOutputFormat"));

check("helper does not import prisma", !text.includes("@/lib/prisma"));
check("helper does not write files", !text.includes("writeFile"));
check("helper does not call Clio", !text.includes("uploadDocumentToClio"));
check("helper does not call Graph", !text.includes("graphFetchJson"));

if (failures.length) {
  console.error(`FAIL: document artifact contract safety verifier (${failures.length} failure(s))`);
  process.exit(1);
}

console.log("PASS: document artifact contract safety verifier");
