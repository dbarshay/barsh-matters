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

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const q = clean(url.searchParams.get("q"));
    const status = clean(url.searchParams.get("status"));
    const dateFrom = clean(url.searchParams.get("dateFrom"));
    const dateTo = clean(url.searchParams.get("dateTo"));

    const and: any[] = [];

    if (status) and.push({ status });

    const createdAt: any = {};
    if (dateFrom) createdAt.gte = new Date(dateFrom + "T00:00:00");
    if (dateTo) createdAt.lte = new Date(dateTo + "T23:59:59");
    if (dateFrom || dateTo) and.push({ createdAt });

    if (q) {
      and.push({
        OR: [
          { invoiceNumber: { contains: q } },
          { providerDisplayName: { contains: q } },
          { referenceEntityId: { contains: q } },
          { providerClientInfoId: { contains: q } },
          {
            lines: {
              some: {
                OR: [
                  { matter: { contains: q } },
                  { patient: { contains: q } },
                  { provider: { contains: q } },
                  { insurer: { contains: q } },
                  { lawsuit: { contains: q } },
                  { sourceId: { contains: q } },
                  { description: { contains: q } },
                ],
              },
            },
          },
        ],
      });
    }

    const invoices = await prisma.providerClientInvoice.findMany({
      where: and.length ? { AND: and } : {},
      include: { _count: { select: { lines: true } } },
      orderBy: [
        { createdAt: "desc" },
        { invoiceNumber: "desc" },
      ],
      take: 250,
    });

    return NextResponse.json({
      ok: true,
      action: "provider-client-invoice-global-search",
      mode: "read-only-search",
      safety: "Read-only global invoice search/reporting. This route does not create, finalize, void, remit, print, email, queue, mutate source payment rows, update ClaimIndex, or mutate Clio.",
      filters: { q, status, dateFrom, dateTo },
      invoices: invoices.map((invoice: any) => ({
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        providerDisplayName: invoice.providerDisplayName,
        providerClientInfoId: invoice.providerClientInfoId,
        referenceEntityId: invoice.referenceEntityId,
        status: invoice.status,
        createdAt: invoice.createdAt,
        finalizedAt: invoice.finalizedAt,
        voidedAt: invoice.voidedAt || null,
        receiptRowCount: invoice.receiptRowCount,
        lineCount: invoice._count?.lines || 0,
        invoicePackageTotal: moneyNumber(invoice.invoicePackageTotal),
      })),
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Could not search invoices." },
      { status: 500 }
    );
  }
}
