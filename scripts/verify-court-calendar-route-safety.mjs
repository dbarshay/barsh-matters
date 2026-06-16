import fs from "fs";

function assertFileContains(filePath, needle, message) {
  const content = fs.readFileSync(filePath, "utf8");
  if (content.indexOf(needle) < 0) {
    throw new Error(message + "\nMissing: " + needle + "\nFile: " + filePath);
  }
}

function assertFileDoesNotContain(filePath, needle, message) {
  const content = fs.readFileSync(filePath, "utf8");
  if (content.indexOf(needle) >= 0) {
    throw new Error(message + "\nUnexpected: " + needle + "\nFile: " + filePath);
  }
}


const route = fs.readFileSync("app/api/court-calendar/events/route.ts", "utf8");

const required = [
  'sourceOfTruth: "barsh-matters-local"',
  "externalCalendarEventsCreated: false",
  "clioRecordsChanged: false",
  "prisma.courtCalendarEvent.findMany",
  "tx.courtCalendarEvent.create",
  "kind: \"court_calendar_reminder\"",
  "tx.auditLog.create",
  "previewOnly",
  "validDateOnly",
  'sourcePage: clean(body?.sourcePage) || "court-calendar"',
  'scope: "master-lawsuit"',
  "includeCaseData",
  "prisma.claimIndex.findMany",
];

const forbidden = [
  "matterId =",
  "numberOrNull",
  "app/matter/[id]",
  "google.calendar",
  "gcal",
  "Microsoft Graph calendar",
  "fetch(\"https://graph.microsoft.com",
  "clioApi",
  "sendEmail",
];

const failures = [];

for (const token of required) if (!route.includes(token)) failures.push(`route missing ${token}`);
for (const token of forbidden) if (route.includes(token)) failures.push(`route contains forbidden individual/external workflow token ${token}`);

if (failures.length) {
  console.error("FAIL: court calendar route safety");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}


assertFileContains("app/api/court-calendar/filter-options/route.ts", `type: "provider_client"`, "Court Calendar Client Name dropdown must use the same provider_client ReferenceEntity table as main search Provider.");
assertFileContains("app/api/court-calendar/filter-options/route.ts", "providerClientRows.map((row) => row.displayName)", "Court Calendar Client Name options must be built from provider_client displayName rows.");
assertFileDoesNotContain("app/api/court-calendar/filter-options/route.ts", "provider_name", "Court Calendar Client Name dropdown must not use ClaimIndex provider_name / treating-person provider names.");
assertFileDoesNotContain("app/api/court-calendar/filter-options/route.ts", "client_name", "Court Calendar Client Name dropdown must not use ClaimIndex client_name as its option source.");

assertFileContains("app/api/court-calendar/filter-options/route.ts", "defaultCourt", "Court Calendar filter options must expose defaultCourt for Add New Court Date court defaults.");
assertFileContains("app/api/court-calendar/filter-options/route.ts", "masterLawsuitId", "Court Calendar filter options must expose masterLawsuitId for Add New Court Date court defaults.");
assertFileContains("app/api/court-calendar/filter-options/route.ts", "venueSelection", "Court Calendar filter options must expose venueSelection for Add New Court Date court defaults.");
assertFileContains("app/api/court-calendar/events/route.ts", "lawsuitAmount", "Court Calendar event enrichment must return lawsuitAmount rollup.");
assertFileContains("app/api/court-calendar/events/route.ts", "lawsuitBalance", "Court Calendar event enrichment must return lawsuitBalance rollup.");
assertFileContains("app/api/court-calendar/events/route.ts", "caption", "Court Calendar event enrichment must return caption rollup.");
assertFileContains("app/api/court-calendar/events/route.ts", "displayEntityName", "Court Calendar caption entities must use display-name normalization.");
console.log("PASS: court calendar route safety");
