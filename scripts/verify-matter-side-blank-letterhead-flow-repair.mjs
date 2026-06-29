import fs from "fs";

const matterPage = fs.readFileSync("app/matter/[id]/page.tsx", "utf8");
const workingDocxRoute = fs.readFileSync("app/api/documents/working-docx/route.ts", "utf8");

let failed = false;
function pass(message) { console.log("PASS:", message); }
function fail(message) { failed = true; console.error("FAIL:", message); }
function has(label, text, token) { text.includes(token) ? pass(label) : fail(`${label} missing ${token}`); }
function lacks(label, text, token) { !text.includes(token) ? pass(label) : fail(`${label} should not contain ${token}`); }

has("only Blank Letterhead option key remains", matterPage, 'key: "blank-letterhead"');
has("Blank Letterhead label remains", matterPage, 'label: "Blank Letterhead"');
lacks("legacy Bill Schedule removed from direct matter popup options", matterPage, 'label: "Bill Schedule"');
lacks("legacy Packet Summary removed from direct matter popup options", matterPage, 'label: "Packet Summary"');
lacks("legacy Summons and Complaint removed from direct matter popup options", matterPage, 'label: "Summons and Complaint"');
has("signer state is present", matterPage, "matterDocumentSignerEmail");
has("signer default panel is present", matterPage, 'data-barsh-direct-document-generation-signer-default="true"');
has("edit flow preserves BRL display number by nulling numeric ID", matterPage, 'const directMatterIdForRequest = /^BRL_/i.test(directMatterDisplayNumber) ? null : directMatterId;');
has("edit/preview body passes BRL-safe directMatterId", matterPage, "directMatterId: directMatterIdForRequest");
has("working-docx body receives signer email", matterPage, 'signerEmail: matterDocumentSignerEmail.trim() || "dbarshay@brlfirm.com"');
has("finalize body preserves BRL display number", matterPage, 'directMatterId: /^BRL_/i.test(directMatterDisplayNumber) ? null : directMatterNumericIdForDocuments()');
has("standard document generation header remains", matterPage, 'data-barsh-direct-document-generation-header-standard="true"');
has("standard document generation footer remains", matterPage, 'data-barsh-direct-document-generation-footer-actions="true"');
has("working-docx still accepts documentKeys", workingDocxRoute, "const requestedKeys = asStringArray(body?.documentKeys)");
has("working-docx still recognizes DB stored DOCX", workingDocxRoute, 'clean(selectedDocument.storageKind) === "db-docx-base64"');

const headerCandidates = [
  "app/components/BarshHeaderQuickNav.tsx",
  "components/BarshHeaderQuickNav.tsx",
  "app/components/BarshHeader.tsx",
  "components/BarshHeader.tsx",
  "app/matter/[id]/page.tsx",
  "app/page.tsx",
].filter((candidate) => fs.existsSync(candidate));
const headerContainmentFound = headerCandidates.some((candidate) =>
  fs.readFileSync(candidate, "utf8").includes("data-barsh-header-logo-containment")
);
if (headerContainmentFound) pass("header logo containment marker is present");
else fail("header logo containment marker is present missing data-barsh-header-logo-containment");

console.log("RESULT: matter-side Blank Letterhead flow repair verifier");
if (failed) process.exit(1);
