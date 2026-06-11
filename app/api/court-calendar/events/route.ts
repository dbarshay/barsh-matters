import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ALLOWED_EVENT_TYPES = new Set([
  "appearance",
  "filing_deadline",
  "return_date",
  "motion_date",
  "trial_date",
  "arbitration_date",
  "adjournment",
  "follow_up",
  "custom",
]);

const ALLOWED_STATUSES = new Set([
  "scheduled",
  "completed",
  "adjourned",
  "cancelled",
  "missed",
]);

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function validDateOnly(value: unknown): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(clean(value));
}

function validOptionalDateOnly(value: unknown): boolean {
  const raw = clean(value);
  return !raw || validDateOnly(raw);
}

function normalizeEventType(value: unknown): string {
  const raw = clean(value).toLowerCase().replace(/[\s-]+/g, "_");
  return ALLOWED_EVENT_TYPES.has(raw) ? raw : "";
}

function normalizeStatus(value: unknown): string {
  const raw = clean(value).toLowerCase().replace(/[\s-]+/g, "_");
  return ALLOWED_STATUSES.has(raw) ? raw : "scheduled";
}

function positiveLimit(value: unknown, fallback = 100): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.trunc(parsed), 500);
}

function jsonError(message: string, status = 400, details: Record<string, unknown> = {}) {
  return NextResponse.json(
    {
      ok: false,
      action: "court-calendar-events",
      localFirst: true,
      sourceOfTruth: "barsh-matters-local",
      error: message,
      ...details,
      safety: {
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

async function lawsuitDefaults(masterLawsuitId: string) {
  const lawsuit = await prisma.lawsuit.findUnique({
    where: { masterLawsuitId },
    select: {
      masterLawsuitId: true,
      venue: true,
      venueSelection: true,
      venueOther: true,
      indexAaaNumber: true,
      lawsuitOptions: true,
    },
  });

  if (!lawsuit) return null;

  const options =
    lawsuit.lawsuitOptions && typeof lawsuit.lawsuitOptions === "object" && !Array.isArray(lawsuit.lawsuitOptions)
      ? (lawsuit.lawsuitOptions as Record<string, any>)
      : {};

  return {
    lawsuit,
    court: clean(lawsuit.venueSelection || lawsuit.venue || options.venueSelection || options.venue),
    venue: clean(lawsuit.venue || lawsuit.venueSelection || options.venue || options.venueSelection),
    indexAaaNumber: clean(lawsuit.indexAaaNumber || options.indexAaaNumber),
  };
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
    adjournedFromEventId: true,
    adjournedToEventId: true,
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

async function enrichEvents(events: Array<any>, options: { hideClosedMatters?: boolean } = {}) {
  const masterIds = Array.from(new Set(events.map((event) => clean(event.masterLawsuitId)).filter(Boolean)));

  if (!masterIds.length) return events.map((event) => ({ ...event, caseData: { childCount: 0, matters: [] } }));

  const claims = await prisma.claimIndex.findMany({
    where: { master_lawsuit_id: { in: masterIds } },
    orderBy: [{ display_number: "asc" }],
    select: {
      matter_id: true,
      display_number: true,
      master_lawsuit_id: true,
      patient_name: true,
      provider_name: true,
      client_name: true,
      insurer_name: true,
      claim_number_raw: true,
      claim_number_normalized: true,
      dos_start: true,
      dos_end: true,
      date_of_loss: true,
      bill_number: true,
      claim_amount: true,
      balance_presuit: true,
      final_status: true,
      close_reason: true,
      denial_reason: true,
      service_type: true,
      treating_provider: true,
    },
  });

  const byMaster = new Map<string, Array<any>>();
  const visibleClaims = options.hideClosedMatters ? claims.filter((claim) => clean(claim.final_status).toLowerCase() !== "closed") : claims;

  for (const claim of visibleClaims) {
    const key = clean(claim.master_lawsuit_id);
    if (!key) continue;
    if (!byMaster.has(key)) byMaster.set(key, []);
    byMaster.get(key)!.push(claim);
  }

  return events.map((event) => {
    const rows = byMaster.get(clean(event.masterLawsuitId)) || [];
    const patients = Array.from(new Set(rows.map((row) => clean(row.patient_name)).filter(Boolean)));
    const providers = Array.from(new Set(rows.map((row) => clean(row.provider_name || row.client_name)).filter(Boolean)));
    const insurers = Array.from(new Set(rows.map((row) => clean(row.insurer_name)).filter(Boolean)));
    const claims = Array.from(new Set(rows.map((row) => clean(row.claim_number_raw || row.claim_number_normalized)).filter(Boolean)));

    return {
      ...event,
      caseData: {
        childCount: rows.length,
        patients,
        providers,
        insurers,
        claimNumbers: claims,
        matters: rows.map((row) => ({
          matterId: row.matter_id,
          displayNumber: row.display_number,
          patient: row.patient_name,
          provider: row.provider_name || row.client_name,
          insurer: row.insurer_name,
          claimNumber: row.claim_number_raw || row.claim_number_normalized,
          dosStart: row.dos_start,
          dosEnd: row.dos_end,
          dateOfLoss: row.date_of_loss,
          billNumber: row.bill_number,
          claimAmount: row.claim_amount,
          balancePresuit: row.balance_presuit,
          finalStatus: row.final_status,
          closeReason: row.close_reason,
          denialReason: row.denial_reason,
          serviceType: row.service_type,
          treatingProvider: row.treating_provider,
        })),
      },
    };
  });
}

export async function GET(req: NextRequest) {
  try {
    const url = req.nextUrl;
    const masterLawsuitId = clean(url.searchParams.get("masterLawsuitId"));
    const status = clean(url.searchParams.get("status"));
    const eventType = normalizeEventType(url.searchParams.get("eventType"));
    const dateFrom = clean(url.searchParams.get("dateFrom"));
    const dateTo = clean(url.searchParams.get("dateTo"));
    const query = clean(url.searchParams.get("q"));
    const appearanceType = clean(url.searchParams.get("appearanceType"));
    const venue = clean(url.searchParams.get("venue"));
    const clientName = clean(url.searchParams.get("clientName"));
    const includeCaseData = clean(url.searchParams.get("includeCaseData")).toLowerCase() === "true";
    const hideClosedMatters = clean(url.searchParams.get("hideClosedMatters")).toLowerCase() === "true";
    const limit = positiveLimit(url.searchParams.get("limit"));

    const where: any = {};

    if (masterLawsuitId) where.masterLawsuitId = masterLawsuitId;
    if (status && status !== "all") where.status = normalizeStatus(status);
    if (eventType) where.eventType = eventType;
    if (appearanceType && appearanceType !== "all") where.appearanceType = { contains: appearanceType };
    if (venue && venue !== "all") where.AND = [...(Array.isArray(where.AND) ? where.AND : []), { OR: [{ venue: { contains: venue } }, { court: { contains: venue } }] }];

    if (dateFrom || dateTo) {
      where.eventDate = {};
      if (dateFrom) where.eventDate.gte = dateFrom;
      if (dateTo) where.eventDate.lte = dateTo;
    }

    if (query) {
      where.OR = [
        { title: { contains: query } },
        { court: { contains: query } },
        { venue: { contains: query } },
        { indexAaaNumber: { contains: query } },
        { calendarNumber: { contains: query } },
        { part: { contains: query } },
        { judgeOrArbitrator: { contains: query } },
        { notes: { contains: query } },
        { displayNumber: { contains: query } },
        { masterLawsuitId: { contains: query } },
      ];
    }

    if (clientName && clientName !== "all") {
      const matchingClaims = await prisma.claimIndex.findMany({ where: { client_name: { contains: clientName } }, select: { master_lawsuit_id: true }, take: 1000 });
      const matchingMasters = Array.from(new Set(matchingClaims.map((row) => clean(row.master_lawsuit_id)).filter(Boolean)));
      where.AND = [...(Array.isArray(where.AND) ? where.AND : []), matchingMasters.length ? { masterLawsuitId: { in: matchingMasters } } : { masterLawsuitId: "__NO_CLIENT_MATCH__" }];
    }

    const events = await prisma.courtCalendarEvent.findMany({
      where,
      orderBy: [{ eventDate: "asc" }, { eventTime: "asc" }, { createdAt: "desc" }],
      take: limit,
      select: eventSelect(),
    });

    return NextResponse.json({
      ok: true,
      action: "court-calendar-events-list",
      localFirst: true,
      sourceOfTruth: "barsh-matters-local",
      count: events.length,
      events: includeCaseData ? await enrichEvents(events, { hideClosedMatters }) : events,
      safety: {
        readOnly: true,
        clioRecordsChanged: false,
        externalCalendarEventsCreated: false,
        emailsSent: false,
        documentsGenerated: false,
        printQueueChanged: false,
      },
    });
  } catch (error: any) {
    return jsonError(error?.message || "Court calendar event list failed.", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const masterLawsuitId = clean(body?.masterLawsuitId);
    const displayNumber = clean(body?.displayNumber);
    const eventType = normalizeEventType(body?.eventType);
    const eventDate = clean(body?.eventDate);
    const reminderDate = clean(body?.reminderDate);
    const actor = clean(body?.actorEmail || body?.actorName) || null;
    const previewOnly = body?.previewOnly === true;
    const createReminderTickler = body?.createReminderTickler === true && !!reminderDate;

    if (!masterLawsuitId) return jsonError("masterLawsuitId is required.");
    if (!eventType) return jsonError("A valid eventType is required.");
    if (!validDateOnly(eventDate)) return jsonError("eventDate must be YYYY-MM-DD.");
    if (!validOptionalDateOnly(reminderDate)) return jsonError("reminderDate must be YYYY-MM-DD when supplied.");

    const defaults = await lawsuitDefaults(masterLawsuitId);
    if (!defaults) {
      return jsonError(`No local Lawsuit row found for ${masterLawsuitId}.`, 404, {
        masterLawsuitId,
        safety: { databaseRecordsChanged: false },
      });
    }

    const title = clean(body?.title) || `${eventType.replace(/_/g, " ")} for ${masterLawsuitId}`;
    const eventPlan = {
      masterLawsuitId,
      displayNumber: displayNumber || masterLawsuitId,
      eventType,
      title,
      court: clean(body?.court) || defaults.court || null,
      venue: clean(body?.venue) || defaults.venue || null,
      indexAaaNumber: clean(body?.indexAaaNumber) || defaults.indexAaaNumber || null,
      calendarNumber: clean(body?.calendarNumber) || null,
      eventDate,
      eventTime: clean(body?.eventTime) || null,
      part: clean(body?.part) || null,
      judgeOrArbitrator: clean(body?.judgeOrArbitrator) || null,
      appearanceType: clean(body?.appearanceType) || null,
      notes: clean(body?.notes) || null,
      status: normalizeStatus(body?.status),
      adjournedFromEventId: clean(body?.adjournedFromEventId) || null,
      reminderDate: reminderDate || null,
      source: "barsh-matters-local",
      sourceType: clean(body?.sourceType) || "court-calendar-event",
      sourcePage: clean(body?.sourcePage) || "court-calendar",
      sourceAction: clean(body?.sourceAction) || "create-court-calendar-event",
      createdBy: actor,
      updatedBy: actor,
      metadata: {
        source: "court-calendar-events-route",
        workflow: "court-calendaring",
        scope: "master-lawsuit",
        reportMayEnrichFromChildMatters: true,
        createReminderTickler,
        suppliedMetadata: body?.metadata && typeof body.metadata === "object" ? body.metadata : null,
      },
    };

    if (previewOnly) {
      return NextResponse.json({
        ok: true,
        action: "court-calendar-event-preview",
        localFirst: true,
        sourceOfTruth: "barsh-matters-local",
        previewOnly: true,
        databaseRecordsChanged: false,
        eventPlan,
        safety: {
          readOnly: true,
          clioRecordsChanged: false,
          databaseRecordsChanged: false,
          ticklersCreated: false,
          externalCalendarEventsCreated: false,
          emailsSent: false,
          documentsGenerated: false,
          printQueueChanged: false,
        },
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const event = await tx.courtCalendarEvent.create({
        data: eventPlan,
        select: eventSelect(),
      });

      let reminderTickler = null;

      if (createReminderTickler && reminderDate) {
        reminderTickler = await tx.localWorkflowTickler.create({
          data: {
            kind: "court_calendar_reminder",
            source: "barsh-matters-local",
            status: "open",
            priority: "normal",
            title: `Court calendar reminder: ${title}`,
            description: `Court calendar event on ${eventDate}${eventPlan.eventTime ? ` at ${eventPlan.eventTime}` : ""}.`,
            masterLawsuitId,
            matterId: null,
            displayNumber: displayNumber || masterLawsuitId,
            dueDate: reminderDate,
            createdBy: actor,
            metadata: {
              source: "court-calendar-events-route",
              workflow: "court-calendaring",
              courtCalendarEventId: event.id,
              eventType,
              eventDate,
              eventTime: eventPlan.eventTime,
            },
          },
        });

        await tx.courtCalendarEvent.update({
          where: { id: event.id },
          data: { reminderTicklerId: reminderTickler.id },
        });
      }

      await tx.auditLog.create({
        data: {
          action: "court-calendar-event-create",
          summary: `Created court calendar event ${title} for ${masterLawsuitId}.`,
          entityType: "court-calendar-event",
          fieldName: "courtCalendarEvent",
          priorValue: { before: null },
          newValue: event,
          details: {
            source: "court-calendar-events-route",
            workflow: "court-calendaring",
            scope: "master-lawsuit",
            reminderTicklerId: reminderTickler?.id || null,
          },
          masterLawsuitId,
          sourcePage: eventPlan.sourcePage,
          workflow: "court-calendaring",
          actorName: clean(body?.actorName) || null,
          actorEmail: clean(body?.actorEmail) || null,
        },
      });

      const savedEvent = await tx.courtCalendarEvent.findUnique({
        where: { id: event.id },
        select: eventSelect(),
      });

      return { event: savedEvent, reminderTickler };
    });

    return NextResponse.json({
      ok: true,
      action: "court-calendar-event-create",
      localFirst: true,
      sourceOfTruth: "barsh-matters-local",
      databaseRecordsChanged: true,
      event: result.event,
      reminderTickler: result.reminderTickler,
      safety: {
        clioRecordsChanged: false,
        databaseRecordsChanged: true,
        ticklersCreated: !!result.reminderTickler,
        externalCalendarEventsCreated: false,
        emailsSent: false,
        documentsGenerated: false,
        printQueueChanged: false,
      },
    });
  } catch (error: any) {
    return jsonError(error?.message || "Court calendar event creation failed.", 500);
  }
}
