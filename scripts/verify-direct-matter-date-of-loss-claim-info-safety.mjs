import fs from "fs";

const page = fs.readFileSync("app/matter/[id]/page.tsx", "utf8");
const route = fs.readFileSync("app/api/matters/identity-field/route.ts", "utf8");
const failures = [];

const claimNumberIndex = page.indexOf("<span>Claim Number</span>");
const dateOfLossIndex = page.indexOf("<span>Date of Loss</span>", claimNumberIndex);
const claimAmountIndex = page.indexOf("<span>Claim Amount</span>", claimNumberIndex);

if (claimNumberIndex < 0) failures.push("Claim Number card not found on direct matter page");
if (dateOfLossIndex < 0) failures.push("Date of Loss card not found after Claim Number on direct matter page");
if (claimAmountIndex < 0) failures.push("Claim Amount card not found after Claim Number on direct matter page");
if (claimNumberIndex >= 0 && dateOfLossIndex >= 0 && claimAmountIndex >= 0 && !(claimNumberIndex < dateOfLossIndex && dateOfLossIndex < claimAmountIndex)) {
  failures.push("Date of Loss must be located after Claim Number and before Claim Amount");
}

const claimNumberColumnClose = page.indexOf('\n              </div>\n\n              <div className="barsh-direct-summary-column"', claimNumberIndex);
if (claimNumberColumnClose < 0) failures.push("Could not find end of Claim Number visual column");
if (claimNumberColumnClose >= 0 && !(claimNumberIndex < dateOfLossIndex && dateOfLossIndex < claimNumberColumnClose)) {
  failures.push("Date of Loss must be inside the same visual column as Claim Number");
}

for (const token of [
  'openIdentityFieldEditDialog("date_of_loss")',
  'formatDate(matter?.dateOfLoss || matter?.date_of_loss) || "—"',
  'href={`/matters?dateOfLoss=${encodeURIComponent',
  'style={identityEditButtonStyle}',
  'if (field === "date_of_loss") return textValue(matter?.dateOfLoss || matter?.date_of_loss);',
  'dateOfLoss: value,',
  'date_of_loss: value,',
]) {
  if (!page.includes(token)) failures.push(`direct matter page missing ${token}`);
}

for (const token of [
  '| "date_of_loss"',
  'date_of_loss: { fieldName: "date_of_loss", label: "Date of Loss" }',
  'date_of_loss: true',
  'if (fieldName === "date_of_loss") return textValue(claimIndex?.date_of_loss);',
  'if (config.fieldName === "date_of_loss")',
  'date_of_loss: nextValue || null',
]) {
  if (!route.includes(token)) failures.push(`identity-field route missing ${token}`);
}

if (failures.length) {
  console.error("FAIL: direct matter Date of Loss Claim Information safety");
  for (const failure of failures) console.error("- " + failure);
  process.exit(1);
}

console.log("PASS: direct matter Date of Loss Claim Information safety");
