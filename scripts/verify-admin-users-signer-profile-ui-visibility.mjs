import fs from "node:fs";

const page = fs.readFileSync("app/admin/users/page.tsx", "utf8");
const failures = [];

function must(condition, message) {
  if (!condition) failures.push(message);
}

must(page.includes('data-barsh-admin-users-signer-profile-location-note="true"'), "missing signer profile location note");
must(page.includes('data-barsh-admin-users-signer-profile-visibility-panel="true"'), "missing signer profile visibility panel");
must(page.includes('data-barsh-admin-users-signer-profile-required-fields="true"'), "missing required-field explainer cards");
must(page.includes("Signer Profiles"), "missing Signer Profiles heading");
must(page.includes("Required for signer.* tokens"), "missing signer token note");
must(page.includes("No Wet Signature"), "missing no wet signature reassurance");
must(page.includes('"Signer Profile", "Signature Name", "Signer Contact"'), "missing signer profile columns in table header array");
must(page.includes('data-barsh-admin-users-table-signer-profile-status="true"'), "missing signer profile status table cell");
must(page.includes('data-barsh-admin-users-table-signature-name="true"'), "missing signature name table cell");
must(page.includes('data-barsh-admin-users-table-signer-contact="true"'), "missing signer contact table cell");

must(page.includes("Edit / Signer Profile"), "missing discoverable edit/signer-profile action label");
must(page.includes("signerEligible"), "missing signerEligible UI/source reference");
must(page.includes("signatureBlockName"), "missing signatureBlockName UI/source reference");
must(page.includes("phoneExtension"), "missing phoneExtension UI/source reference");
must(page.includes("faxNumber"), "missing faxNumber UI/source reference");
must(!page.includes("maxWidth: 1220"), "admin users page still uses narrow maxWidth 1220 wrapper");
must(!page.includes("wetSignatureStored: true"), "wet signature storage appears enabled in Admin Users UI");

if (failures.length) {
  console.error("FAILURES=" + failures.length);
  for (const failure of failures) console.error("FAIL=" + failure);
  process.exit(1);
}

console.log("PASS: Admin Users signer-profile UI visibility verifier passed");
