import fs from "fs";
const route = fs.readFileSync("app/api/settlements/documents-preview/route.ts", "utf8");
const pkg = fs.readFileSync("package.json", "utf8");

let failures = 0;
function check(label, ok) { ok ? console.log(`PASS: ${label}`) : (console.error(`FAIL: ${label}`), failures++); }

check("documents preview route exists", route.includes("export async function"));
check("documents preview route is settlement document planning route", route.includes("settlement") || route.includes("Settlement"));
check("documents preview does not upload to Clio", !route.includes("uploadDocumentToClio"));
check("documents preview does not send email", !route.includes("sendMail"));
check("documents preview does not write print queue", !route.includes("documentPrintQueueItem.create"));
check("package script registered", pkg.includes("verify:local-settlement-documents-preview-safety"));
if (failures) process.exit(1);
console.log("PASS: local settlement documents preview safety passed.");
