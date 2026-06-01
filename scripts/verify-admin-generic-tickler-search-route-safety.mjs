import fs from "node:fs";

const route = fs.readFileSync("app/api/admin/ticklers/search/route.ts", "utf8");
const page = fs.readFileSync("app/admin/ticklers/page.tsx", "utf8");
const schema = fs.readFileSync("prisma/schema.prisma", "utf8");

const failures = [];

function mustInclude(label, haystack, needle) {
  if (!haystack.includes(needle)) failures.push(`missing ${label}: ${needle}`);
}

function mustNotInclude(label, haystack, needle) {
  if (haystack.includes(needle)) failures.push(`forbidden ${label}: ${needle}`);
}

mustInclude("LocalWorkflowTickler model", schema, "model LocalWorkflowTickler");
mustInclude("tickler kind field", schema, "kind               String");
mustInclude("tickler status field", schema, "status             String");
mustInclude("tickler priority field", schema, "priority           String");
mustInclude("tickler master lawsuit field", schema, "masterLawsuitId");
mustInclude("tickler matter field", schema, "matterId");
mustInclude("tickler display number field", schema, "displayNumber");
mustInclude("tickler settlement record field", schema, "settlementRecordId");
mustInclude("tickler due date field", schema, "dueDate");
mustInclude("tickler metadata field", schema, "metadata           Json?");

mustInclude("admin search route action", route, 'action: "admin-generic-tickler-search"');
mustInclude("administrator safety flag", route, "administratorFunction: true");
mustInclude("read-only safety flag", route, "readOnly: true");
mustInclude("local-only safety flag", route, "localOnly: true");
mustInclude("matter page runner disabled flag", route, "matterPageRunner: false");
mustInclude("no Clio writes flag", route, "clioWritesPerformed: false");
mustInclude("documents unchanged flag", route, "documentsChanged: false");
mustInclude("emails unchanged flag", route, "emailsChanged: false");
mustInclude("print queue unchanged flag", route, "printQueueChanged: false");

mustInclude("tickler search query", route, "prisma.localWorkflowTickler.findMany");
mustInclude("kind filter", route, 'url.searchParams.get("kind")');
mustInclude("status filter", route, 'url.searchParams.get("status")');
mustInclude("priority filter", route, 'url.searchParams.get("priority")');
mustInclude("master lawsuit filter", route, 'url.searchParams.get("masterLawsuitId")');
mustInclude("matter id filter", route, 'url.searchParams.get("matterId")');
mustInclude("display number filter", route, 'url.searchParams.get("displayNumber")');
mustInclude("settlement record filter", route, 'url.searchParams.get("settlementRecordId")');
mustInclude("due date filter", route, 'url.searchParams.get("dueDate")');
mustInclude("due before filter", route, 'url.searchParams.get("dueBefore")');
mustInclude("due after filter", route, 'url.searchParams.get("dueAfter")');

mustInclude("blank matterId remains null", route, "if (!raw) return null;");
mustInclude("matterId parser cleans value first", route, "const raw = clean(value);");

mustInclude("ClaimIndex bridge exists", route, "prisma.claimIndex.findMany");
mustInclude("Lawsuit master context exists", route, "prisma.lawsuit.findMany");
mustInclude("Settlement record context exists", route, "prisma.localSettlementRecord.findMany");
mustInclude("Settlement row context exists", route, "prisma.localSettlementRow.findMany");
mustInclude("lawsuit map exists", route, "lawsuitByMasterLawsuitId");
mustInclude("plain object helper exists", route, "function plainObject");
mustInclude("related matter metadata helper exists", route, "function firstRelatedMatterText");

mustInclude("own-context scope marker", route, 'contextScope: isMasterSettlementTickler ? "master_lawsuit_only" : "individual_matter_only"');
mustInclude("settlement ticklers suppress child ClaimIndex context", route, 'if (tickler.kind === "settlement_payment_due_followup")');
mustInclude("settlement ticklers return empty claim context", route, "return {};");

mustInclude("master provider may use settlement rows", route, 'firstSettlementRowText(settlementRows, ["provider", "providerName", "clientName", "provider_client"])');
mustInclude("master provider may use related metadata", route, 'firstRelatedMatterText(metadata, ["provider", "providerName", "clientName", "provider_client"])');
mustInclude("master patient may use settlement rows", route, 'firstSettlementRowText(settlementRows, ["patient", "patientName", "patient_name"])');
mustInclude("master patient may use related metadata", route, 'firstRelatedMatterText(metadata, ["patient", "patientName", "patient_name"])');
mustInclude("master insurer may use settlement rows", route, 'firstSettlementRowText(settlementRows, ["insurer", "insurerName", "insuranceCompany", "insurance_company"])');
mustInclude("master insurer may use related metadata", route, 'firstRelatedMatterText(metadata, ["insurer", "insurerName", "insuranceCompany", "insurance_company"])');
mustInclude("master claim number may use lawsuit claimNumber", route, "lawsuit.claimNumber");
mustInclude("master date of loss from lawsuit options", route, "lawsuitOptions.dateOfLoss");
mustInclude("master court from lawsuit venue", route, "lawsuit.venue");
mustInclude("master index from lawsuit indexAaaNumber", route, "lawsuit.indexAaaNumber");
mustInclude("master date filed from lawsuit options", route, "lawsuitOptions.dateFiled");

mustInclude("individual provider uses ClaimIndex", route, "claim.provider_name");
mustInclude("individual patient uses ClaimIndex", route, "claim.patient_name");
mustInclude("individual insurer uses ClaimIndex", route, "claim.insurer_name");
mustInclude("individual claim number uses ClaimIndex", route, "claim.claim_number_normalized");
mustInclude("individual date of loss uses ClaimIndex", route, "claim.date_of_loss");
mustInclude("individual index uses ClaimIndex", route, "claim.index_aaa_number");

mustInclude("dedupe raw count", route, "rawCount: enrichedTicklersRaw.length");
mustInclude("dedupe count", route, "dedupedCount: enrichedTicklersRaw.length - enrichedTicklers.length");

mustInclude("admin page calls search route", page, "/api/admin/ticklers/search?");
mustInclude("admin page has no matter-page runner", page, "Tickler Results");

mustNotInclude("route create side effect", route, ".create(");
mustNotInclude("route update side effect", route, ".update(");
mustNotInclude("route delete side effect", route, ".delete");
mustNotInclude("route Clio fetch", route, "clioFetch");
mustNotInclude("route email side effect", route, "createMessage");
mustNotInclude("route print queue create side effect", route, "printQueue.create");
mustNotInclude("route print queue update side effect", route, "printQueue.update");
mustNotInclude("route print queue delete side effect", route, "printQueue.delete");

mustNotInclude("settlement tickler grouped-child fallback", route, '(claimsByMasterLawsuitId.get(String(tickler.masterLawsuitId || "")) || [])[0]');
mustNotInclude("master date of loss from child claim", route, "dateOfLoss: firstText(claim.date_of_loss");
mustNotInclude("master index from child claim", route, "indexNumber: firstText(claim.index_aaa_number");
mustNotInclude("master date filed from child claim", route, "dateFiled: firstText(metadata.dateFiled, metadata.filedDate, claim.date_filed");

mustNotInclude("page Run Ticklers button", page, "Run Ticklers");
mustNotInclude("page Process Ticklers button", page, "Process Ticklers");
mustNotInclude("page Create Tickler button", page, "Create Tickler");

if (failures.length) {
  console.error("FAIL: admin generic tickler search route safety verifier failed");
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}

console.log("PASS: admin generic tickler search route supports filtered read-only search with own-context enrichment and no matter-page runner.");
