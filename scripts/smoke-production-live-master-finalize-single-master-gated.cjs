#!/usr/bin/env node

const PROD = process.env.PRODUCTION_URL || "https://clio-lawsuit-aggregator.vercel.app";
const ARMED = process.env.CONFIRM_LIVE_TERMINAL_FINALIZE === "YES";
const masterLawsuitId = process.env.LIVE_MASTER_LAWSUIT_ID || "2026.06.00015";
const documentKey = process.env.LIVE_MASTER_DOCUMENT_KEY || "summons-complaint";

function pass(message) {
  console.log(`PASS: ${message}`);
}

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exitCode = 1;
}

function assert(ok, message) {
  ok ? pass(message) : fail(message);
}

async function post(path, body) {
  const res = await fetch(PROD + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  console.log(`\n--- POST ${path} HTTP ${res.status} ---`);
  console.log(JSON.stringify(json, null, 2));
  return { res, json };
}

async function main() {
  console.log("RESULT: gated production live master finalize single-master proof starting");
  console.log("CONTRACT: This script may create/reuse a Microsoft Graph working DOCX and may upload or idempotently skip a finalized PDF in Clio.");
  console.log("CONTRACT: It requires CONFIRM_LIVE_TERMINAL_FINALIZE=YES.");

  if (!ARMED) {
    console.log("STOP: live finalize not armed. Set CONFIRM_LIVE_TERMINAL_FINALIZE=YES only when intentionally testing live production upload.");
    return;
  }

  pass("live finalize explicitly armed");

  const working = await post("/api/documents/working-docx", {
    masterLawsuitId,
    uploadTargetMode: "master-lawsuit",
    useSingleMasterClioStorage: true,
    confirmCreate: true,
    documentKey,
    documentKeys: [documentKey],
  });

  assert(working.res.status === 200, "working-docx returned HTTP 200");
  assert(working.json?.ok === true, "working-docx ok true");

  const driveItemId = working.json?.workingDocument?.driveItemId || working.json?.workingDocumentDriveItemId;
  assert(Boolean(driveItemId), "working DOCX driveItemId returned");

  if (process.exitCode) process.exit(process.exitCode);

  const final = await post("/api/documents/finalize", {
    masterLawsuitId,
    uploadTargetMode: "master-lawsuit",
    useSingleMasterClioStorage: true,
    confirmUpload: true,
    singleMasterDryRun: false,
    singleMasterResolveFolders: true,
    documentKeys: [documentKey],
    workingDocumentDriveItemId: driveItemId,
    workingDocumentKey: documentKey,
  });

  assert(final.res.status === 200, "finalize returned HTTP 200");
  assert(final.json?.ok === true, "finalize ok true");
  assert(final.json?.uploadRewired === true, "finalize uploadRewired true");
  assert(final.json?.singleMasterDryRun !== true, "finalize was not dry-run");
  assert(final.json?.clioUploadTarget?.parentType === "Folder", "target parentType is Folder");
  assert(Number(final.json?.clioUploadTarget?.parentId) > 0, "target parentId present");
  assert(final.json?.folderResolution?.createdFolderCount === 0 || Number(final.json?.folderResolution?.createdFolderCount) >= 0, "folder resolution reported createdFolderCount");
  assert(Number(final.json?.folderResolution?.folderId) > 0, "folder resolution returned folderId");

  const uploaded = Array.isArray(final.json?.uploaded) ? final.json.uploaded : [];
  const skipped = Array.isArray(final.json?.skipped) ? final.json.skipped : [];

  console.log(`RESULT_COUNTS uploaded=${uploaded.length} skipped=${skipped.length}`);

  if (uploaded.length) {
    assert(uploaded.some((u) => u.clioUploadParent?.type === "Folder"), "uploaded result used resolved single-master Folder parent");
    assert(uploaded.some((u) => Number(u.clioUploadParent?.id) > 0), "uploaded result contains Clio folder parent id");
    assert(uploaded.some((u) => u.fullyUploaded === true), "uploaded result fullyUploaded true");
    assert(uploaded.some((u) => Number(u.clioDocumentId) > 0), "uploaded result contains Clio document id");
  } else {
    assert(skipped.length > 0, "no new upload means duplicate/idempotent skip was reported");
  }

  assert(final.json?.finalizationRecord?.ok === true, "finalization record ok true");
  assert(Number(final.json?.finalizationRecord?.id) > 0, "finalization record id present");
  assert(final.json?.safety?.uploadedToResolvedSingleMasterFolder === true, "safety uploadedToResolvedSingleMasterFolder true");

  if (process.exitCode) {
    console.error("RESULT: gated production live master finalize single-master proof failed");
    process.exit(process.exitCode);
  }

  console.log("RESULT: gated production live master finalize single-master proof passed");
}

main().catch((err) => {
  console.error(err?.stack || err?.message || String(err));
  process.exit(1);
});
