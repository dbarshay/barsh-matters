import fs from "fs";

const route = fs.readFileSync("app/api/documents/working-docx/route.ts", "utf8");
let failed = false;
function pass(message) { console.log("PASS:", message); }
function fail(message) { failed = true; console.error("FAIL:", message); }

const requestedDocIndex = route.indexOf("const requestedDocument =");
const fallbackIndex = route.indexOf("const requestedBlankLetterheadFallback =");
const unavailableGuardIndex = route.indexOf("if (requestedKeys.length > 0 && !requestedDocument && !requestedBlankLetterheadFallback)");
const selectedDocIndex = route.indexOf("let selectedDocument =");
const fallbackUseIndex = route.indexOf("requestedBlankLetterheadFallback ||");

if (requestedDocIndex >= 0) pass("requestedDocument declaration exists"); else fail("requestedDocument declaration missing");
if (fallbackIndex > requestedDocIndex) pass("fallback declaration is after requestedDocument"); else fail("fallback declaration ordering is wrong");
if (unavailableGuardIndex > fallbackIndex) pass("unavailable-key guard is after fallback declaration"); else fail("unavailable-key guard ordering is wrong");
if (selectedDocIndex > unavailableGuardIndex) pass("selectedDocument declaration remains after unavailable-key guard"); else fail("selectedDocument declaration ordering changed unexpectedly");
if (fallbackUseIndex > selectedDocIndex) pass("selectedDocument uses fallback after declaration"); else fail("selectedDocument does not use fallback correctly");
if (!route.slice(0, selectedDocIndex).includes("if (!selectedDocument")) pass("no selectedDocument reference before declaration"); else fail("selectedDocument is referenced before declaration");

console.log("RESULT: working-docx Blank Letterhead fallback order verifier");
if (failed) process.exit(1);
