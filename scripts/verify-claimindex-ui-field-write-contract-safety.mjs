#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const repo = process.cwd();

function read(rel) {
  return fs.readFileSync(path.join(repo, rel), "utf8");
}

function pass(label) {
  console.log(`PASS: ${label}`);
}

function fail(label, detail = "") {
  console.error(`FAIL: ${label}${detail ? `: ${detail}` : ""}`);
  process.exitCode = 1;
}

function mustContain(label, text, needle) {
  if (!text.includes(needle)) fail(label, `missing ${needle}`);
  else pass(label);
}

function mustNotContain(label, text, needle) {
  if (text.includes(needle)) fail(label, `unexpected ${needle}`);
  else pass(label);
}

const schema = read("prisma/schema.prisma");
const claimIndexQuery = read("lib/claimIndexQuery.ts");
const claimIndexUpsert = read("lib/claimIndexUpsert.ts");
const localClaimIndex = read("lib/claimIndex.ts");
const directRoute = read("app/api/matters/update-direct-field/route.ts");
const identityRoute = read("app/api/matters/identity-field/route.ts");
const identitySearchRoute = read("app/api/matters/identity-field/search/route.ts");
const paymentRoute = read("app/api/matters/apply-payment/route.ts");
const matterPage = read("app/matter/[id]/page.tsx");
const mattersPage = read("app/matters/page.tsx");
const homePage = read("app/page.tsx");
const lawsuitsPage = read("app/lawsuits/page.tsx");
const pkg = JSON.parse(read("package.json"));

console.log("RESULT: verify ClaimIndex UI-field write-through contract");

const claimIndexSchemaFields = [
  "matter_id",
  "display_number",
  "description",
  "claim_number_raw",
  "claim_number_normalized",
  "patient_name",
  "client_name",
  "provider_name",
  "insurer_name",
  "claim_amount",
  "payment_amount",
  "balance_amount",
  "bill_number",
  "dos_start",
  "dos_end",
  "denial_reason",
  "service_type",
  "policy_number",
  "date_of_loss",
  "payment_voluntary",
  "balance_presuit",
  "master_lawsuit_id",
  "index_aaa_number",
  "status",
  "close_reason",
  "final_status",
  "matter_stage_name",
  "treating_provider",
];

for (const field of claimIndexSchemaFields) {
  mustContain(`ClaimIndex schema has ${field}`, schema, field);
}

const searchSelectFields = [
  "matter_id",
  "display_number",
  "claim_number_raw",
  "claim_number_normalized",
  "patient_name",
  "client_name",
  "provider_name",
  "insurer_name",
  "claim_amount",
  "payment_amount",
  "balance_amount",
  "bill_number",
  "dos_start",
  "dos_end",
  "denial_reason",
  "service_type",
  "policy_number",
  "date_of_loss",
  "payment_voluntary",
  "balance_presuit",
  "master_lawsuit_id",
  "index_aaa_number",
  "status",
  "close_reason",
  "final_status",
  "matter_stage_name",
  "treating_provider",
];

for (const field of searchSelectFields) {
  mustContain(`CLAIM_INDEX_SELECT returns ${field}`, claimIndexQuery, `${field}: true`);
}

const upsertFields = [
  "claim_number_raw",
  "claim_number_normalized",
  "patient_name",
  "client_name",
  "provider_name",
  "insurer_name",
  "claim_amount",
  "payment_amount",
  "balance_amount",
  "bill_number",
  "dos_start",
  "dos_end",
  "denial_reason",
  "service_type",
  "policy_number",
  "date_of_loss",
  "payment_voluntary",
  "balance_presuit",
  "master_lawsuit_id",
  "index_aaa_number",
  "status",
  "close_reason",
  "final_status",
  "matter_stage_name",
];

for (const field of upsertFields) {
  mustContain(`ClaimIndex Clio/import upsert maps ${field}`, claimIndexUpsert, `${field}:`);
}

const localHelperFields = [
  "claim_number_raw",
  "claim_number_normalized",
  "patient_name",
  "client_name",
  "provider_name",
  "insurer_name",
  "claim_amount",
  "payment_amount",
  "balance_amount",
  "bill_number",
  "dos_start",
  "dos_end",
  "denial_reason",
  "service_type",
  "policy_number",
  "date_of_loss",
  "payment_voluntary",
  "balance_presuit",
  "master_lawsuit_id",
  "index_aaa_number",
  "status",
  "close_reason",
  "final_status",
  "matter_stage_name",
  "treating_provider",
];

for (const field of localHelperFields) {
  mustContain(`local ClaimIndex helper maps ${field}`, localClaimIndex, `${field}: row.${field}`);
}

const identityFields = [
  ["patient_name", "Patient"],
  ["client_name", "Provider"],
  ["insurer_name", "Insurer"],
  ["claim_number_raw", "Claim Number"],
  ["treating_provider", "Treating Provider"],
];

for (const [field, label] of identityFields) {
  mustContain(`identity route supports ${label}`, identityRoute, `fieldName: "${field}"`);
  mustContain(`identity route reads ${field}`, identityRoute, `claimIndex?.${field}`);
  mustContain(`identity route updateData writes ${field}`, identityRoute, `${field}: nextValue`);
}

mustContain("identity route uses field-specific updateDataForField", identityRoute, "data: updateDataForField(config, nextValue)");
mustContain("identity route updates ClaimIndex transactionally", identityRoute, "tx.claimIndex.update");
mustContain("identity route audit records ClaimIndex storage", identityRoute, 'storage: "ClaimIndex"');
mustContain("identity route is local-only no Clio write", identityRoute, "noClioWrite: true");
mustContain("identity route is local-only no Clio read", identityRoute, "noClioRead: true");

mustContain("identity search route reads ClaimIndex", identitySearchRoute, "prisma.claimIndex.findMany");
mustContain("identity search route returns claim amount", identitySearchRoute, "claimAmount: moneyNumber(row.claim_amount)");
mustContain("identity search route returns denial reason", identitySearchRoute, "denialReason: row.denial_reason");
mustContain("identity search route returns policy number", identitySearchRoute, "policyNumber: row.policy_number");
mustContain("identity search route returns date of loss", identitySearchRoute, "dateOfLoss: row.date_of_loss");

const directFieldWrites = [
  ["claimAmount", "claim_amount"],
  ["claimAmount", "balance_presuit"],
  ["claimAmount", "balance_amount"],
  ["dos", "dos_start"],
  ["dos", "dos_end"],
  ["denialReason", "denial_reason"],
  ["status", "matter_stage_name"],
  ["status", "status"],
];

for (const [uiField, claimIndexField] of directFieldWrites) {
  mustContain(`direct route supports UI field ${uiField}`, directRoute, `"${uiField}"`);
  mustContain(`direct route writes ClaimIndex field ${claimIndexField}`, directRoute, `${claimIndexField}:`);
}

mustContain("direct route updates ClaimIndex transactionally", directRoute, "tx.claimIndex.update");
mustContain("direct route uses field-specific ClaimIndex update data", directRoute, "data: claimIndexUpdateData(field, nextValue, existing)");
mustContain("direct route audit records ClaimIndex storage", directRoute, 'storage: "ClaimIndex"');
mustNotContain("direct route must not support Final Status direct edits", directRoute, '"finalStatus"');
mustNotContain("direct route must not support Closed Reason direct edits", directRoute, '"closedReason"');
mustContain("direct route returns claimIndexUpdated true", directRoute, "claimIndexUpdated: true");
mustContain("direct route is local-only no Clio write", directRoute, "noClioWrite: true");
mustContain("direct route is local-only no Clio read", directRoute, "noClioRead: true");

mustContain("payment route mirrors local totals to ClaimIndex", paymentRoute, "mirrorLocalPaymentTotalsToClaimIndex");
mustContain("payment route updates ClaimIndex payment_amount", paymentRoute, "payment_amount: totals.after.paymentVoluntary");
mustContain("payment route updates ClaimIndex payment_voluntary", paymentRoute, "payment_voluntary: totals.after.paymentVoluntary");
mustContain("payment route updates ClaimIndex balance_amount", paymentRoute, "balance_amount: totals.after.balancePresuit");
mustContain("payment route updates ClaimIndex balance_presuit", paymentRoute, "balance_presuit: totals.after.balancePresuit");
mustContain("payment route uses ClaimIndex updateMany", paymentRoute, "prisma.claimIndex.updateMany");

const uiLabels = [
  "Claim Amount",
  "Date of Service",
  "Denial Reason",
  "Status",
  "Final Status",
  "Close Reason",
  "Treating Provider",
  "Patient",
  "Provider",
  "Insurer",
  "Claim Number",
  "Policy",
  "Date of Loss",
  "Service Type",
  "Balance",
];

for (const label of uiLabels) {
  const found =
    matterPage.includes(label) ||
    mattersPage.includes(label) ||
    homePage.includes(label) ||
    lawsuitsPage.includes(label);
  if (!found) fail(`UI contains ClaimIndex-backed label ${label}`);
  else pass(`UI contains ClaimIndex-backed label ${label}`);
}

mustContain("matter page Claim Amount copy says ClaimIndex", matterPage, "This updates Claim Amount in ClaimIndex");
mustContain("matter page uses direct field route", matterPage, "/api/matters/update-direct-field");
mustContain("matter page uses identity field route", matterPage, "/api/matters/identity-field");

for (const [label, text] of [
  ["direct route", directRoute],
  ["identity route", identityRoute],
  ["identity search route", identitySearchRoute],
  ["payment route", paymentRoute],
]) {
  mustNotContain(`${label} must not call Clio`, text, "clioFetch");
  mustNotContain(`${label} must not call Clio API`, text, "api/v4");
  mustNotContain(`${label} must not use ClaimIndex rebuild wording`, text, "ClaimIndex rebuild");
  mustNotContain(`${label} must not call legacy ClaimIndex refresh route`, text, "/api/claim-index/rebuild");
  mustNotContain(`${label} must not call legacy ClaimIndex refresh-cluster route`, text, "/api/claim-index/refresh-cluster");
}

if (pkg.scripts?.["verify:claimindex-ui-field-write-contract-safety"] !== "node scripts/verify-claimindex-ui-field-write-contract-safety.mjs") {
  fail("package.json registers verify:claimindex-ui-field-write-contract-safety");
} else {
  pass("package.json registers verify:claimindex-ui-field-write-contract-safety");
}

if (process.exitCode) {
  console.error("FAILURES=1");
  process.exit(1);
}

console.log("FAILURES=0");
