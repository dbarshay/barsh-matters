import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function jsonError(message: string, status = 400, details: Record<string, unknown> = {}) {
  return NextResponse.json(
    {
      ok: false,
      action: "court-calendar-webcivil-local-import",
      localFirst: true,
      sourceOfTruth: "barsh-matters-local",
      error: message,
      ...details,
      safety: {
        externalWebCivilCalled: false,
        clioRecordsChanged: false,
        externalCalendarEventsCreated: false,
        emailsSent: false,
        documentsGenerated: false,
        printQueueChanged: false,
        ...(details.safety && typeof details.safety === "object" ? details.safety : {}),
      },
    },
    { status }
  );
}

function splitLine(line: string): string[] {
  if (line.includes("\t")) return line.split("\t").map(clean);
  return line.split(",").map(clean);
}

function headerKey(value: unknown): string {
  return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function columnIndex(headers: string[], aliases: string[]): number {
  const normalized = headers.map(headerKey);
  for (const alias of aliases) {
    const idx = normalized.indexOf(headerKey(alias));
    if (idx >= 0) return idx;
  }
  return -1;
}

function looksLikeHeader(cells: string[]) {
  const normalized = cells.map(headerKey);
  return normalized.includes("eventid") || normalized.includes("calendarNumber".toLowerCase()) || normalized.includes("calendarnumber");
}

type ParsedImportRow = {
  rowNumber: number;
  eventId: string;
  calendarNumber: string;
};

function parseImportRows(pastedText: string): { rows: ParsedImportRow[]; rowMessages: Array<Record<string, unknown>> } {
  const lines = pastedText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return { rows: [], rowMessages: [] };

  const firstCells = splitLine(lines[0]);
  const hasHeader = looksLikeHeader(firstCells);
  const headers = hasHeader ? firstCells : ["Event ID", "Calendar Number"];
  const eventIdIdx = columnIndex(headers, ["Event ID", "eventId", "id"]);
  const calendarNumberIdx = columnIndex(headers, ["Calendar Number", "calendarNumber", "Cal No", "Calendar No", "Cal #", "Calendar #"]);
  const dataLines = hasHeader ? lines.slice(1) : lines;
  const rows: ParsedImportRow[] = [];
  const rowMessages: Array<Record<string, unknown>> = [];

  if (eventIdIdx < 0 || calendarNumberIdx < 0) {
    return {
      rows,
      rowMessages: [{
        rowNumber: 1,
        status: "error",
        reason: "Header must include Event ID and Calendar Number columns.",
      }],
    };
  }

  dataLines.forEach((line, index) => {
    const rowNumber = hasHeader ? index + 2 : index + 1;
    const cells = splitLine(line);
    const eventId = clean(cells[eventIdIdx]);
    const calendarNumber = clean(cells[calendarNumberIdx]);

    if (!eventId && !calendarNumber) return;
    if (!eventId) {
      rowMessages.push({ rowNumber, calendarNumber, status: "skipped", reason: "Missing Event ID." });
      return;
    }
    if (!calendarNumber) {
      rowMessages.push({ rowNumber, eventId, status: "skipped", reason: "Missing Calendar Number." });
      return;
    }

    rows.push({ rowNumber, eventId, calendarNumber });
  });

  return { rows, rowMessages };
}

function eventSelect() {
  return {
    id: true,
    masterLawsuitId: true,
    displayNumber: true,
    eventType: true,
    title: true,
    court: true,
    venue: true,
    indexAaaNumber: true,
    calendarNumber: true,
    eventDate: true,
    eventTime: true,
    part: true,
    judgeOrArbitrator: true,
    appearanceType: true,
    notes: true,
    status: true,
    reminderDate: true,
    reminderTicklerId: true,
    source: true,
    sourceType: true,
    sourcePage: true,
    sourceAction: true,
    metadata: true,
    createdBy: true,
    updatedBy: true,
    createdAt: true,
    updatedAt: true,
  } as const;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const pastedText = clean(body?.pastedText);
    const previewOnly = body?.previewOnly !== false;
    const actor = clean(body?.actorEmail || body?.actorName) || null;

    if (!pastedText) return jsonError("pastedText is required.");

    const parsed = parseImportRows(pastedText);
    const eventIds = Array.from(new Set(parsed.rows.map((row) => row.eventId).filter(Boolean)));

    const existingEvents = eventIds.length
      ? await prisma.courtCalendarEvent.findMany({ where: { id: { in: eventIds } }, select: eventSelect() })
      : [];

    const byId = new Map(existingEvents.map((event) => [event.id, event]));
    const seen = new Set<string>();
    const rowPlans = [];

    for (const row of parsed.rows) {
      const event = byId.get(row.eventId);
      if (!event) {
        rowPlans.push({ rowNumber: row.rowNumber, eventId: row.eventId, calendarNumber: row.calendarNumber, status: "skipped" as const, reason: "No matching local Court Calendar event found.", currentCalendarNumber: null, event: null });
        continue;
      }
      if (seen.has(row.eventId)) {
        rowPlans.push({ rowNumber: row.rowNumber, eventId: row.eventId, calendarNumber: row.calendarNumber, status: "skipped" as const, reason: "Duplicate Event ID in pasted import.", currentCalendarNumber: event.calendarNumber, event });
        continue;
      }
      seen.add(row.eventId);
      if (clean(event.calendarNumber) === row.calendarNumber) {
        rowPlans.push({ rowNumber: row.rowNumber, eventId: row.eventId, calendarNumber: row.calendarNumber, status: "skipped" as const, reason: "Calendar Number already matches.", currentCalendarNumber: event.calendarNumber, event });
        continue;
      }
      rowPlans.push({ rowNumber: row.rowNumber, eventId: row.eventId, calendarNumber: row.calendarNumber, status: previewOnly ? "ready" as const : "updated" as const, reason: previewOnly ? "Ready to update local Calendar Number." : "Updated local Calendar Number.", currentCalendarNumber: event.calendarNumber, event });
    }

    const allRows = [...parsed.rowMessages, ...rowPlans].sort((a: any, b: any) => Number(a.rowNumber || 0) - Number(b.rowNumber || 0));
    const importablePlans = rowPlans.filter((row) => row.status === "ready" || row.status === "updated");

    if (previewOnly) {
      return NextResponse.json({
        ok: true,
        action: "court-calendar-webcivil-local-import-preview",
        localFirst: true,
        sourceOfTruth: "barsh-matters-local",
        previewOnly: true,
        databaseRecordsChanged: false,
        parsedRowCount: parsed.rows.length + parsed.rowMessages.length,
        importableRowCount: importablePlans.length,
        skippedRowCount: allRows.length - importablePlans.length,
        updatedCount: 0,
        rows: allRows,
        safety: {
          readOnly: true,
          externalWebCivilCalled: false,
          clioRecordsChanged: false,
          databaseRecordsChanged: false,
          externalCalendarEventsCreated: false,
          emailsSent: false,
          documentsGenerated: false,
          printQueueChanged: false,
        },
      });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const updatedRows = [];
      for (const plan of importablePlans) {
        const updatedEvent = await tx.courtCalendarEvent.update({
          where: { id: plan.eventId },
          data: {
            calendarNumber: plan.calendarNumber,
            updatedBy: actor,
            sourceAction: clean(body?.sourceAction) || "apply-webcivil-local-calendar-number-import",
            metadata: {
              ...((plan.event?.metadata && typeof plan.event.metadata === "object" && !Array.isArray(plan.event.metadata)) ? plan.event.metadata as Record<string, unknown> : {}),
              lastWebCivilLocalCalendarNumberImport: {
                source: "manual-paste",
                importedAt: new Date().toISOString(),
                priorCalendarNumber: plan.currentCalendarNumber || null,
                importedCalendarNumber: plan.calendarNumber,
              },
            },
          },
          select: eventSelect(),
        });

        await tx.auditLog.create({
          data: {
            action: "court-calendar-webcivil-local-calendar-number-import",
            summary: `Imported WebCivil Local calendar number ${plan.calendarNumber} for court calendar event ${plan.eventId}.`,
            entityType: "court-calendar-event",
            fieldName: "calendarNumber",
            priorValue: { calendarNumber: plan.currentCalendarNumber || null },
            newValue: { calendarNumber: plan.calendarNumber },
            details: {
              source: "court-calendar-import-webcivil-local-route",
              workflow: "court-calendaring",
              scope: "master-lawsuit",
              importMethod: "manual-paste",
              eventId: plan.eventId,
            },
            masterLawsuitId: clean(plan.event?.masterLawsuitId) || null,
            sourcePage: clean(body?.sourcePage) || "court-calendar",
            workflow: "court-calendaring",
            actorName: clean(body?.actorName) || null,
            actorEmail: clean(body?.actorEmail) || null,
          },
        });

        updatedRows.push({ ...plan, event: updatedEvent });
      }
      return updatedRows;
    });

    const updatedById = new Map(updated.map((row) => [row.eventId, row]));
    const finalRows = allRows.map((row: any) => updatedById.get(row.eventId) || row);

    return NextResponse.json({
      ok: true,
      action: "court-calendar-webcivil-local-import-apply",
      localFirst: true,
      sourceOfTruth: "barsh-matters-local",
      previewOnly: false,
      databaseRecordsChanged: true,
      parsedRowCount: parsed.rows.length + parsed.rowMessages.length,
      importableRowCount: importablePlans.length,
      skippedRowCount: allRows.length - importablePlans.length,
      updatedCount: updated.length,
      rows: finalRows,
      safety: {
        externalWebCivilCalled: false,
        clioRecordsChanged: false,
        databaseRecordsChanged: true,
        externalCalendarEventsCreated: false,
        emailsSent: false,
        documentsGenerated: false,
        printQueueChanged: false,
      },
    });
  } catch (error: any) {
    return jsonError(error?.message || "WebCivil Local calendar-number import failed.", 500);
  }
}
