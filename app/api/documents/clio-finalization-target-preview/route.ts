import { NextRequest, NextResponse } from "next/server";
import { buildClioStorageFolderResolutionPreview } from "@/lib/clioStorageFolderResolution";
import type { ClioStorageTargetInput } from "@/lib/clioStoragePlan";

export const dynamic = "force-dynamic";

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function parseBoolean(value: unknown): boolean {
  return value === true || clean(value) === "1" || clean(value).toLowerCase() === "true";
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const input = (body?.targetInput || body || {}) as Partial<ClioStorageTargetInput> & Record<string, unknown>;
    const lawsuitId = clean(input.lawsuitId || input.masterLawsuitId || input.lawsuitDisplayId || input.matterNumber || input.displayNumber);
    const matterDisplayNumber = clean(input.matterDisplayNumber || input.displayNumber || lawsuitId);
    const matterIdRaw = input.bmMatterId ?? input.matterId ?? input.masterMatterId ?? input.claimId ?? lawsuitId;

    const targetInput = {
      ...input,
      bmMatterId: matterIdRaw,
      lawsuitId: lawsuitId || clean(input.lawsuitId),
      displayNumber: matterDisplayNumber,
    } as ClioStorageTargetInput;

    const preview = buildClioStorageFolderResolutionPreview(targetInput);

    return NextResponse.json({
      ok: true,
      previewOnly: true,
      uploadRewired: false,
      databaseMutation: false,
      clioWrite: false,
      finalizeRewired: false,
      routePurpose: "no-write finalization target preview",
      targetPlan: preview.targetPlan,
      resolutionPreview: preview,
      guardSummary: {
        requiresLiveWriteCommand: "RUN_CLIO_SINGLE_MASTER_FOLDER_CREATE",
        requiresCreateFoldersEnabled: true,
        requiresLiveWriteEnabled: true,
        currentRequestAllowsWrite: false,
      },
      inputEcho: {
        lawsuitId: targetInput.lawsuitId,
        matterDisplayNumber,
        matterId: targetInput.bmMatterId,
        dryRunRequested: parseBoolean(body?.dryRun),
      },
    });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      previewOnly: true,
      clioWrite: false,
      databaseMutation: false,
      finalizeRewired: false,
      error: err instanceof Error ? err.message : String(err),
    }, { status: 400 });
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    previewOnly: true,
    uploadRewired: false,
    databaseMutation: false,
    clioWrite: false,
    finalizeRewired: false,
    routePurpose: "no-write finalization target preview",
    usage: "POST JSON with finalization target fields or targetInput; returns planned Clio single-master folder target only.",
  });
}
