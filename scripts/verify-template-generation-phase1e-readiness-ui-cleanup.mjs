import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const roots = ["app", "src", "components", "pages"];
const extensions = new Set([".tsx", ".ts", ".jsx", ".js"]);
const forbiddenPhrases = [
  "Template Builder Phase 1 prepares",
  "This readiness surface is scoped",
  "Phase 1 readiness guardrails",
  "Required storage namespaces",
  "Template creation readiness gate",
  "Phase 5 confirms the app is ready",
  "No template creation or upload is wired yet"
];

const failures = [];

function walk(dir) {
  if (!existsSync(dir)) return [];
  const found = [];
  for (const name of readdirSync(dir)) {
    if ([".git", ".next", "node_modules"].includes(name)) continue;
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) found.push(...walk(path));
    else if (extensions.has(extname(path))) found.push(path);
  }
  return found;
}

for (const root of roots) {
  for (const file of walk(root)) {
    const text = readFileSync(file, "utf8");
    for (const phrase of forbiddenPhrases) {
      if (text.includes(phrase)) {
        failures.push(file + " still contains UI readiness phrase: " + phrase);
      }
    }
  }
}

if (failures.length) {
  console.error("FAIL: Template Generation Phase 1E readiness UI cleanup verifier");
  for (const failure of failures) console.error("- " + failure);
  process.exit(1);
}

console.log("PASS: Template Generation Phase 1E readiness UI copy/cards removed");
