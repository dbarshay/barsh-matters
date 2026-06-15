import fs from "fs";

const page = fs.readFileSync("app/matter/[id]/page.tsx", "utf8");
const failures = [];

for (const token of [
  "matterViewEmailsPopupOpen",
  "function openMatterViewEmailsPopup()",
  "function closeMatterViewEmailsPopup()",
  "function renderMatterViewEmailsPopup()",
  "emailThreadLastCheckedAt",
  "setEmailThreadLastCheckedAt(new Date().toISOString());",
  "function emailThreadLastCheckedIsCurrent()",
  "function emailThreadLastCheckedColor()",
  "15 * 60 * 1000",
  "emailThreadPreviewResult?.error",
  'aria-label="View Emails"',
  'data-barsh-direct-view-emails-standard-modal="true"',
  'data-barsh-direct-view-emails-header-standard="true"',
  'data-barsh-direct-view-emails-footer-actions="true"',
  "View Emails",
  'background: "#1e3a8a"',
  'textAlign: "center"',
  "{renderMatterViewEmailsPopup()}",
  "{renderMatterEmailThreadsPanel()}",
  "openMatterViewEmailsPopup();",
]) {
  if (!page.includes(token)) failures.push("missing direct View Emails modal token: " + token);
}

for (const forbidden of [
  'activeWorkspaceTab === "email_threads" && renderMatterEmailThreadsPanel()',
  'setActiveWorkspaceTab("email_threads");\n                            void loadMatterEmailThreadPreview();',
]) {
  if (page.includes(forbidden)) failures.push("View Emails still renders inline or switches workspace tab: " + forbidden);
}

const emailPanelStart = page.indexOf("function renderMatterEmailThreadsPanel()");
const emailPanelEnd = page.indexOf("function renderMatterViewEmailsPopup()", emailPanelStart);
const emailPanel = emailPanelStart >= 0 && emailPanelEnd > emailPanelStart ? page.slice(emailPanelStart, emailPanelEnd) : "";

if (!emailPanel) failures.push("could not isolate renderMatterEmailThreadsPanel");

for (const token of [
  'style={{ ...tabPlaceholderPanelStyle, margin: 0, boxShadow: "none", border: 0, borderRadius: 0 }}',
  'justifyContent: "flex-end"',
  'gridTemplateColumns: "repeat(4, minmax(0, 1fr))"',
  'border: "1px solid #1e3a8a"',
  'background: emailThreadPreviewLoading ? "#f3f4f6" : "#1e3a8a"',
  "Refresh Emails",
  "Matter",
  "Threads",
  "Messages",
  "Last Checked",
  "formatEmailThreadTimestamp(emailThreadLastCheckedAt)",
  "color: emailThreadLastCheckedColor()",
]) {
  if (!emailPanel.includes(token)) failures.push("missing direct View Emails panel token: " + token);
}

for (const token of [
  "Graph calls",
  "Creates draft",
  "Sends email",
  "Reads mailbox",
  "Syncs mailbox",
  "DB changed",
  "Safety",
  "Read Only",
  "Raw local thread preview JSON",
  "JSON.stringify(emailThreadPreviewResult, null, 2)",
  "Unified matter email area.",
  "Graph-synced messages and MailDrop-linked thread records appear here together",
  "Opening this panel reads local records only",
  '<h2 style={{ marginTop: 0, marginBottom: 6 }}>Emails</h2>',
  'gridTemplateColumns: "repeat(3, minmax(0, 1fr))"',
  'background: emailThreadPreviewLoading ? "#f3f4f6" : "#2563eb"',
]) {
  if (emailPanel.includes(token)) failures.push("visible direct View Emails panel still contains debug/intro/layout token: " + token);
}

if (failures.length) {
  console.error("FAIL: direct View Emails popup modal safety");
  for (const failure of failures) console.error("- " + failure);
  process.exit(1);
}

console.log("PASS: direct View Emails popup modal safety");
