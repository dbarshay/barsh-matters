import fs from "node:fs";

const route = fs.readFileSync("app/api/documents/templates/generate-preview/route.ts", "utf8");
const failures = [];
const must = (condition, message) => { if (!condition) failures.push(message); };

const templateNullIndex = route.indexOf('if (!template) {');
const selectedIndex = route.indexOf('let selectedVersionForGeneration: any = null;');
const metadataIndex = route.indexOf('const metadata = template.metadata');

must(route.includes('const searchParams = req.nextUrl.searchParams'), "generate-preview must use req.nextUrl.searchParams");
must(route.includes('const key = clean(searchParams.get("key"))'), "generate-preview must read key from searchParams");
must(route.includes('const versionId = clean(searchParams.get("versionId"))'), "generate-preview must read optional versionId query param");
must(!route.includes("currentVersion: true"), "generate-preview must not include a Prisma currentVersion relation");
must(!route.includes("template.currentVersion"), "generate-preview must not depend on template.currentVersion relation");
must(route.includes("versions: {"), "generate-preview must include template versions");
must(route.includes('where: { storageKind: "db-docx-base64" }'), "latest selection must only consider stored DB DOCX versions");
must(route.includes('orderBy: [{ versionNumber: "desc" }, { createdAt: "desc" }]'), "latest selection must order versions newest-first");
must(templateNullIndex >= 0, "template null check must exist");
must(selectedIndex > templateNullIndex, "selected version logic must run after template null check");
must(metadataIndex > selectedIndex, "production-ready metadata check must run after selected version is resolved");
must(route.includes("if (versionId)"), "explicit versionId must remain supported");
must(route.includes("template.versions[0]"), "default generation must use latest stored DOCX version");
must(route.includes("const currentVersion = selectedVersionForGeneration"), "generation must use selected version");
must(route.includes("Buffer.from(currentVersion.contentText"), "DOCX source must come from selected version");
must(route.includes('"X-Barsh-Matters-Selected-Version-Id"'), "response must expose selected version id");
must(route.includes('"X-Barsh-Matters-Requested-Version-Id"'), "response must expose requested version id");
must(route.includes('"X-Barsh-Matters-Latest-Version-Default"'), "response must expose latest-version default flag");
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
