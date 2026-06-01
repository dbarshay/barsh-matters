import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function clean(value: unknown): string {
  return String(value || "").trim();
}

function numberOrNull(value: unknown): number | null {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function positiveLimit(value: unknown, fallback = 100): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return fallback;
  return Math.min(Math.floor(numeric), 250);
}

function iso(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString();
}

export async function GET(req: NextRequest) {
  try {
    const url = req.nextUrl;

    const kind = clean(url.searchParams.get("kind"));
    const status = clean(url.searchParams.get("status")) || "open";
    const priority = clean(url.searchParams.get("priority"));
    const masterLawsuitId = clean(url.searchParams.get("masterLawsuitId"));
    const matterId = numberOrNull(url.searchParams.get("matterId"));
    const displayNumber = clean(url.searchParams.get("displayNumber"));
    const settlementRecordId = clean(url.searchParams.get("settlementRecordId"));
    const dueDate = clean(url.searchParams.get("dueDate"));
    const dueBefore = clean(url.searchParams.get("dueBefore"));
    const dueAfter = clean(url.searchParams.get("dueAfter"));
    const query = clean(url.searchParams.get("q"));
    const limit = positiveLimit(url.searchParams.get("limit"));

    const where: any = {};

    if (kind && kind !== "all") where.kind = kind;
    if (status && status !== "all") where.status = status;
    if (priority && priority !== "all") where.priority = priority;
    if (masterLawsuitId) where.masterLawsuitId = masterLawsuitId;
    if (matterId !== null) where.matterId = matterId;
    if (displayNumber) where.displayNumber = displayNumber;
    if (settlementRecordId) where.settlementRecordId = settlementRecordId;

    if (dueDate || dueBefore || dueAfter) {
      where.dueDate = {};
      if (dueDate) where.dueDate.equals = dueDate;
      if (dueBefore) where.dueDate.lte = dueBefore;
      if (dueAfter) where.dueDate.gte = dueAfter;
    }

    if (query) {
      where.OR = [
        { title: { contains: query } },
        { description: { contains: query } },
        { displayNumber: { contains: query } },
        { masterLawsuitId: { contains: query } },
        { settlementRecordId: { contains: query } },
      ];
    }

    const ticklers = await prisma.localWorkflowTickler.findMany({
      where,
      orderBy: [
        { dueDate: "asc" },
        { createdAt: "desc" },
      ],
      take: limit,
      select: {
        id: true,
        kind: true,
        source: true,
        status: true,
        priority: true,
        title: true,
        description: true,
        masterLawsuitId: true,
        matterId: true,
        displayNumber: true,
        settlementRecordId: true,
        dueDate: true,
        completedAt: true,
        completedBy: true,
        completedNote: true,
        metadata: true,
        createdBy: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const kinds = await prisma.localWorkflowTickler.findMany({
      distinct: ["kind"],
      orderBy: { kind: "asc" },
      select: { kind: true },
    });

    const statuses = await prisma.localWorkflowTickler.findMany({
      distinct: ["status"],
      orderBy: { status: "asc" },
      select: { status: true },
    });

    return NextResponse.json({
      ok: true,
      action: "admin-generic-tickler-search",
      count: ticklers.length,
      limit,
      filters: {
        kind: kind || "all",
        status,
        priority: priority || "all",
        masterLawsuitId: masterLawsuitId || null,
        matterId,
        displayNumber: displayNumber || null,
        settlementRecordId: settlementRecordId || null,
        dueDate: dueDate || null,
        dueBefore: dueBefore || null,
        dueAfter: dueAfter || null,
        q: query || null,
      },
      availableFilters: {
        kinds: kinds.map((row) => row.kind).filter(Boolean),
        statuses: statuses.map((row) => row.status).filter(Boolean),
      },
      ticklers: ticklers.map((tickler) => ({
        ...tickler,
        completedAt: iso(tickler.completedAt),
        createdAt: iso(tickler.createdAt),
        updatedAt: iso(tickler.updatedAt),
      })),
      safety: {
        administratorFunction: true,
        readOnly: true,
        localOnly: true,
        matterPageRunner: false,
        clioWritesPerformed: false,
        documentsChanged: false,
        emailsChanged: false,
        printQueueChanged: false,
      },
      note:
        "Administrator-only Barsh Matters local tickler search foundation. Filter by tickler kind/type, status, priority, due date, master lawsuit, matter, display number, settlement record, or keyword. This route is read-only and does not run or process ticklers.",
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        action: "admin-generic-tickler-search",
        error: error?.message || "Admin generic tickler search failed.",
      },
      { status: 500 }
    );
  }
}
