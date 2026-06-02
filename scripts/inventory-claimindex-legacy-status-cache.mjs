#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const repo = process.cwd();

const roots = [
  'app',
  'lib',
  'scripts',
  'prisma/schema.prisma',
].filter((rel) => fs.existsSync(path.join(repo, rel)));

const files = [];

const walk = (full) => {
  const stat = fs.statSync(full);

  if (stat.isDirectory()) {
    const base = path.basename(full);
    if (['node_modules', '.next', '.git', 'backups'].includes(base)) return;

    for (const entry of fs.readdirSync(full)) {
      walk(path.join(full, entry));
    }
    return;
  }

  if (/\.(ts|tsx|js|mjs|prisma)$/.test(full)) {
    files.push(full);
  }
};

for (const rel of roots) walk(path.join(repo, rel));

const sections = [
  ['ClaimIndexRebuildState', /\bClaimIndexRebuildState\b|\bclaimIndexRebuildState\b/g],
  ['ClaimClusterCache', /\bClaimClusterCache\b|\bclaimClusterCache\b/g],
  ['claim-index rebuild route', /api\/claim-index\/rebuild|claim-index\/rebuild/g],
  ['advanced-search hydrate route', /advanced-search\/hydrate/g],
  ['rebuild status wording', /rebuild-status|rebuild status|Rebuild status|rebuildStatus/g],
  ['local index status wording', /local index status|Local index status/g],
  ['legacy Clio operational block helper', /legacyClioOperationalRouteBlocked/g],
];

const lines = [];
lines.push('RESULT: ClaimIndex legacy status/cache inventory');
lines.push(`FILES_SCANNED=${files.length}`);
lines.push('');

for (const [label, re] of sections) {
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

const outPath = '/tmp/barsh-claimindex-legacy-status-cache-inventory.txt';
fs.writeFileSync(outPath, lines.join('\n') + '\n');

console.log(lines.join('\n'));
console.log(`LEGACY_STATUS_CACHE_INVENTORY_FILE=${outPath}`);
