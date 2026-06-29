import fs from "node:fs";

const route = fs.readFileSync("app/api/admin/users/signer-profile/route.ts", "utf8");
const failures = [];
const must = (condition, message) => { if (!condition) failures.push(message); };

must(route.includes("const existingTwoFactorEnforced"), "missing existing enforced-state calculation");
must(route.includes("const payloadTwoFactorEnforced"), "missing payload enforced-state calculation");
must(route.includes("existingTwoFactorEnforced === false"), "guard must only block transition from non-enforced");
must(route.includes("payloadTwoFactorEnforced === true"), "guard must still block transition into enforced");
must(route.includes("Sole bootstrapSafe owner_admin cannot be moved directly into enforced 2FA"), "owner 2FA guard error message removed");
must(!route.includes("activeOwnerCount <= 1 &&\n      payload.twoFactorDisabled === false"), "old broad payload-only guard still present");

if (failures.length) {
  console.error("FAILURES=" + failures.length);
  for (const failure of failures) console.error("FAIL=" + failure);
  process.exit(1);
}

console.log("PASS: signer-profile owner 2FA guard blocks only transition into enforced state");
