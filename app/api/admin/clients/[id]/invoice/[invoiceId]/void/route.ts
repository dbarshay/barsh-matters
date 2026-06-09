import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function intId(value: unknown): number | null {
  const text = clean(value);
  if (!/^\d+$/.test(text)) return null;
  const numeric = Number(text);
  return Number.isSafeInteger(numeric) ? numeric : null;
}

export async function POST(
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

    const body = await request.json().catch(() => ({}));

    if (body?.confirmVoidInvoice !== true) {
      return NextResponse.json(
        { ok: false, error: "confirmVoidInvoice must be true to void this invoice." },
        { status: 400 }
      );
    }

    const voidReason = clean(body?.voidReason);
    if (!voidReason) {
      return NextResponse.json({ ok: false, error: "Void reason is required." }, { status: 400 });
    }

    const invoice = await prisma.providerClientInvoice.findUnique({
      where: { id: invoiceId },
      include: { lines: true },
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

    if (invoice.status !== "finalized") {
      return NextResponse.json(
        { ok: false, error: `Only finalized invoices can be voided. Current status: ${invoice.status}` },
        { status: 409 }
      );
    }

    const receiptIds = Array.from(
      new Set(
        invoice.lines
          .filter((line) => line.sourceTable === "MatterPaymentReceipt")
          .map((line) => intId(line.sourceId))
          .filter((value): value is number => value !== null)
      )
    );

    const voidedAt = new Date();

    const result = await prisma.$transaction(async (tx) => {
      const receiptClear = receiptIds.length
        ? await tx.matterPaymentReceipt.updateMany({
            where: {
              id: { in: receiptIds },
              invoiceId,
            },
            data: { invoiceId: null },
          })
        : { count: 0 };

      const updatedInvoice = await tx.providerClientInvoice.update({
        where: { id: invoice.id },
        data: {
          status: "voided",
          voidedAt,
          voidReason,
          auditSnapshot: {
            voidedAt: voidedAt.toISOString(),
            voidReason,
            receiptLineSourceIds: receiptIds,
            receiptRowsClearedOnVoid: receiptClear.count,
            noClioRecordsChanged: true,
            noClaimIndexRecordsChanged: true,
            noRemittanceRecordsChanged: true,
          },
        },
        include: { lines: true },
      });

      await tx.providerClientInvoiceAudit.create({
        data: {
          invoiceId: invoice.id,
          providerClientInfoId: invoice.providerClientInfoId,
          referenceEntityId: invoice.referenceEntityId,
          providerDisplayName: invoice.providerDisplayName,
          eventType: "invoice.voided",
          eventSummary: "Finalized invoice voided and receipt rows marked with this invoice ID were released.",
          details: {
            voidReason,
            receiptLineSourceIds: receiptIds,
            receiptRowsClearedOnVoid: receiptClear.count,
            noClioRecordsChanged: true,
            noClaimIndexRecordsChanged: true,
            noRemittanceRecordsChanged: true,
          },
        },
      });

      return {
        invoice: updatedInvoice,
        receiptLineSourceIds: receiptIds,
        receiptRowsClearedOnVoid: receiptClear.count,
      };
    });

    return NextResponse.json({
      ok: true,
      action: "provider-client-invoice-void",
      mode: "local-voided",
      safety: "Voided a local finalized invoice only. This route clears MatterPaymentReceipt.invoiceId only for included receipt rows currently marked with this exact invoice id. It does not mutate Clio, ClaimIndex, source costs, documents, email, print, queue, or remittance records.",
      invoice: result.invoice,
      verification: {
        lineCount: result.invoice.lines.length,
        receiptLineSourceIds: result.receiptLineSourceIds,
        receiptRowsClearedOnVoid: result.receiptRowsClearedOnVoid,
        isVoided: result.invoice.status === "voided",
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Could not void invoice." },
      { status: 500 }
    );
  }
}
