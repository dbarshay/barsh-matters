import fs from "fs";

const file = "app/matter/[id]/page.tsx";
const text = fs.readFileSync(file, "utf8");

const required = [
  "function resolvedNumericMatterId()",
  "matter?.matterId",
  "matter?.matter_id",
  "matter?.id",
  "const numericMatterId = resolvedNumericMatterId();",
  "matterId: numericMatterId,",
  "matterDisplayNumber: textValue(matter?.displayNumber || matter?.display_number || matterId)",
];

const forbidden = [
  "matterId: Number(matterId),\n          matterDisplayNumber: textValue(matter?.displayNumber || matter?.display_number),",
];

let failed = false;

for (const needle of required) {
  if (!text.includes(needle)) {
    console.error(`FAIL: missing ${needle}`);
    failed = true;
  } else {
    console.log(`PASS: found ${needle}`);
  }
}

for (const needle of forbidden) {
  if (text.includes(needle)) {
    console.error(`FAIL: old numeric route-param identity save remains`);
    failed = true;
  } else {
    console.log("PASS: old numeric route-param identity save removed");
  }
}

if (failed) process.exit(1);

console.log("PASS: direct matter identity save uses resolved numeric matter id.");
