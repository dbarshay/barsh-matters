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
mustContain("Home results has Matter column", home, "<th style={homeResultsThStyle}>Matter</th>");
mustContain("Home results has Patient column", home, "<th style={homeResultsThStyle}>Patient</th>");
mustContain("Home results has Provider column", home, "<th style={homeResultsThStyle}>Provider</th>");
mustContain("Home results has Insurer column", home, "<th style={homeResultsThStyle}>Insurer</th>");
mustContain("Home results has Claim Number column", home, "<th style={homeResultsThStyle}>Claim Number</th>");
mustContain("Home results has Lawsuit ID column", home, "<th style={homeResultsThStyle}>Lawsuit ID</th>");
mustContain("Home results has Court column", home, "<th style={homeResultsThStyle}>Court</th>");
mustContain("Home results has Adversary Attorney column", home, "<th style={homeResultsThStyle}>Adversary Attorney</th>");
mustContain("Home results has Denial Reason column", home, "<th style={homeResultsThStyle}>Denial Reason</th>");
mustContain("Home results reads advanced actual values per row", home, "const values = advancedActualValuesFromMatter(row);");
mustContain("Home results displays Court from local row values", home, 'advancedDisplayValue("Court", values.court)');
mustContain("Home results displays Adversary Attorney from local row values", home, 'advancedDisplayValue("Adversary Attorney", values.adversaryAttorney)');
mustContain("Home results displays Denial Reason from local row values", home, 'advancedDisplayValue("Denial Reason", values.denialReason)');
mustContain("Home results keeps matter navigation", home, 'href={`/matter/${row.id}`}');

mustContain("Home results Matter link uses table link style", home, "style={homeResultsMatterLinkStyle}");
mustContain("Home results Matter link style inherits table font", home, 'font: "inherit"');
mustNotContain("Home results Matter cell must not use old card title style", home, 'href={`/matter/${row.id}`} style={matterTitleLinkStyle}');

mustContain("Home results keeps patient filtered search link", home, 'filteredSearchUrl(row.patient, "Patient")');
mustContain("Home results keeps provider filtered search link", home, 'filteredSearchUrl(row.provider, "Provider")');

mustNotContain("Home results must not render old results overlay block", home, "{resultsModalOpen && (\n            <div style={searchResultsOverlayStyle}");
mustNotContain("Home results must not render old card result rows", home, 'className="barsh-result-row" style={resultRowStyle}');
mustNotContain("Home results must not render advanced bubble summary", home, "compactAdvancedActualValueSummary(row) &&");
mustNotContain("Home results must not render details bubble readback", home, "Advanced field values returned for this result");

mustNotContain("Home results URL state must not include modal field", home, "modal: string;");
mustNotContain("Home results URL writer must not set modal param", home, 'params.set("modal"');
mustNotContain("Home results search must not write modal results", home, 'modal: "results"');
mustNotContain("Home inline results must not depend on modal open state", home, "resultsModalOpen || loading || error || searched");
mustContain("Home inline results render depends on searched state", home, "{(loading || error || searched) && (");


if (process.exitCode) {
  console.error("FAILURES=1");
  process.exit(1);
}

console.log("FAILURES=0");
