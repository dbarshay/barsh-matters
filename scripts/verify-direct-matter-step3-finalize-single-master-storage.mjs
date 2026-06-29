import fs from "fs";

const page = fs.readFileSync("app/matter/[id]/page.tsx", "utf8");
const start = page.indexOf("async function finalizeMatterDocumentFromStep2");
const endCandidates = [
  page.indexOf("\n  async function ", start + 10),
  page.indexOf("\n  function ", start + 10),
].filter((index) => index > start);
const end = endCandidates.length ? Math.min(...endCandidates) : page.length;
const block = page.slice(start, end);

let failed = false;
function pass(message) { console.log("PASS:", message); }
function fail(message) { failed = true; console.error("FAIL:", message); }
function has(label, token) { block.includes(token) ? pass(label) : fail(`${label} missing ${token}`); }

has("Step 3 finalize posts to finalize route", 'const res = await fetch("/api/documents/finalize"');
has("Step 3 finalize confirms upload", "confirmUpload: true,");
has("Step 3 finalize is direct matter mode", 'uploadTargetMode: "direct-matter",');
has("Step 3 finalize uses single-master Clio storage", "useSingleMasterClioStorage: true,");
has("Step 3 finalize is not dry run", "singleMasterDryRun: false,");
has("Step 3 finalize resolves direct folders", "singleMasterResolveFolders: true,");
has("Step 3 finalize sends normalized direct matter display number", "directMatterDisplayNumber,");
has("Step 3 finalize sends directMatterIdForRequest", "directMatterId: directMatterIdForRequest,");
has("Step 3 finalize sends working document drive item", "workingDocumentDriveItemId,");

console.log("RESULT: direct matter Step 3 finalize single-master storage verifier");
if (failed) process.exit(1);
