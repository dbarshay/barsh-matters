import fs from "fs";

const file = "app/matter/[id]/page.tsx";
const text = fs.readFileSync(file, "utf8");

const required = [
  "function localTreatingProviderName(): string {",
  "textValue(claimIndexTreatingProviderField?.fieldValue) ||",
  "textValue(matter?.treatingProvider || matter?.treating_provider)",
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

if (failed) process.exit(1);

console.log("PASS: direct treating provider display falls back to matter state.");
