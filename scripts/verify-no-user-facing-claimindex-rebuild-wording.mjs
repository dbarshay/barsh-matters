#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const repo = process.cwd();

const filesToScan = [
  'app/api/matters/identity-field/route.ts',
  'app/api/matters/update-direct-field/route.ts',
  'app/matter/[id]/page.tsx',
  'app/matters/page.tsx',
  'app/page.tsx',
  'app/lawsuits/page.tsx',
].filter((rel) => fs.existsSync(path.join(repo, rel)));

const forbidden = [
  {
    label: 'user-facing rebuild/index instruction',
    re: /Rebuild or index the matter|Rebuild or locally create the matter|rebuild or index the matter|rebuild or locally create the matter/u,
  },
  {
    label: 'user-facing ClaimIndex row jargon',
    re: /No ClaimIndex row exists for this matter/u,
  },
  {
    label: 'user-facing Clio-era rebuild instruction',
    re: /rebuild the matter before saving|rebuild.*before saving local identity|rebuild.*before saving direct fields/iu,
  },
];

const failures = [];

for (const rel of filesToScan) {
  const full = path.join(repo, rel);
  const text = fs.readFileSync(full, 'utf8');
  const lines = text.split(/\r?\n/);

  lines.forEach((line, idx) => {
    for (const rule of forbidden) {
      if (rule.re.test(line)) {
        failures.push(`${rel}:${idx + 1}: ${rule.label}: ${line.trim()}`);
      }
    }
  });
}

const requiredPositive = [
  {
    file: 'app/api/matters/identity-field/route.ts',
    phrase: 'No local matter index row exists for this matter. Import or locally create the matter before saving local identity fields.',
  },
  {
    file: 'app/api/matters/update-direct-field/route.ts',
    phrase: 'No local matter index row exists for this matter. Import or locally create the matter before saving direct fields.',
  },
];

for (const item of requiredPositive) {
  const full = path.join(repo, item.file);

  if (!fs.existsSync(full)) {
    failures.push(`missing expected file: ${item.file}`);
    continue;
  }

  const text = fs.readFileSync(full, 'utf8');
  if (!text.includes(item.phrase)) {
    failures.push(`${item.file}: missing replacement phrase: ${item.phrase}`);
  }
}

console.log('RESULT: verify no user-facing ClaimIndex rebuild wording');
console.log(`FILES_SCANNED=${filesToScan.length}`);
for (const rel of filesToScan) console.log(`SCANNED=${rel}`);
console.log(`FAILURES=${failures.length}`);
for (const failure of failures) console.log(`FAIL=${failure}`);

if (failures.length) process.exit(1);
