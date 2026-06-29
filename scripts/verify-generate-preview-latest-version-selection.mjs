import fs from "node:fs";

const route = fs.readFileSync("app/api/documents/templates/generate-preview/route.ts", "utf8");
const failures = [];
const must = (condition, message) => { if (!condition) failures.push(message); };

must(route.includes('const versionId = searchParams.get("versionId")'), "generate-preview must read optional versionId query param");
must(route.includes("versions: {"), "generate-preview must include template versions");
must(route.includes('where: { storageKind: "db-docx-base64" }'), "latest selection must only consider stored DB DOCX versions");
must(route.includes('orderBy: [{ versionNumber: "desc" }, { createdAt: "desc" }]'), "latest selection must order versions newest-first");
must(route.includes("selectedVersionForGeneration"), "generate-preview must compute selected generation version");
must(route.includes("versionId ?") || route.includes("if (versionId)"), "explicit versionId must remain supported");
must(route.includes("template.versions[0]"), "default generation must use latest stored DOCX version");
must(route.includes("template.currentVersion = selectedVersionForGeneration"), "selected version must override template.currentVersion for generation");
must(route.includes('"x-barsh-matters-selected-version-id"'), "response must expose selected version id");
must(route.includes('"x-barsh-matters-latest-version-default"'), "response must expose latest-version default flag");
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

console.log("PASS: generate-preview defaults to latest stored DOCX version safely");
