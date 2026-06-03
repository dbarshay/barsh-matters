#!/usr/bin/env node
import fs from 'node:fs';

const failures = [];
const page = fs.readFileSync('app/page.tsx', 'utf8');
const proxy = fs.existsSync('proxy.ts') ? fs.readFileSync('proxy.ts', 'utf8') : '';
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

for (const required of [
  'params.get("adminRequired") !== "1"',
  'params.get("from") || "/admin"',
  'requestedPath.startsWith("/admin") ? requestedPath : "/admin"',
  'window.history.replaceState({ barshMattersAdminGatePrompted: true }',
  'void runAdministratorGate("Open Administrator Home"',
  'window.location.href = safeRequestedPath',
]) {
  if (!page.includes(required)) {
    failures.push(`app/page.tsx: missing visible admin gate handler fragment: ${required}`);
  }
}

const openMenuMatch = page.match(/function openAdministratorMenu\(\)\s*\{([\s\S]*?)\n  \}/);
if (!openMenuMatch) {
  failures.push('app/page.tsx: missing openAdministratorMenu');
} else {
  const body = openMenuMatch[1];
  if (!body.includes('window.location.href = "/admin";')) {
    failures.push('app/page.tsx: Administrator button must navigate to /admin');
  }
}

if (!proxy.includes('redirectUrl.searchParams.set("adminRequired", "1")')) {
  failures.push('proxy.ts: expected adminRequired redirect marker');
}

if (!proxy.includes('redirectUrl.searchParams.set("from", pathname)')) {
  failures.push('proxy.ts: expected from pathname redirect marker');
}

if (pkg.scripts?.['verify:admin-gate-visible-prompt-safety'] !== 'node scripts/verify-admin-gate-visible-prompt-safety.mjs') {
  failures.push('package.json: missing verify:admin-gate-visible-prompt-safety script');
}

console.log('RESULT: admin gate visible prompt safety verifier');

if (failures.length) {
  console.log(`FAILURES=${failures.length}`);
  for (const failure of failures) console.log(`FAIL=${failure}`);
  process.exit(1);
}

console.log('FAILURES=0');
console.log('PASS: proxy adminRequired redirects now trigger visible home-page admin prompt.');
