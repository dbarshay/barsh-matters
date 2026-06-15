const fs = require("fs");
const s = fs.readFileSync("app/matters/page.tsx", "utf8");
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
function assertOk(condition, message) { if (!condition) throw new Error(message); console.log("PASS:", message); }

const start = s.indexOf('{masterSettlementFormOpen && activeMasterWorkspaceTab === "payments" && (');
const end = s.indexOf('{masterPaymentFormOpen && activeMasterWorkspaceTab === "payments" && (', start);
assertOk(start >= 0 && end > start, "Master Record Settlement popup boundaries found");
const chunk = s.slice(start, end);

const hasTopRightCloseButton =
  chunk.includes('aria-label="Close lawsuit settlement preview popup"') ||
  chunk.includes('aria-label="Close settlement preview popup"') ||
  chunk.includes("Close settlement") ||
  chunk.includes(">\n                      ×\n                    </button>") ||
  chunk.includes(">×</button>");

assertOk(chunk.includes('display: "flex"') && chunk.includes('alignItems: "center"') && chunk.includes('justifyContent: "center"'), "Settlement popup uses centered overlay");
assertOk(chunk.includes('background: "rgba(15, 23, 42, 0.58)"'), "Settlement popup uses standard overlay shade");
assertOk(chunk.includes('data-barsh-standard-settlement-popup-shell="true"'), "Settlement popup has standard shell marker");
assertOk(chunk.includes('border: "1px solid #1e3a8a"') && chunk.includes('boxShadow: "0 28px 90px rgba(15, 23, 42, 0.34)"'), "Settlement popup uses standard shell styling");
assertOk(!chunk.includes('resize: "both"') && !chunk.includes("translateX(-50%)"), "Settlement popup no longer uses old draggable/resizable shell");
assertOk(chunk.includes('data-barsh-standard-settlement-popup-header="true"') && chunk.includes('background: "#1e3a8a"'), "Settlement popup has navy header");
assertOk(chunk.includes("Record Settlement") && chunk.includes('color: "#ffffff"'), "Settlement popup title is centered white Record Settlement");
assertOk(!chunk.includes("data-barsh-draggable-settlement-popup") && !chunk.includes("onPointerDown={beginMasterSettlementPopupDrag}") && !chunk.includes("masterSettlementPopupDragging"), "Settlement popup drag behavior removed");
assertOk(chunk.includes('data-barsh-standard-modal-close="removed"') && !hasTopRightCloseButton, "Settlement popup has no top-right close button");
assertOk(chunk.includes('event.key === "Escape"') && chunk.includes("setMasterSettlementFormOpen(false)"), "Settlement popup supports Escape close");
assertOk(chunk.includes("onClick={() => setMasterSettlementFormOpen(false)}") && chunk.includes("event.stopPropagation()"), "Settlement popup supports overlay close without inner click propagation");

assertOk(chunk.includes("Settlement Based on") && chunk.includes("lawsuit_amount") && chunk.includes("fee_schedule_amount") && chunk.includes("custom_amount"), "Settlement basis options preserved");
assertOk(chunk.includes("Principal *") && chunk.includes("Settled With *") && chunk.includes("Settlement Date *") && chunk.includes("Payment Due Date") && chunk.includes("Notes"), "Settlement entry fields preserved");
assertOk(chunk.includes("Settlement Allocation Preview") && chunk.includes("Settled Attorney Fee") && chunk.includes("Total Settlement"), "Settlement allocation preview preserved");
assertOk(chunk.includes("Cancel") && chunk.includes("Clear") && chunk.includes("Record Settlement") && chunk.includes("commitMasterSettlementAndLaunchDocuments"), "Settlement footer actions preserved");

assertOk(s.includes("async function commitMasterSettlementAndLaunchDocuments()"), "Settlement commit flow remains present");
assertOk(s.includes("async function runMasterSettlementLocalPreview()"), "Settlement local preview flow remains present");
assertOk(s.includes("async function runMasterSettlementRecordSave()"), "Settlement record-save flow remains present");
assertOk(s.includes("function clearMasterSettlementEntryFields()"), "Settlement Clear behavior remains present");

assertOk(pkg.scripts && pkg.scripts["verify:master-payment-popup-safety"] === "node scripts/verify-master-payment-popup-safety.cjs", "Locked payment popup verifier remains registered");
assertOk(pkg.scripts && pkg.scripts["verify:master-payment-close-prompt-safety"] === "node scripts/verify-master-payment-close-prompt-safety.cjs", "Locked payment close prompt verifier remains registered");
assertOk(s.includes("Close After Payment?</h2>"), "Locked payment close prompt remains present");
assertOk(s.includes("Post Lawsuit Payment"), "Locked payment popup remains present");
assertOk(s.includes("data-barsh-master-info-edit-standard-modal=\"true\""), "Locked Master Info Edit popup remains present");
assertOk(s.includes("function parseMasterNotesFromMetadata") && s.includes("async function persistMasterNotes"), "Locked Master Notes persistence remains present");
assertOk(s.includes("function renderMasterViewDocumentsPopup()") && s.includes('params.set("mode", "email-pdf")'), "Locked Master View Documents behavior remains present");

console.log("PASS: master Record Settlement popup verifier complete");
