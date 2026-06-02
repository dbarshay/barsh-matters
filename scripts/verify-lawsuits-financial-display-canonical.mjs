#!/usr/bin/env node

import fs from "fs";

const file = "app/lawsuits/page.tsx";
const src = fs.readFileSync(file, "utf8");

const failures = [];

function requireIncludes(label, needle) {
  if (!src.includes(needle)) {
    failures.push(`${label}: missing ${needle}`);
  }
}

function requireNotIncludes(label, needle) {
  if (src.includes(needle)) {
    failures.push(`${label}: forbidden ${needle}`);
  }
}

requireIncludes(
  "payment display canonical priority",
  'return moneyValue(val(m, "paymentVoluntary", "payment_voluntary", "paymentAmount", "payment_amount"));'
);

requireIncludes(
  "selected balance total canonical priority",
  'moneyValue(val(m, "balancePresuit", "balance_presuit", "balanceAmount", "balance_amount"))'
);

requireIncludes(
  "sort balance canonical priority",
  'if (key === "balance") return moneyValue(val(m, "balancePresuit", "balance_presuit", "balanceAmount", "balance_amount"));'
);

requireIncludes(
  "lawsuit amount balance mode uses canonical balance state",
  'lawsuitAmountMode === "balance_presuit"'
);

requireIncludes(
  "lawsuit preview/create payload sends canonical balance mode",
  'amountSoughtMode: lawsuitAmountMode'
);

requireIncludes(
  "create lawsuit balance radio uses canonical balance",
  'Balance ({money(selectedMatters.reduce((sum, m) => sum + moneyValue(val(m, "balancePresuit", "balance_presuit", "balanceAmount", "balance_amount")), 0))})'
);

requireNotIncludes(
  "do not prefer stale paymentAmount before paymentVoluntary",
  'return moneyValue(val(m, "paymentAmount", "payment_amount", "paymentVoluntary", "payment_voluntary"));'
);

requireNotIncludes(
  "do not prefer stale balanceAmount before balancePresuit",
  'moneyValue(val(m, "balanceAmount", "balance_amount", "balancePresuit", "balance_presuit"))'
);

requireNotIncludes(
  "do not use stale balance field as Create Lawsuit source mode",
  'amountSoughtMode === "balance_amount"'
);

console.log("RESULT: verify lawsuits financial display canonical fields");
console.log("FILE=" + file);
console.log("CANONICAL_PAYMENT_FIELDS=paymentVoluntary,payment_voluntary");
console.log("CANONICAL_BALANCE_FIELDS=balancePresuit,balance_presuit");
console.log("STALE_FALLBACK_PAYMENT_FIELDS=paymentAmount,payment_amount");
console.log("STALE_FALLBACK_BALANCE_FIELDS=balanceAmount,balance_amount");
console.log("FAILURES=" + failures.length);

for (const failure of failures) {
  console.log("FAIL=" + failure);
}

if (failures.length) process.exit(1);
