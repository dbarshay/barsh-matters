import fs from "fs";

const page = fs.readFileSync("app/matters/page.tsx", "utf8");
const route = fs.readFileSync("app/api/lawsuits/claim-index-field/route.ts", "utf8");
const metadata = fs.readFileSync("app/api/lawsuits/update-metadata/route.ts", "utf8");
const failures = [];

for (const token of [
  "masterInfoFieldPersistsToClaimIndex",
  '"provider", "patient", "insurer", "claimNumber", "dateOfLoss"',
  "/api/lawsuits/claim-index-field",
  "claimIndexPersisted",
]) {
  if (!page.includes(token)) failures.push(`page missing ${token}`);
}

for (const token of [
  "master-claimindex-field-update",
  "prisma.claimIndex.findMany",
  "tx.claimIndex.updateMany",
  "provider_name",
  "client_name",
  "patient_name",
  "insurer_name",
  "claim_number_raw",
  "claim_number_normalized",
  "date_of_loss",
  "master_lawsuit_id: masterLawsuitId",
]) {
  if (!route.includes(token)) failures.push(`claim-index route missing ${token}`);
}

for (const token of [
  "dateFiled: text(body?.dateFiled || existingOptions.dateFiled)",
  "mirrorLawsuitMetadataToClaimIndex",
  "PRAGMA table_info('ClaimIndex')",
  "index_aaa_number",
  "adversary_attorney",
  "date_filed",
]) {
  if (!metadata.includes(token)) failures.push(`metadata route missing ${token}`);
}

const popupStart = page.indexOf('{masterInfoEditDialog && activeMasterWorkspaceTab === "payments" && (');
const popupEnd = page.indexOf('{masterPaymentFormOpen && activeMasterWorkspaceTab === "payments" && (', popupStart);
const popup = popupStart >= 0 && popupEnd > popupStart ? page.slice(popupStart, popupEnd) : "";
for (const token of ["#ea580c", "#c2410c", "#fff7ed"]) {
  if (popup.includes(token)) failures.push(`edit popup still contains orange token ${token}`);
}

if (failures.length) {
  console.error("FAIL: master info ClaimIndex persistence safety");
  for (const failure of failures) console.error("- " + failure);
  process.exit(1);
}
console.log("PASS: master info ClaimIndex persistence safety");
