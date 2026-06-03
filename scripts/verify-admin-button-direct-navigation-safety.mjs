#!/usr/bin/env node
import fs from 'node:fs';

const files = [
  'app/page.tsx',
  'app/matter/[id]/page.tsx',
  'app/matters/page.tsx',
];

const failures = [];

for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  const match = text.match(/function openAdministratorMenu\(\)\s*\{([\s\S]*?)\n  \}/);

  if (!match) {
    failures.push(`${file}: missing openAdministratorMenu`);
    continue;
  }

  const body = match[1];

  if (!body.includes('window.location.href = "/admin";')) {
    failures.push(`${file}: Administrator button must navigate directly to /admin`);
  }

  if (body.includes('runAdministratorGate') || body.includes('/api/admin/authorize') || body.includes('prompt(')) {
    failures.push(`${file}: Administrator button must not use pre-navigation prompt/authorize flow`);
  }
}

const proxy = fs.existsSync('proxy.ts') ? fs.readFileSync('proxy.ts', 'utf8') : '';
if (!proxy.includes('/admin')) {
  failures.push('proxy.ts: expected admin path gating reference');
}

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
if (pkg.scripts?.['verify:admin-button-direct-navigation-safety'] !== 'node scripts/verify-admin-button-direct-navigation-safety.mjs') {
  failures.push('package.json: missing verify:admin-button-direct-navigation-safety script');
}

console.log('RESULT: admin button direct navigation safety verifier');
console.log(`FILES_SCANNED=${files.length + 1}`);

if (failures.length) {
  console.log(`FAILURES=${failures.length}`);
  for (const failure of failures) console.log(`FAIL=${failure}`);
  process.exit(1);
}

console.log('FAILURES=0');
console.log('PASS: Administrator buttons navigate directly to proxy-gated /admin.');
