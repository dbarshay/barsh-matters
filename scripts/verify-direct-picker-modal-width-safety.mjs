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

console.log("RESULT: verify direct picker modal width safety");

const selectAnchor = `value={directPicklistInputValue(directFieldEditModal)}`;
const selectIndex = page.indexOf(selectAnchor);
const selectWindow = selectIndex >= 0 ? page.slice(selectIndex, selectIndex + 650) : "";

if (
  selectWindow.includes('width: "100%"') &&
  selectWindow.includes('maxWidth: "100%"') &&
  selectWindow.includes('boxSizing: "border-box"')
) {
  pass("direct picker select has width/maxWidth/boxSizing safety");
} else {
  fail("direct picker select has width/maxWidth/boxSizing safety");
}

if (page.includes('openPicklistEditDialog("finalStatus")') || page.includes('openPicklistEditDialog("closedReason")')) {
  fail("Final Status / Closed Reason must remain non-editable from direct picker modal");
} else {
  pass("Final Status / Closed Reason remain non-editable from direct picker modal");
}

if (pkg.scripts?.["verify:direct-picker-modal-width-safety"] === "node scripts/verify-direct-picker-modal-width-safety.mjs") {
  pass("package.json registers verify:direct-picker-modal-width-safety");
} else {
  fail("package.json registers verify:direct-picker-modal-width-safety");
}

if (process.exitCode) {
  console.error("FAILURES=1");
  process.exit(1);
}

console.log("FAILURES=0");
