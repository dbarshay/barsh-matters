import fs from "fs";

const page = fs.readFileSync("app/court-calendar/page.tsx", "utf8");
const header = fs.readFileSync("app/components/BarshHeaderActions.tsx", "utf8");
const matter = fs.readFileSync("app/matter/[id]/page.tsx", "utf8");

const requiredPage = [
  'data-barsh-court-calendar-page="true"',
  "/api/court-calendar/events",
  "includeCaseData",
  
  "Create Court Calendar Event",
  "BarshHeaderActions",
  "BarshHeaderQuickNav",
  "XLSX.writeFile",
  "/matters?master=",
];

const forbiddenPage = [
  "/matter/[id]",
  "google.calendar",
  "Microsoft Graph calendar",
  "externalCalendarEventsCreated: true",
];

const failures = [];

for (const token of requiredPage) if (!page.includes(token)) failures.push(`page missing ${token}`);
for (const token of forbiddenPage) if (page.includes(token)) failures.push(`page contains forbidden token ${token}`);

if (!header.includes('href="/court-calendar"') || !header.includes("Court Calendar")) {
  failures.push("global header is missing Court Calendar link");
}

if (matter.includes("/api/court-calendar/events") || matter.includes('data-barsh-court-calendar-page="true"')) {
  failures.push("direct matter page contains Court Calendar workflow wiring");
}

if (failures.length) {
  console.error("FAIL: court calendar page safety");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

if (!page.includes('handleCalendarFilterKeyDown')) failures.push('page missing handleCalendarFilterKeyDown');
if (!page.includes('onKeyDown={handleCalendarFilterKeyDown}')) failures.push('page missing onKeyDown={handleCalendarFilterKeyDown}');
if (!page.includes('Search Calendar')) failures.push('page missing Search Calendar');
if (!page.includes('gridTemplateColumns: "140px 140px minmax(220px, 1fr) 190px minmax(260px, 1.15fr) minmax(220px, 0.95fr)"')) failures.push('page missing gridTemplateColumns: "140px 140px minmax(220px, 1fr) 190px minmax(260px, 1.15fr) minmax(220px, 0.95fr)"');
if (page.includes('Create Event')) failures.push('page contains removed filter action Create Event');
if (page.includes('Export Report XLS')) failures.push('page contains removed filter action Export Report XLS');
console.log("PASS: court calendar page safety");
