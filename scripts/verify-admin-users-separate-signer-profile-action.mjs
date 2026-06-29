import fs from "node:fs";

const page = fs.readFileSync("app/admin/users/page.tsx", "utf8");
const failures = [];

function must(condition, message) {
  if (!condition) failures.push(message);
}

must(page.includes('data-barsh-admin-users-edit-row-button="true"'), "missing Edit row button");
must(page.includes('>Edit</button><button data-barsh-admin-users-signer-profile-row-button="true"'), "Edit and Signer Profile are not separate adjacent action buttons");
must(page.includes('data-barsh-admin-users-signer-profile-row-button="true"'), "missing Signer Profile row button");
must(page.includes('openSignerProfilePanel(user)'), "Signer Profile row button does not open signer popup");
must(page.includes('data-barsh-admin-users-signer-profile-modal="true"'), "missing signer profile modal");
must(page.includes('data-barsh-admin-users-signer-profile-only-fields="true"'), "missing signer-only fields anchor");
must(page.includes('data-barsh-admin-users-signer-profile-email="true"'), "missing signer profile email field");
must(page.includes('data-barsh-admin-users-signer-profile-phone-extension="true"'), "missing signer profile extension field");
must(page.includes('data-barsh-admin-users-signer-profile-fax-number="true"'), "missing signer profile fax field");
must(page.includes('data-barsh-admin-users-signer-profile-signature-name="true"'), "missing signer profile signature name field");
must(page.includes('data-barsh-admin-users-signer-profile-eligible="true"'), "missing signer profile eligibility field");
must(page.includes('data-barsh-admin-users-signer-profile-save-button="true"'), "missing Save Signer Profile button");
must(page.includes('Save Signer Profile'), "missing Save Signer Profile label");
must(page.includes("This popup does not edit roles, password, lockout, 2FA, or admin-card access."), "missing signer-only scope warning");
must(!page.includes(">Edit / Signer Profile</button>"), "combined Edit / Signer Profile button still exists");
must(!page.includes('data-barsh-admin-users-edit-phone-extension="true"'), "full Edit panel still includes signer extension field");
must(!page.includes('data-barsh-admin-users-edit-fax-number="true"'), "full Edit panel still includes signer fax field");
must(!page.includes('data-barsh-admin-users-edit-signature-block-name="true"'), "full Edit panel still includes signer signature name field");
must(!page.includes('data-barsh-admin-users-edit-signer-eligible="true"'), "full Edit panel still includes signer eligibility field");
must(!page.includes('gridColumn: "1 / -1",  gridColumn: "1 / -1"'), "duplicate gridColumn remains in admin card style");
must(!page.includes('writingMode: "vertical-rl"'), "Save User button regressed to vertical rail");

if (failures.length) {
  console.error("FAILURES=" + failures.length);
  for (const failure of failures) console.error("FAIL=" + failure);
  process.exit(1);
}

console.log("PASS: Admin Users has separate Edit and focused Signer Profile popup");
