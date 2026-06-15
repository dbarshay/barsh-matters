import fs from "node:fs";

let failures = 0;

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function mustContain(path, text, needle) {
  if (!text.includes(needle)) {
    console.error("FAIL " + path + ": missing " + needle);
    failures += 1;
  }
}

function mustNotContain(path, text, needle) {
  if (text.includes(needle)) {
    console.error("FAIL " + path + ": must not contain " + needle);
    failures += 1;
  }
}

console.log("=== EMAIL / MAILDROP UNIFIED UI SAFETY VERIFICATION ===");

const directPath = "app/matter/[id]/page.tsx";
const masterPath = "app/matters/page.tsx";
const direct = read(directPath);
const master = read(masterPath);

mustContain(directPath, direct, "label: \"Emails\"");
mustContain(directPath, direct, "note: \"Matter emails and MailDrop threads\"");
mustContain(directPath, direct, "function renderMatterViewEmailsPopup()");
mustContain(directPath, direct, "function renderMatterEmailThreadsPanel()");
mustContain(directPath, direct, "data-barsh-direct-view-emails-standard-modal=\"true\"");
mustContain(directPath, direct, "data-barsh-direct-view-emails-footer-actions=\"true\"");
mustContain(directPath, direct, "void loadMatterEmailThreadPreview();");
mustContain(directPath, direct, "Email records load automatically when this panel opens.");
mustContain(directPath, direct, "hidden");
mustContain(directPath, direct, "aria-hidden=\"true\"");

mustContain(masterPath, master, "Unified Master Lawsuit email area.");
mustContain(masterPath, master, "if (activeMasterWorkspaceTab !== \"email_threads\") return;");
mustContain(masterPath, master, "void loadMasterEmailThreadPreview();");
mustContain(masterPath, master, "Graph-synced messages and MailDrop-linked thread records appear here together");
mustContain(masterPath, master, "Email records load automatically when this panel opens.");
mustContain(masterPath, master, "hidden");
mustContain(masterPath, master, "aria-hidden=\"true\"");

mustNotContain(directPath, direct, "label: \"Email / Threads\"");
mustNotContain(masterPath, master, ">Email / Threads<");

if (failures > 0) {
  console.error("=== EMAIL / MAILDROP UNIFIED UI SAFETY FAILED: " + failures + " failure(s) ===");
  process.exit(1);
}

console.log("=== EMAIL / MAILDROP UNIFIED UI SAFETY PASSED ===");
