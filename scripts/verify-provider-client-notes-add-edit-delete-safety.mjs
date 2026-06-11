import fs from "fs";

const pagePath = "app/admin/clients/[id]/page.tsx";
const routePath = "app/api/admin/clients/[id]/route.ts";
const pkgPath = "package.json";

const page = fs.readFileSync(pagePath, "utf8");
const route = fs.readFileSync(routePath, "utf8");
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));

let failures = 0;

function pass(message) {
  console.log(`PASS: ${message}`);
}

function fail(message) {
  console.error(`FAIL: ${message}`);
  failures += 1;
}

function mustContain(label, text, needle) {
  if (text.includes(needle)) pass(`${label}: found ${needle}`);
  else fail(`${label}: missing ${needle}`);
}

function mustAvoid(label, text, needle) {
  if (!text.includes(needle)) pass(`${label}: avoids ${needle}`);
  else fail(`${label}: still contains ${needle}`);
}

function mustAvoidPattern(label, text, regex, description) {
  if (regex.test(text) === false) pass(`${label}: avoids ${description}`);
  else fail(`${label}: matched forbidden ${description}`);
}

console.log("=== VERIFY PROVIDER CLIENT NOTES ADD EDIT DELETE SAFETY ===");

mustContain("client page", page, "Account Notes");
mustContain("client page", page, "Add Note");
mustContain("client page", page, "Edit Notes");
mustContain("client page", page, "Save New Note");
mustContain("client page", page, "Save Note Edits");
mustContain("client page", page, "notesEditorMode");
mustContain("client page", page, "editableNotes");
mustContain("client page", page, "splitClientNotesForEditing");
mustContain("client page", page, "startAddNote");
mustContain("client page", page, "startEditNotes");
mustContain("client page", page, "updateEditableNote");
mustContain("client page", page, "deleteEditableNote");
mustContain("client page", page, "Add a new note. Saving will append it with the current date and time.");
mustContain("client page", page, "Edit any individual note below or use Delete to remove that note. Saving replaces the notes list.");
mustContain("client page", page, "appendNote: clientForm.notes");
mustContain("client page", page, "replaceNotes: true");
mustContain("client page", page, "editableNotes.map");
mustContain("client page", page, "filter(Boolean)");
mustContain("client page", page, "join(");
mustContain("client page", page, "Delete");
mustAvoid("client page", page, "Add Notes");

mustContain("API route", route, "replaceNotes");
mustContain("API route", route, "function replaceClientNotes");
mustContain("API route", route, "replaceClientNotes(next, body.notes)");
mustContain("API route", route, "appendClientNote(next, body.appendNote)");
mustContain("API route", route, "appendNote");

mustAvoidPattern("client page", page, /providerClientInvoice\.(create|update|delete|upsert)\s*\(/i, "direct ProviderClientInvoice mutation on hub page");
mustAvoidPattern("client page", page, /matterPaymentReceipt\.(create|update|delete|upsert)\s*\(/i, "direct MatterPaymentReceipt mutation on hub page");

const expected = "node scripts/verify-provider-client-notes-add-edit-delete-safety.mjs";
if (pkg.scripts?.["verify:provider-client-notes-add-edit-delete-safety"] === expected) {
  pass("package.json registers verify:provider-client-notes-add-edit-delete-safety");
} else {
  fail("package.json missing verify:provider-client-notes-add-edit-delete-safety");
}

if (failures) {
  console.error(`\nRESULT: provider/client notes add edit delete safety FAILED (${failures})`);
  process.exit(1);
}

console.log("\nRESULT: provider/client notes add edit delete safety PASSED");
