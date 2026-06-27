import fs from "node:fs";

let failed = false;
function must(ok, message) {
  if (!ok) {
    failed = true;
    console.error("FAIL: " + message);
  } else {
    console.log("PASS: " + message);
  }
}

const challenge = fs.readFileSync("app/api/auth/2fa/challenge/route.ts", "utf8");
const verify = fs.readFileSync("app/api/auth/2fa/verify/route.ts", "utf8");

must(challenge.includes('import { isAdminRequestAuthorized } from "@/lib/adminAuth";'), "challenge route imports admin auth boundary");
must(verify.includes('import { isAdminRequestAuthorized } from "@/lib/adminAuth";'), "verify route imports admin auth boundary");
must(challenge.includes("setupVerification && !isAdminRequestAuthorized(req)"), "challenge route blocks setup code return without admin session");
must(verify.includes("setupVerification && !isAdminRequestAuthorized(req)"), "verify route blocks setup verification without admin session");
must(challenge.includes("setupVerificationCode: setupVerification ? challenge.code : null"), "challenge route still returns setup code only for setup verification");
must(challenge.includes("codeReturned: setupVerification"), "normal 2FA challenge still does not return code");
must(challenge.includes("deliveryPendingExternalSms: !setupVerification"), "normal 2FA challenge remains external-SMS pending");

if (failed) {
  console.error("RESULT: Admin Users Workflow Phase U1S 2FA setup auth boundary verifier failed");
  process.exit(1);
}
console.log("PASS: Admin Users Workflow Phase U1S setup verification auth boundary locked.");
