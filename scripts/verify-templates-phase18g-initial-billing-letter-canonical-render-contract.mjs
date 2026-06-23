import fs from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";

const fixturePath = "test/fixtures/templates/templates-phase18g-initial-billing-letter-canonical-render-contract-fixture.json";

function fail(message) {
  console.error("FAIL: " + message);
  process.exit(1);
}

function pass(message) {
  console.log("PASS: " + message);
}

function xmlEscape(value) {
  return String(value)
    .split("&").join("&amp;")
    .split("<").join("&lt;")
    .split(">").join("&gt;")
    .split("\\\"").join("&quot;")
    .split("\\u0027").join("&apos;");
}

async function readZipXml(zip) {
  const names = Object.keys(zip.files)
    .filter((name) => name.endsWith(".xml"))
    .filter((name) => zip.files[name].dir === false)
    .sort();

  const entries = [];
  for (const name of names) {
    const text = await zip.files[name].async("string");
    entries.push({ name, text });
  }
  return entries;
}

const fixtureRaw = await fs.readFile(fixturePath, "utf8");
const fixture = JSON.parse(fixtureRaw);
const sourceDocx = fixture.sourceDocx;
const outputDocx = fixture.outputDocx;
const outputDir = fixture.outputDir;
const mergeMap = fixture.canonicalMergeMap;

await fs.access(sourceDocx).catch(() => fail("source DOCX missing: " + sourceDocx));
await fs.mkdir(outputDir, { recursive: true });

const sourceBuffer = await fs.readFile(sourceDocx);
const sourceZip = await JSZip.loadAsync(sourceBuffer);
const sourceXmlEntries = await readZipXml(sourceZip);
const sourceXml = sourceXmlEntries.map((entry) => entry.text).join("\\n");

const legacySourceMatches = sourceXml.match(/<<[^>]+>>/g) || [];
if (legacySourceMatches.length > 0) {
  fail("legacy tokens remain in source DOCX: " + Array.from(new Set(legacySourceMatches)).join(", "));
}
pass("source DOCX has no legacy <<...>> tokens");

const canonicalTokens = Object.keys(mergeMap);
const missingCanonical = canonicalTokens.filter((token) => sourceXml.indexOf(token) < 0);
if (missingCanonical.length > 0) {
  fail("source DOCX is missing expected canonical tokens: " + missingCanonical.join(", "));
}
pass("source DOCX contains all expected canonical tokens");

for (const entry of sourceXmlEntries) {
  let rendered = entry.text;
  for (const [token, value] of Object.entries(mergeMap)) {
    rendered = rendered.split(token).join(xmlEscape(value));
  }
  sourceZip.file(entry.name, rendered);
}

const renderedBuffer = await sourceZip.generateAsync({ type: "nodebuffer" });
await fs.writeFile(outputDocx, renderedBuffer);

const outputZip = await JSZip.loadAsync(renderedBuffer);
const outputXmlEntries = await readZipXml(outputZip);
const outputXml = outputXmlEntries.map((entry) => entry.text).join("\\n");

const canonicalOutputMatches = outputXml.match(/\{\{[^}]+\}\}/g) || [];
if (canonicalOutputMatches.length > 0) {
  fail("canonical tokens remain in rendered output: " + Array.from(new Set(canonicalOutputMatches)).join(", "));
}
pass("rendered output has no remaining {{...}} tokens");

const legacyOutputMatches = outputXml.match(/<<[^>]+>>/g) || [];
if (legacyOutputMatches.length > 0) {
  fail("legacy tokens appear in rendered output: " + Array.from(new Set(legacyOutputMatches)).join(", "));
}
pass("rendered output has no legacy <<...>> tokens");

const missingResolvedValues = Object.values(mergeMap)
  .map((value) => xmlEscape(value))
  .filter((value) => outputXml.indexOf(value) < 0);

if (missingResolvedValues.length > 0) {
  fail("rendered output is missing resolved values: " + missingResolvedValues.join(", "));
}
pass("rendered output contains all expected BRL_202600003 resolved values");

const report = {
  phase: fixture.phase,
  document: fixture.document,
  matter: fixture.matter,
  sourceDocx,
  outputDocx,
  tokenCount: canonicalTokens.length,
  resolvedValues: mergeMap
};
await fs.writeFile(path.join(outputDir, "phase18g-render-report.json"), JSON.stringify(report, null, 2) + "\\n");

pass("Phase 18G canonical render contract verified for " + fixture.matter);
