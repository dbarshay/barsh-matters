#!/usr/bin/env node
import fs from "fs";

const files = [
  "app/page.tsx",
  "app/matter/[id]/page.tsx",
  "app/matters/page.tsx",
];

let failed = false;

function check(label, ok) {
  if (ok) console.log(`PASS: ${label}`);
  else {
    console.log(`FAIL: ${label}`);
    failed = true;
  }
}

function menuBlock(text) {
  const marker = 'data-barsh-administrator-menu="true"';
  const markerIndex = text.indexOf(marker);
  if (markerIndex === -1) return "";
  const start = text.lastIndexOf("<div", markerIndex);
  const end = text.indexOf("</div>", markerIndex);
  return start >= 0 && end >= 0 ? text.slice(start, end + "</div>".length) : "";
}

for (const file of files) {
  const text = fs.readFileSync(file, "utf8");
  const menu = menuBlock(text);

  check(`${file} has Administrator button gate`, text.includes("function openAdministratorMenu()") && text.includes("Open Administrator Menu") && text.includes("runAdministratorGate"));
  check(`${file} has administrator menu block`, menu.includes('data-barsh-administrator-menu="true"'));
  check(`${file} menu has Admin Home`, menu.includes("🛠️ Admin Home"));
  check(`${file} menu has Import`, menu.includes("🔐 Import"));
  check(`${file} menu has Audit / History`, menu.includes("📜 Audit / History"));
  check(`${file} menu has Templates`, menu.includes("📄 Templates"));
  check(`${file} Admin Home menu item direct navigates`, menu.includes('window.location.href = "/admin"'));
  check(`${file} Import menu item direct navigates`, menu.includes('window.location.href = "/admin/reference-data"'));
  check(`${file} Templates menu item direct navigates`, menu.includes('window.location.href = "/admin/document-templates"'));
  check(`${file} menu items do not call gated opener functions`, !menu.includes("openAdminHome") && !menu.includes("openReferenceImportsAdmin") && !menu.includes("openDocumentTemplatesAdmin") && !menu.includes("runAdministratorGate"));
}

const landing = fs.readFileSync("app/page.tsx", "utf8");
const matter = fs.readFileSync("app/matter/[id]/page.tsx", "utf8");
const master = fs.readFileSync("app/matters/page.tsx", "utf8");

check("landing Audit menu item routes to admin audit page", menuBlock(landing).includes('window.location.href = "/admin/audit-history"'));
check("matter Audit menu item opens matter audit popup directly", menuBlock(matter).includes("setMatterAuditHistoryPopupOpen(true)") && menuBlock(matter).includes("loadMatterAuditHistory()"));
check("master Audit menu item opens master audit popup directly", menuBlock(master).includes("setMasterAuditHistoryOpen(true)") && menuBlock(master).includes("loadMasterAuditHistory()"));

if (failed) process.exit(1);
console.log("PASS: administrator menu items direct after gate verifier");
