import fs from "fs";

const page = fs.readFileSync("app/court-calendar/page.tsx", "utf8");
const route = fs.readFileSync("app/api/court-calendar/import-webcivil-local/route.ts", "utf8");
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const failures = [];

const requiredPage = [
  "Import Calendar Numbers from WebCivil Local",
  "data-barsh-court-calendar-webcivil-local-import-panel",
  "data-barsh-court-calendar-webcivil-local-copy-template",
  "data-barsh-court-calendar-webcivil-local-preview-import",
  "data-barsh-court-calendar-webcivil-local-apply-import",
  "webCivilImportTemplateText",
  "/api/court-calendar/import-webcivil-local",
  "Event ID",
  "Calendar Number",
];

const requiredRoute = [
  'sourceOfTruth: "barsh-matters-local"',
  "externalWebCivilCalled: false",
  "clioRecordsChanged: false",
  "externalCalendarEventsCreated: false",
  "prisma.courtCalendarEvent.findMany",
  "tx.courtCalendarEvent.update",
  "tx.auditLog.create",
  "previewOnly",
  "manual-paste",
  "calendarNumber",
];

const forbidden = [
  "fetch(\"https://iapps.courts.state.ny.us",
  "fetch('https://iapps.courts.state.ny.us",
  "webcivilLocal/LCCalendarSearch\", {",
  "clioApi",
  "google.calendar",
  "Microsoft Graph calendar",
  "sendEmail",
  "printQueueChanged: true",
];

for (const token of requiredPage) if (!page.includes(token)) failures.push(`page missing ${token}`);
for (const token of requiredRoute) if (!route.includes(token)) failures.push(`route missing ${token}`);
for (const token of forbidden) {
  if (route.includes(token)) failures.push(`route contains forbidden token ${token}`);
}

if (pkg.scripts?.["verify:court-calendar-webcivil-local-import-safety"] !== "node scripts/verify-court-calendar-webcivil-local-import-safety.mjs") {
  failures.push("package.json missing verify:court-calendar-webcivil-local-import-safety script");
}

if (failures.length) {
  console.error("FAIL: court calendar WebCivil Local import safety");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("PASS: court calendar WebCivil Local import safety");
