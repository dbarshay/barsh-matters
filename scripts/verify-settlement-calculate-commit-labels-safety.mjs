import { execFileSync } from "node:child_process";

const focused = [
  "verify:local-first-settlement-preview-ui-safety",
  "verify:local-settlement-record-save-safety",
  "verify:local-settlement-history-safety",
  "verify:settlement-percent-normalization-safety",
  "verify:settlement-popup-column-entry-safety",
  "verify:settlement-document-workflow-ui-safety",
];

console.log("=== VERIFY SETTLEMENT SAFETY DELEGATED CURRENT CONTRACT ===");
for (const script of focused) {
  if (script === process.env.SKIP_SELF) continue;
  console.log(`RUN_FOCUSED=${script}`);
  execFileSync("npm", ["run", script], {
    stdio: "inherit",
    env: { ...process.env, SKIP_SELF: script },
  });
}
console.log("PASS: settlement safety covered by current focused settlement verifiers.");
