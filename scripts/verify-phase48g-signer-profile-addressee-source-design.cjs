const fs = require("fs");

const md = fs.readFileSync("docs/template-generation-refactor/phase48g-signer-profile-addressee-source-design.md", "utf8");
const json = JSON.parse(fs.readFileSync("docs/template-generation-refactor/phase48g-signer-profile-addressee-source-design.json", "utf8"));

let failed = false;
function pass(message) { console.log("PASS: " + message); }
function fail(message) { console.error("FAIL: " + message); failed = true; }
function has(label, token) { md.includes(token) ? pass(label) : fail(label + " missing " + token); }

has("scope blocks DB mutation", "no database mutation");
has("separate signer profile decision", "Signer fields should not live directly on AdminUser.");
has("non-login signers allowed", "Non-login signers are allowed.");
has("signer eligibility separate/default enabled", "Signer eligibility is separately enabled, but defaults to enabled.");
has("template-required missing signer fields block", "generation is blocked when the selected template requires missing signer fields");
has("template default workflow override", "Addressee source defaults come from the selected template, with workflow/context override.");
has("missing addressee warn require", "Missing addressee data warns and requires manual completion.");
has("lawsuit insurer controls", "the lawsuit matter insurer controls");
has("settled contact only", "resolve only from settlement contact data");

json.scope?.dbMutation === false ? pass("JSON dbMutation false") : fail("JSON dbMutation false");
json.scope?.clioAction === false ? pass("JSON clioAction false") : fail("JSON clioAction false");
json.scope?.graphAction === false ? pass("JSON graphAction false") : fail("JSON graphAction false");
json.decisions?.nonLoginSignersAllowed === true ? pass("JSON non-login signers allowed") : fail("JSON non-login signers allowed");
json.decisions?.signerEligibilitySeparateFromAdminUser === true && json.decisions?.signerEligibilityDefaultEnabled === true ? pass("JSON signer eligibility locked") : fail("JSON signer eligibility locked");
json.decisions?.blockGenerationWhenTemplateRequiredSignerFieldsMissing === true ? pass("JSON required signer fields block") : fail("JSON required signer fields block");
json.decisions?.addresseeDefaultSourceOwner === "template" && json.decisions?.workflowOverrideAllowed === true ? pass("JSON addressee template default/workflow override") : fail("JSON addressee default");
json.decisions?.missingAddresseeDataBehavior === "warn_require_manual_completion" ? pass("JSON missing addressee behavior") : fail("JSON missing addressee behavior");
json.decisions?.lawsuitMatterInsurerControls === true && json.decisions?.childInsurerConflictExpected === false ? pass("JSON lawsuit insurer controls") : fail("JSON lawsuit insurer controls");
json.decisions?.settledWithContactResolution === "settlement_contact_only" && json.decisions?.settledWithContactFallbackAllowed === false ? pass("JSON settled contact only/no fallback") : fail("JSON settled contact only/no fallback");
json.signerProfile?.doNotStoreDirectlyOnAdminUser === true && json.signerProfile?.adminUserIdNullable === true ? pass("JSON signer profile relation") : fail("JSON signer profile relation");
["adversary_attorney", "insurer", "court", "settled_with_contact", "manual"].every((source) => json.addressee?.sourceTypes?.includes(source)) ? pass("JSON all addressee sources") : fail("JSON all addressee sources");
json.futureImplementationRequiresSeparateApproval === true ? pass("JSON future implementation approval gate") : fail("JSON future implementation approval gate");

if (failed) process.exit(1);
console.log("PASS: Phase 48G signer profile/addressee source design verifier passed");
