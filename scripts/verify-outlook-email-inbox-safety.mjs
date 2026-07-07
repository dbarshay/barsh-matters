import fs from "fs";

// Outlook-style email inbox: folder rail (Inbox / Sent / Drafts / Deleted Items), draggable+resizable
// window, single Emails launch, and actions that are REAL in Outlook via Graph — Delete moves the
// message to the mailbox Deleted Items (reversible soft delete, never a hard purge) and Save Draft
// creates a real Outlook draft. Deleted/Draft state is tracked locally so the folders have contents.
let failed = false;
function check(file, needles) {
  const text = fs.readFileSync(file, "utf8");
  for (const n of needles) {
    if (!text.includes(n)) { console.error(`FAIL: ${file} missing: ${n}`); failed = true; }
    else console.log(`PASS: ${file} has: ${n}`);
  }
}
function absent(file, needles) {
  const text = fs.readFileSync(file, "utf8");
  for (const n of needles) {
    if (text.includes(n)) { console.error(`FAIL: ${file} should NOT contain: ${n}`); failed = true; }
    else console.log(`PASS: ${file} free of: ${n}`);
  }
}

// Schema: soft-delete flag drives the Deleted Items folder.
check("prisma/schema.prisma", ["deletedLocal"]);

// Delete = real Graph move to Deleted Items (reversible) + local soft-delete flag (NOT a hard delete).
check("app/api/graph/matter-email/delete/route.ts", [
  "isMatterEmailEnabled()",
  "isAdminRequestAuthorized(req)",
  "confirmDelete !== true",
  'method: "DELETE"',                 // Graph DELETE = move to Deleted Items (reversible)
  "deletedLocal: true",               // local soft delete
]);
absent("app/api/graph/matter-email/delete/route.ts", ["deleteMany(", "prisma.emailMessage.delete("]);

// Save Draft = real Graph draft (create message, no /send) + local isDraft record.
check("lib/graph/matterEmail.ts", ["saveMatterEmailDraft", "isDraft: true"]);
check("app/api/graph/matter-email/save-draft/route.ts", [
  "isMatterEmailEnabled()",
  "isAdminRequestAuthorized(req)",
  "saveMatterEmailDraft(",
]);
check("components/email/MatterEmailCompose.tsx", ["/api/graph/matter-email/save-draft", "Save draft"]);

// Messages API surfaces folder-bucketing fields and no longer hides drafts.
check("app/api/graph/matter-email/messages/route.ts", ["deletedLocal: true", "isDraft: true"]);
absent("app/api/graph/matter-email/messages/route.ts", ["isDraft: false"]);

// Unread badge ignores soft-deleted messages.
check("app/api/graph/matter-email/unread-count/route.ts", ["deletedLocal: false"]);

// Inbox: folder rail with all four Outlook folders, New Mail compose, inline attachment review.
check("components/email/MatterEmailInbox.tsx", [
  'label: "Inbox"',
  'label: "Sent"',
  'label: "Drafts"',
  'label: "Deleted Items"',
  "New Mail",
  "InboundAttachmentReview",
]);

// Draggable + resizable window used to host the inbox.
check("components/ui/DraggableResizableModal.tsx", ['mode: "move"', 'mode: "resize"', "onMouseDown"]);
check("app/matter/[id]/page.tsx", ["DraggableResizableModal"]);

if (failed) process.exit(1);
console.log("PASS: Outlook-style inbox has folder rail; Delete moves to Deleted Items (reversible, never hard delete); Save Draft creates a real Outlook draft.");
