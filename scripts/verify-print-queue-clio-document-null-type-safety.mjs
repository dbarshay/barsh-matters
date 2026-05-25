import fs from "fs";

const route = fs.readFileSync("app/api/documents/print-queue/route.ts", "utf8");

const required = [
  "let byFilename: any | null = byId",
  "verifyClioDocumentById",
  "if (!byFilename && clioDocumentId)",
];

const forbidden = [
  "let byFilename: ClioMatterDocument",
  "documentPrintQueueItem.deleteMany",
  "sendMail",
  "graph.microsoft.com",
];

const failures = [];

for (const marker of required) {
  if (!route.includes(marker)) failures.push(`missing required marker: ${marker}`);
}

for (const marker of forbidden) {
  if (route.includes(marker)) failures.push(`forbidden marker present: ${marker}`);
}

if (failures.length) {
  console.error("FAIL: print queue Clio document nullable type verifier failed");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("PASS: print queue Clio document lookup allows nullable verification fallback without side effects.");
