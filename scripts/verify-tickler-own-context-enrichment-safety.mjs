import fs from "node:fs";

const route = fs.readFileSync("app/api/admin/ticklers/search/route.ts", "utf8");
const failures = [];

function mustInclude(label, needle) {
  if (!route.includes(needle)) failures.push(`missing ${label}: ${needle}`);
}

function mustNotInclude(label, needle) {
  if (route.includes(needle)) failures.push(`forbidden ${label}: ${needle}`);
}

mustInclude("loads Lawsuit records for master context", "prisma.lawsuit.findMany");
mustInclude("indexes lawsuits by masterLawsuitId", "lawsuitByMasterLawsuitId");
mustInclude("plain object lawsuitOptions helper", "function plainObject");
mustInclude("related matter metadata helper", "function firstRelatedMatterText");
mustInclude("settlement tickler uses master scope", 'contextScope: isMasterSettlementTickler ? "master_lawsuit_only" : "individual_matter_only"');
mustInclude("settlement tickler suppresses child claim lookup", 'if (tickler.kind === "settlement_payment_due_followup")');
mustInclude("settlement tickler returns empty child claim context", "return {};");
mustInclude("master provider can use settlement rows", 'firstSettlementRowText(settlementRows, ["provider", "providerName", "clientName", "provider_client"])');
mustInclude("master provider can use own related matter metadata", 'firstRelatedMatterText(metadata, ["provider", "providerName", "clientName", "provider_client"])');
mustInclude("master patient can use settlement rows", 'firstSettlementRowText(settlementRows, ["patient", "patientName", "patient_name"])');
mustInclude("master patient can use own related matter metadata", 'firstRelatedMatterText(metadata, ["patient", "patientName", "patient_name"])');
mustInclude("master insurer can use settlement rows", 'firstSettlementRowText(settlementRows, ["insurer", "insurerName", "insuranceCompany", "insurance_company"])');
mustInclude("master insurer can use own related matter metadata", 'firstRelatedMatterText(metadata, ["insurer", "insurerName", "insuranceCompany", "insurance_company"])');
mustInclude("master claim number can use lawsuit top-level claim number", "lawsuit.claimNumber");
mustInclude("master date of loss from lawsuit options only", "lawsuitOptions.dateOfLoss");
mustInclude("master court from lawsuit venue only", "lawsuit.venue");
mustInclude("master index from lawsuit indexAaaNumber", "lawsuit.indexAaaNumber");
mustInclude("master date filed from lawsuit options only", "lawsuitOptions.dateFiled");
mustInclude("individual date of loss from claim", "claim.date_of_loss");
mustInclude("individual index from claim", "claim.index_aaa_number");

mustNotInclude("settlement tickler falls back to grouped child claim", '(claimsByMasterLawsuitId.get(String(tickler.masterLawsuitId || "")) || [])[0]');
mustNotInclude("master date of loss from child claim", "dateOfLoss: firstText(claim.date_of_loss");
mustNotInclude("master index from child claim", "indexNumber: firstText(claim.index_aaa_number");
mustNotInclude("master date filed from child claim", "dateFiled: firstText(metadata.dateFiled, metadata.filedDate, claim.date_filed");

if (failures.length) {
  console.error("FAIL: tickler own-context enrichment verifier failed");
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}

console.log("PASS: tickler enrichment uses only the tickler's own master or individual matter context.");
