#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const schemaPath = path.join(process.cwd(), 'prisma/schema.prisma');

if (!fs.existsSync(schemaPath)) {
  console.error('FAIL: prisma/schema.prisma not found');
  process.exit(1);
}

const schema = fs.readFileSync(schemaPath, 'utf8');

const modelBlocks = [...schema.matchAll(/model\s+(\w+)\s+\{([\s\S]*?)\n\}/g)].map((m) => ({
  name: m[1],
  body: m[2],
}));

const classifyModel = (name, body) => {
  const hay = `${name}\n${body}`.toLowerCase();

  if (/audit|history|log/.test(hay)) return 'AUDIT_HISTORY_TABLE';
  if (/tickler|followup|follow_up|deadline|reminder/.test(hay)) return 'TICKLER_TABLE';
  if (/payment|posting|transaction|check|remit|remittance|balance/.test(hay)) return 'PAYMENT_TABLE';
  if (/settlement|settled|allocation/.test(hay)) return 'SETTLEMENT_TABLE';
  if (/template|document|docx|pdf|print|email|draft|maildrop/.test(hay)) return 'DOCUMENT_METADATA_TABLE_OR_WORKFLOW_TABLE';
  if (/patient|provider|insurer|attorney|court|venue|individual|company|contact|reference|service|denial/.test(hay)) return 'REFERENCE_TABLE';
  if (/lawsuit|master/.test(hay)) return 'LOCAL_LAWSUIT_TABLE';
  if (/claimindex|claim_index|matterindex|matter_index|index/.test(hay)) return 'CLAIMINDEX_SEARCH_PROJECTION';
  if (/matter/.test(hay)) return 'LOCAL_MATTER_TABLE_OR_PROJECTION';
  if (/clio/.test(hay)) return 'CLIO_SHELL_OR_DOCUMENT_METADATA_FIELD_REVIEW';

  return 'UNCLASSIFIED_REVIEW';
};

const classifyField = (fieldName, fieldLine) => {
  const hay = `${fieldName} ${fieldLine}`.toLowerCase();

  if (/clio|maildrop|document.*shell|brl/.test(hay)) return 'CLIO_SHELL_ONLY_OR_DISPLAY_IDENTIFIER';
  if (/patient|provider|insurer|treating|claimnumber|claim_number|dos|dateofservice|date_of_service|claimamount|claim_amount|denial|status|workflow|masterlawsuit|master_lawsuit|search|normalized|bill|matterid|matter_id/.test(hay)) return 'KEEP_IN_CLAIMINDEX_IF_MATTER_IDENTITY_SEARCH';
  if (/payment|posting|transaction|check|balance|remit/.test(hay)) return 'MOVE_TO_PAYMENT_TABLE_OR_DERIVED_SNAPSHOT';
  if (/settlement|settled|allocation/.test(hay)) return 'MOVE_TO_SETTLEMENT_TABLE_OR_DERIVED_FLAG';
  if (/tickler|deadline|reminder|follow/.test(hay)) return 'MOVE_TO_TICKLER_TABLE_OR_DERIVED_ROLLUP';
  if (/document|template|docx|pdf|print|email|draft/.test(hay)) return 'DOCUMENT_METADATA_OR_WORKFLOW_FIELD_NOT_DOCUMENT_CONTENT';
  if (/audit|history|log/.test(hay)) return 'MOVE_TO_AUDIT_TABLE';
  if (/id\s|name|string|createdat|updatedat|date/.test(hay)) return 'GENERAL_FIELD_REVIEW';

  return 'UNCLASSIFIED_FIELD_REVIEW';
};

const lines = [];
lines.push('RESULT: ClaimIndex / local schema inventory');
lines.push(`MODEL_COUNT=${modelBlocks.length}`);
lines.push('');

for (const model of modelBlocks) {
  const modelClass = classifyModel(model.name, model.body);
  lines.push(`MODEL ${model.name} => ${modelClass}`);

  const fieldLines = model.body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('//') && !line.startsWith('@@'));

  for (const line of fieldLines) {
    const match = line.match(/^(\w+)\s+/);
    if (!match) continue;

    const field = match[1];
    lines.push(`  FIELD ${field} => ${classifyField(field, line)} | ${line}`);
  }

  lines.push('');
}

const outDir = path.join(process.cwd(), 'backups/indexes');
fs.mkdirSync(outDir, { recursive: true });

const outPath = path.join(outDir, `schema-inventory-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`);
fs.writeFileSync(outPath, lines.join('\n') + '\n');

console.log(lines.join('\n'));
console.log(`SCHEMA_INVENTORY_FILE=${outPath}`);
