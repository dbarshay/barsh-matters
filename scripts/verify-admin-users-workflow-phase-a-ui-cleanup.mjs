import fs from "node:fs";
const page = fs.readFileSync("app/admin/users/page.tsx", "utf8");
const planning = fs.readFileSync("app/api/admin/users/planning/route.ts", "utf8");
const createRoute = fs.readFileSync("app/api/admin/users/create/route.ts", "utf8");
const signerRoute = fs.readFileSync("app/api/admin/users/signer-profile/route.ts", "utf8");
const schema = fs.readFileSync("prisma/schema.prisma", "utf8");
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const failures = [];
const must = (condition, message) => { if (!condition) failures.push(message); };
for (const token of ["Users & Roles","Create User","data-barsh-admin-users-create-first-name","data-barsh-admin-users-create-last-name","data-barsh-admin-users-create-username","data-barsh-admin-users-create-phone-extension","data-barsh-admin-users-create-fax-number","data-barsh-admin-users-create-signature-block-name","data-barsh-admin-users-create-locked","data-barsh-admin-users-create-inactive","data-barsh-admin-users-create-two-factor-phone","data-barsh-admin-users-create-two-factor-disabled","data-barsh-admin-users-create-two-factor-pending-setup","data-barsh-admin-users-table","data-barsh-admin-users-table-row","data-barsh-admin-users-signer-eligibility-note","Signer eligibility is not yet a separate schema/UI setting"]) must(page.includes(token), "Users page missing token: " + token);
for (const token of ["firstName: createFirstName","lastName: createLastName","username: createUsername","phoneExtension: createPhoneExtension","faxNumber: createFaxNumber","signatureBlockName: createSignatureBlockName","locked: createLocked","inactive: createInactive","twoFactorPhone: createTwoFactorPhone","twoFactorDisabled: createTwoFactorDisabled","twoFactorPendingSetup: createTwoFactorPendingSetup"]) must(page.includes(token), "Create payload missing token: " + token);
for (const token of ["firstName: user.firstName","lastName: user.lastName","username: user.username","phoneExtension: user.phoneExtension","faxNumber: user.faxNumber","signatureBlockName: user.signatureBlockName","signerProfileStatus","twoFactorStatus"]) must(planning.includes(token), "Planning API missing display token: " + token);
for (const token of ["buildAdminUserSignerProfileWritePayloadPhase7","emailNormalized","usernameNormalized","twoFactorPhone","twoFactorDisabled","twoFactorPendingSetup"]) must(createRoute.includes(token) && signerRoute.includes(token), "Create/signer route missing signer/security token: " + token);
must(!/signerEligible|eligibleSigner|signerEligibility|isSigner|canSign|signingEligible/i.test(schema), "Phase A must not add signer eligibility schema yet.");
for (const stale of ["Phase 3 Guarded Write Controls","Admin Users / Roles","Phase 3 guarded route. Preview is the default.","Phase 12J guarded route.","Persisted DB Admin Users / Roles"]) must(!page.includes(stale), "Visible stale Users page copy remains: " + stale);
for (const forbidden of ["create-draft","graphFetchJson","sendMail(","legacyClioOperationalRouteBlocked","DocumentTemplate"]) must(!page.includes(forbidden), "Users page must not wire forbidden workflow: " + forbidden);
must(pkg.scripts?.["verify:admin-users-workflow-phase-a-ui-cleanup"] === "node scripts/verify-admin-users-workflow-phase-a-ui-cleanup.mjs", "package script missing");
if (failures.length) { console.error("FAIL: Admin Users Workflow Phase A verifier failed"); for (const failure of failures) console.error(" - " + failure); process.exit(1); }
console.log("PASS: Admin Users Workflow Phase A UI cleanup and create signer/2FA wiring locked.");
