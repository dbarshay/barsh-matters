import { clioFetch } from "@/lib/clio";

export type ClioCloseSyncResult = {
  matterId: number;
  ok: boolean;
  status: number;
  endpoint: string;
  attemptedStatus: "Closed";
  response?: unknown;
  error?: string;
};

function numericMatterId(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : 0;
}

async function readClioResponse(response: Response): Promise<unknown> {
  const bodyText = await response.text().catch(() => "");
  if (!bodyText.trim()) return null;
  try {
    return JSON.parse(bodyText);
  } catch {
    return bodyText;
  }
}

/**
 * Golden Rule close-sync helper.
 *
 * Allowed Clio scope:
 * - guarded matter operational close-status sync only.
 *
 * Forbidden here:
 * - ClaimIndex hydration/rebuild from Clio.
 * - lawsuit grouping changes from Clio.
 * - generic hidden Clio mutation.
 * - settlement writeback shortcuts.
 */
export async function syncClioMatterClosed(params: {
  matterId: number | string;
  reason?: string;
  source: "close-matter" | "close-lawsuit";
}): Promise<ClioCloseSyncResult> {
  const matterId = numericMatterId(params.matterId);
  if (!matterId) {
    return {
      matterId: 0,
      ok: false,
      status: 0,
      endpoint: "",
      attemptedStatus: "Closed",
      error: "Missing valid Clio matter ID for close sync.",
    };
  }

  const endpoint = `/api/v4/matters/${matterId}.json`;
  const payload = {
    data: {
      status: "Closed",
    },
  };

  try {
    const response = await clioFetch(endpoint, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const responseBody = await readClioResponse(response);

    if (!response.ok) {
      return {
        matterId,
        ok: false,
        status: response.status,
        endpoint,
        attemptedStatus: "Closed",
        response: responseBody,
        error: `Clio close sync failed for matter ${matterId}: ${response.status} ${response.statusText}`,
      };
    }

    return {
      matterId,
      ok: true,
      status: response.status,
      endpoint,
      attemptedStatus: "Closed",
      response: responseBody,
    };
  } catch (error: any) {
    return {
      matterId,
      ok: false,
      status: 0,
      endpoint,
      attemptedStatus: "Closed",
      error: error?.message || `Clio close sync failed for matter ${matterId}.`,
    };
  }
}

export async function syncClioMattersClosed(params: {
  matterIds: Array<number | string>;
  reason?: string;
  source: "close-lawsuit";
}): Promise<{
  ok: boolean;
  attemptedMatterIds: number[];
  syncedMatterIds: number[];
  failed: ClioCloseSyncResult[];
  results: ClioCloseSyncResult[];
}> {
  const attemptedMatterIds = Array.from(
    new Set(params.matterIds.map(numericMatterId).filter((id) => id > 0))
  );

  const results: ClioCloseSyncResult[] = [];
  for (const matterId of attemptedMatterIds) {
    const result = await syncClioMatterClosed({
      matterId,
      reason: params.reason,
      source: params.source,
    });
    results.push(result);
  }

  const failed = results.filter((result) => !result.ok);
  return {
    ok: failed.length === 0,
    attemptedMatterIds,
    syncedMatterIds: results.filter((result) => result.ok).map((result) => result.matterId),
    failed,
    results,
  };
}
