import fs from "node:fs";

const routePath = "app/api/matters/apply-payment/route.ts";
const uiPath = "app/matter/[id]/page.tsx";

function fail(message) {
  console.error(`❌ ${message}`);
  process.exit(1);
}

function pass(message) {
  console.log(`✅ ${message}`);
}

function read(path) {
  if (!fs.existsSync(path)) {
    fail(`Missing required file: ${path}`);
  }
  return fs.readFileSync(path, "utf8");
}

const route = read(routePath);
const ui = read(uiPath);

const forbiddenRoutePatterns = [
  {
    label: "clioFetch import/use",
    pattern: /\bclioFetch\b/,
  },
  {
    label: "MATTER_CF import/use",
    pattern: /\bMATTER_CF\b/,
  },
  {
    label: "direct Clio matter API path",
    pattern: /\/api\/v4\/matters/,
  },
  {
    label: "ClaimIndex internal refresh",
    pattern: /\bindexMatterInternal\b/,
  },
  {
    label: "ClaimIndex refresh helper",
    pattern: /\brefreshClaimIndex\b/,
  },
  {
    label: "Clio custom field write payload",
    pattern: /custom_field_values\s*:/,
  },
  {
    label: "Clio system-of-record language",
    pattern: /systemOfRecordAfterWriteback\s*:\s*["']Clio readback["']/,
  },
];

for (const item of forbiddenRoutePatterns) {
  if (item.pattern.test(route)) {
    fail(`Local-first payment route still contains forbidden ${item.label}.`);
  }
}

pass("apply-payment route has no Clio fetch/write or ClaimIndex refresh references.");

const requiredRoutePatterns = [
  {
    label: "Prisma local DB usage",
    pattern: /\bprisma\.matterPaymentReceipt\b/,
  },
  {
    label: "audit helper import/use",
    pattern: /\bcreateMatterAuditLogEntry\b/,
  },
  {
    label: "payment.add audit action",
    pattern: /payment\.add/,
  },
  {
    label: "payment.edit audit action",
    pattern: /payment\.edit/,
  },
  {
    label: "payment.void audit action",
    pattern: /payment\.void/,
  },
  {
    label: "local-only safety flag",
    pattern: /clioWriteAttempted\s*:\s*false/,
  },
  {
    label: "no ClaimIndex refresh safety flag",
    pattern: /claimIndexRefreshAttempted\s*:\s*false/,
  },
  {
    label: "Barsh Matters local DB system of record",
    pattern: /Barsh Matters local DB/,
  },
];

for (const item of requiredRoutePatterns) {
  if (!item.pattern.test(route)) {
    fail(`Local-first payment route is missing required ${item.label}.`);
  }
}

pass("apply-payment route includes local DB persistence, audit actions, and local-only safety flags.");

const forbiddenUiPatterns = [
  {
    label: "old Clio payment writeback void copy",
    pattern: /Clio Payment Voluntary \/ Balance Presuit writeback/,
  },
  {
    label: "old payment writeback error copy",
    pattern: /Payment writeback failed/,
  },
];

for (const item of forbiddenUiPatterns) {
  if (item.pattern.test(ui)) {
    fail(`Matter payment UI still contains forbidden ${item.label}.`);
  }
}

const requiredUiPatterns = [
  {
    label: "Payments label",
    pattern: /Payments/,
  },
  {
    label: "Balance label",
    pattern: /Balance/,
  },
  {
    label: "local payment record void copy",
    pattern: /Barsh Matters local payment record/,
  },
];

for (const item of requiredUiPatterns) {
  if (!item.pattern.test(ui)) {
    fail(`Matter payment UI is missing required ${item.label}.`);
  }
}

pass("matter payment UI uses local-first payment language.");

console.log("✅ Local-first individual payment safety verifier passed.");
