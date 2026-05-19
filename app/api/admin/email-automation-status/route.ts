import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const KNOWN_THREAD_SOURCE = "graph_background_thread_sync";
const MAILDROP_DISCOVERY_SOURCE = "graph_maildrop_discovery";

function safeJson(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === "object") return value;
  if (typeof value !== "string") return value;

  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function asRecord(value: unknown): Record<string, any> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, any>;
}

function readDetails(row: any): Record<string, any> {
  return asRecord(safeJson(row?.details ?? row?.metadata ?? row?.payload ?? null));
}

function normalizeDate(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toISOString();
}

function inferLogSource(row: any): string {
  const details = readDetails(row);
  const candidates = [
    row?.source,
    row?.eventSource,
    row?.workflow,
    row?.type,
    row?.action,
    row?.summaryText,
    row?.targetType,
    details.source,
    details.eventSource,
    details.workflow,
    details.type,
    details.action,
    details.summaryText,
    details.targetType,
  ]
    .map((value) => String(value ?? "").toLowerCase())
    .join(" ");

  if (
    candidates.includes(KNOWN_THREAD_SOURCE) ||
    candidates.includes("background_thread_sync") ||
    candidates.includes("background-thread-sync") ||
    candidates.includes("graph-background-thread-sync")
  ) {
    return KNOWN_THREAD_SOURCE;
  }

  if (
    candidates.includes(MAILDROP_DISCOVERY_SOURCE) ||
    candidates.includes("maildrop_discovery") ||
    candidates.includes("maildrop-discovery") ||
    candidates.includes("graph-maildrop-discovery")
  ) {
    return MAILDROP_DISCOVERY_SOURCE;
  }

  if (candidates.includes("graph_thread_sync_persisted")) {
    return KNOWN_THREAD_SOURCE;
  }

  return String(row?.source ?? details.source ?? row?.workflow ?? details.workflow ?? "unknown");
}

function compactLog(row: any) {
  const details = readDetails(row);
  const source = inferLogSource(row);

  return {
    id: String(row?.id ?? ""),
    source,
    action: row?.action ?? details.action ?? row?.summaryText ?? details.summaryText ?? null,
    status: row?.status ?? details.status ?? null,
    targetId: row?.targetId ?? row?.targetID ?? details.targetId ?? details.targetID ?? null,
    matterId: row?.matterId ?? row?.matterID ?? details.matterId ?? details.matterID ?? null,
    masterLawsuitId: row?.masterLawsuitId ?? details.masterLawsuitId ?? null,
    graphConversationId: row?.graphConversationId ?? details.graphConversationId ?? null,
    createdAt: normalizeDate(row?.createdAt),
    details: Object.keys(details).length ? details : safeJson(row?.details ?? row?.metadata ?? null),
    error: row?.error ?? details.error ?? null,
  };
}

function isKnownThreadLog(row: any): boolean {
  return inferLogSource(row) === KNOWN_THREAD_SOURCE;
}

function isMaildropDiscoveryLog(row: any): boolean {
  return inferLogSource(row) === MAILDROP_DISCOVERY_SOURCE;
}

function isFailureLog(row: any): boolean {
  const details = readDetails(row);
  const haystack = [
    row?.status,
    row?.error,
    row?.action,
    row?.summaryText,
    details.status,
    details.error,
    details.action,
    details.summaryText,
  ]
    .map((value) => String(value ?? "").toLowerCase())
    .join(" ");

  return Boolean(row?.error || details.error || haystack.includes("fail") || haystack.includes("error"));
}

function countStatus(rows: any[]) {
  return rows.reduce<Record<string, number>>((acc, row) => {
    const details = readDetails(row);
    const key = String(row?.status ?? details.status ?? "unknown");
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function automationHealth(latestRun: any, thresholdMinutes = 3) {
  const createdAt = normalizeDate(latestRun?.createdAt);
  if (!createdAt) {
    return {
      label: "No run log found",
      stale: true,
      ageMinutes: null,
      thresholdMinutes,
    };
  }

  const ageMs = Date.now() - new Date(createdAt).getTime();
  const ageMinutes = Number.isFinite(ageMs) ? Math.max(0, Math.round(ageMs / 60000)) : null;
  const stale = ageMinutes === null || ageMinutes > thresholdMinutes;

  return {
    label: stale ? `Stale (${ageMinutes ?? "unknown"} min)` : `Healthy (${ageMinutes} min)`,
    stale,
    ageMinutes,
    thresholdMinutes,
  };
}

function firstText(...values: unknown[]): string | null {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return null;
}

function normalizeMaildropAddressRow(row: any) {
  const details = readDetails(row);
  const address = firstText(
    row?.clioMaildropEmail,
    row?.email,
    row?.emailAddress,
    row?.maildropEmail,
    row?.mailDropEmail,
    row?.maildropAddress,
    row?.mailDropAddress,
    row?.value,
    row?.address,
    row?.normalizedEmail,
    row?.normalizedAddress,
    details.clioMaildropEmail,
    details.email,
    details.emailAddress,
    details.maildropEmail,
    details.mailDropEmail,
    details.maildropAddress,
    details.mailDropAddress,
    details.value,
    details.address,
    details.normalizedEmail,
    details.normalizedAddress,
  );

  return {
    id: String(row?.id ?? ""),
    address: address || "—",
    normalizedAddress: firstText(row?.normalizedEmail, row?.normalizedAddress, row?.clioMaildropEmail, details.normalizedEmail, details.normalizedAddress, details.clioMaildropEmail),
    label: firstText(row?.clioMaildropLabel, row?.label, row?.displayName, row?.name, details.clioMaildropLabel, details.label, details.displayName, details.name),
    source: firstText(row?.source, details.source),
    matterId: firstText(row?.matterId, row?.matterID, details.matterId, details.matterID),
    masterLawsuitId: firstText(row?.masterLawsuitId, details.masterLawsuitId),
    clioMatterId: firstText(row?.clioMatterId, row?.clioMatterID, details.clioMatterId, details.clioMatterID),
    clioDisplayNumber: firstText(row?.clioDisplayNumber, details.clioDisplayNumber),
    createdAt: normalizeDate(row?.createdAt),
    updatedAt: normalizeDate(row?.updatedAt),
    active: row?.active !== false,
  };
}

export async function GET() {
  const [
    recentFilingLogs,
    activeMaildropCount,
    recentMaildropRows,
    maildropSourceGroups,
  ] = await Promise.all([
    prisma.emailFilingLog.findMany({
      where: {
        action: {
          in: [
            "graph_background_thread_sync",
            "graph_maildrop_discovery",
            "graph-background-thread-sync",
            "graph-maildrop-discovery",
            "graph_thread_sync_persisted",
          ],
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    } as any),
    prisma.maildropAddress.count({
      where: { active: true },
    } as any),
    prisma.maildropAddress.findMany({
      where: { active: true },
      orderBy: [
        { updatedAt: "desc" },
        { createdAt: "desc" },
      ],
      take: 10,
    } as any),
    prisma.maildropAddress.groupBy({
      by: ["source"],
      where: { active: true },
      _count: { _all: true },
    } as any),
  ]);

  const knownThreadLogs = recentFilingLogs.filter(isKnownThreadLog);
  const maildropDiscoveryLogs = recentFilingLogs.filter(isMaildropDiscoveryLog);
  const recentAutomationLogs = [...knownThreadLogs, ...maildropDiscoveryLogs]
    .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 25);
  const failedAutomationLogs = recentAutomationLogs.filter(isFailureLog).slice(0, 10);

  return NextResponse.json({
    ok: true,
    generatedAt: new Date().toISOString(),
    knownThreadSync: {
      latestRun: knownThreadLogs[0] ? compactLog(knownThreadLogs[0]) : null,
      health: automationHealth(knownThreadLogs[0]),
      recentCount: knownThreadLogs.length,
      statusCounts: countStatus(knownThreadLogs),
      recentLogs: knownThreadLogs.slice(0, 10).map(compactLog),
    },
    maildropDiscovery: {
      latestRun: maildropDiscoveryLogs[0] ? compactLog(maildropDiscoveryLogs[0]) : null,
      health: automationHealth(maildropDiscoveryLogs[0]),
      recentCount: maildropDiscoveryLogs.length,
      statusCounts: countStatus(maildropDiscoveryLogs),
      recentLogs: maildropDiscoveryLogs.slice(0, 10).map(compactLog),
    },
    maildropRegistry: {
      activeCount: activeMaildropCount,
      sourceBreakdown: Object.fromEntries(
        maildropSourceGroups.map((row: any) => [row.source || "unknown", row._count._all]),
      ),
      recentAddresses: recentMaildropRows.map(normalizeMaildropAddressRow),
    },
    recentEmailAutomationLogs: recentAutomationLogs.map(compactLog),
    recentFailures: failedAutomationLogs.map(compactLog),
    safety: {
      readOnly: true,
      createsDrafts: false,
      sendsEmail: false,
      writesClio: false,
      uploadsDocuments: false,
      usesLocalOutlookAutomation: false,
      callsGraph: false,
      callsClio: false,
    },
  });
}
