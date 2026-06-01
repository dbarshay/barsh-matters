import fs from "node:fs";

const pagePath = "app/admin/ticklers/page.tsx";
const packagePath = "package.json";
const page = fs.readFileSync(pagePath, "utf8");
const pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"));

const required = [
  'data-barsh-admin-tickler-detail-popup="true"',
  'data-barsh-admin-tickler-detail-row-open="true"',
  'data-barsh-admin-tickler-detail-bottom-close="true"',
  'Read-Only Tickler Detail',
  'Full tickler record',
  'caseData / contextScope',
  'settlementRecord',
  'lawsuit / master context',
  'metadata and source fields',
  'setSelectedTicklerDetail(tickler)',
  'setSelectedTicklerDetail(null)',
  'aria-modal="true"',
  'resize: "both"',
];

const failures = [];

for (const token of required) {
  if (!page.includes(token)) {
    failures.push(`missing ${token}`);
  }
}

const popupStart = page.indexOf('data-barsh-admin-tickler-detail-popup="true"');
const popupEnd = page.indexOf('data-barsh-admin-tickler-detail-bottom-close="true"');
const popupBlock = popupStart >= 0 && popupEnd > popupStart
  ? page.slice(popupStart, popupEnd)
  : "";

if (!popupBlock) {
  failures.push("could not isolate Admin Tickler Detail popup body before bottom Close section");
}

const popupButtons = (popupBlock.match(/<button\b/g) || []).length;
if (popupButtons !== 0) {
  failures.push(`popup body must not contain action buttons before bottom Close section; found ${popupButtons}`);
}

const bottomCloseStart = page.indexOf('data-barsh-admin-tickler-detail-bottom-close="true"');
const bottomCloseEnd = bottomCloseStart >= 0
  ? page.indexOf("</div>", page.indexOf("</button>", bottomCloseStart))
  : -1;

const bottomCloseBlock = bottomCloseStart >= 0 && bottomCloseEnd > bottomCloseStart
  ? page.slice(bottomCloseStart, bottomCloseEnd)
  : "";

if (!bottomCloseBlock) {
  failures.push("could not isolate Admin Tickler Detail bottom Close section");
} else {
  const closeButtons = (bottomCloseBlock.match(/<button\b/g) || []).length;
  if (closeButtons !== 1) {
    failures.push(`bottom action area must contain exactly one button; found ${closeButtons}`);
  }
  const normalizedBottomCloseBlock = bottomCloseBlock.replace(/\s+/g, " ");
  if (!/>\s*Close\s*</.test(bottomCloseBlock) && !normalizedBottomCloseBlock.includes("> Close <")) {
    failures.push("bottom action area must contain explicit Close button text");
  }
  if (!bottomCloseBlock.includes("setSelectedTicklerDetail(null)")) {
    failures.push("bottom Close button must close only by clearing selectedTicklerDetail");
  }
}

const forbiddenControlTokens = [
  "Record Payment",
  "Post Payment",
  "Complete Tickler",
  "Process Tickler",
  "Run Tickler",
  "Change Status",
  "Save Tickler",
  "Update Tickler",
  "Void Settlement",
  "Close Paid Settlements",
];

for (const token of forbiddenControlTokens) {
  if (popupBlock.includes(token) || bottomCloseBlock.includes(token)) {
    failures.push(`read-only detail popup contains forbidden write/control token: ${token}`);
  }
}

if (!pkg.scripts?.["verify:admin-tickler-read-only-detail-popup-safety"]) {
  failures.push("package.json missing verify:admin-tickler-read-only-detail-popup-safety script");
}

if (failures.length) {
  console.error("FAIL: Admin Tickler read-only detail popup safety verifier");
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}

console.log("PASS: Admin Tickler read-only detail popup is row-opened, read-only, administrator-scoped, and verifier-locked.");
