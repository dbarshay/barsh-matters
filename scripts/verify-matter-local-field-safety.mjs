import fs from "node:fs";

const identityPath = "app/api/matters/identity-field/route.ts";
const directPath = "app/api/matters/update-direct-field/route.ts";
const pagePath = "app/matter/[id]/page.tsx";

const identity = fs.readFileSync(identityPath, "utf8");
const direct = fs.readFileSync(directPath, "utf8");
const page = fs.readFileSync(pagePath, "utf8");

let failures = 0;
function check(label, ok) {
  if (ok) console.log(`PASS: ${label}`);
  else {
    failures += 1;
    console.error(`FAIL: ${label}`);
  }
}

check("identity field route exists", fs.existsSync(identityPath));
check("direct field route exists", fs.existsSync(directPath));
check("matter page exists", fs.existsSync(pagePath));
check("identity field route is local/non-Clio workflow", identity.includes("export async function") && !identity.includes("clioFetch("));
check("direct field route is local/non-Clio workflow", direct.includes("export async function") && !direct.includes("clioFetch("));
check("direct route touches local matter/claim data", /claimIndex|ClaimIndex|matterLocalField|MatterLocalField|local/i.test(direct));
check("matter page calls local field routes", page.includes("/api/matters/identity-field") || page.includes("/api/matters/update-direct-field"));
check("routes avoid Clio writes", !identity.includes("clioFetch(") && !direct.includes("clioFetch("));

if (failures) {
  console.error(`FAIL: matter local field safety failed (${failures})`);
  process.exit(1);
}
console.log("PASS: matter local field safety passed for current split local routes.");
