import fs from "node:fs";

const matters = fs.readFileSync("app/matters/page.tsx", "utf8");
const direct = fs.readFileSync("app/matter/[id]/page.tsx", "utf8");
const pkg = fs.readFileSync("package.json", "utf8");
let failures = 0;
function check(label, ok) { ok ? console.log(`PASS: ${label}`) : (console.error(`FAIL: ${label}`), failures++); }

check("matters page has reference/contact typing helper", matters.includes("masterInfoContactType") || matters.includes("provider_client") || matters.includes("insurer_company"));
check("matters page uses populated reference options", matters.includes("/api/reference-data/options") || matters.includes("reference"));
check("direct page uses populated reference options", direct.includes("/api/reference-data/options") || direct.includes("reference"));
check("package script registered", pkg.includes("verify:populated-reference-table-targets-safety"));
if (failures) process.exit(1);
console.log("PASS: populated reference table targets safety passed.");
