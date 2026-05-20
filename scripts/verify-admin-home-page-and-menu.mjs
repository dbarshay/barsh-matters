#!/usr/bin/env node
import fs from "fs";

const adminHomePath = "app/admin/page.tsx";
const headerFiles = ["app/page.tsx", "app/matter/[id]/page.tsx", "app/matters/page.tsx"];

let failed = false;
function check(label, ok) {
  if (ok) console.log(`PASS: ${label}`);
  else {
    console.log(`FAIL: ${label}`);
    failed = true;
  }
}

const adminHome = fs.readFileSync(adminHomePath, "utf8");

check("admin home page exists", fs.existsSync(adminHomePath));
check("admin home marker exists", adminHome.includes('data-barsh-admin-home="true"'));
check("admin home links reference import", adminHome.includes("/admin/reference-data"));
check("admin home links audit history", adminHome.includes("/admin/audit-history"));
check("admin home links document templates", adminHome.includes("/admin/document-templates"));
check("admin home safety copy keeps print queue separate", adminHome.includes("Print Queue remains a separate"));

for (const file of headerFiles) {
  const text = fs.readFileSync(file, "utf8");
  check(`${file} has openAdminHome`, text.includes("function openAdminHome()"));
  check(`${file} admin menu includes Admin Home`, text.includes("🛠️ Admin Home"));
  check(`${file} admin home is gated`, text.includes("Open Administrator Home") && text.includes("runAdministratorGate"));
  check(`${file} keeps Administrator button`, text.includes("<span>Administrator</span>"));
  check(`${file} keeps Print Queue separate`, text.includes("<span>Print Queue</span>"));
}

if (failed) process.exit(1);
console.log("PASS: admin home page and menu verifier");
