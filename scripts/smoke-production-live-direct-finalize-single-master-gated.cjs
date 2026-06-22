#!/usr/bin/env node

const PROD = process.env.PRODUCTION_URL || "https://clio-lawsuit-aggregator.vercel.app";
const ARMED = process.env.CONFIRM_LIVE_TERMINAL_FINALIZE === "YES";
const directMatterDisplayNumber = process.env.LIVE_DIRECT_MATTER_DISPLAY_NUMBER || "BRL_202600003";
const documentKey = process.env.LIVE_DIRECT_DOCUMENT_KEY || "summons-complaint";

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

function driveItemIdFrom(json) {
  return json?.workingDocument?.driveItemId || json?.workingDocumentDriveItemId || json?.driveItemId || "";
}

async function createWorkingDocx() {
  const attempts = [
    {
      matterId: directMatterDisplayNumber,
      directMatterId: directMatterDisplayNumber,
      uploadTargetMode: "direct-matter",
      directMatterDisplayNumber,
      useSingleMasterClioStorage: true,
      singleMasterDirectStorage: true,
      confirmCreate: true,
      documentKey,
      documentKeys: [documentKey],
    },
    {
      directMatterId: directMatterDisplayNumber,
      uploadTargetMode: "direct-matter",
      directMatterDisplayNumber,
      useSingleMasterClioStorage: true,
      singleMasterDirectStorage: true,
      confirmCreate: true,
      documentKey,
      documentKeys: [documentKey],
    },
    {
      uploadTargetMode: "direct-matter",
      directMatterDisplayNumber,
      useSingleMasterClioStorage: true,
      singleMasterDirectStorage: true,
      confirmCreate: true,
      documentKey,
      documentKeys: [documentKey],
    },
  ];

  let last = null;
  for (let i = 0; i < attempts.length; i += 1) {
    console.log(`INFO: working-docx direct payload attempt ${i + 1}`);
    const result = await post("/api/documents/working-docx", attempts[i]);
    last = result;
    if (result.res.status === 200 && result.json?.ok === true && driveItemIdFrom(result.json)) {
      return result;
    }
  }
  return last;
}

async function main() {
  console.log("RESULT: gated production live direct finalize single-master proof starting");
  console.log("CONTRACT: This script may create/reuse a Microsoft Graph working DOCX and may upload or idempotently skip a finalized PDF in Clio.");
  console.log("CONTRACT: It requires CONFIRM_LIVE_TERMINAL_FINALIZE=YES.");

  if (!ARMED) {
    console.log("STOP: live finalize not armed. Set CONFIRM_LIVE_TERMINAL_FINALIZE=YES only when intentionally testing live production upload.");
    return;
  }

  pass("live direct finalize explicitly armed");

  const working = await createWorkingDocx();
  assert(working?.res?.status === 200, "working-docx returned HTTP 200");
  assert(working?.json?.ok === true, "working-docx ok true");

  const driveItemId = driveItemIdFrom(working?.json);
  assert(Boolean(driveItemId), "working DOCX driveItemId returned");

  const selectedDocumentKey = working?.json?.selectedDocument?.key || documentKey;
  assert(Boolean(selectedDocumentKey), "selected direct document key returned");
  console.log(`LIVE_DIRECT_SELECTED_DOCUMENT_KEY=${selectedDocumentKey}`);

  if (process.exitCode) process.exit(process.exitCode);

  const final = await post("/api/documents/finalize", {
    uploadTargetMode: "direct-matter",
    directMatterDisplayNumber,
    useSingleMasterClioStorage: true,
    confirmUpload: true,
    singleMasterDryRun: false,
    singleMasterResolveFolders: true,
    documentKeys: [selectedDocumentKey],
    workingDocumentDriveItemId: driveItemId,
    workingDocumentKey: selectedDocumentKey,
  });

  assert(final.res.status === 200, "finalize returned HTTP 200");
  assert(final.json?.ok === true, "finalize ok true");
  assert(final.json?.uploadRewired === true, "finalize uploadRewired true");
  assert(final.json?.singleMasterDryRun !== true, "finalize was not dry-run");
  assert(final.json?.clioUploadTarget?.parentType === "Folder", "target parentType is Folder");
  assert(Number(final.json?.clioUploadTarget?.parentId) > 0, "target parentId present");
  assert(final.json?.clioUploadTarget?.displayNumber === directMatterDisplayNumber || final.json?.singleMasterTargetInput?.directMatterFileNumber === directMatterDisplayNumber || final.json?.folderResolution?.targetPlan?.directMatterFileNumber === directMatterDisplayNumber, "direct matter display number preserved");
  assert(Number(final.json?.folderResolution?.folderId || final.json?.clioUploadTarget?.parentId) > 0, "folder resolution returned folder id");

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

  const firstUpload = uploaded[0] || {};
  console.log(`LIVE_DIRECT_DISPLAY_NUMBER=${directMatterDisplayNumber}`);
  console.log(`LIVE_DIRECT_WORKING_DOCX_DRIVE_ITEM_ID=${driveItemId}`);
  console.log(`LIVE_DIRECT_CLIO_FOLDER_ID=${final.json?.clioUploadTarget?.parentId || final.json?.folderResolution?.folderId || firstUpload?.clioUploadParent?.id || ""}`);
  console.log(`LIVE_DIRECT_CLIO_DOCUMENT_ID=${firstUpload?.clioDocumentId || ""}`);
  console.log(`LIVE_DIRECT_FINALIZATION_RECORD_ID=${final.json?.finalizationRecord?.id || ""}`);
  console.log(`LIVE_DIRECT_FULLY_UPLOADED=${firstUpload?.fullyUploaded === true}`);
  console.log(`LIVE_DIRECT_UPLOAD_REWIRED=${final.json?.uploadRewired === true}`);
  console.log(`LIVE_DIRECT_FILENAME=${firstUpload?.filename || ""}`);

  if (process.exitCode) {
    console.error("RESULT: gated production live direct finalize single-master proof failed");
    process.exit(process.exitCode);
  }

  console.log("RESULT: gated production live direct finalize single-master proof passed");
}

main().catch((err) => {
  console.error(err?.stack || err?.message || String(err));
  process.exit(1);
});
