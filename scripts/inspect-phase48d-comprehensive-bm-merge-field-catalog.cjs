const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "docs", "template-generation-refactor");
const JSON_OUT = path.join(OUT_DIR, "phase48d-comprehensive-bm-merge-field-catalog-inspection.json");
const MD_OUT = path.join(OUT_DIR, "phase48d-comprehensive-bm-merge-field-catalog-inspection.md");

function readIfExists(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
}
function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) {
      if (!["node_modules", ".next", ".git", "coverage", "dist"].includes(name)) walk(full, out);
    } else if (/\.(ts|tsx|js|jsx|cjs|md)$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}
function camelField(model, field) {
  const source = `${model}.${field}`
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/);
  if (!source.length) return "";
  const words = source.map((w) => w.toLowerCase());
  return words[0] + words.slice(1).map((w) => w[0].toUpperCase() + w.slice(1)).join("");
}
function classifyModel(modelName) {
  const lower = modelName.toLowerCase();
  if (/(claim|matter|direct)/.test(lower)) return ["pre_suit", "direct_matter"];
  if (/(lawsuit|court|calendar|appearance|venue)/.test(lower)) return ["lawsuit", "pleading_layout"];
  if (/(settlement|settled)/.test(lower)) return ["settlement"];
  if (/(payment|receipt|invoice|remit|providerclientinvoice|providerclient)/.test(lower)) return ["payment", "invoice_remittance_reference"];
  if (/(documenttemplate|template|mergefield)/.test(lower)) return ["template_repository"];
  if (/(adminuser|user|role|permission)/.test(lower)) return ["signer_profile", "admin"];
  if (/(audit|history|log|tickler|workflow)/.test(lower)) return ["hidden_internal", "workflow"];
  if (/(reference|entity|alias|contact)/.test(lower)) return ["reference_data", "addressee"];
  return ["general"];
}
function classifyField(fieldName) {
  const lower = fieldName.toLowerCase();
  const tags = [];
  if (/(id|uuid|createdat|updatedat|deletedat|metadata|json|snapshot|hash|token|key|status|audit|log|internal|hidden|raw)/.test(lower)) tags.push("hidden_internal");
  if (/(name|display|patient|provider|insurer|claim|court|venue|index|date|amount|balance|phone|fax|email|address|city|state|zip|title|number)/.test(lower)) tags.push("visible_or_document_relevant");
  if (/(email|fax|phone|extension|user|signer|attorney)/.test(lower)) tags.push("signer_or_contact");
  if (/(address|court|insurer|adversary|settled|contact)/.test(lower)) tags.push("addressee_candidate");
  if (/(claim|patient|provider|insurer|index|matter|lawsuit|dateofloss|dos)/.test(lower)) tags.push("re_line_candidate");
  return tags.length ? tags : ["needs_review"];
}
function parsePrismaModels(schemaText) {
  const models = [];
  const re = /model\s+(\w+)\s*\{([\s\S]*?)\n\}/g;
  let m;
  while ((m = re.exec(schemaText))) {
    const modelName = m[1];
    const body = m[2];
    const fields = [];
    for (const rawLine of body.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("//") || line.startsWith("@@")) continue;
      const parts = line.split(/\s+/);
      const fieldName = parts[0];
      const fieldType = parts[1] || "";
      if (!fieldName || fieldName.startsWith("@")) continue;
      const isRelation = /[A-Z]/.test(fieldType[0] || "") && !["String", "Int", "BigInt", "Float", "Decimal", "Boolean", "DateTime", "Json", "Bytes"].includes(fieldType.replace(/[?\[\]]/g, ""));
      fields.push({
        fieldName,
        fieldType,
        candidateMergeField: camelField(modelName, fieldName),
        classifications: classifyField(fieldName),
        relationLike: isRelation,
        requiredBySchema: !fieldType.includes("?") && !fieldType.includes("[]"),
        source: "prisma_schema",
      });
    }
    models.push({
      modelName,
      workflowTags: classifyModel(modelName),
      fields,
    });
  }
  return models;
}
function extractUiLabels(files) {
  const labels = [];
  const seen = new Set();
  for (const full of files) {
    const rel = path.relative(ROOT, full);
    const text = readIfExists(full);
    if (!/(label|placeholder|title|dt|th|Field|Patient|Provider|Insurer|Claim|Court|Invoice|Remit|Settlement|Signer|Addressee|Re:)/i.test(text)) continue;
    const patterns = [
      /label:\s*["'`]([^"'`]{2,80})["'`]/g,
      /placeholder=\{?["'`]([^"'`]{2,80})["'`]\}?/g,
      /<label[^>]*>([^<]{2,80})<\/label>/g,
      /<th[^>]*>([^<]{2,80})<\/th>/g,
      /<dt[^>]*>([^<]{2,80})<\/dt>/g,
      /aria-label=\{?["'`]([^"'`]{2,80})["'`]\}?/g,
    ];
    for (const re of patterns) {
      let m;
      while ((m = re.exec(text))) {
        const label = String(m[1] || "").replace(/\s+/g, " ").trim();
        if (!label || /[{}<>;]/.test(label) || label.length > 80) continue;
        const key = `${rel}::${label}`;
        if (seen.has(key)) continue;
        seen.add(key);
        labels.push({
          file: rel,
          label,
          candidateMergeField: label
            .replace(/[^a-zA-Z0-9]+/g, " ")
            .trim()
            .split(/\s+/)
            .map((w, i) => i === 0 ? w.toLowerCase() : w[0].toUpperCase() + w.slice(1).toLowerCase())
            .join(""),
          source: "ui_source_scan",
        });
      }
    }
  }
  return labels;
}
function pickModelSummary(models) {
  return models.map((model) => ({
    modelName: model.modelName,
    workflowTags: model.workflowTags,
    fieldCount: model.fields.length,
    visibleOrDocumentRelevantCount: model.fields.filter((f) => f.classifications.includes("visible_or_document_relevant")).length,
    hiddenInternalCount: model.fields.filter((f) => f.classifications.includes("hidden_internal")).length,
  }));
}
function selectHighValueFields(models) {
  const wantedModels = /(claim|matter|lawsuit|providerclient|invoice|payment|receipt|settlement|court|calendar|reference|adminuser|documenttemplate|mergefield|tickler|audit)/i;
  const rows = [];
  for (const model of models) {
    if (!wantedModels.test(model.modelName)) continue;
    for (const field of model.fields) {
      if (field.relationLike) continue;
      rows.push({
        modelName: model.modelName,
        fieldName: field.fieldName,
        fieldType: field.fieldType,
        candidateMergeField: field.candidateMergeField,
        workflowTags: model.workflowTags,
        classifications: field.classifications,
        requiredBySchema: field.requiredBySchema,
      });
    }
  }
  return rows.slice(0, 500);
}

fs.mkdirSync(OUT_DIR, { recursive: true });

const schemaPath = path.join(ROOT, "prisma", "schema.prisma");
const schemaText = readIfExists(schemaPath);
const models = parsePrismaModels(schemaText);
const sourceFiles = walk(path.join(ROOT, "app")).concat(walk(path.join(ROOT, "components"))).concat(walk(path.join(ROOT, "lib")));
const uiLabels = extractUiLabels(sourceFiles);

const layoutFields = {
  letterhead: [
    "todayLong",
    "signerName",
    "signerTitle",
    "signerPhoneExtension",
    "signerFax",
    "signerEmail",
    "firmAddressLine1",
    "firmAddressLine2",
    "addresseeSourceType",
    "addresseeRole",
    "addresseeName",
    "addresseeCompany",
    "addresseeAttentionLine",
    "addresseeAddressLine1",
    "addresseeAddressLine2",
    "addresseeAddressLine3",
    "addresseeEmail",
    "addresseeFax",
    "reLine1",
    "reLine2",
    "reMatterNumber",
    "rePatientName",
    "reProviderName",
    "reInsurerName",
    "reClaimNumber",
    "reIndexNumber",
    "reDateOfLoss",
  ],
  pleading_paper: [
    "courtName",
    "courtVenue",
    "courtAddressLine1",
    "courtAddressCityStateZip",
    "plaintiffName",
    "defendantName",
    "indexNumber",
    "pleadingTitle",
    "matterNumber",
    "attorneyName",
    "todayLong",
  ],
};

const proof = {
  ok: models.length > 0,
  action: "phase48d-comprehensive-bm-merge-field-catalog-inspection",
  scope: {
    allVisibleUiFields: true,
    allNonViewableDatabaseFields: true,
    hiddenInternalFields: true,
    layoutFields: true,
    templateSpecificFields: true,
  },
  schemaPath: fs.existsSync(schemaPath) ? "prisma/schema.prisma" : null,
  modelCount: models.length,
  totalSchemaFieldCount: models.reduce((sum, m) => sum + m.fields.length, 0),
  uiSourceFileCount: sourceFiles.length,
  uiLabelCandidateCount: uiLabels.length,
  workflowBuckets: [
    "lawsuit",
    "pre_suit",
    "direct_matter",
    "settlement",
    "letterhead",
    "pleading_paper",
    "invoice_remittance_reference",
    "signer_profile",
    "addressee",
    "hidden_internal",
    "template_repository",
  ],
  modelSummary: pickModelSummary(models),
  highValueCandidateFields: selectHighValueFields(models),
  uiLabelCandidates: uiLabels.slice(0, 350),
  layoutFields,
  uncertainMappingPolicy: "Ask Dave before mapping any ambiguous field, duplicate source, legacy placeholder, hidden/internal field, or addressee/signer/Re source.",
  safety: {
    readOnlyInspection: true,
    noDatabaseMutation: true,
    noClioTouched: true,
    noGraphTouched: true,
    noFinalization: true,
    noFieldMapping: true,
    noTemplateConversion: true,
  },
};

fs.writeFileSync(JSON_OUT, JSON.stringify(proof, null, 2));

const modelLines = proof.modelSummary.slice(0, 120).map((m) => `- \`${m.modelName}\`: ${m.fieldCount} fields; workflow tags: ${m.workflowTags.join(", ")}; visible/document-relevant: ${m.visibleOrDocumentRelevantCount}; hidden/internal: ${m.hiddenInternalCount}`).join("\n");
const fieldLines = proof.highValueCandidateFields.slice(0, 160).map((f) => `- \`${f.modelName}.${f.fieldName}\` → \`{{${f.candidateMergeField}}}\` [${f.workflowTags.join(", ")}; ${f.classifications.join(", ")}]`).join("\n");
const uiLines = proof.uiLabelCandidates.slice(0, 120).map((u) => `- \`${u.label}\` → \`{{${u.candidateMergeField}}}\` from \`${u.file}\``).join("\n");

const md = `# Phase 48D — Comprehensive Barsh Matters Merge-Field Catalog Inspection

## Status

Read-only inspection only. This phase does not map fields into templates.

## Scope Locked

The comprehensive Barsh Matters merge-field catalog must include:

- all visible UI fields in Barsh Matters
- all non-viewable fields in database tables already created
- hidden/internal fields needed for document generation, reporting, audit, and workflow logic
- layout-level merge fields for letterhead and pleading paper
- signer, addressee-source, and Re fields
- template-specific fields from uploaded DOCX placeholders

## Inspection Sources

- Prisma schema: \`${proof.schemaPath || "not found"}\`
- Source files scanned for UI labels and field labels: ${proof.uiSourceFileCount}
- Prisma models found: ${proof.modelCount}
- Prisma fields found: ${proof.totalSchemaFieldCount}
- UI label candidates found: ${proof.uiLabelCandidateCount}

## Workflow Buckets

${proof.workflowBuckets.map((w) => `- \`${w}\``).join("\n")}

## Layout Fields Already Identified

### Letterhead

${proof.layoutFields.letterhead.map((f) => `- \`{{${f}}}\``).join("\n")}

### Pleading Paper

${proof.layoutFields.pleading_paper.map((f) => `- \`{{${f}}}\``).join("\n")}

## Model Summary

${modelLines || "- No model summary generated."}

## High-Value Schema Field Candidates

${fieldLines || "- No high-value schema fields generated."}

## UI Label Candidates

${uiLines || "- No UI label candidates generated."}

## Mapping Policy

Ask Dave before mapping any ambiguous field, duplicate source, legacy placeholder, hidden/internal field, addressee source, signer source, or Re field.

## Next Recommended Phase

Phase 48E should turn this inspection into a reviewed canonical merge-field catalog proposal. It should group fields by workflow and identify uncertain mappings for Dave before any DB write, DOCX conversion, or template mapping.

## Safety

This phase performs no database mutation, no Clio action, no Graph/OneDrive action, no document finalization, no template conversion, and no field mapping.
`;
fs.writeFileSync(MD_OUT, md);

console.log(JSON.stringify({
  ok: proof.ok,
  modelCount: proof.modelCount,
  totalSchemaFieldCount: proof.totalSchemaFieldCount,
  uiSourceFileCount: proof.uiSourceFileCount,
  uiLabelCandidateCount: proof.uiLabelCandidateCount,
  json: path.relative(ROOT, JSON_OUT),
  md: path.relative(ROOT, MD_OUT),
  safety: proof.safety,
}, null, 2));
