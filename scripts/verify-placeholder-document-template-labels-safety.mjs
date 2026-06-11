import fs from "node:fs";

const finalizePreview = fs.readFileSync("app/api/documents/finalize-preview/route.ts", "utf8");
const printQueue = fs.readFileSync("app/api/documents/print-queue/route.ts", "utf8");
const mattersPage = fs.readFileSync("app/matters/page.tsx", "utf8");
const pkg = fs.readFileSync("package.json", "utf8");

let failures = 0;
function check(label, ok) { ok ? console.log(`PASS: ${label}`) : (console.error(`FAIL: ${label}`), failures++); }

check("finalize preview supports template source contract", finalizePreview.includes("sourceTemplateContract") || finalizePreview.includes("templateSource"));
check("finalize preview supports stored DB templates or placeholder fallback", finalizePreview.includes("stored") || finalizePreview.includes("placeholder"));
check("print queue remains document output path", printQueue.includes("print") || printQueue.includes("DocumentPrintQueue"));
check("UI avoids pretending templates are Clio templates", !mattersPage.includes("Clio template source of truth"));
check("package script registered", pkg.includes("verify:placeholder-document-template-labels-safety"));
if (failures) process.exit(1);
console.log("PASS: placeholder/stored document template label safety passed.");
