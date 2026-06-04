#!/usr/bin/env node
import fs from "fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function mustContain(label, text, needle) {
  if (!text.includes(needle)) {
    console.error(`FAIL: ${label} missing ${needle}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS: ${label}`);
  }
}

function mustNotContain(label, text, needle) {
  if (text.includes(needle)) {
    console.error(`FAIL: ${label} unexpectedly contains ${needle}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS: ${label}`);
  }
}

const home = read("app/page.tsx");

console.log("RESULT: verify Home search results inline table safety");

mustContain("Home results render uses inline table panel", home, "homeResultsTablePanelStyle");
mustContain("Home results render uses table", home, "<table style={homeResultsTableStyle}>");
mustContain("Home results reads advanced actual values per row", home, "const values = advancedActualValuesFromMatter(row);");
mustContain("Home results displays Court from local row values", home, 'advancedDisplayValue("Court", values.court)');
mustContain("Home results displays Adversary Attorney from local row values", home, 'advancedDisplayValue("Adversary Attorney", values.adversaryAttorney)');
mustContain("Home results displays Denial Reason from local row values", home, 'advancedDisplayValue("Denial Reason", values.denialReason)');
mustContain("Home results keeps matter navigation", home, 'href={`/matter/${row.id}`}');

mustContain("Home results Matter link uses table link style", home, "style={homeResultsMatterLinkStyle}");
mustContain("Home results Matter link style inherits table font", home, 'font: "inherit"');
mustNotContain("Home results Matter cell must not use old card title style", home, 'href={`/matter/${row.id}`} style={matterTitleLinkStyle}');

mustContain("Home results keeps patient filtered search link", home, 'runHomeLinkedFilter(row.patient, "Patient")');
mustContain("Home results keeps provider filtered search link", home, 'runHomeLinkedFilter(row.provider, "Provider")');

mustContain("Home results filtered search supports Court", home, 'target === "Court"');
mustContain("Home results filtered search supports Adversary Attorney", home, 'target === "Adversary Attorney"');
mustContain("Home results filtered search supports Denial Reason", home, 'target === "Denial Reason"');
mustContain("Home results links insurer", home, 'runHomeLinkedFilter(row.insurer, "Insurer")');
mustContain("Home results links claim number", home, 'runHomeLinkedFilter(row.claimNumber || values.claim, "Claim number")');
mustContain("Home results links lawsuit ID", home, 'runHomeLinkedFilter(row.masterLawsuitId, "Lawsuit ID")');
mustContain("Home results links court", home, 'runHomeLinkedFilter(courtValue, "Court")');
mustContain("Home results links adversary attorney", home, 'runHomeLinkedFilter(adversaryAttorneyValue, "Adversary Attorney")');
mustContain("Home results links denial reason", home, 'runHomeLinkedFilter(denialReasonValue, "Denial Reason")');
mustContain("Home results field links use table style", home, "style={homeResultsFieldButtonStyle}");


mustNotContain("Home results must not render old results overlay block", home, "{resultsModalOpen && (\n            <div style={searchResultsOverlayStyle}");
mustNotContain("Home results must not render old card result rows", home, 'className="barsh-result-row" style={resultRowStyle}');
mustNotContain("Home results must not render advanced bubble summary", home, "compactAdvancedActualValueSummary(row) &&");
mustNotContain("Home results must not render details bubble readback", home, "Advanced field values returned for this result");

mustNotContain("Home results URL state must not include modal field", home, "modal: string;");
mustNotContain("Home results URL writer must not set modal param", home, 'params.set("modal"');
mustNotContain("Home results search must not write modal results", home, 'modal: "results"');
mustNotContain("Home inline results must not depend on modal open state", home, "resultsModalOpen || loading || error || searched");
mustContain("Home inline results render depends on searched state", home, "{(loading || error || searched) && (");

mustNotContain("Home results must not keep resultsModalOpen state", home, "resultsModalOpen");
mustNotContain("Home results must not keep setResultsModalOpen calls", home, "setResultsModalOpen");
mustNotContain("Home results must not keep closeHomeResults helper", home, "function closeHomeResults");
mustNotContain("Home results must not keep old card hover selector", home, ".barsh-result-row:hover");
mustNotContain("Home results must not keep old modal overlay style", home, "const searchResultsOverlayStyle");
mustNotContain("Home results must not keep old modal style", home, "const searchResultsModalStyle");
mustNotContain("Home results must not keep old modal close style", home, "const searchResultsCloseButtonStyle");
mustNotContain("Home results must not keep old list style", home, "const searchResultsListStyle");
mustNotContain("Home results must not keep old result row style", home, "const resultRowStyle");
mustNotContain("Home results must not keep old result top-line style", home, "const resultTopLineStyle");
mustNotContain("Home results must not keep compact advanced summary helper", home, "function compactAdvancedActualValueSummary");
mustNotContain("Home results must not keep old advanced actual value bubble style", home, "const advancedActualValuesStyle");
mustNotContain("Home results must not keep old advanced details style", home, "const advancedFieldDetailsStyle");
mustNotContain("Home results must not keep old advanced grid style", home, "const advancedFieldGridStyle");




mustContain("Home MatterResult preserves Court", home, "court: advancedValues.court");
mustContain("Home MatterResult preserves Adversary Attorney", home, "adversaryAttorney: advancedValues.adversaryAttorney");
mustContain("Home MatterResult preserves Denial Reason", home, 'denialReason: advancedDisplayValue("Denial Reason", advancedValues.denialReason)');
mustContain("Home URL state supports insurer", home, "insurer: string;");
mustContain("Home URL state supports lawsuit ID", home, "lawsuitId: string;");
mustContain("Home URL state supports court", home, "court: string;");
mustContain("Home URL state supports adversary attorney", home, "adversaryAttorney: string;");
mustContain("Home URL state supports denial reason", home, "denialReason: string;");
mustContain("Home popstate replays insurer linked filter", home, 'runFilteredSearchPage(urlState.insurer, "Insurer", { updateUrl: false })');
mustContain("Home popstate replays court linked filter", home, 'runFilteredSearchPage(urlState.court, "Court", { updateUrl: false })');
mustContain("Home popstate replays adversary linked filter", home, 'runFilteredSearchPage(urlState.adversaryAttorney, "Adversary Attorney", { updateUrl: false })');
mustContain("Home popstate replays denial linked filter", home, 'runFilteredSearchPage(urlState.denialReason, "Denial Reason", { updateUrl: false })');
mustNotContain("Home inline linked filters must not use filtered hrefs", home, "href={filteredSearchUrl");
mustContain("Home inline linked filters use buttons", home, "runHomeLinkedFilter");
mustContain("Home results have sortable Matter header", home, 'homeSortableHeader("Matter", "matter")');
mustContain("Home results have sortable Patient header", home, 'homeSortableHeader("Patient", "patient")');
mustContain("Home results have sortable Provider header", home, 'homeSortableHeader("Provider", "provider")');
mustContain("Home results have sortable Insurer header", home, 'homeSortableHeader("Insurer", "insurer")');
mustContain("Home results have sortable Claim Number header", home, 'homeSortableHeader("Claim Number", "claimNumber")');
mustContain("Home results have sortable Lawsuit ID header", home, 'homeSortableHeader("Lawsuit ID", "lawsuitId")');
mustContain("Home results have sortable Court header", home, 'homeSortableHeader("Court", "court")');
mustContain("Home results have sortable Adversary Attorney header", home, 'homeSortableHeader("Adversary Attorney", "adversaryAttorney")');
mustContain("Home results have sortable Denial Reason header", home, 'homeSortableHeader("Denial Reason", "denialReason")');
mustContain("Home results render sorted rows", home, "sortedHomeResults.map");

mustContain("Home popstate replays lawsuit ID linked filter", home, 'runFilteredSearchPage(urlState.lawsuitId, "Lawsuit ID", { updateUrl: false })');
if (process.exitCode) {
  console.error("FAILURES=1");
  process.exit(1);
}

console.log("FAILURES=0");
