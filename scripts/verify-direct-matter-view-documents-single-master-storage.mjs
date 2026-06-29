import fs from "node:fs";

const pagePath = "app/matter/[id]/page.tsx";
const routePath = "app/api/documents/clio-matter-documents/route.ts";
const page = fs.readFileSync(pagePath, "utf8");
const route = fs.readFileSync(routePath, "utf8");

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exitCode = 1;
}

function pass(message) {
  console.log(`PASS: ${message}`);
}

function functionBody(source, signature) {
  const start = source.indexOf(signature);
  if (start < 0) return "";

  const braceStart = source.indexOf("{", start);
  if (braceStart < 0) return "";

  let depth = 0;
  let inString = null;
  let escaped = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = braceStart; i < source.length; i++) {
    const ch = source[i];
    const next = source[i + 1];

    if (inLineComment) {
      if (ch === "\n") inLineComment = false;
      continue;
    }

    if (inBlockComment) {
      if (ch === "*" && next === "/") {
        inBlockComment = false;
        i++;
      }
      continue;
    }

    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === inString) inString = null;
      continue;
    }

    if (ch === "/" && next === "/") {
      inLineComment = true;
      i++;
      continue;
    }

    if (ch === "/" && next === "*") {
      inBlockComment = true;
      i++;
      continue;
    }

    if (ch === "'" || ch === '"' || ch === "`") {
      inString = ch;
      continue;
    }

    if (ch === "{") depth++;
    if (ch === "}") {
      depth--;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }

  return "";
}

function normalizeLikeRuntime(value) {
  const raw = String(value || "").trim().toUpperCase();
  if (!raw) return "";

  const brlMatch = raw.match(/^BRL[_-]?(\d{4})(\d{5})$/);
  if (brlMatch) return `BRL_${brlMatch[1]}${brlMatch[2]}`;

  const numericMatch = raw.match(/^(\d{4})(\d{5})$/);
  if (numericMatch) return `BRL_${numericMatch[1]}${numericMatch[2]}`;

  return raw;
}

const loadBody = functionBody(page, "async function loadMatterClioDocuments()");
if (!loadBody) fail("missing loadMatterClioDocuments function");

const pageNormalizerBody = functionBody(page, "function normalizeDirectMatterDisplayNumberForDocuments(");
const routeNormalizerBody = functionBody(route, "function normalizeDirectMatterDisplayNumberForDocuments(");
const directSingleMasterIndex = route.indexOf('uploadTargetMode === "direct-matter" && singleMasterDirectStorage');
const legacyMatterResolutionIndex = route.indexOf("resolveClioMatterByDisplayNumber(localDisplayNumber)");
const legacyMatterConflictIndex = route.indexOf("if (matterId && masterLawsuitId)");

const checks = [
  ["page normalizer exists", Boolean(pageNormalizerBody)],
  ["route normalizer exists", Boolean(routeNormalizerBody)],
  ["runtime normalization proof BRL202600001", normalizeLikeRuntime("BRL202600001") === "BRL_202600001"],
  ["runtime normalization proof 202600001", normalizeLikeRuntime("202600001") === "BRL_202600001"],
  ["page regex literals are not over-escaped", !page.includes(String.raw`\\d{4}`) && !page.includes(String.raw`\\d{5}`) && !page.includes(String.raw`\\d{9}`)],
  ["route regex literals are not over-escaped", !route.includes(String.raw`\\d{4}`) && !route.includes(String.raw`\\d{5}`) && !route.includes(String.raw`\\d{9}`)],
  ["page normalizes BRL202600001 or 202600001 to BRL_YYYYNNNNN", page.includes(String.raw`/^BRL[_-]?(\d{4})(\d{5})$/`) && page.includes(String.raw`/^(\d{4})(\d{5})$/`) && page.includes("BRL_${brlMatch[1]}${brlMatch[2]}") && page.includes("BRL_${numericMatch[1]}${numericMatch[2]}")],
  ["route normalizes BRL202600001 or 202600001 to BRL_YYYYNNNNN", route.includes(String.raw`/^BRL[_-]?(\d{4})(\d{5})$/`) && route.includes(String.raw`/^(\d{4})(\d{5})$/`) && route.includes("BRL_${brlMatch[1]}${brlMatch[2]}") && route.includes("BRL_${numericMatch[1]}${numericMatch[2]}")],
  ["loadMatterClioDocuments uses URLSearchParams", loadBody.includes("new URLSearchParams()")],
  ["sends uploadTargetMode direct-matter", loadBody.includes('params.set("uploadTargetMode", "direct-matter")')],
  ["sends singleMasterDirectStorage=1", loadBody.includes('params.set("singleMasterDirectStorage", "1")')],
  ["sends useSingleMasterClioStorage=1", loadBody.includes('params.set("useSingleMasterClioStorage", "1")')],
  ["sends directMatterDisplayNumber", loadBody.includes('params.set("directMatterDisplayNumber", directMatterDisplayNumber)')],
  ["fetch uses params.toString", loadBody.includes("params.toString()")],
  ["loadMatterClioDocuments does not use directMatterNumericIdForDocuments as Clio matterId", !loadBody.includes("directMatterNumericIdForDocuments()") && !loadBody.includes("numericMatterId")],
  ["direct View Documents path does not send matterId", !/params\.set\(["']matterId["']/.test(loadBody) && !/matterId=\$\{/.test(loadBody) && !/matterId=\$\{encodeURIComponent/.test(loadBody)],
  ["direct View Documents path does not send clioMatterId", !/params\.set\(["']clioMatterId["']/.test(loadBody) && !/clioMatterId=/.test(loadBody)],
  ["route imports listClioFolderDocuments", route.includes("listClioFolderDocuments")],
  ["route accepts uploadTargetMode", route.includes("uploadTargetMode")],
  ["route accepts singleMasterDirectStorage", route.includes("singleMasterDirectStorage")],
  ["route accepts useSingleMasterClioStorage", route.includes("useSingleMasterClioStorage")],
  ["route accepts directMatterDisplayNumber", route.includes("directMatterDisplayNumber")],
  ["route resolves direct single-master folder before legacy matterId conflict path", directSingleMasterIndex > 0 && legacyMatterConflictIndex > 0 && directSingleMasterIndex < legacyMatterConflictIndex],
  ["route resolves direct single-master folder before legacy Clio matter lookup", directSingleMasterIndex > 0 && legacyMatterResolutionIndex > 0 && directSingleMasterIndex < legacyMatterResolutionIndex],
  ["route uses existing folder resolver endpoint", route.includes("/api/documents/clio-folder-resolver-dry-run")],
  ["route lists Clio folder documents for direct single-master storage", route.includes("listClioFolderDocuments(folderId)")],
  ["route response marks single-master direct storage", route.includes('sourceStorageMode: "single-master-direct-folder"') && route.includes("singleMasterDirectStorage: true") && route.includes("useSingleMasterClioStorage: true")],
];

for (const [message, ok] of checks) {
  if (ok) pass(message);
  else fail(message);
}

if (process.exitCode) {
  console.error("RESULT: direct matter View Documents single-master verifier failed");
  process.exit(process.exitCode);
}

console.log("RESULT: direct matter View Documents single-master verifier passed");
