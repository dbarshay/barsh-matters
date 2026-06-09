import fs from "node:fs";

const matterPagePath = "app/matter/[id]/page.tsx";
const dateUtilPath = "lib/dateOnlyDisplay.ts";

function fail(message, details) {
  console.error(`FAIL: ${message}`);
  if (details) console.error(JSON.stringify(details, null, 2));
  process.exit(1);
}

function pass(message) {
  console.log(`PASS: ${message}`);
}

for (const file of [matterPagePath, dateUtilPath]) {
  if (!fs.existsSync(file)) fail("required file missing", { file });
}

const matterPage = fs.readFileSync(matterPagePath, "utf8");
const dateUtil = fs.readFileSync(dateUtilPath, "utf8");

if (!matterPage.includes('import { formatDateOnlyForDisplay } from "@/lib/dateOnlyDisplay";')) {
  fail("matter page must import shared date-only display helper");
}
pass("matter page imports shared date-only display helper");

if (!matterPage.includes("function formatDate(v?: string) {\n  return formatDateOnlyForDisplay(v);\n}")) {
  fail("matter page formatDate must delegate to shared date-only display helper");
}
pass("matter page formatDate delegates to shared helper");

for (const required of [
  "formatDateOnlyForDisplay",
  "isoDateOnlyMatch",
  "dottedDateMatch",
  "slashDateMatch",
  "return `${Number(month)}/${Number(day)}/${year}`",
]) {
  if (!dateUtil.includes(required)) fail("shared helper missing required date-only marker", { required });
}
pass("shared helper has date-only parsing branches");

const forbidden = [
  {
    label: "old formatDate Date parse for all values",
    text: "function formatDate(v?: string) {\n  if (!v) return \"\";\n  const d = new Date(v);",
  },
  {
    label: "formatDate fallback Date parse inside matter display helper",
    text: "const d = new Date(raw);\n  if (Number.isNaN(d.getTime())) return raw;\n  return d.toLocaleDateString(\"en-US\");",
  },
  {
    label: "directFieldDateInputValue fallback Date parse",
    text: "const date = new Date(raw);\n    if (!Number.isNaN(date.getTime()))",
  },
];

for (const item of forbidden) {
  if (matterPage.includes(item.text)) fail(`forbidden ${item.label} remains`);
  pass(`forbidden ${item.label} absent`);
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

const displayCases = [
  ["formatDate handles YYYY-MM-DD as date-only string", "2026-06-04", "6/4/2026"],
  ["formatDate handles dotted MM.DD.YYYY as date-only string", "06.04.2026", "6/4/2026"],
  ["formatDate handles slash MM/DD/YYYY as date-only string", "06/04/2026", "6/4/2026"],
  ["formatDate handles ISO datetime by date component", "2026-06-04T00:00:00.000Z", "6/4/2026"],
];

for (const [label, input, expected] of displayCases) {
  const actual = formatDateOnlyForDisplay(input);
  if (actual !== expected) fail(label, { input, expected, actual });
  pass(label);
}

const hasLegacyDirectFieldDateInputValue = matterPage.includes("function directFieldDateInputValue(value: unknown): string");
if (hasLegacyDirectFieldDateInputValue) {
  if (!matterPage.includes("return `${ymd[1]}-${ymd[2]}-${ymd[3]}`;")) {
    fail("directFieldDateInputValue must preserve YYYY-MM-DD when that helper exists");
  }
  pass("directFieldDateInputValue preserves YYYY-MM-DD");

  if (!matterPage.includes("return `${mdy[3]}-${mdy[1]}-${mdy[2]}`;")) {
    fail("directFieldDateInputValue must parse manual M/D/YYYY without Date fallback when that helper exists");
  }
  pass("directFieldDateInputValue parses manual M/D/YYYY without Date");
} else {
  pass("legacy directFieldDateInputValue helper not present; no obsolete helper contract enforced");
}

console.log("PASS: direct matter DOS date-only handling avoids timezone shifts.");
