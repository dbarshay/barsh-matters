import fs from "fs";

const pagePath = "app/matter/[id]/page.tsx";
const page = fs.readFileSync(pagePath, "utf8");

let failed = false;
function pass(message) {
  console.log("PASS:", message);
}
function fail(message) {
  failed = true;
  console.error("FAIL:", message);
}
function has(label, token) {
  page.includes(token) ? pass(label) : fail(`${label} missing token: ${token}`);
}
function lacks(label, token) {
  !page.includes(token) ? pass(label) : fail(`${label} should not contain token: ${token}`);
}

has("original direct matter topbar style is locked", '<div style={bmGlobalTopBarStyle}>');
has("original direct matter left wrapper style is locked", '<div style={bmGlobalLeftLogoWrapStyle}>');
has("original BRL logo tag is locked", '<img src="/brl-logo.png" alt="BRL Logo" style={bmGlobalBrlLogoStyle} />');
has("original quick-nav wrapper padding is locked", '<div style={{ paddingTop: 8 }}>');
has("original right logo link is locked", '<a href="/" title="Return to Barsh Matters entry screen" style={bmGlobalLogoLinkStyle}>');
has("original Barsh Matters logo tag is locked", '<img src="/barsh-matters-cropped-transparent.png" alt="Barsh Matters Logo" style={bmGlobalLogoStyle} />');

for (const forbidden of [
  "data-barsh-matter-header-grid",
  "data-barsh-matter-header-two-row",
  "data-barsh-matter-header-left",
  "data-barsh-matter-header-utility-row",
  "data-barsh-matter-header-right-logo-link",
  "data-barsh-matter-header-right-logo-hidden",
  "data-barsh-matter-left-logo",
  "data-barsh-matter-right-logo",
  "data-barsh-header-logo-containment",
  "gridTemplateColumns: \"minmax(0, 1fr) 132px\"",
  "gridTemplateRows: \"auto auto\"",
  "paddingBottom",
]) {
  lacks(`forbidden header mutation absent: ${forbidden}`, forbidden);
}

has("stable document selection dropdown remains present", 'data-barsh-direct-document-generation-template-dropdown="true"');
has("Blank Letterhead dropdown option remains present", '<option value="blank-letterhead">Blank Letterhead</option>');
has("signer-only step flow remains present", 'data-barsh-direct-document-generation-signer-only-section="true"');
has("continue-to-generate signer confirmation remains present", 'data-barsh-direct-document-generation-continue-to-actions="true"');
has("Blank Letterhead remains the direct matter template", 'key: "blank-letterhead"');

console.log("RESULT: direct matter header locked");
if (failed) process.exit(1);
