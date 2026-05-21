import fs from "node:fs";

const files = [
  "app/page.tsx",
  "app/matter/[id]/page.tsx",
  "app/matters/page.tsx",
];

let failed = false;

function check(label, ok) {
  if (ok) {
    console.log(`PASS: ${label}`);
  } else {
    failed = true;
    console.error(`FAIL: ${label}`);
  }
}

for (const file of files) {
  const text = fs.readFileSync(file, "utf8");
  const openMatch = text.match(/function openAdministratorMenu\(\) \{[\s\S]*?\n  \}/);
  const openBlock = openMatch?.[0] || "";

  check(`${file} keeps Administrator header button`, text.includes("<span>Administrator</span>"));
  check(`${file} Administrator button uses openAdministratorMenu`, text.includes("onClick={openAdministratorMenu}"));
  check(`${file} Administrator button is gated`, openBlock.includes("runAdministratorGate"));
  check(`${file} Administrator gate says Open Administrator Home`, openBlock.includes('"Open Administrator Home"'));
  check(`${file} Administrator routes directly to /admin`, openBlock.includes('window.location.href = "/admin"'));

  check(`${file} removed administrator dropdown state`, !text.includes("administratorMenuOpen"));
  check(`${file} removed menu setter`, !text.includes("setAdministratorMenuOpen"));
  check(`${file} removed menu-gate wording`, !text.includes('"Open Administrator Menu"'));

  check(`${file} no header Import dropdown item`, !text.includes("🔐 Import"));
  check(`${file} no header Templates dropdown item`, !text.includes("📄 Templates"));
  check(`${file} no header Admin Home dropdown item`, !text.includes("🛠️ Admin Home"));

  // Do not ban all Audit / History text because matter/master pages still have legitimate
  // matter-specific audit popup headings and workspace labels.
  check(`${file} no Audit / History dropdown button`, !text.includes("📜 Audit / History</button>"));
}

const adminHome = fs.readFileSync("app/admin/page.tsx", "utf8");
check("Admin Home still links Reference Data Import", adminHome.includes("/admin/reference-data"));
check("Admin Home still links Audit / History", adminHome.includes("/admin/audit-history"));
check("Admin Home still links Document Templates", adminHome.includes("/admin/document-templates"));
check("Admin Home still states Print Queue is separate", adminHome.includes("Print Queue remains a separate header function"));

if (failed) {
  process.exit(1);
}

console.log("PASS: Administrator header opens Admin Home only");
