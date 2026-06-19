import { clioFetch } from "./clio";
import { assertClioStorageFolderWriteAllowed } from "./clioStorageWriteGuard";


export type ClioFolderCreateExecutorInput = {
  matterId: number;
  folderName: string;
  parentId?: number | null;
};

export type ClioFolderCreateExecutorResult = {
  ok: true;
  id: number | string;
  name: string;
  matterId: number;
  parentId: number | null;
};

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

export async function createClioFolderWithGuard(input: ClioFolderCreateExecutorInput, env: NodeJS.ProcessEnv = process.env): Promise<ClioFolderCreateExecutorResult> {
  const guard = assertClioStorageFolderWriteAllowed(env);
  if (!guard.allowed) throw new Error("[CLIO_STORAGE] Folder create guard unexpectedly denied writes.");

  const matterId = Number(input.matterId);
  const folderName = clean(input.folderName);
  const parentId = input.parentId == null ? null : Number(input.parentId);

  if (!Number.isFinite(matterId) || matterId <= 0) throw new Error("[CLIO_STORAGE] matterId is required for guarded folder creation.");
  if (!folderName) throw new Error("[CLIO_STORAGE] folderName is required for guarded folder creation.");

  const body: Record<string, unknown> = {
    data: {
      name: folderName,
      matter: { id: matterId },
      ...(parentId ? { parent: { id: parentId, type: "Folder" } } : {}),
    },
  };

  const response = await clioFetch("/folders.json", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) throw new Error(`[CLIO_STORAGE] Clio folder create failed: ${response.status} ${response.statusText}`);
  const json = await response.json();
  const data = json?.data || {};

  return {
    ok: true,
    id: data.id,
    name: clean(data.name || folderName),
    matterId,
    parentId,
  };
}
