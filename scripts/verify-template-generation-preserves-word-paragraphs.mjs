import fs from "node:fs";

const route = fs.readFileSync("app/api/documents/templates/generate-preview/route.ts", "utf8");
const failures = [];
const must = (condition, message) => { if (!condition) failures.push(message); };

must(route.includes("function replaceTokenInsideTextScope"), "missing scoped text replacement helper");
must(route.includes("function replaceTokenAcrossTextNodes"), "missing replacement entrypoint");
must(route.includes("const paragraphRegex = /<w:p"), "replacement must scope replacements to Word paragraphs");
must(route.includes("xml.replace(paragraphRegex"), "replacement must replace paragraph-by-paragraph");
must(route.includes("Do not build one full text stream for the whole document part"), "route must document paragraph-boundary safety");
must(route.includes("return { xml: xmlWithParagraphReplacements, count }"), "paragraph replacements must return before whole-part fallback");
must(route.includes("xmlEscape(changed[index])"), "replacement must escape text only");
must(!route.includes("xmlTextWithBreaks"), "replacement must not inject raw break XML");
must(!route.includes("signerReplacementValueForContext"), "replacement must not force signer layout");
must(!route.includes("normalizeSignatureBreaksBeforeGeneration"), "replacement must not normalize template XML before replacement");
must(route.includes('where: { storageKind: "db-docx-base64" }'), "generation must still select stored DOCX versions");
must(route.includes('orderBy: [{ versionNumber: "desc" }, { createdAt: "desc" }]'), "generation must still select latest version first");
must(route.includes("clioWrites: false"), "generation safety must still block Clio writes");
must(route.includes("graphWrites: false"), "generation safety must still block Graph writes");
must(route.includes("emailsSent: false"), "generation safety must still block emails");
must(route.includes("printQueued: false"), "generation safety must still block print queue");
must(route.includes("draftsCreated: false"), "generation safety must still block drafts");

if (failures.length) {
  console.error("FAILURES=" + failures.length);
  for (const failure of failures) console.error("FAIL=" + failure);
  process.exit(1);
}
console.log("PASS: template generation preserves Word paragraphs during token replacement");
