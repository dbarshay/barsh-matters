import fs from "node:fs";

const creationRoute = fs.readFileSync("app/api/ticklers/settlement-payment-due/route.ts", "utf8");
const adminRoute = fs.readFileSync("app/api/admin/ticklers/search/route.ts", "utf8");
const adminPage = fs.readFileSync("app/admin/ticklers/page.tsx", "utf8");

const failures = [];

function mustInclude(label, haystack, needle) {
  if (!haystack.includes(needle)) failures.push(`missing ${label}: ${needle}`);
}

function mustNotInclude(label, haystack, needle) {
  if (haystack.includes(needle)) failures.push(`forbidden ${label}: ${needle}`);
}

mustInclude("settlement tickler kind", creationRoute, 'const TICKLER_KIND = "settlement_payment_due_followup"');
mustInclude("settlement tickler uses master lawsuit id", creationRoute, "masterLawsuitId: settlementRecord.masterLawsuitId");
mustInclude("settlement tickler does not attach matter id", creationRoute, "matterId: null");
mustInclude("settlement tickler display number is master lawsuit", creationRoute, "displayNumber: settlementRecord.masterLawsuitId");
mustInclude("child rows preserved in metadata", creationRoute, "metadata: {");
mustInclude("related matters preserved in metadata", creationRoute, "relatedMatters");
mustInclude("related matter id preserved in metadata", creationRoute, "matterId: row.matterId");
mustInclude("related display number preserved in metadata", creationRoute, "displayNumber: row.displayNumber");

mustNotInclude("settlement tickler attaches first child matter", creationRoute, "matterId: firstRow?.matterId || null");
mustNotInclude("settlement tickler displays first child matter", creationRoute, "displayNumber: firstRow?.displayNumber || null");

mustInclude("admin route loads master lawsuit records", adminRoute, "prisma.lawsuit.findMany");
mustInclude("admin route indexes master lawsuits", adminRoute, "lawsuitByMasterLawsuitId");
mustInclude("admin route identifies settlement master tickler", adminRoute, 'const isMasterSettlementTickler = tickler.kind === "settlement_payment_due_followup"');
mustInclude("admin route marks master context scope", adminRoute, 'contextScope: isMasterSettlementTickler ? "master_lawsuit_only" : "individual_matter_only"');
mustInclude("admin route suppresses child claim lookup for settlement ticklers", adminRoute, 'if (tickler.kind === "settlement_payment_due_followup")');
mustInclude("admin route returns empty child claim context for settlement ticklers", adminRoute, "return {};");
mustInclude("admin route master matter value from master lawsuit", adminRoute, "tickler.masterLawsuitId, settlementRecord.masterLawsuitId, lawsuit.masterLawsuitId");
mustInclude("admin route master provider from settlement rows", adminRoute, 'firstSettlementRowText(settlementRows, ["provider", "providerName", "clientName", "provider_client"])');
mustInclude("admin route master provider from own metadata", adminRoute, 'firstRelatedMatterText(metadata, ["provider", "providerName", "clientName", "provider_client"])');
mustInclude("admin route master patient from settlement rows", adminRoute, 'firstSettlementRowText(settlementRows, ["patient", "patientName", "patient_name"])');
mustInclude("admin route master patient from own metadata", adminRoute, 'firstRelatedMatterText(metadata, ["patient", "patientName", "patient_name"])');
mustInclude("admin route master insurer from settlement rows", adminRoute, 'firstSettlementRowText(settlementRows, ["insurer", "insurerName", "insuranceCompany", "insurance_company"])');
mustInclude("admin route master insurer from own metadata", adminRoute, 'firstRelatedMatterText(metadata, ["insurer", "insurerName", "insuranceCompany", "insurance_company"])');
mustInclude("admin route master claim number from lawsuit record", adminRoute, "lawsuit.claimNumber");
mustInclude("admin route master date of loss from lawsuit options only", adminRoute, "lawsuitOptions.dateOfLoss");
mustInclude("admin route master court from lawsuit venue only", adminRoute, "lawsuit.venue");
mustInclude("admin route master index from lawsuit record only", adminRoute, "lawsuit.indexAaaNumber");
mustInclude("admin route master date filed from lawsuit options only", adminRoute, "lawsuitOptions.dateFiled");
mustInclude("admin route individual matter date of loss from ClaimIndex", adminRoute, "claim.date_of_loss");
mustInclude("admin route individual matter index from ClaimIndex", adminRoute, "claim.index_aaa_number");

mustInclude("admin XLS matter prefers lawsuit-level caseData", adminPage, "tickler.caseData?.matter || tickler.masterLawsuitId");
mustInclude("admin XLS uses standard ordered headers", adminPage, "standardCaseExportHeaders");

mustNotInclude("settlement tickler falls back to grouped child claim", adminRoute, '(claimsByMasterLawsuitId.get(String(tickler.masterLawsuitId || "")) || [])[0]');
mustNotInclude("master date of loss from child claim", adminRoute, "dateOfLoss: firstText(claim.date_of_loss");
mustNotInclude("master index from child claim", adminRoute, "indexNumber: firstText(claim.index_aaa_number");
mustNotInclude("master date filed from child claim", adminRoute, "dateFiled: firstText(metadata.dateFiled, metadata.filedDate, claim.date_filed");

if (failures.length) {
  console.error("FAIL: settlement tickler lawsuit-level context verifier failed");
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}

console.log("PASS: settlement payment-due ticklers are master/lawsuit-level rows and never enrich master fields from child matters.");
