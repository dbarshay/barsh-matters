import { execFileSync } from "node:child_process";
import fs from "node:fs";

const requiredFiles = [
  "prisma/schema.prisma",
  "app/admin/page.tsx",
  "app/admin/clients/page.tsx",
  "app/admin/clients/[id]/page.tsx",
  "app/admin/clients/[id]/invoice/page.tsx",
  "app/api/admin/clients/route.ts",
  "app/api/admin/clients/[id]/route.ts",
];

for (const file of requiredFiles) {
  if (!fs.existsSync(file)) {
    console.error(`FAIL: missing required file ${file}`);
    process.exit(1);
  }
}

const focusedVerifiers = [
  "verify:admin-client-remittance-source-safety",
  "verify:provider-client-invoice-create-preview-safety",
  "verify:provider-client-invoice-step2-review-tables-safety",
  "verify:provider-client-invoice-cost-ledger-ui-safety",
  "verify:provider-client-invoice-cost-expended-reinvoice-safety",
  "verify:provider-client-notes-add-edit-delete-safety",
  "verify:provider-client-notes-header-actions-safety",
  "verify:provider-client-display-normalization-safety",
  "verify:provider-client-hub-page-polish-safety",
];

console.log("=== VERIFY ADMIN CLIENTS INTERFACE SAFETY ===");
console.log("This broad verifier delegates to current focused provider/client invoice, remittance, notes, hub, and display verifiers.");

for (const script of focusedVerifiers) {
  console.log(`RUN_FOCUSED=${script}`);
  execFileSync("npm", ["run", script], { stdio: "inherit" });
}

console.log("PASS: Admin Clients interface safety is covered by current focused verifiers.");
