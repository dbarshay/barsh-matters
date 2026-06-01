import fs from "node:fs";

const page = fs.readFileSync("app/matters/page.tsx", "utf8");
const route = fs.readFileSync("app/api/settlements/local-void/route.ts", "utf8");

const checks = [
  {
    label: "void route exists and is local-only",
    ok: route.includes('action: "settlement-local-void"') && route.includes("clioRecordsChanged: false"),
  },
  {
    label: "void route requires confirmVoid true",
    ok: route.includes("confirmVoid: true") && route.includes("requires confirmVoid: true"),
  },
  {
    label: "void route updates LocalSettlementRecord as voided",
    ok: route.includes("localSettlementRecord.update") && route.includes("voided: true") && route.includes('kind: "settlement_payment_due_followup"'),
  },
  {
    label: "void route falls back to active settlement when record id is missing",
    ok: route.includes("settlementRecordId ?") && route.includes("voided: false") && route.includes('recordedAt: "desc"'),
  },

  {
    label: "void route does not delete settlement rows",
    ok: route.includes("localSettlementRowsPreservedForHistory: true") && !route.includes("localSettlementRow.delete"),
  },
  {
    label: "void route voids related open ticklers only",
    ok: route.includes("localWorkflowTickler.deleteMany") && route.includes('kind: "settlement_payment_due_followup"'),
  },
  {
    label: "Settlement Already Recorded button opens admin void flow",
    ok: page.includes("Settlement Already Recorded") && page.includes("openVoidActiveSettlementAdminFlow"),
  },
  {
    label: "shared settlement launcher conditionally opens void or record flow",
    ok:
      page.includes("if (masterHasActiveRecordedSettlement)") &&
      page.includes("openVoidActiveSettlementAdminFlow();") &&
      page.includes("setMasterSettlementFormOpen(true);"),
  },

  {
    label: "admin gate is used for settlement void",
    ok: page.includes('runAdministratorGate(') && page.includes('"Void Active Settlement"'),
  },
  {
    label: "temporary no-password void settlement helper exists",
    ok:
      page.includes("function openTemporaryNoPasswordVoidSettlementFlow()") &&
      page.includes("void voidActiveMasterSettlementRecord(record, { skipTypedConfirm: true, skipReasonPrompt: true });"),
  },
  {
    label: "temporary no-password void button is clearly marked temporary",
    ok:
      page.includes("Temporary Void Settlement") &&
      page.includes("Temporary local-development shortcut") &&
      page.includes("main settlement area temporary no-password void button") &&
      page.includes("skipTypedConfirm") &&
      page.includes("skipReasonPrompt"),
  },
  {
    label: "temporary no-password void button is visible in main settlement area",
    ok:
      page.includes("main settlement area temporary no-password void button") &&
      page.includes("masterHasActiveRecordedSettlement && (") &&
      page.includes("onClick={() => void openTemporaryNoPasswordVoidSettlementFlow()}"),
  },

  {
    label: "temporary no-password void button still uses shared safe void function",
    ok:
      page.includes("onClick={() => void openTemporaryNoPasswordVoidSettlementFlow()}") &&
      page.includes("voidActiveMasterSettlementRecord(record, { skipTypedConfirm: true, skipReasonPrompt: true })") &&
      page.includes("skipTypedConfirm") &&
      page.includes("skipReasonPrompt") &&
      page.includes("Type confirm to void this settlement."),
  },

  {
    label: "temporary no-password void bypasses typed confirm only for temporary helper",
    ok:
      page.includes("options: { skipTypedConfirm?: boolean; skipReasonPrompt?: boolean } = {}") &&
      page.includes("if (!options.skipTypedConfirm)") &&
      page.includes("options.skipReasonPrompt") &&
      page.includes("voidActiveMasterSettlementRecord(record, { skipTypedConfirm: true, skipReasonPrompt: true })") &&
      page.includes("() => void voidActiveMasterSettlementRecord(record)"),
  },

  {
    label: "temporary no-password void bypasses reason prompt only for temporary helper",
    ok:
      page.includes("skipReasonPrompt?: boolean") &&
      page.includes("Temporary no-password development void") &&
      page.includes("!options.skipReasonPrompt && !String(reason).trim()") &&
      page.includes("voidActiveMasterSettlementRecord(record, { skipTypedConfirm: true, skipReasonPrompt: true })"),
  },

  {
    label: "void UI calls local-void route",
    ok: page.includes('fetch("/api/settlements/local-void"'),
  },
  {
    label: "void UI uses simple confirm typed confirmation",
    ok: page.includes("Type confirm to void this settlement.") && page.includes('toLowerCase() !== "confirm"'),
  },
  {
    label: "void UI sends explicit current master lawsuit id",
    ok: page.includes("const voidMasterLawsuitId = currentMasterLawsuitIdForDocumentPreview();") && page.includes("masterLawsuitId: voidMasterLawsuitId"),
  },
  {
    label: "void UI allows backend active-record fallback when record id is absent",
    ok: page.includes('settlementRecordId: record?.id || ""'),
  },


];

let failed = 0;
for (const check of checks) {
  if (check.ok) {
    console.log(`PASS: ${check.label}`);
  } else {
    failed += 1;
    console.error(`FAIL: ${check.label}`);
  }
}

if (failed) {
  console.error(`\nSettlement void safety verifier failed: ${failed} check(s).`);
  process.exit(1);
}

console.log("\nSettlement void safety verifier passed.");
