import fs from "node:fs";

const pagePath = "app/admin/ticklers/page.tsx";
const routePath = "app/api/admin/ticklers/search/route.ts";
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

mustInclude("Admin Ticklers page", page, 'const [ticklerStatusMode, setTicklerStatusMode] = useState<"open" | "completed">("open")');
mustInclude("Admin Ticklers page", page, "ticklerStatusMode");
mustInclude("Admin Ticklers page", page, "status");
mustInclude("Admin Ticklers page", page, 'data-barsh-admin-tickler-completed-history-controls="true"');
mustInclude("Admin Ticklers page", page, 'data-barsh-admin-tickler-completed-history-button="true"');
mustInclude("Admin Ticklers page", page, 'data-barsh-admin-tickler-open-mode-button="true"');
mustInclude("Admin Ticklers page", page, 'data-barsh-admin-tickler-results-mode-label="true"');
mustInclude("Admin Ticklers page", page, 'Completed History: read-only audit results.');
mustInclude("Admin Ticklers page", page, 'Open Ticklers: active follow-up results.');
mustInclude("Admin Ticklers page", page, 'title="completion audit fields"');
mustInclude("Admin Ticklers page", page, "selectedTicklerDetail?.completedAt");
mustInclude("Admin Ticklers page", page, "selectedTicklerDetail?.completedBy");
mustInclude("Admin Ticklers page", page, "selectedTicklerDetail?.completedNote");

mustInclude("search route", route, "completedAt: true");
mustInclude("search route", route, "completedBy: true");
mustInclude("search route", route, "completedNote: true");
mustInclude("search route", route, "completedAt: iso(tickler.completedAt)");

mustNotInclude("Admin Ticklers completed history must not reopen", page, "reopenTickler");
mustNotInclude("Admin Ticklers completed history must not rerun", page, "rerunTickler");
mustNotInclude("Admin Ticklers completed history must not update ticklers", page, "localWorkflowTickler.update");
mustNotInclude("Admin Ticklers completed history must not complete ticklers", page, "Complete Tickler");
mustNotInclude("Admin Ticklers completed history must not process ticklers", page, "Process Tickler");
mustNotInclude("Admin Ticklers completed history must not post payments", page, "Post Payment");

if (!pkg.scripts?.["verify:admin-tickler-completed-history-safety"]) {
  failures.push("package.json missing verify:admin-tickler-completed-history-safety script");
}

if (failures.length) {
  console.error("FAIL: Admin Tickler completed history safety verifier");
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}

console.log("PASS: Admin Ticklers completed-history mode is read-only, status-filtered, and exposes completion audit fields.");
