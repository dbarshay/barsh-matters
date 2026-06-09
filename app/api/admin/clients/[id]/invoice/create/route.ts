import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function moneyNumber(value: unknown): number {
  const numeric = Number(String(value ?? "").replace(/[$,\s]/g, ""));
  return Number.isFinite(numeric) ? numeric : 0;
}

function intNumber(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.trunc(numeric) : 0;
}

function jsonOrNull(value: unknown) {
  if (value === undefined) return null;
  return value as any;
}

function providerInitials(value: unknown): string {
  const text = clean(value)
    .replace(/&/g, " and ")
    .replace(/\bP\.?\s*C\.?\b/gi, " P C ")
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const stopWords = new Set(["and", "the", "of"]);
  const initials = text
    .split(" ")
    .filter(Boolean)
    .filter((word) => !stopWords.has(word.toLowerCase()))
    .map((word) => word[0])
    .join("")
    .toUpperCase();

  return initials || "CLIENT";
}

function safeInvoiceNumberBase(value: unknown, providerDisplayName: unknown): string {
  const supplied = clean(value).replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-").slice(0, 64);
  if (supplied) return supplied;

  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}${m}${d}-${providerInitials(providerDisplayName)}`;
}

async function uniqueInvoiceNumber(base: string): Promise<string> {
  let candidate = base;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const existing = await prisma.providerClientInvoice.findUnique({
      where: { invoiceNumber: candidate },
      select: { id: true },
    });

    if (!existing) return candidate;

    const suffix = String(attempt + 2).padStart(2, "0");
    candidate = `${base}-${suffix}`;
  }

  throw new Error("Could not allocate a unique invoice number.");
}

function normalizedLine(line: any) {
  return {
    lineType: clean(line?.lineType) || "line",
    sourceId: clean(line?.sourceId) || null,
    sourceTable: clean(line?.sourceTable) || null,
    sortDate: clean(line?.sortDate) || null,
    matter: clean(line?.matter) || null,
    patient: clean(line?.patient) || null,
    provider: clean(line?.provider) || null,
    insurer: clean(line?.insurer) || null,
    lawsuit: clean(line?.lawsuit) || null,
    description: clean(line?.description) || null,
    amount: moneyNumber(line?.amount),
    retainerFee: moneyNumber(line?.retainerFee),
    rowSnapshot: jsonOrNull(line?.rowSnapshot ?? line),
  };
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> | { id: string } }) {
  try {
    const resolvedParams = await Promise.resolve(context.params);
    const clientId = clean(resolvedParams.id);

    if (!clientId) {
      return NextResponse.json({ ok: false, error: "Provider/client id is required." }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));

    if (body?.confirmCreateInvoiceDraft !== true) {
      return NextResponse.json(
        { ok: false, error: "confirmCreateInvoiceDraft must be true to create a local draft invoice." },
        { status: 400 }
      );
    }

    const preview = body?.invoiceDraftPreview || {};
    const lines = Array.isArray(preview?.lines) ? preview.lines : [];

    if (!lines.length) {
      return NextResponse.json(
        { ok: false, error: "Invoice draft preview must include at least one line." },
        { status: 400 }
      );
    }

    const totals = preview?.totalsSnapshot || {};
    const filters = preview?.filters || {};
    const invoiceNumber = await uniqueInvoiceNumber(safeInvoiceNumberBase(preview?.invoiceNumberCandidate, preview?.providerDisplayName || preview?.clientSnapshot?.displayName));
    const receiptLineSourceIds: number[] = Array.from(
      new Set<number>(
        lines
          .filter((line: any) => clean(line?.sourceTable) === "MatterPaymentReceipt")
          .map((line: any) => Number(clean(line?.sourceId)))
          .filter((value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value))
      )
    );

    const receiptRowsMarkedWithAnotherInvoiceId = receiptLineSourceIds.length
      ? await prisma.matterPaymentReceipt.findMany({
          where: {
            id: { in: receiptLineSourceIds },
            invoiceId: { not: null },
            NOT: [{ invoiceId: "" }],
          },
          select: {
            id: true,
            invoiceId: true,
            displayNumber: true,
            transactionType: true,
            paymentAmount: true,
            transactionDate: true,
          },
          orderBy: { id: "asc" },
        })
      : [];

    if (receiptRowsMarkedWithAnotherInvoiceId.length && body?.confirmIncludeAlreadyInvoiced !== true) {
      return NextResponse.json(
        {
          ok: false,
          error: "Invoice draft includes receipt rows already assigned to another invoice. Refresh ordinary preview or confirm admin include-already-invoiced mode.",
          receiptRowsMarkedWithAnotherInvoiceId,
        },
        { status: 409 }
      );
    }

    const normalizedLines = lines.map(normalizedLine);

    const created = await prisma.$transaction(async (tx) => {
      const invoice = await tx.providerClientInvoice.create({
        data: {
          invoiceNumber,
          providerClientInfoId: clean(preview?.providerClientInfoId) || null,
          referenceEntityId: clean(preview?.referenceEntityId) || clientId,
          providerDisplayName: clean(preview?.providerDisplayName) || clean(preview?.clientSnapshot?.displayName) || "Provider Client",
          status: "draft",

          dateFrom: clean(filters?.dateFrom) || null,
          dateTo: clean(filters?.dateTo) || null,
          statusFilter: clean(filters?.status) || null,
          transactionTypeFilter: clean(filters?.transactionType) || null,

          receiptRowCount: intNumber(totals?.receiptRowCount),
          principalInterestTotal: moneyNumber(totals?.principalInterestTotal),
          filingFeePaymentTotal: moneyNumber(totals?.filingFeePaymentTotal),
          costsExpendedTotal: moneyNumber(totals?.costsExpendedTotal),
          retainerFeeTotal: moneyNumber(totals?.retainerFeeTotal),
          invoicePackageTotal: moneyNumber(totals?.invoicePackageTotal),

          clientSnapshot: jsonOrNull(preview?.clientSnapshot),
          filterSnapshot: jsonOrNull(filters),
          totalsSnapshot: jsonOrNull(totals),
        },
      });

      await tx.providerClientInvoiceLine.createMany({
        data: normalizedLines.map((line: ReturnType<typeof normalizedLine>) => ({
          invoiceId: invoice.id,
          ...line,
        })),
      });

      await tx.providerClientInvoiceAudit.create({
        data: {
          invoiceId: invoice.id,
          providerClientInfoId: invoice.providerClientInfoId,
          referenceEntityId: invoice.referenceEntityId,
          providerDisplayName: invoice.providerDisplayName,
          eventType: "invoice.draft_created",
          eventSummary: "Local draft invoice created from frozen invoice preview.",
          details: {
            lineCount: normalizedLines.length,
            receiptLineSourceIds,
            receiptRowsMarkedWithAnotherInvoiceId: receiptRowsMarkedWithAnotherInvoiceId.length,
            invoicePackageTotal: moneyNumber(totals?.invoicePackageTotal),
            noReceiptRowsMarked: true,
            noClioRecordsChanged: true,
            noClaimIndexRecordsChanged: true,
            noRemittanceRecordsChanged: true,
          },
        },
      });

      return tx.providerClientInvoice.findUnique({
        where: { id: invoice.id },
        include: { lines: true },
      });
    });

    return NextResponse.json({
      ok: true,
      action: "provider-client-invoice-create-draft",
      mode: "local-draft-created",
      safety: "Created a local draft invoice and frozen invoice lines only. This route does not finalize invoices, update MatterPaymentReceipt.invoiceId, write remittances, generate documents, send email, print, queue, update ClaimIndex, mutate Clio, or change source payment/cost rows.",
      invoice: created,
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Could not create local draft invoice." },
      { status: 500 }
    );
  }
}
