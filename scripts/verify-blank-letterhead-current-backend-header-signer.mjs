import fs from "fs";

const matterPage = fs.readFileSync("app/matter/[id]/page.tsx", "utf8");
const workingDocx = fs.readFileSync("app/api/documents/working-docx/route.ts", "utf8");
const directPreview = fs.readFileSync("app/api/documents/direct-finalize-preview/route.ts", "utf8");

let failed = false;
function pass(message) { console.log("PASS:", message); }
function fail(message) { failed = true; console.error("FAIL:", message); }
function has(label, text, token) { text.includes(token) ? pass(label) : fail(`${label} missing ${token}`); }
function lacks(label, text, token) { !text.includes(token) ? pass(label) : fail(`${label} should not contain ${token}`); }

has("Blank Letterhead option remains", matterPage, 'key: "blank-letterhead"');
lacks("Bill Schedule legacy option removed", matterPage, 'label: "Bill Schedule"');
lacks("Packet Summary legacy option removed", matterPage, 'label: "Packet Summary"');
lacks("Summons and Complaint legacy option removed", matterPage, 'label: "Summons and Complaint"');
has("signer display option exists", matterPage, 'displayName: "David M. Barshay"');
has("signer select exists", matterPage, "<select");
has("signer select stores email value", matterPage, "value={signer.email}");
lacks("signer email placeholder removed", matterPage, 'placeholder="dbarshay@brlfirm.com"');

const containedImgTags = [...matterPage.matchAll(/<img\b[\s\S]*?\/>/g)].map((m) => m[0]).filter((tag) => tag.includes("data-barsh-header-logo-containment"));
if (containedImgTags.length >= 2) pass("header logo containment tags present");
else fail(`expected at least 2 contained header images, found ${containedImgTags.length}`);
for (const tag of containedImgTags) {
  const src = (tag.match(/src="([^"]+)"/) || [])[1] || "unknown";
  const styleCount = (tag.match(/\bstyle=/g) || []).length;
  if (styleCount === 1) pass(`${src} has one style prop`);
  else fail(`${src} has ${styleCount} style props`);
  has(`${src} width constrained`, tag, "width:");
  has(`${src} maxWidth constrained`, tag, "maxWidth:");
  has(`${src} maxHeight constrained`, tag, "maxHeight:");
  has(`${src} objectFit constrained`, tag, 'objectFit: "contain"');
}

has("working-docx accepts signerEmail", workingDocx, "const signerEmail = clean(body?.signerEmail");
has("working-docx has blank-letterhead fallback", workingDocx, "blank-letterhead-db-docx-fallback");
has("working-docx declares requestedBlankLetterheadFallback", workingDocx, "const requestedBlankLetterheadFallback =");
has("working-docx unavailable-key guard allows fallback", workingDocx, "if (requestedKeys.length > 0 && !requestedDocument && !requestedBlankLetterheadFallback)");
has("working-docx selectedDocument uses fallback", workingDocx, "requestedBlankLetterheadFallback ||");
has("working-docx fallback marks DB source", workingDocx, 'repositorySource: "barsh-matters-db"');
has("working-docx fallback marks DB DOCX", workingDocx, 'storageKind: "db-docx-base64"');
if (!directPreview.includes("blank-letterhead-db-docx-fallback")) pass("direct-finalize-preview no longer contains risky catch fallback");
else fail("direct-finalize-preview still contains risky blank-letterhead fallback");

console.log("RESULT: current Blank Letterhead backend/header/signer verifier");
if (failed) process.exit(1);
