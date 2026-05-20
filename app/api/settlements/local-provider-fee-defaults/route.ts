import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeName(value: unknown): string {
  return clean(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function numberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const raw = clean(value).replace(/[$,%\s,]/g, "");
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function compactKey(value: string): string {
  return normalizeName(value).replace(/\s+/g, "");
}

function detailEntries(details: unknown): [string, unknown][] {
  if (!details || typeof details !== "object" || Array.isArray(details)) return [];

  const topEntries = Object.entries(details as Record<string, unknown>);
  const hidden = (details as Record<string, unknown>)._hiddenImportFields;
  const hiddenEntries =
    hidden && typeof hidden === "object" && !Array.isArray(hidden)
      ? Object.entries(hidden as Record<string, unknown>)
      : [];

  return [...topEntries, ...hiddenEntries];
}

function findDetailValue(details: unknown, preferredKeys: string[]): unknown {
  const entries = detailEntries(details);
  const preferredCompacts = preferredKeys.map(compactKey);

  for (const preferred of preferredCompacts) {
    const exact = entries.find(([key]) => compactKey(key) === preferred);
    if (exact) return exact[1];
  }

  for (const preferred of preferredCompacts) {
    const fuzzy = entries.find(([key]) => compactKey(key).includes(preferred));
    if (fuzzy) return fuzzy[1];
  }

  return null;
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const providerName = clean(url.searchParams.get("provider") || url.searchParams.get("client"));
    const normalizedProviderName = normalizeName(providerName);

    if (!providerName || !normalizedProviderName) {
      return NextResponse.json(
        {
          ok: false,
          action: "local-provider-fee-defaults",
          localFirst: true,
          error: "Missing provider/client name.",
          safety: {
            clioRecordsChanged: false,
            databaseRecordsChanged: false,
            documentsGenerated: false,
            printQueueChanged: false,
            mattersClosed: false,
            settlementWritebackPerformed: false,
          },
        },
        { status: 400 }
      );
    }

    const entity =
      (await prisma.referenceEntity.findFirst({
        where: {
          type: "provider_client",
          normalizedName: normalizedProviderName,
          active: true,
        },
        select: {
          id: true,
          displayName: true,
          normalizedName: true,
          details: true,
        },
      })) ||
      (await prisma.referenceEntity.findFirst({
        where: {
          type: "provider_client",
          active: true,
          displayName: {
            equals: providerName,
            mode: "insensitive",
          },
        },
        select: {
          id: true,
          displayName: true,
          normalizedName: true,
          details: true,
        },
      }));

    const principalRaw = findDetailValue(entity?.details, [
      "hidden_retainer_principal_nf_percent",
      "Retainer Principal NF",
      "Retainer Principal",
      "Principal Fee Percent",
      "Principal Fee %",
      "Principal Fee",
    ]);

    const interestRaw = findDetailValue(entity?.details, [
      "hidden_retainer_interest_percent",
      "Retainer Interest",
      "Interest Fee Percent",
      "Interest Fee %",
      "Interest Fee",
    ]);

    const principalFeePercent = numberOrNull(principalRaw);
    const interestFeePercent = numberOrNull(interestRaw);

    return NextResponse.json({
      ok: true,
      action: "local-provider-fee-defaults",
      localFirst: true,
      sourceOfTruth: "barsh-matters-local-reference-data",
      providerName,
      matchedProvider: entity
        ? {
            id: entity.id,
            displayName: entity.displayName,
            normalizedName: entity.normalizedName,
          }
        : null,
      defaults: {
        principalFeePercent,
        interestFeePercent,
        principalRaw,
        interestRaw,
      },
      validation: {
        foundProviderReference: Boolean(entity),
        foundPrincipalFeePercent: principalFeePercent !== null,
        foundInterestFeePercent: interestFeePercent !== null,
        warnings: [
          ...(entity ? [] : [`No active provider/client reference entity matched "${providerName}".`]),
          ...(principalFeePercent !== null ? [] : ["No local Retainer Principal NF / principal fee default was found."]),
          ...(interestFeePercent !== null ? [] : ["No local Retainer Interest / interest fee default was found."]),
        ],
      },
      safety: {
        clioRecordsChanged: false,
        databaseRecordsChanged: false,
        documentsGenerated: false,
        printQueueChanged: false,
        mattersClosed: false,
        settlementWritebackPerformed: false,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        action: "local-provider-fee-defaults",
        localFirst: true,
        error: error?.message || "Local provider fee defaults lookup failed.",
        safety: {
          clioRecordsChanged: false,
          databaseRecordsChanged: false,
          documentsGenerated: false,
          printQueueChanged: false,
          mattersClosed: false,
          settlementWritebackPerformed: false,
        },
      },
      { status: 500 }
    );
  }
}
