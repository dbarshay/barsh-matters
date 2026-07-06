import { NextRequest, NextResponse } from "next/server";
import { clioFetch } from "@/lib/clio";
import { isAdminRequestAuthorized, adminUnauthorizedJson } from "@/lib/adminAuth";
import { isUploadDocsEnabled, UPLOAD_DOCS_DISABLED_MESSAGE } from "@/lib/documents/uploadDocsConfig";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// READ-ONLY diagnostic: confirm the single-master storage anchors exist in the Clio account the
// current token points to. Performs two GETs (no writes, no folder creation, no upload):
//   - the master matter (CLIO_MASTER_MATTER_ID)
//   - the root folder   (CLIO_SINGLE_MASTER_ROOT_FOLDER_ID / CLIO_DOCUMENTS_ROOT_FOLDER_ID)
// A 404 on either tells you exactly which id is wrong / not in this account.
async function getJson(path: string): Promise<{ status: number; ok: boolean; data: any }> {
  try {
    const res = await clioFetch(path, { method: "GET" });
    const data = await res.json().catch(() => null);
    return { status: res.status, ok: res.ok, data };
  } catch (err: any) {
    return { status: 0, ok: false, data: { error: err?.message || "request failed" } };
  }
}

export async function GET(req: NextRequest) {
  if (!isUploadDocsEnabled()) {
    return NextResponse.json({ ok: false, error: UPLOAD_DOCS_DISABLED_MESSAGE }, { status: 403 });
  }
  if (!isAdminRequestAuthorized(req)) return adminUnauthorizedJson();

  const masterMatterId = (process.env.CLIO_MASTER_MATTER_ID || "").trim();
  const rootFolderId = (process.env.CLIO_SINGLE_MASTER_ROOT_FOLDER_ID || process.env.CLIO_DOCUMENTS_ROOT_FOLDER_ID || "").trim();
  const storageMode = (process.env.CLIO_STORAGE_MODE || "").trim();

  const matterRes = masterMatterId
    ? await getJson(`/matters/${encodeURIComponent(masterMatterId)}.json?fields=id,display_number,description`)
    : { status: 0, ok: false, data: { error: "CLIO_MASTER_MATTER_ID not set" } };

  // Fetch the root folder WITH its matter association, so we can see which matter it really belongs to.
  const folderRes = rootFolderId
    ? await getJson(`/folders/${encodeURIComponent(rootFolderId)}.json?fields=id,name,parent{id},matter{id}`)
    : { status: 0, ok: false, data: { error: "CLIO_SINGLE_MASTER_ROOT_FOLDER_ID not set" } };

  const matter = matterRes.data?.data || null;
  const folder = folderRes.data?.data || null;

  // Replicate the EXACT list call the folder resolver makes (this is what 404'd during upload):
  //   GET /folders.json?matter_id={master}&parent_id={root}
  const listWithMatter =
    masterMatterId && rootFolderId
      ? await getJson(`/folders.json?matter_id=${encodeURIComponent(masterMatterId)}&parent_id=${encodeURIComponent(rootFolderId)}&limit=5&fields=id,name`)
      : { status: 0, ok: false, data: null };

  // And the same list WITHOUT matter_id, to see if dropping the matter scope resolves it.
  const listNoMatter = rootFolderId
    ? await getJson(`/folders.json?parent_id=${encodeURIComponent(rootFolderId)}&limit=5&fields=id,name`)
    : { status: 0, ok: false, data: null };

  const rootFolderMatterId = folder?.matter?.id ?? null;

  const matterOk = matterRes.ok && !!matter;
  const folderOk = folderRes.ok && !!folder;

  const matterScopedListOk = listWithMatter.ok;
  const unscopedListOk = listNoMatter.ok;
  const rootFolderMatterMismatch =
    rootFolderMatterId != null && String(rootFolderMatterId) !== String(masterMatterId);

  let verdict: string;
  if (matterOk && folderOk && !matterScopedListOk && rootFolderMatterMismatch) {
    verdict = `MISMATCH: root folder ${rootFolderId} belongs to Clio matter ${rootFolderMatterId}, not the configured master matter ${masterMatterId}. The resolver lists children scoped to matter_id=${masterMatterId}, so it 404s. Fix: set CLIO_MASTER_MATTER_ID to ${rootFolderMatterId}, OR point CLIO_SINGLE_MASTER_ROOT_FOLDER_ID at a folder inside matter ${masterMatterId}.`;
  } else if (matterOk && folderOk && !matterScopedListOk && unscopedListOk) {
    verdict = `The matter-scoped folder list (matter_id=${masterMatterId} & parent_id=${rootFolderId}) 404s, but the unscoped list works. The root folder isn't reachable under that matter id — likely a matter/folder association mismatch. Root folder's matter id = ${rootFolderMatterId ?? "unknown"}.`;
  } else if (matterOk && folderOk && matterScopedListOk) {
    verdict = "Both anchors exist AND the matter-scoped child list works. Upload should now resolve/create subfolders — retry the upload.";
  } else if (matterOk && folderOk) {
    verdict = "Both anchors exist, but the folder child-list call failed for another reason — see listWithMatter below.";
  } else if (!matterOk && !folderOk) {
    verdict = "Neither the master matter nor the root folder was found. The current Clio token likely points at a different account, or these ids were never set up live.";
  } else if (!matterOk) {
    verdict = `Master matter ${masterMatterId} was not found (HTTP ${matterRes.status}). Check CLIO_MASTER_MATTER_ID and that the token owns it.`;
  } else {
    verdict = `Root folder ${rootFolderId} was not found (HTTP ${folderRes.status}). Check CLIO_SINGLE_MASTER_ROOT_FOLDER_ID — it may be stale, deleted, or in another matter.`;
  }

  return NextResponse.json({
    ok: matterOk && folderOk,
    storageMode,
    verdict,
    masterMatter: {
      configuredId: masterMatterId || null,
      httpStatus: matterRes.status,
      found: matterOk,
      displayNumber: matter?.display_number ?? null,
      description: matter?.description ?? null,
    },
    rootFolder: {
      configuredId: rootFolderId || null,
      httpStatus: folderRes.status,
      found: folderOk,
      name: folder?.name ?? null,
      parentId: folder?.parent?.id ?? null,
      belongsToMatterId: rootFolderMatterId,
      matchesConfiguredMasterMatter: rootFolderMatterId == null ? null : !rootFolderMatterMismatch,
    },
    listWithMatter: { httpStatus: listWithMatter.status, ok: listWithMatter.ok },
    listNoMatter: { httpStatus: listNoMatter.status, ok: listNoMatter.ok },
  });
}
