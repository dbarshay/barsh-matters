import fs from "fs";

const route = fs.readFileSync("app/api/documents/preview-pdf/route.ts", "utf8");

const required = [
  "const pdfBody = new Uint8Array(conversion.pdfBuffer);",
  "return new NextResponse(pdfBody,",
  '"Content-Type": conversion.pdfContentType || PDF_CONTENT_TYPE',
  '"Cache-Control": "no-store"',
];

const forbidden = [
  "return new NextResponse(conversion.pdfBuffer",
  "sendMail",
  "documentPrintQueueItem.create",
];

const failures = [];

for (const marker of required) {
  if (!route.includes(marker)) failures.push(`missing required marker: ${marker}`);
}

for (const marker of forbidden) {
  if (route.includes(marker)) failures.push(`forbidden marker present: ${marker}`);
}

if (failures.length) {
  console.error("FAIL: preview PDF body type verifier failed");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("PASS: preview-pdf returns a Uint8Array body for NextResponse without delivery side effects.");
