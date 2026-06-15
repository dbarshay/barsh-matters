import { execFileSync } from "node:child_process";
import fs from "node:fs";

const packageJson = fs.readFileSync("package.json", "utf8");

function run(script) {
  console.log("RUN_FOCUSED=" + script);
  execFileSync("npm", ["run", script], { stdio: "inherit" });
}

function assertOk(condition, message) {
  if (!condition) {
    console.error("FAIL: " + message);
    process.exit(1);
  }
  console.log("PASS: " + message);
}

console.log("=== VERIFY SETTLEMENT POPUP DRAGGABLE SAFETY DELEGATED CURRENT CONTRACT ===");
console.log("The settlement popup is now locked as a standard non-draggable modal; this stale verifier delegates to the current focused standard-modal and settlement-layout verifiers.");

run("verify:master-settlement-popup-safety");
run("verify:settlement-popup-column-entry-safety");

assertOk(packageJson.includes("\"verify:settlement-popup-draggable-safety\""), "package script registered");

console.log("=== SETTLEMENT POPUP DRAGGABLE SAFETY DELEGATED CURRENT CONTRACT PASSED ===");
