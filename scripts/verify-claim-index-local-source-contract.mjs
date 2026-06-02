#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const repo = process.cwd();

const requiredLocalMarkers = [
  {
    file: 'app/api/claim-index/search-grouped/route.ts',
    markers: ['noClioRead', 'noClioWrite', 'noClioHydration'],
  },
];

const operationalProtectedFiles = [
  'app/api/claim-index/search-grouped/route.ts',
  'app/api/lawsuits/local-generation-preview/route.ts',
  'app/api/lawsuits/local-generation-create/route.ts',
  'app/api/matters/update-direct-field/route.ts',
].filter((p) => fs.existsSync(path.join(repo, p)));

const uiProtectedFiles = [
  'app/matter/[id]/page.tsx',
  'app/matters/page.tsx',
].filter((p) => fs.existsSync(path.join(repo, p)));

const operationalForbiddenPatterns = [
  { label: 'Clio matter-context route', re: /\/api\/clio\/matter-context|matter-context/iu },
  { label: 'Clio operational import', re: /from\s+['"][^'"]*(?:clio|Clio)[^'"]*['"]/u },
  { label: 'Clio operational require', re: /require\(['"][^'"]*(?:clio|Clio)[^'"]*['"]\)/u },
  { label: 'Clio custom field operational dependency', re: /\bcustom_field_values\b|\bcustomFieldValues\b/u },
  { label: 'Clio hydration language', re: /\bhydrat(?:e|ion|ed|ing)\b.*\bClio\b|\bClio\b.*\bhydrat(?:e|ion|ed|ing)\b/iu },
  { label: 'Clio rebuild language', re: /\brebuildClaimIndex\b|\brebuild.*\bClio\b|\bClio\b.*\brebuild\b/iu },
  { label: 'Known Clio operational helper', re: /\bfetchMatterFromClio\b|\bgetMatterFromClio\b|\bclioMatterContext\b|\bloadClioMatterContext\b/u },
];

const uiForbiddenPatterns = [
  { label: 'Clio matter-context route', re: /\/api\/clio\/matter-context|matter-context/iu },
  { label: 'Clio hydration language', re: /\bhydrat(?:e|ion|ed|ing)\b.*\bClio\b|\bClio\b.*\bhydrat(?:e|ion|ed|ing)\b/iu },
  { label: 'Clio rebuild language', re: /\brebuildClaimIndex\b|\brebuild.*\bClio\b|\bClio\b.*\brebuild\b/iu },
  { label: 'Known Clio operational helper', re: /\bfetchMatterFromClio\b|\bgetMatterFromClio\b|\bclioMatterContext\b|\bloadClioMatterContext\b/u },
  { label: 'Clio custom field operational dependency', re: /\bcustom_field_values\b|\bcustomFieldValues\b/u },
];

const isAllowedGraphEmailSyncUiLine = (line) => {
  const l = line.toLowerCase();

  return (
    l.includes('microsoft graph') ||
    l.includes('graph-synced') ||
    l.includes('email metadata') ||
    l.includes('maildrop-linked') ||
    l.includes('does not create a draft') ||
    l.includes('does not create drafts') ||
    l.includes('does not send email') ||
    l.includes('does not write clio') ||
    l.includes('upload documents') ||
    l.includes('local outlook automation')
  );
};

const failures = [];

for (const { file, markers } of requiredLocalMarkers) {
  const full = path.join(repo, file);

  if (!fs.existsSync(full)) {
    failures.push(`${file}: missing required local-only route file`);
    continue;
  }

  const text = fs.readFileSync(full, 'utf8');

  for (const marker of markers) {
    if (!text.includes(marker)) {
      failures.push(`${file}: missing local-only response marker "${marker}"`);
    }
  }
}

const scan = (rel, patterns, opts = {}) => {
  const full = path.join(repo, rel);
  const text = fs.readFileSync(full, 'utf8');
  const lines = text.split(/\r?\n/);

  lines.forEach((line, idx) => {
    if (opts.ui && isAllowedGraphEmailSyncUiLine(line)) return;

    for (const pattern of patterns) {
      if (pattern.re.test(line)) {
        failures.push(`${rel}:${idx + 1}: ${pattern.label}: ${line.trim()}`);
      }
    }
  });
};

for (const rel of operationalProtectedFiles) {
  scan(rel, operationalForbiddenPatterns);
}

for (const rel of uiProtectedFiles) {
  scan(rel, uiForbiddenPatterns, { ui: true });
}

const contractPath = path.join(repo, 'CLAIMINDEX_LOCAL_SOURCE_CONTRACT.txt');
const contract = fs.existsSync(contractPath) ? fs.readFileSync(contractPath, 'utf8') : '';

for (const required of [
  'ClaimIndex is not a Clio cache',
  'ClaimIndex is not hydrated from Clio',
  'Aggregated lawsuits must preserve child/sibling links',
  'all current/future local PostgreSQL database tables/indexes',
  'does not copy actual document folders',
  'does not pull document files from Clio',
  'Microsoft Graph email sync UI copy is allowed',
  'Backup/Restore should eventually have guarded Admin UI controls',
]) {
  if (!contract.includes(required)) {
    failures.push(`CLAIMINDEX_LOCAL_SOURCE_CONTRACT.txt missing required phrase: ${required}`);
  }
}

console.log('RESULT: verify ClaimIndex local-source contract');
console.log(`OPERATIONAL_PROTECTED_FILES=${operationalProtectedFiles.length}`);
for (const rel of operationalProtectedFiles) console.log(`OPERATIONAL_PROTECTED=${rel}`);
console.log(`UI_PROTECTED_FILES=${uiProtectedFiles.length}`);
for (const rel of uiProtectedFiles) console.log(`UI_PROTECTED=${rel}`);
console.log('GRAPH_EMAIL_SYNC_UI_ALLOWED=YES');
console.log(`FAILURES=${failures.length}`);
for (const failure of failures) console.log(`FAIL=${failure}`);

if (failures.length) {
  process.exit(1);
}
