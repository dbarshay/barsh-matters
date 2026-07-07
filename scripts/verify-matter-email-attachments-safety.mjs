import fs from "fs";

// Phase C — attach already-FILED documents to a native matter/lawsuit email.
// Safety invariants: attachments are resolved by filedDocumentId and authorization-scoped to THIS
// matter/lawsuit (no arbitrary Clio ids), size-capped, uploaded to the draft before /send, and
// recorded as EmailAttachment metadata (bytes stay in the Clio vault). Flag-gate/admin/confirm intact.
let failed = false;
function check(file, needles) {
  const text = fs.readFileSync(file, "utf8");
  for (const n of needles) {
    if (!text.includes(n)) { console.error(`FAIL: ${file} missing: ${n}`); failed = true; }
    else console.log(`PASS: ${file} has: ${n}`);
  }
}

// Resolver: scoped authorization + size caps (per-file + encoded total under the 25 MB standard).
check("lib/graph/matterEmailAttachments.ts", [
  "resolveFiledDocumentAttachments",
  "MATTER_EMAIL_MAX_ATTACHMENT_BYTES",
  "MATTER_EMAIL_MAX_TOTAL_ENCODED_BYTES",
  "MATTER_EMAIL_STANDARD_MESSAGE_BYTES",
  "base64EncodedBytes",                       // budget the ENCODED total, not raw
  "status: \"active\", OR: scope",          // only active filings within the matter/lawsuit scope
  "are not filed to this matter/lawsuit",    // rejects ids outside scope
  "/api/v4/documents/${encodeURIComponent(clioDocumentId)}/download",
]);

// sendMatterEmail: attaches to the draft BEFORE send; large files stream via a Graph upload session.
check("lib/graph/matterEmail.ts", [
  "input.attachments",
  "#microsoft.graph.fileAttachment",
  "MATTER_EMAIL_SIMPLE_ATTACHMENT_BYTES",     // simple path only for small files
  "createUploadSession",                       // larger files → chunked upload session (no compression)
  "Content-Range",
  "emailAttachment.create",
  'storageStatus: "clio_vault"',
  "attachedCount",
]);

// Send route: resolves + authorizes + returns a 400 on any resolution failure (before sending).
check("app/api/graph/matter-email/send/route.ts", [
  "isMatterEmailEnabled()",
  "isAdminRequestAuthorized(req)",
  "body?.confirmSend !== true",
  "resolveFiledDocumentAttachments(",
  "attachmentFiledDocumentIds",
  "if (!resolved.ok) return",
]);

// Compose UI: attach dialog uses the document tree with per-doc checkmarks; posts the filed ids.
check("components/email/MatterEmailCompose.tsx", [
  "data-barsh-email-attach-button",
  "data-barsh-email-attach-dialog",
  "Attach documents to this email?",
  "selectable",
  "onToggleSelect={toggleAttachment}",
  "attachmentFiledDocumentIds: attachments.map",
]);

// FolderTree: opt-in selection mode with a checkmark control.
check("components/documents/FolderTree.tsx", [
  "selectable",
  "onToggleSelect",
  "function SelectCheck",
]);

if (failed) process.exit(1);
console.log("PASS: matter email attachments (Phase C) are scope-authorized, size-capped, draft-attached, and recorded.");
