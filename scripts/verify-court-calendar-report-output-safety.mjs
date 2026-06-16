import fs from "fs";

const pagePath = "app/court-calendar/page.tsx";
const packagePath = "package.json";

const page = fs.readFileSync(pagePath, "utf8");
const pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"));
const has = (value) => page.includes(value);

const checks = [
  ["xlsx_import_present", has('import * as XLSX from "xlsx";')],
  ["download_workbook_helper_present", has("function downloadWorkbookRows(headers: string[], rows: unknown[][], filename: string, sheetName: string)") && has("XLSX.utils.aoa_to_sheet([headers, ...rows])") && has("XLSX.writeFile(workbook, filename)")],
  ["report_type_state_present", has('const [reportType, setReportType] = useState("all")')],
  ["report_type_selector_has_three_contracts", has('<option value="all">All</option>') && has('<option value="trial-calendar">Trial Calendar Report</option>') && has('<option value="appearance-calendar">Appearance Calendar Report</option>')],
  ["report_titles_locked", has('if (reportType === "trial-calendar") return "Trial Calendar Report";' ) && has('if (reportType === "appearance-calendar") return "Appearance Calendar Report";') && has('return "Court Calendar Report";')],
  ["xlsx_slugs_locked", has("trial-calendar-report") && has("appearance-calendar-report") && has("court-calendar-report")],
  ["xlsx_sheet_names_locked", has('return "Trial Calendar";') && has('return "Appearance Calendar";') && has('return "Court Calendar";')],
  ["print_action_wired", has("function printCalendarReport()") && has('window.open("", "_blank")') && has("window.print()") && has('data-barsh-court-calendar-print-filtered-results="true"')],
  ["xlsx_action_wired", has("function exportCalendarReport()") && has("downloadWorkbookRows(headers, rows, `barsh-matters-${selectedCourtCalendarReportSlug()}-${timestampForFilename()}.xlsx`, selectedCourtCalendarReportSheetName())") && has('data-barsh-court-calendar-export-xlsx="true"')],
  ["all_print_columns_include_required_rollup_fields", has('<table class=\\\"all-report\\\"') && has("<th>Date</th>") && has("<th>Time</th>") && has("<th>Cal.<br/>No.</th>") && has("<th>Claim<br/>Amount</th>") && has("<th>Balance<br/>Amount</th>") && has("<th>Caption</th>") && has("event.caseData?.lawsuitAmount") && has("event.caseData?.lawsuitBalance") && has("event.caseData?.caption || event.title")],
  ["appearance_print_columns_include_required_rollup_fields", has('<table class=\\\"appearance-report\\\"') && has("<th>Appearance<br/>Type</th>") && has("<th>Notes</th>") && has("event.caseData?.lawsuitAmount") && has("event.caseData?.lawsuitBalance") && has("event.caseData?.caption || event.title")],
  ["trial_print_columns_include_required_rollup_fields", has('<table class=\\\"trial-report\\\"') && has("<th>Daily Court<br/>Cal. No</th>") && has("<th>Case Caption</th>") && has("<th>Trial Result</th>") && has("printableResultLines()") && has("event.caseData?.lawsuitAmount") && has("event.caseData?.lawsuitBalance") && has("event.caseData?.caption || event.title")],
  ["xlsx_all_headers_include_required_rollup_fields", has('headers = ["Event Date", "Event Time", "Court", "Calendar Number", "Index / AAA", "Master Lawsuit", "Status", "Appearance Type", "Claim Amount", "Balance Amount", "Caption", "Judge / Arbitrator", "Notes"]')],
  ["xlsx_appearance_headers_include_required_rollup_fields", has('headers = ["Event Date", "Event Time", "Court", "Calendar Number", "Index / AAA", "Master Lawsuit", "Appearance Type", "Claim Amount", "Balance Amount", "Caption", "Judge / Arbitrator", "Notes"]')],
  ["xlsx_trial_headers_include_required_rollup_fields", has('headers = ["Event Date", "Event Time", "Court", "Daily Court Cal. No", "Index / AAA Number", "Packet ID / Case ID", "Case Status", "Claim Amount", "Balance Amount", "Case Caption", "Defendant Attorney", "Trial Status", "Trial Result"]') && has("safeExportCell(event.eventDate)") && has("safeExportCell(event.eventTime)") && has("safeExportCell(event.court || event.venue)")],
  ["raw_calendar_number_preserved_for_export", has("safeExportCell(event.calendarNumber") && !has("safeExportCell(`Cal")],
  ["money_export_uses_printable_money", has("safeExportCell(printableMoney(event.caseData?.lawsuitAmount))") && has("safeExportCell(printableMoney(event.caseData?.lawsuitBalance))")],
  ["known_output_contract_strings", has("printableMoney(event.caseData?.lawsuitAmount)") && has("printableMoney(event.caseData?.lawsuitBalance)") && has("event.caseData?.caption || event.title") && has("safeExportCell(event.calendarNumber || \\\"0\\\")") || has("safeExportCell(event.calendarNumber || \"0\")")],
  ["package_script_registered", pkg.scripts?.["verify:court-calendar-report-output-safety"] === "node scripts/verify-court-calendar-report-output-safety.mjs"],
];

let ok = true;
for (const [name, passed] of checks) {
  if (passed) console.log(`PASS: ${name}`);
  else {
    console.error(`FAIL: ${name}`);
    ok = false;
  }
}

if (!ok) process.exit(1);
console.log("PASS: court calendar report output contract");
