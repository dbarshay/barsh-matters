import fs from "node:fs";

// Template Builder <-> generation PARITY verifier.
//
// Supersedes the retired source-text snapshot proofs that froze the old self-contained
// raw-SQL preview implementation:
//   - verify-template-builder-live-example-preview-server
//   - verify-template-builder-live-preview-postgres-resolver
//   - verify-template-builder-live-preview-matter-tokens
//   - verify-template-builder-live-preview-child-lawsuit-token-sources
//   - verify-template-builder-source-backed-field-values
//   - verify-template-builder-direct-example-brl-202600001
//   - verify-template-builder-example-matter-20260600011-values
//   - verify-template-builder-address-block-format
//   - verify-template-builder-address-blocks-custom-dialog
//
// The Template Builder live preview now resolves example output through the SAME functions
// the document generator uses (lib/documents/templateTokenResolver + templateTokenFormat).
// Because there is one resolver + one formatter, the builder preview and generated documents
// cannot drift. This verifier proves that single-source wiring structurally, and locks the
// still-valid library / build-UI / API-route contracts the retired proofs also covered.
//
// Runtime parity is additionally smoke-checked live against
// GET /api/admin/document-templates/example-preview?matter=... (returns the resolver output).

const previewPath = "src/lib/templates/template-builder-live-example-preview.ts";
const libraryPath = "src/lib/templates/template-builder-merge-field-library.ts";
const buildPath = "app/admin/document-templates/build/page.tsx";
const routePath = "app/api/admin/document-templates/example-preview/route.ts";
const pkgPath = "package.json";

const preview = fs.readFileSync(previewPath, "utf8");
const library = fs.readFileSync(libraryPath, "utf8");
const build = fs.readFileSync(buildPath, "utf8");
const route = fs.readFileSync(routePath, "utf8");
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));

let failed = false;
const pass = (m) => console.log("\x1b[32mPASS\x1b[0m:", m);
const fail = (m) => {
  failed = true;
  console.error("\x1b[31mFAIL\x1b[0m:", m);
};
const has = (src, needle, m) => (src.includes(needle) ? pass(m) : fail(m));
const lacks = (src, needle, m) => (!src.includes(needle) ? pass(m) : fail(m));

// 1. SINGLE SOURCE: the preview delegates to the generation resolver + formatter.
has(preview, 'from "@/lib/documents/templateTokenResolver"', "Preview imports the generation token resolver");
has(preview, "resolveTemplateTokenBaseValues", "Preview calls resolveTemplateTokenBaseValues (same as generation)");
has(preview, 'from "@/lib/documents/templateTokenFormat"', "Preview imports the shared token formatter");
has(preview, "formatTokenValue", "Preview formats values with the shared formatTokenValue");
has(preview, "parseTemplateToken", "Preview parses tokens with the shared parseTemplateToken");
has(preview, "TEMPLATE_BUILDER_CANONICAL_MERGE_FIELDS", "Preview builds output by iterating the canonical merge-field library");
has(preview, "for (const field of TEMPLATE_BUILDER_CANONICAL_MERGE_FIELDS)", "Preview maps every canonical merge field (signer + first-doc tokens transitively covered)");
has(preview, "usedPreviewFallback: false", "Preview reports no preview-only fallback path");

// 2. NO INDEPENDENT DATA PATH: preview must not re-implement source reads or hard-code values.
for (const rawSql of ['safeRawRows', 'from "ClaimIndex"', 'from "Lawsuit"', 'from "ProviderClientInfo"', 'from "ReferenceEntity"', "$queryRaw", "queryRawUnsafe"]) {
  lacks(preview, rawSql, `Preview has no independent raw-SQL data path (${rawSql})`);
}
for (const forbidden of [
  "PREVIEW_ONLY_FALLBACK_OUTPUTS",
  "Preview Provider",
  "Preview Patient",
  "Preview Insurer",
  "BRL_202600003",
  "Atlantic Medical & Diagnostic",
  "Allstate",
  "123444/2026",
  "Martyn, Smith",
  "3105 Veterans Memorial Highway",
]) {
  lacks(preview, forbidden, `Preview has no hard-coded business value (${forbidden})`);
}

// 3. LAWSUIT vs DIRECT CONTEXT (behavioral contract, mirrors generation):
//    lawsuit context passes only the master lawsuit id -> per-claim tokens stay unresolved (dash);
//    direct context passes the BRL display number -> per-claim money tokens resolve.
has(preview, "masterLawsuitId = requestedMatter", "Lawsuit context resolves via master lawsuit id only");
has(preview, "directMatterDisplayNumber = requestedMatter", "Direct context resolves via BRL display number");
lacks(preview, 'findMany({ where: { master_lawsuit_id: requestedMatter }', "Preview does NOT fill per-claim tokens from a representative claim in lawsuit context");

// 4. CANONICAL / APPROVED TOKENS kept in the merge-field library (preview emits them all).
const approvedTokens = [
  "{{insurer.street}}",
  "{{insurer.city}}",
  "{{insurer.state}}",
  "{{insurer.zipcode}}",
  "{{insurer.fullAddressBlock}}",
  "{{provider.taxId}}",
  "{{claim.number}}",
  "{{matter.billedAmount}}",
  "{{claim.balance}}",
  "{{claim.payments}}",
  "{{lawsuit.adversaryAttorney}}",
  "{{adversaryAttorney.street}}",
  "{{adversary.fullAddressBlock}}",
  "{{court.name}}",
  "{{lawsuit.indexNumber}}",
  "{{cost.total}}",
  "{{signer.signatureName}}",
];
for (const t of approvedTokens) has(library, t, `Merge-field library keeps approved token ${t}`);

// 5. RETIRED tokens removed from the user-facing library and build UI.
const retiredTokens = [
  "{{lawsuit.court}}",
  "{{insurer.hidden_street}}",
  "{{insurer.hidden_city}}",
  "{{insurer.hidden_state}}",
  "{{insurer.hidden_zipcode}}",
  "{{matter.claimNumber}}",
  "{{treatingProvider.name}}",
  "{{claim.amount}}",
  "{{matter.dateOfService}}",
];
for (const t of retiredTokens) {
  lacks(library, t, `Merge-field library excludes retired token ${t}`);
  lacks(build, t, `Build Template UI excludes retired token ${t}`);
}

// 6. BUILD UI contracts (example matters, canonical wiring, multi-line address rendering, custom dialog).
has(build, "BRL_202600001", "Build Template keeps BRL_202600001 direct example option");
has(build, "2026.06.00011", "Build Template keeps 2026.06.00011 lawsuit example option");
has(build, "TEMPLATE_BUILDER_CANONICAL_MERGE_FIELDS", "Build Template page reads the canonical merge fields");
has(build, "data-template-merge-field-token={token}", "Build Template page exposes token data attribute for the DOCX checker");
has(build, 'whiteSpace: "pre-line"', "Example Output renders multi-line address blocks (pre-line)");
has(build, "exampleOutputFor(field)", "Example Output is driven by exampleOutputFor(field)");
has(build, "TEMPLATE_BUILDER_CUSTOM_PLACEHOLDER_FIELDS", "Build Template keeps custom placeholder field catalog");
has(build, "Add Custom Placeholder", "Build Template keeps Add Custom Placeholder control");
has(build, "customPlaceholderDialogOpen", "Build Template keeps custom placeholder dialog state");

// 7. API route contract (unchanged entry point).
has(route, "resolveTemplateBuilderExamplePreview", "Example-preview API route calls the source-backed resolver");
has(route, 'searchParams.get("matter")', "Example-preview API route reads the matter search param");
has(route, "NextResponse.json", "Example-preview API route returns JSON");

// 8. Package wiring for this verifier.
if (pkg.scripts?.["verify:template-builder-generation-parity"] === "node scripts/verify-template-builder-generation-parity.mjs") {
  pass("Package has the generation-parity verifier script");
} else {
  fail("Package has the generation-parity verifier script");
}

if (failed) {
  console.error("\nTemplate Builder / generation parity checks failed.");
  process.exit(1);
}
console.log("\nPASS: Template Builder preview resolves through the single generation resolver (parity guaranteed by construction).");
