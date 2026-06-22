#!/usr/bin/env node
const { spawnSync } = require("child_process");

const commands = [
  ["npm", ["run", "smoke:production-single-master-finalize-no-upload-contract"]],
  ["npm", ["run", "verify:production-ui-single-master-finalize-bundle-tokens"]],
  ["npm", ["run", "verify:working-docx-single-master-preview-propagation"]],
  ["npm", ["run", "verify:ui-single-master-live-finalize-payload-safety"]],
  ["npm", ["run", "smoke:production-live-master-finalize-single-master-gated"], { CONFIRM_LIVE_TERMINAL_FINALIZE: "NO" }],
  ["npm", ["run", "smoke:production-live-direct-finalize-single-master-gated"], { CONFIRM_LIVE_TERMINAL_FINALIZE: "NO" }],
  ["npx", ["tsc", "--noEmit"]],
];

console.log("RESULT: single-master production readiness suite starting");
console.log("CONTRACT: runs no-upload production checks, UI bundle verification, static verifiers, TypeScript, and unarmed live-proof scripts only.");

for (const [cmd, args, extraEnv] of commands) {
  console.log(`\n--- ${cmd} ${args.join(" ")} ---`);
  const res = spawnSync(cmd, args, {
    stdio: "inherit",
    shell: false,
    env: { ...process.env, ...(extraEnv || {}) },
  });
  if (res.status !== 0) {
    console.error(`FAIL: command failed: ${cmd} ${args.join(" ")}`);
    process.exit(res.status || 1);
  }
}

console.log("RESULT: single-master production readiness suite passed");
