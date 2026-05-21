import fs from "node:fs";

const routePath = "app/api/settlements/documents-finalize-local/route.ts";
const helperPath = "lib/documents/artifactContract.ts";
const route = fs.readFileSync(routePath, "utf8");
const helper = fs.readFileSync(helperPath, "utf8");
const failures = [];

function check(label, condition) {
  if (condition) {
    console.log(`PASS: ${label}`);
  } else {
    console.error(`FAIL: ${label}`);
    failures.push(label);
  }
}

check("shared artifact contract helper exists", helper.includes("buildPlaceholderSeededDocxRouteArtifact"));
check("settlement route imports artifact contract", route.includes("@/lib/documents/artifactContract"));
check("settlement route uses placeholder seeded artifact helper", route.includes("buildPlaceholderSeededDocxRouteArtifact"));
check("settlement route still maps seeded settlement routes", route.includes("/api/settlements/settlement-summary") && route.includes("/api/settlements/provider-remittance-breakdown") && route.includes("/api/settlements/attorney-fee-breakdown"));
check("settlement route still marks placeholder seeded", route.includes("templateSource") && route.includes("placeholder-seeded"));
check("settlement route still marks production template false", route.includes("productionTemplateReady") && route.includes("false"));
check("settlement route still marks final production false", route.includes("finalProductionDocument") && route.includes("false"));
check("settlement route still avoids PDF pretend", route.includes("finalizedPdfGenerated: false"));
check("settlement route still avoids persistent file creation", route.includes("persistentFileCreated: false"));
check("settlement route does not write files", !route.includes("fs.writeFile"));
check("settlement route does not upload to Clio", !route.includes("uploadDocumentToClio"));
check("settlement route does not send email", !route.includes("sendMail("));

if (failures.length) {
  console.error(`FAIL: settlement document artifact contract usage safety verifier (${failures.length} failure(s))`);
  process.exit(1);
}

console.log("PASS: settlement document artifact contract usage safety verifier");
