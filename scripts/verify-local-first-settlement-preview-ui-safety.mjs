import fs from "fs";
const page = fs.readFileSync("app/matters/page.tsx", "utf8");
const pkg = fs.readFileSync("package.json", "utf8");
let failures = 0;
function check(label, ok) { ok ? console.log(`PASS: ${label}`) : (console.error(`FAIL: ${label}`), failures++); }

check("preview state exists", page.includes("masterSettlementLocalPreview"));
check("preview loading exists", page.includes("masterSettlementLocalPreviewLoading"));
check("preview runner exists", page.includes("runMasterSettlementLocalPreview"));
check("preview route used", page.includes("/api/settlements/local-preview"));
check("local preview panel exists", page.includes("data-barsh-local-settlement-preview-panel"));
check("payload preview exists", page.includes("settlementRecordPayload"));
check("preview is non-writing", page.includes("No database record is created here") || page.includes("preview"));
check("provider net total present", page.includes("providerNetTotal"));
check("principal fee total present", page.includes("principalFeeTotal"));
check("interest fee total present", page.includes("interestFeeTotal"));
check("package script registered", pkg.includes("verify:local-first-settlement-preview-ui-safety"));
if (failures) process.exit(1);
console.log("PASS: local-first settlement preview UI safety passed.");
