import fs from "node:fs";

const pagePath = "app/admin/ticklers/runner/page.tsx";
const routePath = "app/api/admin/ticklers/run/route.ts";
const pkgPath = "package.json";

const page = fs.readFileSync(pagePath, "utf8");
const route = fs.readFileSync(routePath, "utf8");
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));

const failures = [];

function mustInclude(label, text, token) {
  if (!text.includes(token)) failures.push(`${label}: missing ${token}`);
}

function mustNotInclude(label, text, token) {
  if (text.includes(token)) failures.push(`${label}: forbidden ${token}`);
}

mustInclude("runner page", page, 'data-barsh-admin-tickler-bulk-runner-completion-audit-summary="true"');
mustInclude("runner page", page, "Completion Audit Summary");
mustInclude("runner page", page, "Completed Count");
mustInclude("runner page", page, "Completed By");
mustInclude("runner page", page, "Completed At");
mustInclude("runner page", page, "Completion Note");
mustInclude("runner page", page, "firstCompletionTimestamp(ticklers)");
mustInclude("runner page", page, "dateTimeCell(tickler.completedAt)");
mustInclude("runner page", page, "cell(tickler.completedBy)");
mustInclude("runner page", page, "cell(tickler.completedNote)");
mustInclude("runner page", page, "result.writePerformed ? (");
mustInclude("runner page", page, "Audit only: this summary records the LocalWorkflowTickler completion result");
mustInclude("runner page", page, "does not post payments, close matters, change settlement records");

mustInclude("runner route", route, "completedAt: true");
mustInclude("runner route", route, "completedBy: true");
mustInclude("runner route", route, "completedNote: true");
mustInclude("runner route", route, "completedAt: serializeDate(tickler.completedAt)");
mustInclude("runner route", route, "completedBy: tickler.completedBy");
mustInclude("runner route", route, "completedNote: tickler.completedNote");

mustNotInclude("runner page audit must not post payments", page, "Post Payment");
mustNotInclude("runner page audit must not close matters", page, "Close Paid Settlements");
mustNotInclude("runner page audit must not reopen ticklers", page, "Reopen Tickler");
mustNotInclude("runner page audit must not rerun ticklers", page, "Rerun Tickler");

if (!pkg.scripts?.["verify:admin-tickler-bulk-runner-completion-audit-safety"]) {
  failures.push("package.json missing verify:admin-tickler-bulk-runner-completion-audit-safety script");
}

if (failures.length) {
  console.error("FAIL: Admin Tickler bulk runner completion audit safety verifier");
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}

console.log("PASS: Admin Tickler bulk runner shows read-only completion audit summary and returned completion fields.");
