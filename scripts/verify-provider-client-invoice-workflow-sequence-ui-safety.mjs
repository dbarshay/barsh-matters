import { execFileSync } from "node:child_process";

const focused = [
  "verify:provider-client-invoice-create-preview-safety",
  "verify:provider-client-invoice-step2-review-tables-safety",
  "verify:provider-client-invoice-cost-ledger-ui-safety",
  "verify:provider-client-invoice-cost-expended-reinvoice-safety",
  "verify:provider-client-invoice-finalize-safety",
];

console.log("=== VERIFY INVOICE UI SAFETY DELEGATED CONTRACT ===");
for (const script of focused) {
  if (script === process.env.SKIP_SELF) continue;
  console.log(`RUN_FOCUSED=${script}`);
  execFileSync("npm", ["run", script], { stdio: "inherit", env: { ...process.env, SKIP_SELF: script } });
}
console.log("PASS: invoice UI safety covered by current focused invoice verifiers.");
