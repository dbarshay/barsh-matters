import fs from "fs";

const home = fs.readFileSync("app/page.tsx", "utf8");
const lawsuits = fs.readFileSync("app/lawsuits/page.tsx", "utf8");
const pkg = fs.readFileSync("package.json", "utf8");

function assert(ok, msg) {
  if (!ok) throw new Error(msg);
}

assert(home.includes("/api/claim-index") || home.includes("search"), "home page should retain local search wiring.");
assert(lawsuits.includes("/api/") || lawsuits.includes("fetch("), "lawsuits page should retain local route wiring.");
assert(!home.includes("clioFetch("), "home search must not call Clio.");
assert(!lawsuits.includes("clioFetch("), "lawsuits page must not call Clio.");
assert(pkg.includes("verify:local-search-and-lawsuits-routing-safety"), "package script must remain registered.");

console.log("RESULT: local search and lawsuits routing safety");
console.log("RUNTIME_CHECK_SKIPPED=static_verifier_only");
console.log("WRITES_CLIO=false");
console.log("PASS: local search and lawsuits routing static safety passed.");
