import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function moneyNumber(value: unknown): number {
  const numeric = Number(String(value ?? "").replace(/[$,\s]/g, ""));
  return Number.isFinite(numeric) ? Math.round(numeric * 100) / 100 : 0;
}

function isCostRecoveryTransactionType(value: unknown): boolean {
  const type = clean(value).toLowerCase();
  return (
    type.includes("filing fee") ||
    type.includes("index fee") ||
    type.includes("service fee") ||
    type.includes("court cost") ||
    type.includes("court costs") ||
    type.includes("other court costs") ||
    type.includes("other court fees")
  );
}

function costCategory(value: unknown): string {
  const text = clean(value);
  const lower = text.toLowerCase();
  if (lower.includes("filing fee") || lower.includes("index fee")) return "Index Fee";
  if (lower.includes("service fee")) return "Service Fee";
  if (lower.includes("other court costs") || lower.includes("other court fees") || lower.includes("court cost")) return "Other Court Costs";
  return text || "Other Court Costs";
}

function sourceKey(sourceTable: string, sourceId: unknown): string {
  return `${sourceTable}::${clean(sourceId)}`;
}

function asDateValue(value: unknown): string {
  return clean(value);
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> | { id: string } }) {
  try {
    const resolvedParams = await Promise.resolve(context.params);
    const id = clean(resolvedParams.id);

    if (!id) {
      return NextResponse.json({ ok: false, error: "Provider/client id is required." }, { status: 400 });
    }

    const requestUrl = new URL(request.url);
    const detailUrl = new URL(`/api/admin/clients/${encodeURIComponent(id)}`, requestUrl.origin);

    for (const key of ["status", "transactionType", "dateFrom", "dateTo", "checkNumber", "postingContext"]) {
      const value = requestUrl.searchParams.get(key);
      if (value) detailUrl.searchParams.set(key, value);
    }

    const detailRes = await fetch(detailUrl, { cache: "no-store" });
    const detail = await detailRes.json();

    if (!detailRes.ok || detail?.ok === false) {
      return NextResponse.json(
        { ok: false, error: detail?.error || "Could not build client cost ledger." },
        { status: detailRes.status || 500 }
      );
    }

    const client = detail.client || {};
    const remittanceRows = Array.isArray(detail.remittance?.rows) ? detail.remittance.rows : [];
    const costsExpendedRows = Array.isArray(detail.costsExpended?.rows) ? detail.costsExpended.rows : [];

    const costReceivedRows = remittanceRows.filter((row: any) => isCostRecoveryTransactionType(row?.transactionType));

    const costExpendedSourceIds: string[] = Array.from(
      new Set<string>(costsExpendedRows.map((row: any) => clean(row?.id)).filter(Boolean))
    );
    const receiptIds: number[] = Array.from(
      new Set<number>(
        costReceivedRows
          .map((row: any) => Number(String(row?.id || "").trim()))
          .filter((value: number) => Number.isSafeInteger(value))
      )
    );

    const [costExpendedInvoiceLines, receiptMarks] = await Promise.all([
      costExpendedSourceIds.length
        ? prisma.providerClientInvoiceLine.findMany({
            where: {
              lineType: "cost_expended",
              sourceTable: "Lawsuit.lawsuitOptions",
              sourceId: { in: costExpendedSourceIds },
              invoice: {
                status: { in: ["draft", "finalized", "voided"] },
              },
            },
            select: {
              sourceId: true,
              invoiceId: true,
              invoice: {
                select: {
                  invoiceNumber: true,
                  status: true,
                  finalizedAt: true,
                  voidedAt: true,
                  voidReason: true,
                },
              },
            },
            orderBy: { createdAt: "desc" },
          })
        : Promise.resolve([]),
      receiptIds.length
        ? prisma.matterPaymentReceipt.findMany({
            where: { id: { in: receiptIds } },
            select: {
              id: true,
              invoiceId: true,
              voided: true,
              voidedAt: true,
              voidReason: true,
            },
          })
        : Promise.resolve([]),
    ]);

    const receiptInvoiceIds: string[] = Array.from(
      new Set<string>(receiptMarks.map((row: any) => clean(row.invoiceId)).filter(Boolean))
    );
    const receiptInvoiceById = receiptInvoiceIds.length
      ? new Map(
          (
            await prisma.providerClientInvoice.findMany({
              where: { id: { in: receiptInvoiceIds } },
              select: {
                id: true,
                invoiceNumber: true,
                status: true,
                finalizedAt: true,
                voidedAt: true,
                voidReason: true,
              },
            })
          ).map((invoice: any) => [invoice.id, invoice])
        )
      : new Map();

    const costLineMarksBySource = new Map<string, any[]>();
    for (const line of costExpendedInvoiceLines as any[]) {
      const key = sourceKey("Lawsuit.lawsuitOptions", line.sourceId);
      const bucket = costLineMarksBySource.get(key) || [];
      bucket.push(line);
      costLineMarksBySource.set(key, bucket);
    }

    const receiptMarkById = new Map((receiptMarks as any[]).map((row) => [Number(row.id), row]));

    function invoiceStatusFromMark(mark: any) {
      const invoice = mark?.invoice || mark;
      const status = clean(invoice?.status);
      if (!status) return "not_invoiced";
      return status;
    }

    function eligibleFromInvoice(invoice: any, voided: boolean) {
      const status = clean(invoice?.status);
      if (voided) return false;
      if (!status) return true;
      if (status === "voided") return true;
      if (status === "finalized") return false;
      if (status === "draft") return true;
      return true;
    }

    const costsExpendedLedgerRows = costsExpendedRows.map((row: any) => {
      const sourceId = clean(row?.id);
      const marks = costLineMarksBySource.get(sourceKey("Lawsuit.lawsuitOptions", sourceId)) || [];
      const blockingFinalizedMark = marks.find((line: any) => line?.invoice?.status === "finalized" && !line?.invoice?.voidedAt);
      const latestMark = blockingFinalizedMark || marks[0] || null;
      const invoice = latestMark?.invoice || null;
      const voided = Boolean(row?.voided || row?.isVoided || row?.voidedAt || row?.voided_at);

      return {
        ledgerKind: "cost_expended",
        label: "Cost Expended",
        sourceTable: "Lawsuit.lawsuitOptions",
        sourceId,
        dateIncurred: asDateValue(row?.dateEntered || row?.dateIncurred || row?.createdAt),
        postedDate: asDateValue(row?.postedDate || row?.dateEntered || row?.createdAt),
        costType: costCategory(row?.costType),
        matter: clean(row?.matter),
        lawsuit: clean(row?.lawsuit),
        patient: clean(row?.patient),
        provider: clean(row?.provider || client?.displayName),
        amount: moneyNumber(row?.amount),
        voided,
        voidedAt: row?.voidedAt || row?.voided_at || null,
        voidReason: clean(row?.voidReason || row?.void_reason),
        invoiceId: clean(latestMark?.invoiceId),
        invoiceNumber: clean(invoice?.invoiceNumber),
        invoiceStatus: invoiceStatusFromMark(invoice),
        invoiceFinalizedAt: invoice?.finalizedAt || null,
        invoiceVoidedAt: invoice?.voidedAt || null,
        eligibleForFutureInvoice: eligibleFromInvoice(invoice, voided),
        eligibilityReason: voided
          ? "voided source cost"
          : blockingFinalizedMark
            ? "already included in finalized non-voided invoice"
            : invoice?.status === "draft"
              ? "draft invoice only; not permanently marked"
              : invoice?.status === "voided"
                ? "released by voided invoice"
                : "not yet invoiced",
      };
    });

    const costsReceivedLedgerRows = costReceivedRows.map((row: any) => {
      const receiptId = Number(String(row?.id || "").trim());
      const mark = receiptMarkById.get(receiptId);
      const invoice = mark?.invoiceId ? receiptInvoiceById.get(mark.invoiceId) : null;
      const voided = Boolean(row?.voided || row?.isVoided || row?.voidedAt || row?.voided_at || mark?.voided);

      return {
        ledgerKind: "cost_received",
        label: "Cost Received",
        sourceTable: "MatterPaymentReceipt",
        sourceId: clean(row?.id),
        dateIncurred: "",
        postedDate: asDateValue(row?.transactionDate || row?.createdAt),
        costType: costCategory(row?.transactionType),
        matter: clean(row?.matter),
        lawsuit: clean(row?.lawsuit),
        patient: clean(row?.patient),
        provider: clean(row?.provider || client?.displayName),
        amount: moneyNumber(row?.amount),
        voided,
        voidedAt: row?.voidedAt || row?.voided_at || mark?.voidedAt || null,
        voidReason: clean(row?.voidReason || row?.void_reason || mark?.voidReason),
        invoiceId: clean(mark?.invoiceId),
        invoiceNumber: clean((invoice as any)?.invoiceNumber),
        invoiceStatus: invoiceStatusFromMark(invoice || (mark?.invoiceId ? { status: "marked_unknown_invoice" } : null)),
        invoiceFinalizedAt: (invoice as any)?.finalizedAt || null,
        invoiceVoidedAt: (invoice as any)?.voidedAt || null,
        eligibleForFutureInvoice: eligibleFromInvoice(invoice || (mark?.invoiceId ? { status: "finalized" } : null), voided),
        eligibilityReason: voided
          ? "voided receipt row"
          : mark?.invoiceId && (invoice as any)?.status === "voided"
            ? "released by voided invoice"
            : mark?.invoiceId
              ? "already marked with invoiceId"
              : "not yet invoiced",
      };
    });

    const ledgerRows = [...costsExpendedLedgerRows, ...costsReceivedLedgerRows].sort((a, b) =>
      String(b.postedDate || b.dateIncurred).localeCompare(String(a.postedDate || a.dateIncurred))
    );

    return NextResponse.json({
      ok: true,
      action: "provider-client-invoice-cost-ledger",
      mode: "read-only-cost-ledger",
      safety: "Read-only provider/client invoice cost ledger. It shows cost-expended rows, cost-received rows, invoice status, and eligibility. It does not create, finalize, update, void, remit, print, email, queue, mutate source payment/cost rows, update ClaimIndex, or mutate Clio.",
      filters: {
        status: clean(requestUrl.searchParams.get("status") || "posted"),
        transactionType: clean(requestUrl.searchParams.get("transactionType")),
        dateFrom: clean(requestUrl.searchParams.get("dateFrom")),
        dateTo: clean(requestUrl.searchParams.get("dateTo")),
      },
      totals: {
        rowCount: ledgerRows.length,
        costExpendedRowCount: costsExpendedLedgerRows.length,
        costReceivedRowCount: costsReceivedLedgerRows.length,
        eligibleForFutureInvoiceCount: ledgerRows.filter((row) => row.eligibleForFutureInvoice).length,
        blockedFinalizedInvoiceCount: ledgerRows.filter((row) => row.invoiceStatus === "finalized" && !row.eligibleForFutureInvoice).length,
      },
      rows: ledgerRows,
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Could not load provider/client invoice cost ledger." },
      { status: 500 }
    );
  }
}
