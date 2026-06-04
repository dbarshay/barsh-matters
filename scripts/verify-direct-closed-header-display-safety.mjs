#!/usr/bin/env node
import fs from "node:fs";

const page = fs.readFileSync("app/matter/[id]/page.tsx", "utf8");
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));

function pass(label) {
  console.log(`PASS: ${label}`);
}

function fail(label) {
  console.error(`FAIL: ${label}`);
  process.exitCode = 1;
}

console.log("RESULT: verify direct closed header display safety");

if (page.includes('function directMatterFinalStatusDisplayValue(): "Open" | "Closed"')) {
  pass("direct matter has Open/Closed display helper");
} else {
  fail("direct matter has Open/Closed display helper");
}

if (page.includes("function directMatterIsClosedForDisplay(): boolean")) {
  pass("direct matter has closed display boolean helper");
} else {
  fail("direct matter has closed display boolean helper");
}

const headerStart = page.indexOf("matterIsClosedForPayment() ? \"#dc2626\" : \"#16a34a\"");
const masterPillIndex = page.indexOf("MASTER LAWSUIT ID:");
const headerWindow =
  headerStart >= 0 && masterPillIndex >= 0
    ? page.slice(headerStart, masterPillIndex + 2200)
    : "";

if (masterPillIndex >= 0) {
  pass("direct header has Master Lawsuit ID pill");
} else {
  fail("direct header has Master Lawsuit ID pill");
}

if (
  headerWindow.includes("directMatterIsClosedForDisplay()") &&
  headerWindow.includes("#fef2f2") &&
  headerWindow.includes("#dcfce7")
) {
  pass("direct Master Lawsuit ID pill background is closed-aware");
} else {
  fail("direct Master Lawsuit ID pill background is closed-aware");
}

if (
  headerWindow.includes("directMatterIsClosedForDisplay()") &&
  headerWindow.includes("#fecaca") &&
  headerWindow.includes("#86efac")
) {
  pass("direct Master Lawsuit ID pill border is closed-aware");
} else {
  fail("direct Master Lawsuit ID pill border is closed-aware");
}

if (
  headerWindow.includes("directMatterIsClosedForDisplay()") &&
  headerWindow.includes("#991b1b") &&
  headerWindow.includes("#166534")
) {
  pass("direct Master Lawsuit ID pill text is closed-aware");
} else {
  fail("direct Master Lawsuit ID pill text is closed-aware");
}

if (pkg.scripts?.["verify:direct-closed-header-display-safety"] === "node scripts/verify-direct-closed-header-display-safety.mjs") {
  pass("package.json registers verify:direct-closed-header-display-safety");
} else {
  fail("package.json registers verify:direct-closed-header-display-safety");
}

if (process.exitCode) {
  console.error("FAILURES=1");
  process.exit(1);
}

console.log("FAILURES=0");
