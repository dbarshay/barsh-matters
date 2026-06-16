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
if (page.includes('Create Event')) failures.push('page contains removed filter action Create Event');
if (!page.includes('data-barsh-court-calendar-hide-closed-matters-filter')) failures.push('page missing data-barsh-court-calendar-hide-closed-matters-filter');
if (!page.includes('Hide Closed Matters')) failures.push('page missing Hide Closed Matters');
if (!page.includes('hideClosedMatters')) failures.push('page missing hideClosedMatters');
if (!page.includes('gridTemplateColumns: "130px 130px minmax(210px, 1fr) 180px minmax(250px, 1.1fr) minmax(220px, 0.95fr) 190px"')) failures.push('page missing gridTemplateColumns: "130px 130px minmax(210px, 1fr) 180px minmax(250px, 1.1fr) minmax(220px, 0.95fr) 190px"');
if (page.includes('Export Report XLS')) failures.push('page contains removed filter action Export Report XLS');
if (!page.includes('sortableCalendarHeader')) failures.push('page missing sortable result column token sortableCalendarHeader');
if (!page.includes('function sortableCalendarValue(event: CalendarEvent, key: CourtCalendarSortKey)')) failures.push('page missing sortableCalendarValue helper');
if (!page.includes('calendarResultSort')) failures.push('page missing sortable result column token calendarResultSort');
if (!page.includes('setCalendarResultSort')) failures.push('page missing sortable result column token setCalendarResultSort');
if (!page.includes('data-barsh-court-calendar-sort-header')) failures.push('page missing sortable result column token data-barsh-court-calendar-sort-header');
if (!page.includes('CourtCalendarSortKey')) failures.push('page missing sortable result column token CourtCalendarSortKey');
if (!page.includes('sortableCalendarHeader("Date", "eventDate")')) failures.push('page missing sortable result column token sortableCalendarHeader("Date", "eventDate")');
if (!page.includes('sortableCalendarHeader("Court", "court")')) failures.push('page missing sortable result column token sortableCalendarHeader("Court", "court")');
if (!page.includes('sortableCalendarHeader("Calendar Number", "calendarNumber")')) failures.push('page missing sortable result column token sortableCalendarHeader("Calendar Number", "calendarNumber")');
if (!page.includes('sortableCalendarHeader("Index Number", "indexNumber")')) failures.push('page missing sortable result column token sortableCalendarHeader("Index Number", "indexNumber")');
if (!page.includes('sortableCalendarHeader("Lawsuit Number", "lawsuitNumber")')) failures.push('page missing sortable result column token sortableCalendarHeader("Lawsuit Number", "lawsuitNumber")');
if (!page.includes('sortableCalendarHeader("Appearance Type", "appearanceType")')) failures.push('page missing sortable result column token sortableCalendarHeader("Appearance Type", "appearanceType")');
if (!page.includes('sortableCalendarHeader("Lawsuit Amount", "lawsuitAmount")')) failures.push('page missing sortable result column token sortableCalendarHeader("Lawsuit Amount", "lawsuitAmount")');
if (!page.includes('sortableCalendarHeader("Lawsuit Balance", "lawsuitBalance")')) failures.push('page missing sortable result column token sortableCalendarHeader("Lawsuit Balance", "lawsuitBalance")');
if (!page.includes('sortableCalendarHeader("Caption", "caption")')) failures.push('page missing sortable result column token sortableCalendarHeader("Caption", "caption")');
if (!page.includes('const dateCompare = text(a.eventDate).localeCompare(text(b.eventDate));')) failures.push('page missing default date sort tie-breaker');
if (!page.includes('const courtCompare = text(a.court || a.venue).localeCompare(text(b.court || b.venue));')) failures.push('page missing default court sort tie-breaker');
if (!page.includes('leftCalendarNumber')) failures.push('page missing default calendar-number sort tie-breaker');
if (!page.includes('data-barsh-court-calendar-results-fit-columns="true"')) failures.push('page missing results fit-columns marker');
if (!page.includes('resultColumnWidths')) failures.push('page missing resultColumnWidths');
if (!page.includes('\"36%\"')) failures.push('page missing widened Caption result column width');
if (!page.includes('resultTableMinWidth')) failures.push('page missing resultTableMinWidth');
if (!page.includes('tableLayout: "fixed"')) failures.push('page missing fixed table layout for fitted results columns');
if (!page.includes('wrapCellStyle')) failures.push('page missing wrapCellStyle');
if (!page.includes('compactIdCellStyle')) failures.push('page missing compactIdCellStyle');
if (!page.includes('moneyCellStyle')) failures.push('page missing moneyCellStyle');
if (!page.includes('WEB_CIVIL_LOCAL_CALENDAR_URL')) failures.push('page missing WebCivil Local calendar-number helper token WEB_CIVIL_LOCAL_CALENDAR_URL');
if (!page.includes('webcivilLocal/LCCalendarSearch')) failures.push('page missing WebCivil Local calendar-number helper token webcivilLocal/LCCalendarSearch');
if (!page.includes('data-barsh-court-calendar-webcivil-local-helper')) failures.push('page missing WebCivil Local calendar-number helper token data-barsh-court-calendar-webcivil-local-helper');
if (!page.includes('Confirm manually in WebCivil Local using court, date range, and index number.')) failures.push('page missing WebCivil Local calendar-number helper token Confirm manually in WebCivil Local using court, date range, and index number.');
if (!page.includes('Open WebCivil Local Court Calendars')) failures.push('page missing WebCivil Local calendar-number helper token Open WebCivil Local Court Calendars');
if (page.includes("function printCalendarReport") === false) failures.push("page missing printCalendarReport");
if (page.includes("data-barsh-court-calendar-print-filtered-results=\"true\"") === false) failures.push("page missing printable filtered-results button");
if (page.includes("Trial Calendar Report") === false) failures.push("page missing Trial Calendar Report printable title");
if (page.includes("matters from current filtered results") === false) failures.push("page missing current filtered results printable count");
if (page.includes("window.print()") === false) failures.push("page missing printable window print trigger");
if (page.includes("Daily Court<br/>Cal. No") === false) failures.push("page missing trial-calendar report column Daily Court Cal. No");
if (page.includes("Trial Result") === false) failures.push("page missing trial-calendar report column Trial Result");
if (page.includes("Adj") === false) failures.push("page missing trial result handwritten Adj line");
if (page.includes("@page { size: landscape;") === false) failures.push("page missing landscape print CSS");
if (page.includes("useState(\\\"all\\\")") === false) failures.push("page missing All default reportType state");
if (!page.includes("data-barsh-court-calendar-report-controls=\"true\"")) failures.push("page missing report controls marker");
if (!page.includes("data-barsh-court-calendar-report-type-selector=\"true\"")) failures.push("page missing report type selector marker");
if (!page.includes("data-barsh-court-calendar-result-bottom-actions=\"true\"")) failures.push("page missing bottom report action controls marker");
if (!page.includes("Trial Calendar Report")) failures.push("page missing Trial Calendar Report selector option");
if (!page.includes("Appearance Calendar Report")) failures.push("page missing Appearance Calendar Report selector option");
if (page.includes("<option value=\\\"all\\\">All</option>") === false) failures.push("page missing All report selector option");
if (page.includes("Provider Calendar Report")) failures.push("page still contains Provider Calendar Report selector option");
if (!page.includes(">Court Calendars</h1>")) failures.push("page missing Court Calendars title");
if (page.includes(">Barsh Matters</div>")) failures.push("page still contains Barsh Matters eyebrow");
if (page.includes(">BARSH MATTERS</div>")) failures.push("page still contains BARSH MATTERS eyebrow");
if (page.includes(">Open Matters</Link>")) failures.push("page still contains generic Open Matters action in Court Calendar results controls");
console.log("PASS: court calendar page safety");
