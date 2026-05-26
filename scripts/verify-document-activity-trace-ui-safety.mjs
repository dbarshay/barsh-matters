import fs from "fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS: ${message}`);
  }
}

const historyRoute = read("app/api/documents/finalization-history/route.ts");
const masterPage = read("app/matters/page.tsx");

assert(historyRoute.includes("function finalizationActivityLabel"), "finalization history has explicit activity label helper");
assert(historyRoute.includes("Uploaded ${uploaded}"), "finalization activity label includes uploaded count");
assert(historyRoute.includes("Skipped ${skipped} duplicate"), "finalization activity label includes skipped duplicate count");
assert(historyRoute.includes("Target ${target}"), "finalization activity label includes target Clio matter");
assert(historyRoute.includes("trace: finalizationActivityTrace(row)"), "finalization history events include trace metadata");
assert(historyRoute.includes("uploadedCount"), "trace metadata includes uploadedCount");
assert(historyRoute.includes("skippedCount"), "trace metadata includes skippedCount");
assert(historyRoute.includes("requestedKeys"), "trace metadata includes requestedKeys");
assert(historyRoute.includes("clioUploadTarget"), "trace metadata includes clioUploadTarget");
assert(masterPage.includes("Document Activity"), "master page still exposes Document Activity UI");
assert(masterPage.includes("/api/documents/finalization-history"), "master page still reads finalization-history endpoint");

if (process.exitCode) {
  console.error("Document Activity trace UI safety verification failed.");
  process.exit(process.exitCode);
}

console.log("Document Activity trace UI safety verification passed.");
