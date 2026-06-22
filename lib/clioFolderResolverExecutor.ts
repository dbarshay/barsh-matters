import { clioFetch } from "./clio";
import { createClioFolderWithGuard } from "./clioFolderCreateExecutor";
import { buildClioStorageTargetPlan, type ClioStorageTargetInput } from "./clioStoragePlan";

export type ClioResolvedFolderSegment = {
  name: string;
  id: number;
  parentId: number | null;
  created: boolean;
};

export type ClioFolderResolverExecutorResult = {
  ok: true;
  targetPlan: ReturnType<typeof buildClioStorageTargetPlan>;
  bucketFolderId: number;
  matterFolderId: number;
  folderId: number;
  folderSegments: ClioResolvedFolderSegment[];
  createdFolderCount: number;
  reusedFolderCount: number;
};

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function numericId(value: unknown): number {
  const id = Number(value);
  return Number.isFinite(id) && id > 0 ? id : 0;
}

function getResolvedFolderId(result: unknown): number {
  const value = result as any;
  const raw =
    value?.folderId ??
    value?.id ??
    value?.folder?.id ??
    value?.folder?.data?.id ??
    value?.data?.id ??
    value?.result?.folderId ??
    value?.result?.folder?.id;

  const folderId = numericId(raw);

  if (!folderId) {
    throw new Error("Guarded Clio folder creation did not return a valid folder id.");
  }

  return folderId;
}

function getRows(json: any): any[] {
  if (Array.isArray(json?.data)) return json.data;
  if (Array.isArray(json?.folders)) return json.folders;
  if (Array.isArray(json)) return json;
  return [];
}

async function readClioJson(res: Response, fallback: string): Promise<any> {
  const text = await res.text();
  let json: any = null;

  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!res.ok) {
    throw new Error(`${fallback}: ${res.status} ${res.statusText}${json ? ` ${JSON.stringify(json)}` : text ? ` ${text}` : ""}`);
  }

  return json;
}

export async function findExactClioChildFolderByNameWithGuard(input: {
  matterId: number;
  parentId: number;
  folderName: string;
}): Promise<ClioResolvedFolderSegment | null> {
  const matterId = numericId(input.matterId);
  const parentId = numericId(input.parentId);
  const folderName = clean(input.folderName);

  if (!matterId) throw new Error("[CLIO_STORAGE] matterId is required for guarded folder lookup.");
  if (!parentId) throw new Error("[CLIO_STORAGE] parentId is required for guarded folder lookup.");
  if (!folderName) throw new Error("[CLIO_STORAGE] folderName is required for guarded folder lookup.");

  const fields = ["id", "name", "parent{id}"].join(",");
  const query = new URLSearchParams({
    matter_id: String(matterId),
    parent_id: String(parentId),
    limit: "200",
    fields,
  });

  const res = await clioFetch(`/folders.json?${query.toString()}`, { method: "GET" });
  const json = await readClioJson(res, `[CLIO_STORAGE] Clio folder lookup failed for ${folderName}`);
  const exactMatches = getRows(json).filter((row: any) => clean(row?.name) === folderName);

  if (exactMatches.length > 1) {
    const ids = exactMatches.map((row: any) => clean(row?.id)).filter(Boolean).join(", ");
    throw new Error(`[CLIO_STORAGE] Duplicate child folders named ${folderName} under parent ${parentId}. Refusing to choose between ids: ${ids}`);
  }

  const match = exactMatches[0];
  const id = numericId(match?.id);

  if (!match) return null;
  if (!id) throw new Error(`[CLIO_STORAGE] Exact child folder match for ${folderName} did not include a valid id.`);

  return {
    name: folderName,
    id,
    parentId,
    created: false,
  };
}

async function getOrCreateExactClioChildFolderWithGuard(input: {
  matterId: number;
  parentId: number;
  folderName: string;
}, env: NodeJS.ProcessEnv): Promise<ClioResolvedFolderSegment> {
  const existing = await findExactClioChildFolderByNameWithGuard(input);
  if (existing) return existing;

  const created = await createClioFolderWithGuard({
    matterId: input.matterId,
    parentId: input.parentId,
    folderName: input.folderName,
  }, env);

  return {
    name: clean(input.folderName),
    id: getResolvedFolderId(created),
    parentId: numericId(input.parentId),
    created: true,
  };
}

export async function resolveClioMatterFolderWithGuard(
  input: ClioStorageTargetInput,
  env: NodeJS.ProcessEnv = process.env
): Promise<ClioFolderResolverExecutorResult> {
  const target = buildClioStorageTargetPlan(input);
  const configuredSegments = Array.isArray(target.folderSegments) && target.folderSegments.length
    ? target.folderSegments
    : [target.bucketFolderName, target.matterFolderName];

  const configuredRootFolderId = numericId(env.CLIO_SINGLE_MASTER_ROOT_FOLDER_ID || env.CLIO_DOCUMENTS_ROOT_FOLDER_ID || 0);

  if (!configuredRootFolderId) {
    throw new Error("[CLIO_STORAGE] Missing or invalid CLIO_SINGLE_MASTER_ROOT_FOLDER_ID for single-master folder resolution.");
  }

  const folderSegments: ClioResolvedFolderSegment[] = [];
  let parentId = configuredRootFolderId;

  for (const segmentName of configuredSegments) {
    const folderName = clean(segmentName);
    if (!folderName) throw new Error("[CLIO_STORAGE] Empty folder segment in single-master folder resolution.");

    const resolved = await getOrCreateExactClioChildFolderWithGuard({
      matterId: target.masterMatterId,
      parentId,
      folderName,
    }, env);

    folderSegments.push(resolved);
    parentId = resolved.id;
  }

  const finalFolder = folderSegments[folderSegments.length - 1];

  if (!finalFolder) {
    throw new Error("Clio folder resolver did not resolve any folder segments.");
  }

  return {
    ok: true,
    targetPlan: target,
    bucketFolderId: folderSegments[0]?.id ?? finalFolder.id,
    matterFolderId: finalFolder.id,
    folderId: finalFolder.id,
    folderSegments,
    createdFolderCount: folderSegments.filter((segment) => segment.created).length,
    reusedFolderCount: folderSegments.filter((segment) => !segment.created).length,
  };
}
