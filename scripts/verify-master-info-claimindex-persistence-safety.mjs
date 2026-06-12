import fs from "fs";

const page = fs.readFileSync("app/matters/page.tsx", "utf8");
const metadata = fs.readFileSync("app/api/lawsuits/update-metadata/route.ts", "utf8");
const failures = [];

const claimInfoFields = ["provider", "patient", "insurer", "claimNumber", "dateOfLoss"];

for (const token of [
  "dateOfLoss: string;",
  "date_of_loss: string;",
  "dateOfLoss: clean(row?.dateOfLoss ?? row?.date_of_loss ?? row?.lossDate ?? row?.loss_date)",
  "date_of_loss: clean(row?.dateOfLoss ?? row?.date_of_loss ?? row?.lossDate ?? row?.loss_date)",
  "const masterDateOfLossSummary = useMemo(() =>",
  "row.dateOfLoss || row.date_of_loss || row.lossDate || row.loss_date",
]) {
  if (!page.includes(token)) failures.push(`master page Date of Loss display/reload mapping missing token: ${token}`);
}

for (const field of claimInfoFields) {
  if (page.includes(`openMasterInfoEditDialog("${field}"`)) {
    failures.push(`Claim Information field ${field} must not be editable on the master lawsuit page`);
  }
}

for (const field of ["indexAaaNumber", "court", "adversaryAttorney", "dateFiled"]) {
  if (!page.includes(`openMasterInfoEditDialog("${field}"`)) {
    failures.push(`Lawsuit Information field ${field} must remain editable on the master lawsuit page`);
  }
}

for (const token of ["/api/lawsuits/claim-index-field", "masterInfoFieldPersistsToClaimIndex", "claimIndexPersisted"]) {
  if (page.includes(token)) failures.push(`master page must not use ClaimIndex edit route/token: ${token}`);
}

if (fs.existsSync("app/api/lawsuits/claim-index-field/route.ts")) {
  failures.push("master ClaimIndex edit route should not exist; Claim Information is edited on child/direct matter workflows only");
}

for (const token of [
  "dateFiled: text(body?.dateFiled || existingOptions.dateFiled)",
  "indexAaaNumber: text(body?.indexAaaNumber)",
  "adversaryAttorney: text(body?.adversaryAttorney)",
  "venue: text(body?.venue)",
  "venueSelection: text(body?.venueSelection)",
]) {
  if (!metadata.includes(token)) failures.push(`lawsuit metadata route missing persistence token: ${token}`);
}

for (const token of ["mirrorLawsuitMetadataToClaimIndex", "PRAGMA table_info('ClaimIndex')", "claimIndexMirror"]) {
  if (metadata.includes(token)) failures.push(`lawsuit metadata must not mirror Lawsuit Information to child ClaimIndex rows: ${token}`);
}

const popupStart = page.indexOf('{masterInfoEditDialog && activeMasterWorkspaceTab === "payments" && (');
const popupEnd = page.indexOf('{masterPaymentFormOpen && activeMasterWorkspaceTab === "payments" && (', popupStart);
const popup = popupStart >= 0 && popupEnd > popupStart ? page.slice(popupStart, popupEnd) : "";
for (const token of ["#ea580c", "#c2410c", "#fff7ed", "This dialog is a UI preview only"]) {
  if (popup.includes(token)) failures.push(`edit popup contains disallowed orange/warning token: ${token}`);
}

if (failures.length) {
  console.error("FAIL: master info architecture safety");
  for (const failure of failures) console.error("- " + failure);
  process.exit(1);
}

console.log("PASS: master info architecture safety");
