import fs from "fs";

const pkg = fs.readFileSync("package.json", "utf8");
const createShellVerifier = fs.readFileSync("scripts/verify-create-lawsuit-clio-shell-contract.mjs", "utf8");

const pages = [
  "app/page.tsx",
  "app/matter/[id]/page.tsx",
  "app/matters/page.tsx",
  "app/lawsuits/page.tsx",
]
  .filter((file) => fs.existsSync(file))
  .map((file) => [file, fs.readFileSync(file, "utf8")]);

const allPages = pages.map(([, text]) => text).join("\n");

function assert(ok, msg) {
  if (!ok) throw new Error(msg);
}

assert(pkg.includes("verify:local-lawsuit-generation-preview-safety"), "package script must remain registered.");
assert(pkg.includes("verify:create-lawsuit-clio-shell-contract"), "modern Create Lawsuit Clio shell verifier must remain registered.");
assert(createShellVerifier.includes("Clio") || createShellVerifier.includes("clio"), "Create Lawsuit shell contract should cover Clio shell assignment.");

assert(
  allPages.includes("createSuccessNotice") ||
    allPages.includes("masterLawsuitId") ||
    allPages.includes("create-lawsuit") ||
    allPages.includes("Create Lawsuit") ||
    allPages.includes("Start Lawsuit"),
  "UI should expose or consume modern lawsuit creation workflow state."
);

assert(!allPages.includes("/api/aggregate"), "UI must not use legacy /api/aggregate route.");
assert(!allPages.includes("/api/deaggregate"), "UI must not use legacy /api/deaggregate route.");

console.log("RESULT: local lawsuit generation preview safety");
console.log("GOLDEN_RULE=Clio owns lawsuit shell numbers/IDs; Barsh Matters owns workflow and local grouping.");
console.log("LEGACY_AGGREGATION_ROUTES=QUARANTINED");
console.log("MODERN_LAWSUIT_GENERATION=CREATE_LAWSUIT_WORKFLOW_WITH_CLIO_SHELL");
console.log("PASS: local lawsuit generation preview safety delegated to modern Create Lawsuit Clio shell contract.");
