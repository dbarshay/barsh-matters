#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const repo = process.cwd();

const includeRoots = [
  'app',
  'lib',
  'scripts',
  'prisma/schema.prisma',
].filter((rel) => fs.existsSync(path.join(repo, rel)));

const files = [];

const walk = (fullPath) => {
  const stat = fs.statSync(fullPath);

  if (stat.isDirectory()) {
    const base = path.basename(fullPath);
    if (['node_modules', '.next', '.git', 'backups'].includes(base)) return;

    for (const entry of fs.readdirSync(fullPath)) {
      walk(path.join(fullPath, entry));
    }
    return;
  }

  if (/\.(ts|tsx|js|mjs|prisma)$/.test(fullPath)) {
    files.push(fullPath);
  }
};

for (const rel of includeRoots) {
  walk(path.join(repo, rel));
}

const patterns = [
  ['ClaimIndexRebuildState', /\bClaimIndexRebuildState\b/g],
  ['ClaimClusterCache', /\bClaimClusterCache\b/g],
  ['rebuild language', /\brebuild\w*|\bRebuild\w*/g],
  ['hydrate language', /\bhydrat\w*|\bHydrat\w*/g],
  ['clio matter-context', /\/api\/clio\/matter-context|matter-context/g],
  ['custom field values', /custom_field_values|customFieldValues/g],
  ['noClio markers', /noClioRead|noClioWrite|noClioHydration/g],
  ['local generation routes', /local-generation-preview|local-generation-create/g],
];

const lines = [];
lines.push('RESULT: ClaimIndex cleanup candidate inventory');
lines.push(`FILES_SCANNED=${files.length}`);
lines.push('');

for (const [label, re] of patterns) {
  lines.push(`SECTION: ${label}`);

  let count = 0;

  for (const full of files) {
    const rel = path.relative(repo, full);
    const text = fs.readFileSync(full, 'utf8');
    const textLines = text.split(/\r?\n/);

    textLines.forEach((line, idx) => {
      re.lastIndex = 0;
      if (re.test(line)) {
        count += 1;
        lines.push(`${rel}:${idx + 1}: ${line.trim()}`);
      }
    });
  }

  lines.push(`COUNT=${count}`);
  lines.push('');
}

const outDir = '/tmp';
const outPath = path.join(outDir, 'barsh-claim-index-cleanup-candidates.txt');
fs.writeFileSync(outPath, lines.join('\n') + '\n');

console.log(lines.join('\n'));
console.log(`CLEANUP_INVENTORY_FILE=${outPath}`);
