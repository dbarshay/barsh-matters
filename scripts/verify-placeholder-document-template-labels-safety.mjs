import fs from "node:fs";

const failures = [];

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function check(label, condition) {
  if (condition) {
    console.log(`PASS: ${label}`);
  } else {
    console.error(`FAIL: ${label}`);
    failures.push(label);
  }
}

const finalizeRoute = read("app/api/settlements/documents-finalize-local/route.ts");
const queueRoute = read("app/api/settlements/documents-print-queue-local/route.ts");
const page = read("app/matters/page.tsx");

check("finalize route labels generated route as placeholder-seeded", finalizeRoute.includes("buildPlaceholderSeededDocxRouteArtifact") && fs.readFileSync("lib/documents/artifactContract.ts", "utf8").includes('artifactKind: "placeholder-seeded-generated-docx-route"'));
check("finalize route marks productionTemplateReady false", finalizeRoute.includes("productionTemplateReady: false"));
check("finalize route marks finalProductionDocument false", finalizeRoute.includes("finalProductionDocument: false"));
check("finalize route note says not final production", finalizeRoute.includes("not a final production template/document"));

check("queue route marks templateSource placeholder-seeded", queueRoute.includes('templateSource: "placeholder-seeded"'));
check("queue route marks productionTemplateReady false", queueRoute.includes("productionTemplateReady: false"));
check("queue route marks finalProductionDocument false", queueRoute.includes("finalProductionDocument: false"));
check("queue route note says not final production", queueRoute.includes("not a final production template/document"));

check("UI finalization copy says placeholder DOCX route", page.includes("Placeholder DOCX route ready"));
check("UI print copy says placeholder-seeded", page.includes("placeholder-seeded generated DOCX route"));
check("UI queue copy says queued placeholder DOCX route", page.includes("Queued placeholder DOCX route"));

check("no final-production claim was introduced", !finalizeRoute.includes("finalProductionDocument: true") && !queueRoute.includes("finalProductionDocument: true"));

if (failures.length) {
  console.error(`FAIL: placeholder document template label safety verifier (${failures.length} failure(s))`);
  process.exit(1);
}

console.log("PASS: placeholder document template label safety verifier");
