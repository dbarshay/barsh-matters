import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function uniqueSorted(values: unknown[]): string[] {
  return Array.from(new Set(values.map(clean).filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

export async function GET() {
  try {
    const [referenceVenues, lawsuitVenues, eventVenues, providerClientRows] = await Promise.all([
      prisma.referenceEntity.findMany({ where: { type: "court_venue", active: true }, orderBy: { displayName: "asc" }, select: { displayName: true }, take: 500 }),
      prisma.lawsuit.findMany({ select: { venue: true, venueSelection: true, venueOther: true }, take: 1000 }),
      prisma.courtCalendarEvent.findMany({ select: { venue: true, court: true }, take: 1000 }),
      prisma.referenceEntity.findMany({ where: { type: "provider_client", active: true }, orderBy: { displayName: "asc" }, select: { displayName: true }, take: 10000 }),
    ]);

    return NextResponse.json({
      ok: true,
      action: "court-calendar-filter-options",
      localFirst: true,
      sourceOfTruth: "barsh-matters-local",
      appearanceTypes: ["Trial", "Conference", "Motion"],
      venues: uniqueSorted([...referenceVenues.map((row) => row.displayName), ...lawsuitVenues.flatMap((row) => [row.venue, row.venueSelection, row.venueOther]), ...eventVenues.flatMap((row) => [row.venue, row.court])]),
      clientNames: uniqueSorted(providerClientRows.map((row) => row.displayName)),
      safety: { readOnly: true, clioRecordsChanged: false, databaseRecordsChanged: false, externalCalendarEventsCreated: false, emailsSent: false, documentsGenerated: false, printQueueChanged: false },
    });
  } catch (error: any) {
    return NextResponse.json({ ok: false, action: "court-calendar-filter-options", localFirst: true, sourceOfTruth: "barsh-matters-local", error: error?.message || "Court calendar filter options failed.", safety: { clioRecordsChanged: false, databaseRecordsChanged: false, externalCalendarEventsCreated: false, emailsSent: false, documentsGenerated: false, printQueueChanged: false } }, { status: 500 });
  }
}
