import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function parsePositiveInt(value: unknown): number | null {
  const raw = clean(value);
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return null;
  const rounded = Math.floor(parsed);
  return rounded > 0 ? rounded : null;
}

function clampLimit(value: unknown, fallback = 25, max = 100): number {
  const parsed = Number(clean(value) || fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(max, Math.floor(parsed)));
}

function toJsonSafe(value: unknown): any {
  if (value == null) return null;

  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return null;
  }
}

function iso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function safeString(value: unknown): string | null {
  if (value == null) return null;
  return String(value).replace(/[\u0000-\u001F\u007F-\u009F]/g, " ").trim();
}

function eventTime(value: Date | string | null | undefined): number {
  const asIso = iso(value);
  return asIso ? new Date(asIso).getTime() : 0;
}

function includesLoose(haystack: unknown, needle: string): boolean {
  if (!needle) return false;

  try {
    return JSON.stringify(haystack ?? "")
      .toLowerCase()
      .includes(needle.toLowerCase());
  } catch {
    return false;
  }
}


function countJsonItems(value: any): number {
  return Array.isArray(value) ? value.length : 0;
}

function cleanActivityText(value: unknown): string {
  return String(value || "").trim();
}

function activityTargetLabel(row: any): string {
  const target = row?.clioUploadTarget && typeof row.clioUploadTarget === "object" ? row.clioUploadTarget : {};
  return (
    cleanActivityText(target.displayNumber) ||
    cleanActivityText(target.matterDisplayNumber) ||
    cleanActivityText(target.matterId) ||
    cleanActivityText(row?.masterDisplayNumber) ||
    cleanActivityText(row?.masterMatterId)
  );
}

function finalizationActivityLabel(row: any): string {
  const uploaded = countJsonItems(row?.uploaded);
  const skipped = countJsonItems(row?.skipped);
  const target = activityTargetLabel(row);
  const status = cleanActivityText(row?.status);

  const uploadPart = uploaded > 0 ? `Uploaded ${uploaded}` : "No new upload";
  const skippedPart = skipped > 0 ? ` · Skipped ${skipped} duplicate${skipped === 1 ? "" : "s"}` : "";
  const targetPart = target ? ` · Target ${target}` : "";
  const statusPart = status && status !== "success" ? ` · ${status}` : "";

  return `Finalized document packet · ${uploadPart}${skippedPart}${targetPart}${statusPart}`;
}

function finalizationActivityTrace(row: any) {
  return {
    finalizationId: row?.id || null,
    status: cleanActivityText(row?.status),
    masterLawsuitId: cleanActivityText(row?.masterLawsuitId),
    masterMatterId: row?.masterMatterId || null,
    masterDisplayNumber: cleanActivityText(row?.masterDisplayNumber),
    uploadedCount: countJsonItems(row?.uploaded),
    skippedCount: countJsonItems(row?.skipped),
    requestedKeys: Array.isArray(row?.requestedKeys) ? row.requestedKeys : [],
    clioUploadTarget: row?.clioUploadTarget || null,
    noUploadPerformed: Boolean(row?.noUploadPerformed),
    allowDuplicateUploads: Boolean(row?.allowDuplicateUploads),
  };
}

export async function GET(req: NextRequest) {
  try {
    const masterLawsuitId = clean(req.nextUrl.searchParams.get("masterLawsuitId"));
    const matterId = parsePositiveInt(req.nextUrl.searchParams.get("matterId"));
    const matterDisplayNumber = clean(req.nextUrl.searchParams.get("matterDisplayNumber"));
    const clioMatterId = parsePositiveInt(req.nextUrl.searchParams.get("clioMatterId"));
    const clioDisplayNumber = clean(req.nextUrl.searchParams.get("clioDisplayNumber"));
    const limit = clampLimit(req.nextUrl.searchParams.get("limit"), 25, 100);

    const lookupValues = [
      masterLawsuitId,
      matterId ? String(matterId) : "",
      matterDisplayNumber,
      clioMatterId ? String(clioMatterId) : "",
      clioDisplayNumber,
    ].filter(Boolean);

    if (lookupValues.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          action: "document-delivery-history",
          error:
            "Missing lookup. Provide masterLawsuitId, matterId, matterDisplayNumber, clioMatterId, or clioDisplayNumber.",
          safety: {
            readOnly: true,
            noClioRecordsChanged: true,
            noDatabaseRecordsChanged: true,
          },
        },
        { status: 400 }
      );
    }

    const finalizationOr: any[] = [];
    const printQueueOr: any[] = [];
    const emailThreadOr: any[] = [];
    const emailMatterLinkOr: any[] = [];

    if (masterLawsuitId) {
      finalizationOr.push({ masterLawsuitId });
      printQueueOr.push({ masterLawsuitId });
      emailThreadOr.push({ masterLawsuitId });
      emailMatterLinkOr.push({ masterLawsuitId });
    }

    if (matterId) {
      finalizationOr.push({ masterMatterId: matterId });
      printQueueOr.push({ masterMatterId: matterId });
      emailThreadOr.push({ matterId });
      emailMatterLinkOr.push({ matterId });
    }

    if (matterDisplayNumber) {
      emailThreadOr.push({ matterDisplayNumber });
      emailMatterLinkOr.push({ matterDisplayNumber });
    }

    if (clioMatterId) {
      emailThreadOr.push({ clioMatterId });
      emailMatterLinkOr.push({ clioMatterId });
    }

    if (clioDisplayNumber) {
      finalizationOr.push({ masterDisplayNumber: clioDisplayNumber });
      printQueueOr.push({ masterDisplayNumber: clioDisplayNumber });
      emailThreadOr.push({ clioDisplayNumber });
      emailMatterLinkOr.push({ clioDisplayNumber });
    }

    const [finalizations, printQueueItems, emailThreads, emailMatterLinks] =
      await Promise.all([
        finalizationOr.length
          ? prisma.documentFinalization.findMany({
              where: { OR: finalizationOr },
              orderBy: { finalizedAt: "desc" },
              take: limit,
            })
          : Promise.resolve([]),
        printQueueOr.length
          ? prisma.documentPrintQueueItem.findMany({
              where: { OR: printQueueOr },
              orderBy: { queuedAt: "desc" },
              take: limit,
            })
          : Promise.resolve([]),
        emailThreadOr.length
          ? prisma.emailThread.findMany({
              where: { OR: emailThreadOr },
              orderBy: [{ latestMessageAt: "desc" }, { updatedAt: "desc" }],
              take: limit,
              include: {
                messages: {
                  orderBy: [
                    { sentAt: "desc" },
                    { receivedAt: "desc" },
                    { createdAt: "desc" },
                  ],
                  take: 10,
                },
              },
            })
          : Promise.resolve([]),
        emailMatterLinkOr.length
          ? prisma.emailMatterLink.findMany({
              where: { OR: emailMatterLinkOr },
              orderBy: { createdAt: "desc" },
              take: limit,
            })
          : Promise.resolve([]),
      ]);

    const threadIds = new Set<string>();
    const messageIds = new Set<string>();
    const targetIds = new Set<string>();

    for (const thread of emailThreads) {
      if (thread.id) threadIds.add(thread.id);
      if (thread.conversationId) targetIds.add(thread.conversationId);
      if (thread.clioMatterId) targetIds.add(String(thread.clioMatterId));
      if (thread.clioDisplayNumber) targetIds.add(thread.clioDisplayNumber);
      for (const message of thread.messages || []) {
        if (message.id) messageIds.add(message.id);
        if (message.graphMessageId) targetIds.add(message.graphMessageId);
        if (message.internetMessageId) targetIds.add(message.internetMessageId);
      }
    }

    for (const link of emailMatterLinks) {
      if (link.threadId) threadIds.add(link.threadId);
      if (link.messageId) messageIds.add(link.messageId);
      if (link.clioMatterId) targetIds.add(String(link.clioMatterId));
      if (link.clioDisplayNumber) targetIds.add(link.clioDisplayNumber);
    }

    if (masterLawsuitId) targetIds.add(masterLawsuitId);
    if (matterId) targetIds.add(String(matterId));
    if (matterDisplayNumber) targetIds.add(matterDisplayNumber);
    if (clioMatterId) targetIds.add(String(clioMatterId));
    if (clioDisplayNumber) targetIds.add(clioDisplayNumber);

    const emailFilingOr: any[] = [];
    if (threadIds.size) emailFilingOr.push({ threadId: { in: Array.from(threadIds) } });
    if (messageIds.size) emailFilingOr.push({ messageId: { in: Array.from(messageIds) } });
    if (targetIds.size) emailFilingOr.push({ targetId: { in: Array.from(targetIds) } });

    const rawEmailFilingLogs = emailFilingOr.length
      ? await prisma.emailFilingLog.findMany({
          where: { OR: emailFilingOr },
          orderBy: { createdAt: "desc" },
          take: limit * 2,
        })
      : [];

    const emailFilingLogs = rawEmailFilingLogs
      .filter((log) => {
        if (!lookupValues.length) return true;

        if (lookupValues.some((value) => clean(log.targetId) === value)) return true;
        if (log.threadId && threadIds.has(log.threadId)) return true;
        if (log.messageId && messageIds.has(log.messageId)) return true;
        if (lookupValues.some((value) => includesLoose(log.metadata, value))) return true;

        return false;
      })
      .slice(0, limit);

    const finalizationRows = finalizations.map((row) => ({
      id: row.id,
      type: "finalization",
      masterLawsuitId: row.masterLawsuitId,
      masterMatterId: row.masterMatterId,
      masterDisplayNumber: row.masterDisplayNumber,
      status: safeString(row.status),
      requestedKeys: toJsonSafe(row.requestedKeys),
      uploaded: toJsonSafe(row.uploaded),
      skipped: toJsonSafe(row.skipped),
      clioUploadTarget: toJsonSafe(row.clioUploadTarget),
      validationSnapshot: toJsonSafe(row.validationSnapshot),
      packetSummarySnapshot: toJsonSafe(row.packetSummarySnapshot),
      allowDuplicateUploads: row.allowDuplicateUploads,
      noUploadPerformed: row.noUploadPerformed,
      error: safeString(row.error),
      finalizedAt: iso(row.finalizedAt),
      createdAt: iso(row.createdAt),
      updatedAt: iso(row.updatedAt),
    }));

    const printQueueRows = printQueueItems.map((row) => ({
      id: row.id,
      type: "print_queue",
      uniqueQueueKey: safeString(row.uniqueQueueKey),
      masterLawsuitId: row.masterLawsuitId,
      masterMatterId: row.masterMatterId,
      masterDisplayNumber: row.masterDisplayNumber,
      finalizationId: row.finalizationId,
      documentKey: safeString(row.documentKey),
      documentLabel: safeString(row.documentLabel),
      filename: safeString(row.filename),
      clioDocumentId: safeString(row.clioDocumentId),
      clioDocumentName: safeString(row.clioDocumentName),
      clioDocumentVersionUuid: safeString(row.clioDocumentVersionUuid),
      status: safeString(row.status),
      documentSnapshot: toJsonSafe(row.documentSnapshot),
      sourceFinalizationSnapshot: toJsonSafe(row.sourceFinalizationSnapshot),
      queuedAt: iso(row.queuedAt),
      printedAt: iso(row.printedAt),
      printDecision: safeString(row.printDecision),
      notes: safeString(row.notes),
      createdAt: iso(row.createdAt),
      updatedAt: iso(row.updatedAt),
    }));

    const emailThreadRows = emailThreads.map((thread) => ({
      id: thread.id,
      type: "email_thread",
      provider: safeString(thread.provider),
      mailboxUserPrincipalName: safeString(thread.mailboxUserPrincipalName),
      conversationId: safeString(thread.conversationId),
      internetMessageId: safeString(thread.internetMessageId),
      subject: safeString(thread.subject),
      normalizedSubject: safeString(thread.normalizedSubject),
      latestMessageAt: iso(thread.latestMessageAt),
      lastSyncedAt: iso(thread.lastSyncedAt),
      direction: safeString(thread.direction),
      source: safeString(thread.source),
      matterId: thread.matterId,
      matterDisplayNumber: safeString(thread.matterDisplayNumber),
      masterLawsuitId: thread.masterLawsuitId,
      clioMatterId: thread.clioMatterId,
      clioDisplayNumber: safeString(thread.clioDisplayNumber),
      clioMaildropLabel: safeString(thread.clioMaildropLabel),
      status: safeString(thread.status),
      metadata: toJsonSafe(thread.metadata),
      createdAt: iso(thread.createdAt),
      updatedAt: iso(thread.updatedAt),
      messages: (thread.messages || []).map((message) => ({
        id: message.id,
        provider: message.provider,
        graphMessageId: safeString(message.graphMessageId),
        internetMessageId: safeString(message.internetMessageId),
        conversationId: safeString(message.conversationId),
        subject: safeString(message.subject),
        from: safeString(message.from),
        fromEmail: safeString(message.fromEmail),
        toRecipients: toJsonSafe(message.toRecipients),
        ccRecipients: toJsonSafe(message.ccRecipients),
        bccRecipients: toJsonSafe(message.bccRecipients),
        sentAt: iso(message.sentAt),
        receivedAt: iso(message.receivedAt),
        folderName: safeString(message.folderName),
        direction: safeString(message.direction),
        isDraft: message.isDraft,
        isSent: message.isSent,
        hasAttachments: message.hasAttachments,
        importance: safeString(message.importance),
        bodyPreview: safeString(message.bodyPreview),
        webLink: safeString(message.webLink),
        createdAt: iso(message.createdAt),
        updatedAt: iso(message.updatedAt),
      })),
    }));

    const emailMatterLinkRows = emailMatterLinks.map((link) => ({
      id: link.id,
      type: "email_matter_link",
      threadId: safeString(link.threadId),
      messageId: safeString(link.messageId),
      matterId: link.matterId,
      matterDisplayNumber: safeString(link.matterDisplayNumber),
      masterLawsuitId: link.masterLawsuitId,
      clioMatterId: link.clioMatterId,
      clioDisplayNumber: safeString(link.clioDisplayNumber),
      linkReason: safeString(link.linkReason),
      confidence: safeString(link.confidence),
      createdBy: safeString(link.createdBy),
      metadata: toJsonSafe(link.metadata),
      createdAt: iso(link.createdAt),
    }));

    const emailFilingLogRows = emailFilingLogs.map((log) => ({
      id: log.id,
      type: "email_filing_log",
      threadId: log.threadId,
      messageId: log.messageId,
      provider: safeString(log.provider),
      targetSystem: safeString(log.targetSystem),
      targetType: safeString(log.targetType),
      targetId: safeString(log.targetId),
      action: safeString(log.action),
      status: safeString(log.status),
      previewOnly: log.previewOnly,
      clioRecordsChanged: log.clioRecordsChanged,
      databaseChanged: log.databaseChanged,
      requestedBy: safeString(log.requestedBy),
      error: safeString(log.error),
      metadata: toJsonSafe(log.metadata),
      createdAt: iso(log.createdAt),
      updatedAt: iso(log.updatedAt),
    }));

    const events = [
      ...finalizationRows.map((row) => ({
        type: "finalization",
        label: finalizationActivityLabel(row),
        trace: finalizationActivityTrace(row),
        status: safeString(row.status),
        occurredAt: row.finalizedAt,
        sortTime: eventTime(row.finalizedAt),
        row,
      })),
      ...printQueueRows.map((row) => ({
        type: "print_queue",
        label:
          row.status === "printed"
            ? "Printed document"
            : row.status === "queued"
              ? "Queued document for printing"
              : "Print queue update",
        status: safeString(row.status),
        occurredAt: row.printedAt || row.queuedAt,
        sortTime: eventTime(row.printedAt || row.queuedAt),
        row,
      })),
      ...emailThreadRows.flatMap((thread) =>
        thread.messages.map((message) => ({
          type: message.isDraft ? "email_draft" : "email_message",
          label: message.isDraft ? "Drafted email" : "Email message",
          status: message.isSent ? "sent" : message.isDraft ? "draft" : thread.status,
          occurredAt:
            message.sentAt || message.receivedAt || message.createdAt || thread.latestMessageAt,
          sortTime: eventTime(
            message.sentAt || message.receivedAt || message.createdAt || thread.latestMessageAt
          ),
          row: {
            thread,
            message,
          },
        }))
      ),
      ...emailFilingLogRows.map((row) => ({
        type: "email_filing_log",
        label: row.action || "Email filing log",
        status: safeString(row.status),
        occurredAt: row.createdAt,
        sortTime: eventTime(row.createdAt),
        row,
      })),
    ]
      .sort((a, b) => b.sortTime - a.sortTime)
      .slice(0, limit)
      .map(({ sortTime, ...event }) => event);

    return NextResponse.json({
      ok: true,
      action: "document-delivery-history",
      lookup: {
        masterLawsuitId: masterLawsuitId || null,
        matterId,
        matterDisplayNumber: matterDisplayNumber || null,
        clioMatterId,
        clioDisplayNumber: clioDisplayNumber || null,
        limit,
      },
      count: events.length,
      sections: {
        finalizations: {
          count: finalizationRows.length,
          rows: finalizationRows,
        },
        printQueueItems: {
          count: printQueueRows.length,
          rows: printQueueRows,
        },
        emailThreads: {
          count: emailThreadRows.length,
          rows: emailThreadRows,
        },
        emailMatterLinks: {
          count: emailMatterLinkRows.length,
          rows: emailMatterLinkRows,
        },
        emailFilingLogs: {
          count: emailFilingLogRows.length,
          rows: emailFilingLogRows,
        },
      },
      events,
      safety: {
        readOnly: true,
        localDocumentDeliveryHistoryOnly: true,
        clioDocumentsTabRemainsSourceOfTruth: true,
        noClioRecordsChanged: true,
        noDatabaseRecordsChanged: true,
        noOneDriveOrSharePointFoldersCreated: true,
        noEmailSent: true,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        action: "document-delivery-history",
        error: err?.message || "Could not load document delivery history.",
        safety: {
          readOnly: true,
          localDocumentDeliveryHistoryOnly: true,
          noClioRecordsChanged: true,
          noDatabaseRecordsChanged: true,
          noOneDriveOrSharePointFoldersCreated: true,
          noEmailSent: true,
        },
      },
      { status: 500 }
    );
  }
}
