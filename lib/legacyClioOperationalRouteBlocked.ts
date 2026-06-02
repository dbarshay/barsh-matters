import { NextResponse } from "next/server";

export function legacyClioOperationalRouteBlocked(routeName: string) {
  return NextResponse.json(
    {
      ok: false,
      blocked: true,
      routeName,
      status: "legacy-clio-operational-route-disabled",
      error:
        "This legacy Clio-operational route has been disabled.  Barsh Matters local schema is now the operational source of truth.  Clio may be used only for explicit BRL/document shell creation, document vault storage/access, MailDrop/document access, or separately approved transitional writeback workflows.",
      allowedClioUses: [
        "explicit BRL/document shell creation",
        "Clio document vault upload/list/open",
        "Clio MailDrop resolution",
        "separately approved transitional Clio writeback with explicit confirmation",
      ],
      prohibitedUses: [
        "using Clio to hydrate or overwrite ClaimIndex identity/reference/workflow fields",
        "using Clio as the source of truth for lawsuit grouping",
        "creating Clio master matters through legacy aggregation",
        "PATCHing selected bill matters through legacy aggregation",
        "rebuilding local operational data from Clio without an explicit migration/import workflow",
      ],
      writes: {
        createsLawsuit: false,
        updatesClaimIndex: false,
        writesClio: false,
        createsClioMasterMatter: false,
        consumesMasterSequence: false,
      },
    },
    { status: 410 }
  );
}
