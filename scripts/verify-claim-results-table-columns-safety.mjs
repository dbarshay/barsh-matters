import fs from "fs";

const page = fs.readFileSync("app/matters/page.tsx", "utf8");

let failed = false;

function requireText(label, haystack, needle) {
  if (!haystack.includes(needle)) {
    console.error(`FAIL: missing ${label}`);
    failed = true;
  } else {
    console.log(`PASS: ${label}`);
  }
}

function forbidText(label, haystack, needle) {
  if (haystack.includes(needle)) {
    console.error(`FAIL: forbidden ${label}`);
    failed = true;
  } else {
    console.log(`PASS: forbidden ${label} absent`);
  }
}

const tableAnchor = page.indexOf('{sortableClaimResultsHeader("Matter", "matter")}');
const tableEnd = page.indexOf('</table>', tableAnchor);
const tableBlock =
  tableAnchor >= 0 && tableEnd > tableAnchor ? page.slice(tableAnchor, tableEnd) : "";

requireText("MatterRow includes dosStart", page, "dosStart: string;");
requireText("MatterRow includes dosEnd", page, "dosEnd: string;");
requireText("MatterRow includes denialReason", page, "denialReason: string;");
requireText("MatterRow includes status", page, "status: string;");
requireText("row mapper includes status", page, "status: clean(row?.matterStage?.name ?? row?.matter_stage_name ?? row?.status)");
requireText("row mapper includes dosStart", page, "dosStart: clean(row?.dosStart ?? row?.dos_start)");
requireText("row mapper includes dosEnd", page, "dosEnd: clean(row?.dosEnd ?? row?.dos_end)");
requireText("row mapper includes denialReason", page, "denialReason: clean(row?.denialReason ?? row?.denial_reason)");
requireText("displayDate helper exists", page, "function displayDate(v: any)");

requireText("results table located", tableBlock, '{sortableClaimResultsHeader("Matter", "matter")}');
requireText("results table keeps Patient header", tableBlock, '{sortableClaimResultsHeader("Patient", "patient")}');
requireText("results table keeps Provider header", tableBlock, '{sortableClaimResultsHeader("Provider", "provider")}');
requireText("results table keeps Insurer header", tableBlock, '{sortableClaimResultsHeader("Insurer", "insurer")}');
requireText("results table keeps Claim header", tableBlock, '{sortableClaimResultsHeader("Claim", "claim")}');
requireText("results table adds DOS header", tableBlock, '{sortableClaimResultsHeader("DOS", "dos")}');
requireText("results table adds Denial Reason header", tableBlock, '{sortableClaimResultsHeader("Denial Reason", "denialReason")}');
requireText("results table keeps Master Lawsuit header", tableBlock, '{sortableClaimResultsHeader("Master Lawsuit", "masterLawsuit")}');
requireText("results table keeps Claim Amount header", tableBlock, '{sortableClaimResultsHeader("Claim Amount", "claimAmount", rightThStyle)}');
requireText("results table keeps Balance header", tableBlock, '{sortableClaimResultsHeader("Balance", "balance", rightThStyle)}');
requireText("results table adds Status header", tableBlock, '{sortableClaimResultsHeader("Status", "status")}');

requireText("DOS cell uses dosStart/dosEnd", tableBlock, "row.dosStart || row.dosEnd");
requireText("DOS cell formats dosStart", tableBlock, "displayDate(row.dosStart)");
requireText("DOS cell formats dosEnd range", tableBlock, "displayDate(row.dosEnd)");
requireText("Denial Reason cell uses row.denialReason", tableBlock, '<td style={tdStyle}>{row.denialReason || "—"}</td>');
requireText("Master Lawsuit value is linked", tableBlock, 'href={filteredUrl("master", row.masterLawsuitId)}');
requireText("Master Lawsuit uses field link class", tableBlock, 'className="barsh-filter-field-link"');
requireText("Master Lawsuit uses field link style", tableBlock, "style={fieldLinkStyle}");
requireText("Master Lawsuit link displays ID", tableBlock, "{row.masterLawsuitId}");
requireText("Status cell is last display column", tableBlock, '<td style={tdStyle}>{row.status || "—"}</td>');

forbidText("Action header in results table", tableBlock, '<th style={thStyle}>Action</th>');
forbidText("Open Matter action button in results table", tableBlock, "Open Matter");
forbidText("Launch Patient action link in results table", tableBlock, "Launch Patient");
forbidText("Launch Claim action link in results table", tableBlock, "Launch Claim");
forbidText("Open Lawsuit action link in results table", tableBlock, "Open Lawsuit");
forbidText("action stack usage in results table", tableBlock, "actionStackStyle");
forbidText("open link usage in results table", tableBlock, "openLinkStyle");
forbidText("secondary action link usage in results table", tableBlock, "secondaryActionLinkStyle");

if (failed) process.exit(1);

console.log("PASS: claim-filtered results table removes Action column, adds DOS/Denial Reason/Status, links Master Lawsuit directly, and supports sortable headers.");
