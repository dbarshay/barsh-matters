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

mustInclude("runner page", page, "const [previewCriteria, setPreviewCriteria]");
mustInclude("runner page", page, "const currentPreviewCriteria = useMemo");
mustInclude("runner page", page, "const previewCriteriaMatchesCurrent");
mustInclude("runner page", page, "previewCriteria.kind === currentPreviewCriteria.kind");
mustInclude("runner page", page, "previewCriteria.dueThrough === currentPreviewCriteria.dueThrough");
mustInclude("runner page", page, "Number(previewCriteria.limit) === Number(currentPreviewCriteria.limit)");
mustInclude("runner page", page, "const completeDisabled = loading || !previewCriteriaMatchesCurrent");
mustInclude("runner page", page, "function invalidatePreviewCriteria()");
mustInclude("runner page", page, "setPreviewCriteria(null)");
mustInclude("runner page", page, "setResult(null)");
mustInclude("runner page", page, "setPreviewCriteria(currentPreviewCriteria)");
mustInclude("runner page", page, "if (!previewCriteriaMatchesCurrent)");
mustInclude("runner page", page, "Run Preview first. Completion is locked to the exact current filter set.");
mustInclude("runner page", page, "Complete the exact previewed open tickler filter set?");
mustInclude("runner page", page, "mode === \"complete\" && previewCriteriaMatchesCurrent && previewCriteria");
mustInclude("runner page", page, "requestPayload");
mustInclude("runner page", page, "disabled={completeDisabled}");
mustInclude("runner page", page, "data-barsh-admin-tickler-bulk-runner-complete-disabled-until-preview={completeDisabled}");
mustInclude("runner page", page, "cursor: completeDisabled ? \"not-allowed\" : \"pointer\"");
mustInclude("runner page", page, "opacity: completeDisabled ? 0.55 : 1");
mustInclude("runner page", page, "data-barsh-admin-tickler-bulk-runner-preview-lock-status=\"true\"");
mustInclude("runner page", page, "previewCriteriaMatchesCurrent");
mustInclude("runner page", page, "Completion is locked to the exact previewed filter set.");
mustInclude("runner page", page, "Run Preview before completing. Changing Type / Kind, Due Through, or Limit clears the preview lock.");

// URL-backed filter changes must still invalidate the preview lock.
mustInclude("runner page URL-backed filter application exists", page, "function applyRunnerFilterState(nextState: AdminTicklerRunnerUrlState");
mustInclude("runner page URL-backed filter application invalidates preview", page, "invalidatePreviewCriteria();");
mustInclude("runner page URL-backed filter application pushes browser history", page, "pushRunnerFilterUrl(nextState);");
mustInclude("runner page Type / Kind invalidates preview through URL-backed setter", page, "onChange={(event) => applyRunnerFilterState({ kind: event.target.value, dueThrough, limit })}");
mustInclude("runner page Due Through invalidates preview through URL-backed setter", page, "onChange={(event) => applyRunnerFilterState({ kind, dueThrough: event.target.value, limit })}");
mustInclude("runner page Limit invalidates preview through URL-backed setter", page, "onChange={(event) => applyRunnerFilterState({ kind, dueThrough, limit: event.target.value })}");
mustInclude("runner page Back clears preview criteria", page, "setPreviewCriteria(null);");
mustInclude("runner page Back clears result", page, "setResult(null);");

mustInclude("runner route", route, "prisma.localWorkflowTickler.updateMany");
mustInclude("runner route", route, 'status: "completed"');
mustInclude("runner route", route, 'status: "open"');

mustNotInclude("runner page must not rely on old disabled expression", page, "disabled={loading || !previewCriteria}");
mustNotInclude("runner page must not store stale literal preview object", page, "setPreviewCriteria({");
mustNotInclude("runner page must not complete without hard match", page, "if (!previewCriteria) {");

// These old direct setters bypass URL-backed history and must not return.
mustNotInclude("runner page must not use old kind setter", page, "setKind(event.target.value); invalidatePreviewCriteria();");
mustNotInclude("runner page must not use old dueThrough setter", page, "setDueThrough(event.target.value); invalidatePreviewCriteria();");
mustNotInclude("runner page must not use old limit setter", page, "setLimit(event.target.value); invalidatePreviewCriteria();");

if (!pkg.scripts?.["verify:admin-tickler-bulk-runner-preview-lock-safety"]) {
  failures.push("package.json missing verify:admin-tickler-bulk-runner-preview-lock-safety script");
}

if (failures.length) {
  console.error("FAIL: Admin Tickler bulk runner preview-lock safety verifier");
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}

console.log("PASS: Admin Tickler bulk runner completion is disabled until preview and URL-backed filter changes clear preview lock.");
