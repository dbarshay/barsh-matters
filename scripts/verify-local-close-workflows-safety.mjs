#!/usr/bin/env node
import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function mustContain(label, text, needle) {
  if (!text.includes(needle)) {
    console.error(`FAIL: ${label}: missing ${needle}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS: ${label}`);
  }
}

function mustNotContain(label, text, needle) {
  if (text.includes(needle)) {
    console.error(`FAIL: ${label}: unexpected ${needle}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS: ${label}`);
  }
}

console.log("RESULT: verify local close workflows safety");

const matterCloseRoute = read("app/api/matters/close/route.ts");
const lawsuitCloseRoute = read("app/api/lawsuits/close/route.ts");
const matterPage = read("app/matter/[id]/page.tsx");
const mattersPage = read("app/matters/page.tsx");
const byMatterRoute = read("app/api/claim-index/by-matter/route.ts");
const pkg = JSON.parse(read("package.json"));

mustContain("matter close route updates final_status Closed", matterCloseRoute, 'final_status: "Closed"');
mustContain("matter close route updates close_reason from selected reason", matterCloseRoute, "close_reason: closeReason");
mustContain("matter close route is local-only no Clio write", matterCloseRoute, "noClioWrite: true");
mustContain("matter close route is local-only no Clio read", matterCloseRoute, "noClioRead: true");
mustContain("matter close route writes audit", matterCloseRoute, 'action: "claimindex-matter-close"');
mustNotContain("matter close route must not use legacy Clio blocked helper", matterCloseRoute, "legacyClioOperationalRouteBlocked");
mustNotContain("matter close route must not call Clio", matterCloseRoute, "clioFetch");
mustNotContain("matter close route must not call Clio API", matterCloseRoute, "api/v4");

mustContain("lawsuit close route exists", lawsuitCloseRoute, 'action: "local-close-lawsuit"');
mustContain("lawsuit close route stores master final status", lawsuitCloseRoute, 'finalStatus: "Closed"');
mustContain("lawsuit close route stores master close reason", lawsuitCloseRoute, "closeReason");
mustContain("lawsuit close route child reason constant", lawsuitCloseRoute, 'const CHILD_CLOSED_REASON = "Closed Lawsuit"');
mustContain("lawsuit close route cascades children by master_lawsuit_id", lawsuitCloseRoute, "master_lawsuit_id: masterLawsuitId");
mustContain("lawsuit close route sets child final_status closed", lawsuitCloseRoute, 'final_status: "Closed"');
mustContain("lawsuit close route sets child close_reason Closed Lawsuit", lawsuitCloseRoute, "close_reason: CHILD_CLOSED_REASON");
mustContain("lawsuit close route uses ClaimIndex updateMany", lawsuitCloseRoute, "tx.claimIndex.updateMany");
mustContain("lawsuit close route writes audit", lawsuitCloseRoute, 'action: "local-lawsuit-close"');
mustContain("lawsuit close route is local-only no Clio write", lawsuitCloseRoute, "noClioWrite: true");
mustContain("lawsuit close route is local-only no Clio read", lawsuitCloseRoute, "noClioRead: true");
mustNotContain("lawsuit close route must not call Clio", lawsuitCloseRoute, "clioFetch");
mustNotContain("lawsuit close route must not call Clio API", lawsuitCloseRoute, "api/v4");

mustContain("direct matter close modal copy says local", matterPage, "This will close matter");
mustContain("direct matter close modal writes final status closed copy", matterPage, "Final Status = Closed");
mustContain("direct matter closed logic uses finalStatus", matterPage, "matter?.finalStatus || matter?.final_status");

mustContain("master Close Lawsuit button is enabled workflow", mattersPage, "openMasterCloseLawsuitDialog");
mustContain("master Close Lawsuit modal exists", mattersPage, 'aria-label="Close Lawsuit"');
mustContain("master Close Lawsuit modal warns child cascade", mattersPage, "Closed Reason <strong>Closed Lawsuit</strong>");
mustContain("master Close Lawsuit calls local route", mattersPage, 'fetch("/api/lawsuits/close"');
mustNotContain("master Close Lawsuit button no longer disabled placeholder", mattersPage, "Close Lawsuit workflow will be wired after payment/settlement safety checks.");

mustContain("by-matter route selects final_status", byMatterRoute, "final_status: true");
mustContain("by-matter route returns finalStatus alias", byMatterRoute, "finalStatus: rowWithMetadata.final_status");

if (pkg.scripts?.["verify:local-close-workflows-safety"] !== "node scripts/verify-local-close-workflows-safety.mjs") {
  console.error("FAIL: package.json registers verify:local-close-workflows-safety");
  process.exitCode = 1;
} else {
  console.log("PASS: package.json registers verify:local-close-workflows-safety");
}

if (process.exitCode) {
  console.error("FAILURES=1");
  process.exit(1);
}

console.log("FAILURES=0");
