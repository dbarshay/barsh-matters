import fs from "node:fs";

const failures = [];

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function mustInclude(path, needle, label = needle) {
  const text = read(path);
  if (!text.includes(needle)) failures.push(`${path}: missing ${label}`);
}

function mustNotInclude(path, needle, label = needle) {
  const text = read(path);
  if (text.includes(needle)) failures.push(`${path}: forbidden ${label}`);
}

const finalizeRoute = "app/api/settlements/documents-finalize-local/route.ts";
const queueRoute = "app/api/settlements/documents-print-queue-local/route.ts";
const pagePath = "app/matters/page.tsx";

mustInclude(finalizeRoute, "settlementDocxRouteForTemplate");
mustInclude(finalizeRoute, "buildGeneratedDocxReference");
mustInclude(finalizeRoute, "buildPlaceholderSeededDocxRouteArtifact");
mustInclude(finalizeRoute, "@/lib/documents/artifactContract");
mustInclude(finalizeRoute, "/api/settlements/settlement-summary");
mustInclude(finalizeRoute, "/api/settlements/provider-remittance-breakdown");
mustInclude(finalizeRoute, "/api/settlements/attorney-fee-breakdown");
mustInclude(finalizeRoute, "buildPlaceholderSeededDocxRouteArtifact");
mustInclude("lib/documents/artifactContract.ts", 'artifactKind: "placeholder-seeded-generated-docx-route"');
mustInclude(finalizeRoute, 'templateSource: "placeholder-seeded"');
mustInclude(finalizeRoute, "productionTemplateReady: false");
mustInclude(finalizeRoute, "finalProductionDocument: false");
mustInclude(finalizeRoute, "routeBackedArtifact");
mustInclude(finalizeRoute, "docxDownloadUrl");
mustInclude(finalizeRoute, "generatedDocument: generatedDocx");
mustInclude(finalizeRoute, "persistentFileCreated: false");
mustInclude(finalizeRoute, "finalizedPdfGenerated: false");
mustInclude(finalizeRoute, "clioUploaded: false");
mustNotInclude(finalizeRoute, "fs.writeFile", "persistent filesystem write");
mustNotInclude(finalizeRoute, "uploadDocumentToClio", "Clio upload");

mustInclude(queueRoute, "generatedDocument");
mustInclude(queueRoute, "docxDownloadUrl");
mustInclude(queueRoute, "routeBackedArtifact");
mustInclude(queueRoute, "persistentFileCreated: false");
mustInclude(queueRoute, "finalizedPdfGenerated: false");
mustInclude(queueRoute, "printableFileReady: false");
mustNotInclude(queueRoute, "fs.writeFile", "persistent filesystem write");
mustNotInclude(queueRoute, "uploadDocumentToClio", "Clio upload");

mustInclude(pagePath, "Placeholder DOCX route ready");
mustInclude(pagePath, "Queued placeholder DOCX route");

if (failures.length) {
  console.error("FAIL: settlement document generated DOCX route reference safety verifier");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("PASS: settlement document generated DOCX route reference safety verifier");
