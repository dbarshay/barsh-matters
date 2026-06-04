#!/usr/bin/env node

import fs from "node:fs";

const pagePath = "app/matter/[id]/page.tsx";
const page = fs.readFileSync(pagePath, "utf8");

const failures = [];

function mustContain(label, haystack, needle) {
  if (!haystack.includes(needle)) failures.push(`${label}: missing ${needle}`);
}

function mustNotContain(label, haystack, needle) {
  if (haystack.includes(needle)) failures.push(`${label}: forbidden ${needle}`);
}

const popupStart = page.indexOf("{showLawsuitOptionsModal && (");
const popupEnd = page.indexOf("{showCloseModal &&", popupStart);
const popup = popupStart >= 0 && popupEnd > popupStart ? page.slice(popupStart, popupEnd) : "";

if (!popup) failures.push("popup block not found");

mustContain("selected matter summary memo exists", page, "const startLawsuitSelectedMatterSummary = useMemo(() =>");
mustContain("amount calculation helper exists", page, "function startLawsuitAmountForMode(): number");
mustContain("direct create supports custom amount mode", page, 'lawsuitOptions.amountSoughtMode === "custom"');
mustContain("direct create passes custom amount", page, "customAmountSought,");
mustContain("direct create passes venue", page, "venue: selectedVenue,");
mustContain("direct create passes venue selection", page, "venueSelection: selectedVenue,");
mustContain("direct create notes identify Start Lawsuit", page, "Created from Start Lawsuit individual matter workflow.");

mustContain("popup title is Create Lawsuit", popup, '<h2 style={startLawsuitModalTitleStyle}>Create Lawsuit</h2>');
mustContain("popup uses Choose Court label", popup, "Choose Court");
mustContain("popup selected matters summary", popup, "Selected Matters: {startLawsuitSelectedMatterSummary.count}");
mustContain("popup selected amount summary", popup, "Selected Lawsuit Amount: {money(startLawsuitAmountForMode())}");
mustContain("popup confirm label", popup, "Confirm Create Lawsuit");
mustContain("popup notes label", popup, "Lawsuit Notes");
mustContain("popup mirrors top-level modal backdrop", popup, "startLawsuitModalBackdropStyle");
mustContain("popup mirrors top-level modal shell", popup, "startLawsuitModalStyle");
mustContain("popup mirrors top-level drag header", popup, "startLawsuitModalDragHandleStyle");
mustContain("popup mirrors top-level modal title", popup, "startLawsuitModalTitleStyle");
mustContain("popup mirrors top-level amount panel", popup, "startLawsuitAmountModePanelStyle");
mustContain("popup has review table", popup, "startLawsuitTableStyle");
mustContain("popup has Preview-equivalent selected matter review", popup, "Matter Status");
mustContain("popup uses Working label", popup, 'submitting ? "Working..." : "Confirm Create Lawsuit"');
mustNotContain("old compact centered popup removed", popup, 'width: 560');
mustNotContain("old compact white-box shadow removed", popup, 'boxShadow: "0 10px 30px rgba(0,0,0,0.25)"');


mustNotContain("old direct popup title removed", popup, "Lawsuit Generation Options");
mustNotContain("old select venue option removed from popup", popup, "Select Venue");
mustNotContain("pre-filing index input removed from popup", popup, "Index / AAA Number");
mustNotContain("old popup confirm label removed", popup, 'submitting ? "Generating..." : "Confirm"');

console.log("RESULT: verify Start Lawsuit popup polish safety");
console.log("PAGE=" + pagePath);
console.log("SCOPE=showLawsuitOptionsModal");
console.log("EXPECTS_CREATE_LAWSUIT_TITLE=YES");
console.log("EXPECTS_CHOOSE_COURT_LABEL=YES");
console.log("EXPECTS_SELECTED_MATTER_SUMMARY=YES");
console.log("EXPECTS_NO_PREFILING_INDEX_AAA_FIELD_IN_POPUP=YES");
console.log("EXPECTS_MIRRORED_TOP_LEVEL_POPUP_STYLE=YES");
console.log("FAILURES=" + failures.length);

for (const failure of failures) console.log("FAIL=" + failure);

if (failures.length) process.exit(1);
