#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const repo = process.cwd();

const scanRoots = [
  'app/api/claim-index',
  'app/api/lawsuits/local-generation-preview',
  'app/api/lawsuits/local-generation-create',
  'app/api/matters/update-direct-field',
  'app/matter/[id]/page.tsx',
  'app/matters/page.tsx',
].filter((rel) => fs.existsSync(path.join(repo, rel)));

const sourceFiles = [];

const walk = (fullPath) => {
  const stat = fs.statSync(fullPath);

  if (stat.isDirectory()) {
    for (const entry of fs.readdirSync(fullPath)) {
      walk(path.join(fullPath, entry));
    }
    return;
  }

  if (/\.(ts|tsx|js|mjs)$/.test(fullPath)) {
    sourceFiles.push(fullPath);
  }
};

for (const rel of scanRoots) {
  walk(path.join(repo, rel));
}

const failures = [];

const forbidden = [
  {
    label: 'Clio matter-context route must not be used for local matter/search display',
    re: /\/api\/clio\/matter-context|matter-context/iu,
  },
  {
    label: 'ClaimIndex must not be rebuilt from Clio',
    re: /\brebuildClaimIndexFromClio\b|\brebuild.*\bClio\b|\bClio\b.*\brebuild\b/iu,
  },
  {
    label: 'ClaimIndex/search must not hydrate from Clio',
    re: /\bhydrat(?:e|ion|ed|ing)\b.*\bClio\b|\bClio\b.*\bhydrat(?:e|ion|ed|ing)\b/iu,
  },
  {
    label: 'local search/display path must not depend on Clio custom fields',
    re: /\bcustom_field_values\b|\bcustomFieldValues\b/iu,
  },
  {
    label: 'known Clio operational matter helper must not return',
    re: /\bfetchMatterFromClio\b|\bgetMatterFromClio\b|\bclioMatterContext\b|\bloadClioMatterContext\b/iu,
  },
];

const allowedUiLine = (line) => {
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

for (const full of sourceFiles) {
  const rel = path.relative(repo, full);
  const text = fs.readFileSync(full, 'utf8');
  const lines = text.split(/\r?\n/);

  lines.forEach((line, idx) => {
    if (allowedUiLine(line)) return;

    for (const rule of forbidden) {
      if (rule.re.test(line)) {
        failures.push(`${rel}:${idx + 1}: ${rule.label}: ${line.trim()}`);
      }
    }
  });
}

console.log('RESULT: verify no operational Clio hydration regression');
console.log(`FILES_SCANNED=${sourceFiles.length}`);
for (const rel of scanRoots) console.log(`SCAN_ROOT=${rel}`);
console.log('GRAPH_EMAIL_SYNC_UI_ALLOWED=YES');
console.log(`FAILURES=${failures.length}`);
for (const failure of failures) console.log(`FAIL=${failure}`);

if (failures.length) process.exit(1);
