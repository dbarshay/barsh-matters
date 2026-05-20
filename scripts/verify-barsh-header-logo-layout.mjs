#!/usr/bin/env node
import fs from "fs";

const checks = [];

function add(label, ok) {
  checks.push([label, ok]);
}

const landing = fs.readFileSync("app/page.tsx", "utf8");
const master = fs.readFileSync("app/matters/page.tsx", "utf8");
const matter = fs.readFileSync("app/matter/[id]/page.tsx", "utf8");

add("landing right wrapper widened", landing.includes("width: 520") && landing.includes("height: 132"));
add("landing action row offset clears logo", landing.includes("right: 304"));
add("landing logo link absolute", landing.includes('width: 292') && landing.includes('height: 132') && landing.includes("flexShrink: 0"));
add("landing logo min width preserved", landing.includes("minWidth: 292"));

add("master right wrapper widened", master.includes("width: 560") && master.includes("height: 152"));
add("master action row offset clears logo", master.includes("right: 342"));
add("master logo link absolute", master.includes('width: 330') && master.includes('height: 152') && master.includes("flexShrink: 0"));
add("master logo min width preserved", master.includes("minWidth: 330"));

add("matter right wrapper widened", matter.includes("width: 560") && matter.includes("height: 152"));
add("matter action row offset clears logo", matter.includes("right: 342"));
add("matter logo link absolute", matter.includes('width: 330') && matter.includes('height: 152') && matter.includes("flexShrink: 0"));
add("matter logo min width preserved", matter.includes("minWidth: 330"));

add("administrator menu still present", landing.includes("<span>Administrator</span>") && master.includes("<span>Administrator</span>") && matter.includes("<span>Administrator</span>"));
add("print queue still separate", landing.includes("<span>Print Queue</span>") && master.includes("<span>Print Queue</span>") && matter.includes("<span>Print Queue</span>"));

let failed = false;
for (const [label, ok] of checks) {
  if (ok) console.log(`PASS: ${label}`);
  else {
    console.log(`FAIL: ${label}`);
    failed = true;
  }
}

if (failed) process.exit(1);
console.log("PASS: Barsh Matters header logo layout verifier");
