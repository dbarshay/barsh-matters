import { execFileSync } from "node:child_process";
import fs from "node:fs";

const route = fs.readFileSync("app/api/settlements/local-void/route.ts", "utf8");
const page = fs.readFileSync("app/matters/page.tsx", "utf8");
const packageJson = fs.readFileSync("package.json", "utf8");

let failures = 0;
function pass(message) { console.log("PASS: " + message); }
function fail(message) { failures += 1; console.error("FAIL: " + message); }
function mustContain(label, text, token) { text.includes(token) ? pass(label) : fail(label + " missing " + token); }
function mustNotContain(label, text, token) { !text.includes(token) ? pass(label) : fail(label + " must not contain " + token); }
function run(script) { console.log("RUN_FOCUSED=" + script); execFileSync("npm", ["run", script], { stdio: "inherit" }); }

console.log("=== VERIFY SETTLEMENT VOID CURRENT ADMIN FLOW SAFETY ===");

mustContain("void route file is local settlement void endpoint", route, "confirmVoid");
mustContain("void route updates LocalSettlementRecord as voided", route, "localSettlementRecord.update");
mustContain("void route records voidedAt", route, "voidedAt");
mustNotContain("void route does not delete settlement rows with deleteMany", route, "localSettlementRow.deleteMany");
mustNotContain("void route does not delete settlement records", route, "localSettlementRecord.delete");
mustNotContain("void route does not call Clio", route, "clioFetch");

mustContain("Settlement Already Recorded button opens admin void flow", page, "openVoidActiveSettlementAdminFlow");
mustContain("shared settlement launcher conditionally opens void or record flow", page, "masterHasActiveRecordedSettlement");
mustContain("void UI calls local-void route", page, "/api/settlements/local-void");
mustContain("void UI sends current master lawsuit id", page, "currentMasterLawsuitId");
mustContain("package script registered", packageJson, "\"verify:settlement-void-safety\"");

run("verify:settlement-void-deletes-payment-due-tickler-safety");

if (failures) {
  console.error("Settlement void safety verifier failed: " + failures + " check(s).");
  process.exit(1);
}

console.log("Settlement void current admin flow safety verifier passed.");
