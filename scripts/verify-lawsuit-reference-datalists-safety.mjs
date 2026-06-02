import fs from "fs";

const file = "app/lawsuits/page.tsx";
const text = fs.readFileSync(file, "utf8");

const required = [
  'fetch("/api/reference-data/options?type=provider_client"',
  'fetch("/api/reference-data/options?type=insurer_company"',
  'list="barsh-lawsuit-provider-reference-options"',
  'list="barsh-lawsuit-insurer-reference-options"',
  'id="barsh-lawsuit-provider-reference-options"',
  'id="barsh-lawsuit-insurer-reference-options"',
  "providerReferenceOptions.map",
  "insurerReferenceOptions.map",
];

const forbidden = [
  '<input placeholder="Provider" value={provider} onChange={(e) => setProvider(e.target.value)} style={input} />',
  '<input placeholder="Insurer" value={insurer} onChange={(e) => setInsurer(e.target.value)} style={input} />',
];

let failed = false;

for (const needle of required) {
  if (!text.includes(needle)) {
    console.error(`FAIL: missing required lawsuit reference datalist wiring: ${needle}`);
    failed = true;
  } else {
    console.log(`PASS: found ${needle}`);
  }
}

for (const needle of forbidden) {
  if (text.includes(needle)) {
    console.error(`FAIL: plain free-text lawsuit reference input still present: ${needle}`);
    failed = true;
  } else {
    console.log(`PASS: plain free-text input removed: ${needle}`);
  }
}

if (failed) process.exit(1);

console.log("PASS: lawsuit provider/insurer filters use local reference datalists.");
