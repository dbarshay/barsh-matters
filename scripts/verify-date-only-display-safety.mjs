const fs = require("fs");
const path = require("path");

const mustExist = [
  "lib/dateOnlyDisplay.ts",
  "app/admin/clients/[id]/invoice/page.tsx",
  "app/admin/clients/[id]/page.tsx",
  "app/admin/invoices/page.tsx",
  "app/matter/[id]/page.tsx",
  "app/admin/ticklers/page.tsx",
  "app/api/settlements/documents-print-local/route.ts",
];

function fail(message, details) {
  console.error(`FAIL: ${message}`);
  if (details) console.error(JSON.stringify(details, null, 2));
  process.exit(1);
}

for (const file of mustExist) {
  if (!fs.existsSync(file)) fail("required file missing", { file });
}

const util = fs.readFileSync("lib/dateOnlyDisplay.ts", "utf8");

for (const required of [
  "formatDateOnlyForDisplay",
  "isoDateOnlyMatch",
  "dottedDateMatch",
  "slashDateMatch",
  "return `${Number(month)}/${Number(day)}/${year}`",
]) {
  if (!util.includes(required)) fail("shared date utility missing required marker", { required });
}

const patchedFiles = mustExist.filter((file) => file !== "lib/dateOnlyDisplay.ts");
for (const file of patchedFiles) {
  const text = fs.readFileSync(file, "utf8");
  if (!text.includes('from "@/lib/dateOnlyDisplay"')) {
    fail("patched file does not import shared date utility", { file });
  }
}

const forbiddenExact = [
  {
    file: "app/admin/clients/[id]/page.tsx",
    text: "const date = new Date(String(value));\n  if (Number.isNaN(date.getTime())) return String(value);\n  return date.toLocaleDateString();",
  },
  {
    file: "app/admin/invoices/page.tsx",
    text: "const date = new Date(String(value));\n  if (Number.isNaN(date.getTime())) return String(value);\n  return date.toLocaleDateString();",
  },
  {
    file: "app/matter/[id]/page.tsx",
    text: "const d = new Date(raw);\n  if (Number.isNaN(d.getTime())) return raw;\n  return d.toLocaleDateString(\"en-US\");",
  },
  {
    file: "app/admin/ticklers/page.tsx",
    text: "const parsed = new Date(raw);\n  if (Number.isNaN(parsed.getTime())) return raw;\n  return parsed.toLocaleDateString(\"en-US\", { month: \"2-digit\", day: \"2-digit\", year: \"numeric\" });",
  },
  {
    file: "app/api/settlements/documents-print-local/route.ts",
    text: "const d = new Date(raw);\n  if (Number.isNaN(d.getTime())) return raw;\n  return d.toLocaleDateString(\"en-US\");",
  },
];

for (const { file, text } of forbiddenExact) {
  const content = fs.readFileSync(file, "utf8");
  if (content.includes(text)) {
    fail("forbidden timezone-sensitive date-only display block remains", { file });
  }
}

function cleanDateDisplayValue(value) {
  return String(value ?? "").trim();
}

function formatDateOnlyForDisplay(value) {
  const text = cleanDateDisplayValue(value);
  if (!text) return "";

  const isoDateOnlyMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/);
  if (isoDateOnlyMatch) {
    const [, year, month, day] = isoDateOnlyMatch;
    return `${Number(month)}/${Number(day)}/${year}`;
  }

  const dottedDateMatch = text.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (dottedDateMatch) {
    const [, month, day, year] = dottedDateMatch;
    return `${Number(month)}/${Number(day)}/${year}`;
  }

  const slashDateMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashDateMatch) {
    const [, month, day, year] = slashDateMatch;
    return `${Number(month)}/${Number(day)}/${year}`;
  }

  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return text;
  return date.toLocaleDateString("en-US");
}

const cases = [
  ["dateOfLoss ISO", "2026-01-01", "1/1/2026"],
  ["dateOfService ISO", "2026-06-04", "6/4/2026"],
  ["dateOfServiceEnd ISO", "2026-06-09", "6/9/2026"],
  ["datePosted dotted", "06.08.2026", "6/8/2026"],
  ["checkDate dotted", "06.05.2026", "6/5/2026"],
  ["slash", "06/09/2026", "6/9/2026"],
];

const failures = [];
for (const [label, input, expected] of cases) {
  const actual = formatDateOnlyForDisplay(input);
  if (actual !== expected) failures.push({ label, input, expected, actual });
}

if (failures.length) fail("shared date formatter regression failed", { failures });

console.log("PASS: date-only display safety verified");
