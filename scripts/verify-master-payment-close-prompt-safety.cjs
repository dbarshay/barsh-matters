const fs = require("fs");
const s = fs.readFileSync("app/matters/page.tsx", "utf8");
function assertOk(condition, message) { if (!condition) throw new Error(message); console.log("PASS:", message); }

const start = s.indexOf('{masterPaymentClosePromptOpen && activeMasterWorkspaceTab === "payments" && (');
const end = s.indexOf('{masterNoteDeleteTarget && activeMasterWorkspaceTab === "payments" && (', start);
assertOk(start >= 0 && end > start, "Master payment close prompt boundaries found");
const chunk = s.slice(start, end);

assertOk(chunk.includes('Close After Payment?</h2>'), "Prompt title is Close After Payment");
assertOk(chunk.includes('aria-label="Close After Payment?"'), "Prompt aria label matches title");
assertOk(chunk.includes("Payment posted. Do you want to close this lawsuit now?"), "Prompt body uses final wording");
assertOk(chunk.includes("No") && !chunk.includes("Not Now"), "Prompt left button is No");
assertOk(chunk.includes("Yes, Close"), "Prompt right button is Yes, Close");
assertOk(chunk.includes("onClick={() => setMasterPaymentClosePromptOpen(false)}"), "No closes prompt and returns to lawsuit screen");
assertOk(chunk.includes("openMasterCloseLawsuitDialog()"), "Yes opens Close Lawsuit dialog");
assertOk(!chunk.includes('setActiveMasterWorkspaceTab("close_paid_settlements")'), "Yes no longer switches to close_paid_settlements tab");
assertOk(chunk.includes('display: "flex"') && chunk.includes('alignItems: "center"') && chunk.includes('justifyContent: "center"'), "Prompt uses centered overlay");
assertOk(chunk.includes('background: "rgba(15, 23, 42, 0.58)"'), "Prompt uses standard overlay shade");
assertOk(chunk.includes('background: "#1e3a8a"'), "Prompt uses navy header");
assertOk(!chunk.includes("×"), "Prompt has no top-right close glyph");
assertOk(chunk.includes('event.key === "Escape"') && chunk.includes("setMasterPaymentClosePromptOpen(false)"), "Prompt supports Escape close");
assertOk(chunk.includes("event.stopPropagation()"), "Prompt supports inner click propagation guard");
assertOk(!chunk.includes("#fff7ed") && !chunk.includes("#c2410c") && !chunk.includes("Closing remains separate"), "Old orange inline prompt copy/style removed");
assertOk(chunk.includes('background: "#dc2626"') && chunk.includes('border: "1px solid #dc2626"'), "No button is red");
assertOk(chunk.includes('background: "#16a34a"') && chunk.includes('border: "1px solid #15803d"'), "Yes button is green");
assertOk(s.includes("masterCloseDialogOpen") && s.includes('background: masterClosing ? "#fecaca" : "#dc2626"'), "Locked Close Lawsuit popup remains present");
assertOk(s.includes("data-barsh-master-info-edit-standard-modal=\"true\""), "Locked Master Info Edit popup remains present");
assertOk(s.includes("function parseMasterNotesFromMetadata") && s.includes("async function persistMasterNotes"), "Locked Master Notes persistence remains present");
assertOk(s.includes("function renderMasterViewDocumentsPopup()") && s.includes('params.set("mode", "email-pdf")'), "Locked Master View Documents behavior remains present");
console.log("PASS: master payment close prompt verifier complete");
