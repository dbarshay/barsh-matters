#!/usr/bin/env node
import fs from "fs";

const files = [
  "app/page.tsx",
  "app/matter/[id]/page.tsx",
  "app/matters/page.tsx",
];

const authRoute = fs.readFileSync("app/api/admin/authorize/route.ts", "utf8");
const proxy = fs.readFileSync("proxy.ts", "utf8");

let failed = false;

function check(label, ok) {
  if (ok) console.log(`PASS: ${label}`);
  else {
    console.log(`FAIL: ${label}`);
    failed = true;
  }
}

for (const file of files) {
  const text = fs.readFileSync(file, "utf8");
  check(`${file} has Administrator button`, text.includes("<span>Administrator</span>"));
  check(`${file} has admin menu marker`, text.includes('data-barsh-administrator-menu="true"'));
  check(`${file} keeps Print Queue separate`, text.includes("<span>Print Queue</span>"));
  check(`${file} has admin gate function`, text.includes("runAdministratorGate"));
  check(`${file} calls admin authorize API`, text.includes("/api/admin/authorize"));
  check(`${file} has Import in admin menu`, text.includes(">🔐 Import<") || text.includes("🔐 Import"));
  check(`${file} has Templates in admin menu`, text.includes(">📄 Templates<") || text.includes("📄 Templates"));
}

const landing = fs.readFileSync("app/page.tsx", "utf8");
const matter = fs.readFileSync("app/matter/[id]/page.tsx", "utf8");
const master = fs.readFileSync("app/matters/page.tsx", "utf8");

check("matter page has Audit / History in admin menu", matter.includes("📜 Audit / History"));
check("master page has Audit / History in admin menu", master.includes("📜 Audit / History"));
check("landing page does not expose standalone Audit / History button", !landing.includes("<span>Audit / History</span>"));

check("admin auth route checks BARSH_ADMIN_PASSWORD", authRoute.includes("BARSH_ADMIN_PASSWORD"));
check("admin auth route sets httpOnly cookie", authRoute.includes("httpOnly: true"));
check("admin auth route sets admin cookie", authRoute.includes("barsh_admin_gate"));
check("proxy protects /admin routes", proxy.includes('matcher: ["/admin/:path*"]'));
check("proxy checks admin cookie", proxy.includes("barsh_admin_gate"));
check("proxy redirects unauthorized admin", proxy.includes("NextResponse.redirect"));
check("proxy exports proxy function", proxy.includes("export function proxy("));

if (failed) process.exit(1);
console.log("PASS: administrator header menu gate verifier");
