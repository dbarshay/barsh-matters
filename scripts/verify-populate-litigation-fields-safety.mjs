import fs from "fs";

// Populate empty Date Filed / Index Number on an existing matter's lawsuit — the one allowed write,
// ONLY when the field is currently blank (reference-value rule: scans never override existing values).
let failed = false;
function check(file, needles) {
  const text = fs.readFileSync(file, "utf8");
  for (const n of needles) {
    if (!text.includes(n)) {
      console.error(`FAIL: ${file} missing: ${n}`);
      failed = true;
    } else {
      console.log(`PASS: ${file} has: ${n}`);
    }
  }
}

// 1. Helper only writes blank fields (guarded by blank() checks) and never fails filing.
check("lib/documents/populateLitigationFields.ts", [
  "function blank(",
  "if (idx && blank(lawsuit.indexAaaNumber))",
  "if (filed && blank(options.dateFiled))",
  'reason: "already-populated"',
  "db.lawsuit.update({ where: { masterLawsuitId }, data })",
  "populate-from-scan",
]);

// 2. Upload commit invokes it ONLY when the operator confirmed, best-effort AFTER filing.
check("app/api/documents/upload/route.ts", [
  "import { populateEmptyLawsuitLitigationFields }",
  "const confirmPopulateLitigation = body?.confirmPopulateLitigation === true",
  "if (confirmPopulateLitigation) {",
  "await populateEmptyLawsuitLitigationFields(prisma, {",
]);

// 3. Upload page requires an operator checkbox and sends the confirm flag.
check("app/admin/documents/upload/page.tsx", [
  "confirmPopulateLit",
  'type="checkbox"',
  "confirmPopulateLitigation: confirmPopulateLit",
]);

if (failed) process.exit(1);
console.log("PASS: litigation Date Filed / Index Number populate-empty is wired and blank-guarded.");
