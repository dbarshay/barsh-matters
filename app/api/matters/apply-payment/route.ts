import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createMatterAuditLogEntry } from "@/lib/auditLog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function num(value: any): number {
  const cleaned = String(value ?? "").replace(/[$,\s]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function cleanText(value: any): string {
  return String(value ?? "").trim();
}

function isCostRecoveryTransactionType(value: unknown): boolean {
  const normalized = cleanText(value).toLowerCase();
  if (normalized === "interest" || normalized === "interest payment" || normalized.includes("interest collected")) return true;
  return [
    "filing fee collected",
    "index fee collected",
    "service fee collected",
    "other court costs collected",
    "other court fees collected",
  ].includes(normalized);
}

function money(value: any): string {
  return `$${num(value).toFixed(2)}`;
}

function cleanDate(value: any): string {
  const raw = String(value || "").trim();

  if (/^\d{2}\.\d{2}\.\d{4}$/.test(raw)) {
    return raw;
  }

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
    const [mm, dd, yyyy] = raw.split("/");
    return `${mm}.${dd}.${yyyy}`;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [yyyy, mm, dd] = raw.split("-");
    return `${mm}.${dd}.${yyyy}`;
  }

  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}.${dd}.${yyyy}`;
}

function cleanOptionalDate(value: any): string {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return cleanDate(raw);
}

function isLawsuitAllocationContext(value: any): boolean {
  return cleanText(value).toLowerCase() === "lawsuit-allocation";
}

async function matterHasLawsuitAggregation(matterId: number, expectedDisplayNumber?: string): Promise<{
  aggregated: boolean;
  masterLawsuitId: string;
}> {
  const numericMatterId = Number(matterId);
  const displayNumber = cleanText(expectedDisplayNumber);

  if (!Number.isFinite(numericMatterId) || numericMatterId <= 0) {
    return { aggregated: false, masterLawsuitId: "" };
  }

  const claimRows = await prisma.claimIndex.findMany({
    where: {
      OR: [
        { matter_id: numericMatterId },
        ...(displayNumber ? [{ display_number: displayNumber }] : []),
      ],
    },
    select: {
      master_lawsuit_id: true,
    },
    take: 5,
  });

  const masterLawsuitId = cleanText(
    claimRows.find((row) => cleanText(row.master_lawsuit_id))?.master_lawsuit_id
  );

  return {
    aggregated: !!masterLawsuitId,
    masterLawsuitId,
  };
}

function paymentReceiptView(row: any) {
  const safetySnapshot = row?.safetySnapshot || {};
  const posting = safetySnapshot?.posting || {};

  const transactionType = cleanText(row?.transactionType || posting.transactionType);
  const transactionStatus = cleanText(row?.transactionStatus || posting.transactionStatus);
  const transactionDate = cleanText(row?.transactionDate || posting.transactionDate || row?.paymentDate);
  const checkNumber = cleanText(row?.checkNumber || posting.checkNumber);
  const checkDate = cleanText(row?.checkDate || posting.checkDate);
  const invoiceId = cleanText(row?.invoiceId || posting.invoiceId);
  const description = cleanText(row?.description || posting.description || transactionType);
  const transactionFee = row?.transactionFee ?? posting.transactionFee ?? null;
  const postedBy = cleanText(row?.postedBy || posting.postedBy || safetySnapshot.sourceOfPaymentIntent || "Barsh Matters UI");
  const posted = typeof row?.posted === "boolean" ? row.posted : !!row?.createdAt;
  const voided = typeof row?.voided === "boolean" ? row.voided : false;

  return {
    ...row,
    transactionType,
    transactionStatus,
    transactionDate,
    checkNumber,
    checkDate,
    invoiceId,
    description,
    transactionFee,
    postedBy,
    posted,
    voided,
    voidedAt: row?.voidedAt || null,
    voidedBy: cleanText(row?.voidedBy),
    voidReason: cleanText(row?.voidReason),
    reversalSnapshot: row?.reversalSnapshot || null,
    editedAt: row?.editedAt || null,
    editedBy: cleanText(row?.editedBy),
    editReason: cleanText(row?.editReason),
    editSnapshot: row?.editSnapshot || null,
  };
}

function activePaymentTotal(rows: any[]): number {
  return rows
    .filter((row) => !row?.voided && row?.posted !== false)
    .reduce((sum, row) => sum + num(row?.paymentAmount), 0);
}

function afterSnapshot(params: {
  claimAmount: number;
  paymentVoluntary: number;
}) {
  const claimAmount = num(params.claimAmount);
  const paymentVoluntary = num(params.paymentVoluntary);
  const balancePresuit = Math.max(claimAmount - paymentVoluntary, 0);

  return {
    claimAmount,
    paymentVoluntary,
    balancePresuit,
    paymentSource: "Barsh Matters local payment records",
    balanceSource: claimAmount > 0
      ? "claim amount minus Barsh Matters local payments"
      : "Barsh Matters local payments only; claim amount unavailable",
  };
}

async function paymentTotalsForMatter(matterId: number, claimAmount: number) {
  const rows = await prisma.matterPaymentReceipt.findMany({
    where: { matterId },
    orderBy: [
      { paymentDate: "desc" },
      { createdAt: "desc" },
    ],
  });

  const localPaymentTotal = activePaymentTotal(rows);

  return {
    rows,
    localPaymentTotal,
    after: afterSnapshot({
      claimAmount,
      paymentVoluntary: localPaymentTotal,
    }),
  };
}

async function mirrorLocalPaymentTotalsToClaimIndex(params: {
  matterId: number;
  claimAmount: number;
}) {
  const matterId = Number(params.matterId);
  const claimAmount = num(params.claimAmount);

  if (!Number.isFinite(matterId) || matterId <= 0) {
    return {
      attempted: false,
      updatedCount: 0,
      reason: "invalid-matter-id",
    };
  }

  const totals = await paymentTotalsForMatter(matterId, claimAmount);

  const result = await prisma.claimIndex.updateMany({
    where: { matter_id: matterId },
    data: {
      payment_amount: totals.after.paymentVoluntary,
      payment_voluntary: totals.after.paymentVoluntary,
      balance_amount: totals.after.balancePresuit,
      balance_presuit: totals.after.balancePresuit,
    },
  });

  return {
    attempted: true,
    updatedCount: result.count,
    paymentVoluntary: totals.after.paymentVoluntary,
    balancePresuit: totals.after.balancePresuit,
    sourceOfTruth: "Barsh Matters local payment records",
  };
}

function receiptIdentityGuard(params: {
  receipt: any;
  expectedMatterId?: number;
  expectedDisplayNumber?: string;
  actionLabel: string;
}) {
  const expectedMatterId = Number(params.expectedMatterId || 0);
  const expectedDisplayNumber = cleanText(params.expectedDisplayNumber);
  const actualDisplayNumber = cleanText(params.receipt?.displayNumber);

  if (
    Number.isFinite(expectedMatterId) &&
    expectedMatterId > 0 &&
    Number(params.receipt?.matterId) !== expectedMatterId
  ) {
    return {
      ok: false,
      status: 409,
      body: {
        ok: false,
        error: `Receipt matterId mismatch.  Refusing payment ${params.actionLabel}.`,
        expectedMatterId,
        actualMatterId: params.receipt?.matterId,
      },
    };
  }

  if (
    expectedDisplayNumber &&
    actualDisplayNumber &&
    actualDisplayNumber !== expectedDisplayNumber
  ) {
    return {
      ok: false,
      status: 409,
      body: {
        ok: false,
        error: `Receipt display number mismatch.  Refusing payment ${params.actionLabel}.`,
        expectedDisplayNumber,
        actualDisplayNumber,
      },
    };
  }

  return { ok: true };
}

async function writePaymentAudit(input: {
  action: string;
  summary: string;
  receipt: any;
  priorValue?: any;
  newValue?: any;
  details?: any;
}) {
  await createMatterAuditLogEntry({
    action: input.action,
    summary: input.summary,
    entityType: "MatterPaymentReceipt",
    fieldName: "payment",
    priorValue: input.priorValue ?? null,
    newValue: input.newValue ?? null,
    details: input.details ?? null,
    affectedMatterIds: [Number(input.receipt?.matterId)].filter(Boolean),
    matterId: input.receipt?.matterId,
    matterDisplayNumber: cleanText(input.receipt?.displayNumber),
    sourcePage: "individual-matter",
    workflow: "payment-posting",
    actorName: "Barsh Matters UI",
  });
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const matterId = Number(url.searchParams.get("matterId") || "");
    const claimAmount = num(url.searchParams.get("claimAmount"));

    if (!Number.isFinite(matterId) || matterId <= 0) {
      return NextResponse.json(
        { ok: false, error: "Valid matterId is required." },
        { status: 400 }
      );
    }

    const totals = await paymentTotalsForMatter(matterId, claimAmount);
    const rows = totals.rows.slice(0, 25);

    return NextResponse.json({
      ok: true,
      matterId,
      count: rows.length,
      rows: rows.map(paymentReceiptView),
      after: totals.after,
      totals: {
        localPaymentTotal: totals.localPaymentTotal,
        activeReceiptCount: totals.rows.filter((row) => !row?.voided && row?.posted !== false).length,
        sourceOfTruth: "Barsh Matters local payment records",
      },
      safety: {
        localOnly: true,
        clioWriteConfirmed: false,
        clioWriteAttempted: false,
        claimIndexRefreshAttempted: false,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || String(error),
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const matterId = Number(body?.matterId || "");
    const expectedDisplayNumber = cleanText(body?.expectedDisplayNumber);
    const postingContext = cleanText(body?.postingContext || "direct-matter");
    const isLawsuitAllocation = isLawsuitAllocationContext(postingContext);
    const rawPaymentDate = cleanText(body?.paymentDate);
    const rawTransactionType = cleanText(body?.transactionType);
    const rawTransactionStatus = cleanText(body?.transactionStatus);
    const rawCheckDate = cleanText(body?.checkDate);
    const rawCheckNumber = cleanText(body?.checkNumber);
    const paymentAmount = num(body?.paymentAmount);
    const paymentDate = cleanDate(rawPaymentDate);
    const transactionType = rawTransactionType;
    const transactionStatus = rawTransactionStatus;
    const checkDate = cleanOptionalDate(rawCheckDate);
    const checkNumber = rawCheckNumber;
    const invoiceId = cleanText(body?.invoiceId);
    const description = cleanText(body?.description) || transactionType;
    const transactionFee =
      body?.transactionFee === undefined || body?.transactionFee === null || String(body?.transactionFee).trim() === ""
        ? null
        : num(body?.transactionFee);
    const claimAmount = num(body?.claimAmount);

    if (!Number.isFinite(matterId) || matterId <= 0) {
      return NextResponse.json(
        { ok: false, error: "Valid matterId is required." },
        { status: 400 }
      );
    }

    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      return NextResponse.json(
        { ok: false, error: "Payment amount must be greater than $0.00." },
        { status: 400 }
      );
    }

    if (!rawTransactionType) {
      return NextResponse.json(
        { ok: false, error: "Transaction Type is required." },
        { status: 400 }
      );
    }

    if (!rawTransactionStatus) {
      return NextResponse.json(
        { ok: false, error: "Transaction Status is required." },
        { status: 400 }
      );
    }

    if (!rawPaymentDate) {
      return NextResponse.json(
        { ok: false, error: "Transaction Date is required." },
        { status: 400 }
      );
    }

    if (!rawCheckDate) {
      return NextResponse.json(
        { ok: false, error: "Check Date is required." },
        { status: 400 }
      );
    }

    if (!rawCheckNumber) {
      return NextResponse.json(
        { ok: false, error: "Check Number is required." },
        { status: 400 }
      );
    }

    const lawsuitAggregation = await matterHasLawsuitAggregation(matterId, expectedDisplayNumber);

    if (lawsuitAggregation.aggregated && !isLawsuitAllocation) {
      return NextResponse.json(
        {
          ok: false,
          error: "Payments must be posted in Lawsuit Screen",
          masterLawsuitId: lawsuitAggregation.masterLawsuitId,
        },
        { status: 409 }
      );
    }

    const beforeTotals = await paymentTotalsForMatter(matterId, claimAmount);
    const before = beforeTotals.after;
    const after = afterSnapshot({
      claimAmount,
      paymentVoluntary: beforeTotals.localPaymentTotal + paymentAmount,
    });

    const isCostRecoveryPayment = isCostRecoveryTransactionType(transactionType);

    if (!isCostRecoveryPayment && claimAmount > 0 && paymentAmount > before.balancePresuit + 0.005) {
      return Response.json(
        {
          ok: false,
          error: "Payment amount exceeds the current Balance.",
          balancePresuit: before.balancePresuit,
          paymentAmount,
        },
        { status: 400 }
      );
    }

    const receipt = await prisma.matterPaymentReceipt.create({
      data: {
        matterId,
        displayNumber: expectedDisplayNumber || "",
        paymentDate,
        paymentAmount,
        transactionType,
        transactionStatus,
        transactionDate: paymentDate,
        checkDate,
        checkNumber,
        invoiceId,
        description,
        transactionFee,
        postedBy: "Barsh Matters UI",
        posted: true,
        claimAmountBefore: before.claimAmount,
        paymentVoluntaryBefore: before.paymentVoluntary,
        balancePresuitBefore: before.balancePresuit,
        paymentVoluntaryAfter: after.paymentVoluntary,
        balancePresuitAfter: after.balancePresuit,
        clioReadback: Prisma.JsonNull,
        safetySnapshot: {
          action: "post-payment",
          postingContext,
          sourceOfPaymentIntent: isLawsuitAllocation ? "Barsh Matters Lawsuit Screen" : "Barsh Matters UI",
          systemOfRecordAfterPosting: "Barsh Matters local DB",
          clioWriteConfirmed: false,
          clioWriteAttempted: false,
          claimIndexRefreshAttempted: false,
          receiptRecordedLocally: true,
          posting: {
            transactionType,
            transactionStatus,
            transactionDate: paymentDate,
            checkDate,
            checkNumber,
            invoiceId,
            description,
            transactionFee,
            postedBy: "Barsh Matters UI",
            posted: true,
          },
        },
      },
    });

    const claimIndexMirror = await mirrorLocalPaymentTotalsToClaimIndex({ matterId, claimAmount });

    await writePaymentAudit({
      action: "payment.add",
      summary: `Added local payment receipt #${receipt.id} for ${money(paymentAmount)}.`,
      receipt,
      priorValue: before,
      newValue: after,
      details: {
        receiptId: receipt.id,
        paymentAmount,
        paymentDate,
        transactionType,
        transactionStatus,
        checkNumber,
        checkDate,
        localOnly: true,
        clioWriteAttempted: false,
      },
    });

    return NextResponse.json({
      ok: true,
      action: "post-payment",
      postingContext,
      matterId: String(matterId),
      displayNumber: expectedDisplayNumber || "",
      paymentDate,
      paymentApplied: paymentAmount,
      before,
      after,
      receipt: paymentReceiptView(receipt),
      clioWriteConfirmed: false,
      clioReadback: Prisma.JsonNull,
      refreshedIndex: {
        ok: true,
        skipped: true,
        reason: "local-first-payment-posting-no-clio-refresh",
      },
      claimIndexMirror,
      safety: {
        sourceOfPaymentIntent: "Barsh Matters UI",
        systemOfRecordAfterPosting: "Barsh Matters local DB",
        clioWriteConfirmed: false,
        clioWriteAttempted: false,
        claimIndexRefreshAttempted: false,
        receiptRecordedLocally: true,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || String(error),
      },
      { status: 500 }
    );
  }
}

export async function PATCH() {
  return NextResponse.json(
    {
      ok: false,
      error: "Posted payments cannot be edited. Void the payment and post a corrected payment.",
      safety: {
        hardDelete: false,
        editDisabled: true,
        correctionWorkflow: "void-and-repost",
      },
    },
    { status: 405 }
  );
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json();

    const receiptId = Number(body?.receiptId || body?.id || "");
    const expectedMatterId = Number(body?.matterId || "");
    const expectedDisplayNumber = cleanText(body?.expectedDisplayNumber);
    const voidReason = cleanText(body?.voidReason || "Voided from Barsh Matters UI");
    const voidedBy = cleanText(body?.voidedBy || "Barsh Matters UI");
    const claimAmount = num(body?.claimAmount);

    if (!Number.isFinite(receiptId) || receiptId <= 0) {
      return NextResponse.json(
        { ok: false, error: "Valid receiptId is required." },
        { status: 400 }
      );
    }

    const receipt = await prisma.matterPaymentReceipt.findUnique({
      where: { id: receiptId },
    });

    if (!receipt) {
      return NextResponse.json(
        { ok: false, error: "Payment receipt not found." },
        { status: 404 }
      );
    }

    if (receipt.voided) {
      return NextResponse.json(
        {
          ok: false,
          error: "Payment receipt is already voided.",
          receipt: paymentReceiptView(receipt),
        },
        { status: 409 }
      );
    }

    const guard = receiptIdentityGuard({
      receipt,
      expectedMatterId,
      expectedDisplayNumber,
      actionLabel: "void",
    });

    if (!guard.ok) {
      return NextResponse.json(guard.body, { status: guard.status });
    }

    const matterId = Number(receipt.matterId);
    const paymentAmount = num(receipt.paymentAmount);

    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "Receipt has no valid payment amount to void.",
          receipt: paymentReceiptView(receipt),
        },
        { status: 400 }
      );
    }

    const beforeTotals = await paymentTotalsForMatter(matterId, claimAmount);
    const before = beforeTotals.after;
    const after = afterSnapshot({
      claimAmount,
      paymentVoluntary: Math.max(beforeTotals.localPaymentTotal - paymentAmount, 0),
    });

    const voidedAt = new Date();

    const voidedReceipt = await prisma.matterPaymentReceipt.update({
      where: { id: receipt.id },
      data: {
        voided: true,
        voidedAt,
        voidedBy,
        voidReason,
        paymentVoluntaryAfter: after.paymentVoluntary,
        balancePresuitAfter: after.balancePresuit,
        clioReadback: Prisma.JsonNull,
        reversalSnapshot: {
          action: "void-payment",
          sourceOfVoidIntent: "Barsh Matters UI",
          systemOfRecordAfterVoid: "Barsh Matters local DB",
          clioWriteConfirmed: false,
          clioWriteAttempted: false,
          claimIndexRefreshAttempted: false,
          receiptId: receipt.id,
          matterId: receipt.matterId,
          displayNumber: receipt.displayNumber || "",
          paymentAmount,
          before,
          after,
          voidReason,
          voidedBy,
          voidedAt: voidedAt.toISOString(),
        },
      },
    });

    const claimIndexMirror = await mirrorLocalPaymentTotalsToClaimIndex({ matterId, claimAmount });

    await writePaymentAudit({
      action: "payment.void",
      summary: `Voided local payment receipt #${voidedReceipt.id} for ${money(paymentAmount)}.`,
      receipt: voidedReceipt,
      priorValue: {
        receipt: paymentReceiptView(receipt),
        totals: before,
      },
      newValue: {
        receipt: paymentReceiptView(voidedReceipt),
        totals: after,
      },
      details: {
        receiptId: voidedReceipt.id,
        paymentAmount,
        voidReason,
        voidedBy,
        localOnly: true,
        hardDelete: false,
        clioWriteAttempted: false,
      },
    });

    return NextResponse.json({
      ok: true,
      action: "void-payment",
      matterId: String(matterId),
      displayNumber: voidedReceipt.displayNumber || "",
      receiptId: receipt.id,
      paymentVoided: paymentAmount,
      before,
      after,
      receipt: paymentReceiptView(voidedReceipt),
      clioWriteConfirmed: false,
      clioReadback: Prisma.JsonNull,
      refreshedIndex: {
        ok: true,
        skipped: true,
        reason: "local-first-payment-void-no-clio-refresh",
      },
      claimIndexMirror,
      safety: {
        sourceOfVoidIntent: "Barsh Matters UI",
        systemOfRecordAfterVoid: "Barsh Matters local DB",
        clioWriteConfirmed: false,
        clioWriteAttempted: false,
        claimIndexRefreshAttempted: false,
        receiptVoidedLocally: true,
        hardDelete: false,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || String(error),
      },
      { status: 500 }
    );
  }
}
