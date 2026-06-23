#!/usr/bin/env node
const fs = require('fs');
const docPath = 'docs/template-repository/templates-phase2-layout-composition-metadata-schema-proposal.md';
const scriptPath = 'scripts/verify-templates-phase2-layout-composition-metadata-schema-proposal.cjs';
function fail(message) { console.error(`FAIL: ${message}`); process.exit(1); }
function pass(message) { console.log(`PASS: ${message}`); }
if (!fs.existsSync(docPath)) fail(`missing ${docPath}`);
if (!fs.existsSync(scriptPath)) fail(`missing ${scriptPath}`);
const doc = fs.readFileSync(docPath, 'utf8');
const requiredPhrases = [
  'Templates Phase 2 — Layout Composition Metadata Schema Proposal',
  'docs-only',
  'repository-side metadata',
  'templateId',
  'templateDisplayName',
  'templateKind',
  'templateStatus',
  'generationEligible',
  'layoutComposition',
  'requiredMergeFields',
  'signerRequirements',
  'addresseeRequirements',
  'workflowApplicability',
  'assets',
  'role',
  'assetId',
  'assetKind',
  'mode',
  'versionPolicy',
  'pinnedVersion',
  'order',
  'flowAfterAsset',
  'pageNumberingPolicy',
  'relationshipToOtherAssets',
  'duplicateRolePolicy',
  'compatibilityPolicy',
  'cover_fax',
  'letterhead',
  'pleading_paper',
  'cover_page',
  'fax_transmittal',
  'include_cover_in_total_and_show_number',
  'include_cover_in_total_but_hide_number',
  'exclude_cover_and_start_body_at_one',
  'template_specific',
  'new_page',
  'same_page_continuation',
  'section_specific',
  'latest_approved',
  'pinned',
  'ordinary users are blocked',
  'admin/template-management testing may allow warnings',
  'Duplicate layout roles are blocked by default',
  'exception must include a non-empty reason',
  'production templates may not override individual internal layout asset settings',
  'visible asset chain',
  'resolved asset version',
  'blocked reasons',
  'required missing fields',
  'missing signer fields',
  'missing addressee fields',
  'settled_with_contact resolves only from settlement contact data',
  'On lawsuit/master matters, the lawsuit matter insurer controls',
  'Invoices and remittance documents remain app-generated/code-rendered',
  'Layout assets are also DOCX-based repository assets, but they are non-generation assets',
  'must not appear as standalone Generate Documents choices',
  'This phase does not'
];
for (const phrase of requiredPhrases) if (!doc.includes(phrase)) fail(`document missing required phrase: ${phrase}`);
const forbiddenImplementationClaims = [
  'This phase implements runtime schema validation',
  'This phase mutates the database',
  'This phase alters Prisma',
  'This phase edits DOCX files',
  'This phase converts DOCX files',
  'This phase maps merge fields into templates',
  'This phase touches Clio',
  'This phase touches Graph',
  'This phase finalizes documents',
  'This phase uploads documents',
  'This phase performs live document generation'
];
for (const phrase of forbiddenImplementationClaims) if (doc.includes(phrase)) fail(`document contains forbidden implementation claim: ${phrase}`);
const jsonishRequired = [
  '"templateId"',
  '"layoutComposition"',
  '"assets"',
  '"role": "letterhead"',
  '"versionPolicy": "latest_approved"',
  '"ordinaryUserBehavior": "block"',
  '"adminTestingBehavior": "warn"',
  '"generationEligible": false'
];
for (const phrase of jsonishRequired) if (!doc.includes(phrase)) fail(`document missing expected example metadata token: ${phrase}`);
pass('Templates Phase 2 metadata schema proposal document contains required vocabulary and safety limits');
