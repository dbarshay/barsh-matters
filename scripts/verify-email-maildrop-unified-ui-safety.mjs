import fs from "node:fs";

// The matter and lawsuit pages share ONE unified email surface: the Outlook-style MatterEmailInbox,
// launched from the Emails action as a draggable/resizable modal. (The former MailDrop thread panels
// and separate View/Send chrome were retired.)
let failures = 0;
function mustContain(path, marker) {
  const text = fs.readFileSync(path, "utf8");
  if (!text.includes(marker)) { console.error(`FAIL ${path}: missing ${marker}`); failures += 1; }
  else console.log(`PASS ${path}: ${marker}`);
}

for (const page of ["app/matter/[id]/page.tsx", "app/matters/page.tsx"]) {
  mustContain(page, "MatterEmailInbox");
  mustContain(page, "DraggableResizableModal");
}
mustContain("app/matter/[id]/page.tsx", "openMatterViewEmailsPopup()");
mustContain("app/matters/page.tsx", "setMasterEmailInboxOpen(true)");
mustContain("components/email/MatterEmailInbox.tsx", 'label: "Deleted Items"');

if (failures > 0) { console.error(`\n=== EMAIL UNIFIED UI SAFETY FAILED: ${failures} ===`); process.exit(1); }
console.log("\n=== EMAIL UNIFIED UI SAFETY PASSED ===");
console.log("Matter and lawsuit pages both mount the unified Outlook-style inbox in a draggable modal.");
