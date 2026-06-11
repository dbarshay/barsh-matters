import fs from "fs";
const page = fs.readFileSync("app/matters/page.tsx", "utf8");
const pkg = fs.readFileSync("package.json", "utf8");

let failures = 0;
function check(label, ok) { ok ? console.log(`PASS: ${label}`) : (console.error(`FAIL: ${label}`), failures++); }

check("settlement history state/UI exists", page.includes("Settlement") && page.includes("History"));
check("local settlement record/readback references exist", page.includes("LocalSettlement") || page.includes("localSettlement") || page.includes("settlementRecord"));
check("provider net data exists", page.includes("providerNetTotal") || page.includes("Provider Net"));
check("no Clio write in page", !page.includes("writeSettlementToClio"));
check("package script registered", pkg.includes("verify:local-settlement-history-ui-safety"));
if (failures) process.exit(1);
console.log("PASS: local settlement history UI safety passed.");
