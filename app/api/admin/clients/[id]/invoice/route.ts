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

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = await Promise.resolve(context.params);
    const clientId = clean(resolvedParams.id);

    if (!clientId) {
      return NextResponse.json({ ok: false, error: "Provider/client id is required." }, { status: 400 });
    }

    const invoices = await prisma.providerClientInvoice.findMany({
      where: {
        OR: [
          { referenceEntityId: clientId },
          { providerClientInfoId: clientId },
        ],
      },
      include: { _count: { select: { lines: true } } },
      orderBy: [
        { createdAt: "desc" },
        { invoiceNumber: "desc" },
      ],
    });

    return NextResponse.json({
      ok: true,
      action: "provider-client-invoice-history",
      mode: "read-only-history",
      safety: "Read-only provider/client invoice history. This route does not create, finalize, void, remit, print, email, queue, mutate source payment rows, update ClaimIndex, or mutate Clio.",
      invoices: invoices.map((invoice: any) => ({
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        providerDisplayName: invoice.providerDisplayName,
        status: invoice.status,
        createdAt: invoice.createdAt,
        updatedAt: invoice.updatedAt,
        finalizedAt: invoice.finalizedAt,
        voidedAt: invoice.voidedAt || null,
        voidReason: invoice.voidReason || "",
        dateFrom: invoice.dateFrom,
        dateTo: invoice.dateTo,
        statusFilter: invoice.statusFilter,
        transactionTypeFilter: invoice.transactionTypeFilter,
        receiptRowCount: invoice.receiptRowCount,
        principalInterestTotal: moneyNumber(invoice.principalInterestTotal),
        filingFeePaymentTotal: moneyNumber(invoice.filingFeePaymentTotal),
        costsExpendedTotal: moneyNumber(invoice.costsExpendedTotal),
        retainerFeeTotal: moneyNumber(invoice.retainerFeeTotal),
        invoicePackageTotal: moneyNumber(invoice.invoicePackageTotal),
        lineCount: invoice._count?.lines || 0,
      })),
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Could not load invoice history." },
      { status: 500 }
    );
  }
}
