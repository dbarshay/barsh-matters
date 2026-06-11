import fs from "node:fs";

const routePath = "app/api/settlements/local-provider-fee-defaults/route.ts";
const pagePath = "app/matters/page.tsx";
const route = fs.readFileSync(routePath, "utf8");
const page = fs.readFileSync(pagePath, "utf8");
const pkg = fs.readFileSync("package.json", "utf8");

let failures = 0;
function check(label, ok) {
  if (ok) console.log(`PASS: ${label}`);
  else {
    failures += 1;
    console.error(`FAIL: ${label}`);
  }
}

check("route action exists", route.includes('action: "local-provider-fee-defaults"'));
check("route uses provider client reference type", route.includes('type: "provider_client"') || route.includes("provider_client"));
check("route references principal retainer default", route.includes("Retainer Principal NF"));
check("route references interest retainer default", route.includes("Retainer Interest"));
check("route reports no Clio change", route.includes("clioRecordsChanged: false"));
check("route reports no database change", route.includes("databaseRecordsChanged: false"));
check("route avoids Clio reads/writes", !route.includes("clioFetch(") && !route.includes("writeSettlementToClio"));
check("route avoids ClaimIndex mutation", !route.includes("prisma.claimIndex.update"));
check("UI loads provider fee defaults", page.includes("masterSettlementProviderFeeDefaults") && page.includes("loadMasterSettlementProviderFeeDefaults"));
check("UI calls local provider fee defaults endpoint", page.includes("/api/settlements/local-provider-fee-defaults"));
check("UI shows fee defaults source", page.includes("Fee defaults source:"));
check("UI includes payment due date", page.includes("Payment Due Date"));
check("package script registered", pkg.includes("verify:settlement-provider-fee-defaults-local-ui-safety"));

if (failures) {
  console.error(`FAIL: settlement provider fee defaults safety failed (${failures})`);
  process.exit(1);
}
console.log("PASS: settlement provider fee defaults local UI safety passed.");
