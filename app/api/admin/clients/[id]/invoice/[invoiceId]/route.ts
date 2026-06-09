import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string; invoiceId: string }> | { id: string; invoiceId: string } }
) {
  try {
    const resolvedParams = await Promise.resolve(context.params);
    const clientId = clean(resolvedParams.id);
    const invoiceId = clean(resolvedParams.invoiceId);

    if (!clientId) {
      return NextResponse.json({ ok: false, error: "Provider/client id is required." }, { status: 400 });
    }

    if (!invoiceId) {
      return NextResponse.json({ ok: false, error: "Invoice id is required." }, { status: 400 });
    }

    const invoice = await prisma.providerClientInvoice.findUnique({
      where: { id: invoiceId },
      include: {
        lines: {
          orderBy: [
            { sortDate: "asc" },
            { createdAt: "asc" },
          ],
        },
      },
    });

    if (!invoice) {
      return NextResponse.json({ ok: false, error: "Invoice was not found." }, { status: 404 });
    }

    const belongsToClient =
      invoice.referenceEntityId === clientId ||
      invoice.providerClientInfoId === clientId ||
      clean((invoice.clientSnapshot as any)?.id) === clientId;

    if (!belongsToClient) {
      return NextResponse.json(
        { ok: false, error: "Invoice does not belong to this provider/client." },
        { status: 404 }
      );
    }

    const receiptLineSourceIds = Array.from(
      new Set(
        invoice.lines
          .filter((line) => line.sourceTable === "MatterPaymentReceipt")
          .map((line) => Number(String(line.sourceId || "").trim()))
          .filter((value) => Number.isSafeInteger(value))
      )
    );

    const receiptRows = receiptLineSourceIds.length
      ? await prisma.matterPaymentReceipt.findMany({
          where: { id: { in: receiptLineSourceIds } },
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

    const receiptRowIdsFound = new Set(receiptRows.map((row) => row.id));
    const receiptLineSourceIdsMissing = receiptLineSourceIds.filter((id) => !receiptRowIdsFound.has(id));
    const receiptRowsMarkedWithThisInvoiceId = receiptRows.filter((row) => row.invoiceId === invoiceId);
    const receiptRowsMarkedWithAnotherInvoiceId = receiptRows.filter((row) => row.invoiceId && row.invoiceId !== invoiceId);
    const receiptRowsUnmarked = receiptRows.filter((row) => !clean(row.invoiceId));

    const auditEvents = await prisma.providerClientInvoiceAudit.findMany({
      where: { invoiceId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json({
      ok: true,
      action: "provider-client-invoice-detail",
      mode: "read-only",
      safety: "Read-only invoice detail. This route does not create, finalize, update, void, remit, print, email, queue, mutate source payment rows, update ClaimIndex, or mutate Clio.",
      invoice,
      auditEvents,
      verification: {
        lineCount: invoice.lines.length,
        receiptLineSourceIds,
        receiptRowsFound: receiptRows.length,
        receiptLineSourceIdsMissing,
        receiptRowsMarkedWithThisInvoiceId: receiptRowsMarkedWithThisInvoiceId.length,
        receiptRowsMarkedWithAnotherInvoiceId: receiptRowsMarkedWithAnotherInvoiceId.length,
        receiptRowsUnmarked: receiptRowsUnmarked.length,
        receiptMarkDetails: receiptRows.map((row) => ({
          id: row.id,
          invoiceId: row.invoiceId,
          displayNumber: row.displayNumber,
          transactionType: row.transactionType,
          paymentAmount: row.paymentAmount,
          transactionDate: row.transactionDate,
          markStatus: row.invoiceId === invoiceId ? "this_invoice" : row.invoiceId ? "another_invoice" : "unmarked",
        })),
        isDraft: invoice.status === "draft",
        isFinalized: Boolean(invoice.finalizedAt) && invoice.status === "finalized",
        isVoided: invoice.status === "voided",
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Could not load invoice detail." },
      { status: 500 }
    );
  }
}
