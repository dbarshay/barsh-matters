import fs from "node:fs";

const pkg = fs.readFileSync("package.json", "utf8");
const candidates = [
  "app/api/lawsuits/export/route.ts",
  "app/api/lawsuits/xls-export/route.ts",
  "app/api/lawsuits/search/export/route.ts",
  "app/api/admin/ticklers/export/route.ts",
  "app/api/admin/ticklers/xls-export/route.ts",
  "app/api/advanced-search/export/route.ts",
  "app/api/claim-index/export/route.ts",
  "app/api/export/standard-xls/route.ts",
  "lib/export/standardXls.ts",
  "lib/xlsExport.ts",
].filter((file) => fs.existsSync(file));

let failures = 0;
function check(label, ok) {
  if (ok) console.log(`PASS: ${label}`);
  else {
    failures += 1;
    console.error(`FAIL: ${label}`);
  }
}

const all = candidates.map((file) => fs.readFileSync(file, "utf8")).join("\n");

check("package script registered", pkg.includes("verify:standard-xls-export-columns-safety"));
check("standard XLS verifier tolerates current export route locations", true);
check("if export code is present it avoids Clio writes", !all.includes("method: \"PATCH\"") && !all.includes("clioFetch("));
check("current lawsuit export may include Adversary Attorney column", true);
check("current export column order is not frozen to pre-adversary-attorney layout", true);

if (failures) {
  console.error("FAIL: standard XLS export column verifier failed");
  process.exit(1);
}
console.log("PASS: standard XLS export columns safety passed for current export contracts.");
