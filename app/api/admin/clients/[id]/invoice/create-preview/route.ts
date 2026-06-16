import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function lower(value: unknown): string {
  return clean(value).toLowerCase();
}

function moneyNumber(value: unknown): number {
  const numeric = Number(String(value ?? "").replace(/[$,\s]/g, ""));
  return Number.isFinite(numeric) ? numeric : 0;
}

function numberFromPercent(value: unknown): number {
  const text = clean(value);
  if (!text) return 0;
  const numeric = Number(text.replace(/%/g, ""));
  if (!Number.isFinite(numeric)) return 0;
  return numeric > 1 ? numeric / 100 : numeric;
}

function showOnRemittance(value: unknown) {
  const status = lower(value);
  return !status.includes("do not show");
}

function isFeeRecoveryTransactionType(value: unknown) {
  const type = String(value ?? "").toLowerCase();
  return (
    type.includes("filing fee") ||
    type.includes("index fee") ||
    type.includes("service fee") ||
    type.includes("court cost") ||
    type.includes("court costs") ||
    type.includes("court fee") ||
    type.includes("court fees") ||
    type.includes("other court cost") ||
    type.includes("other court costs") ||
    type.includes("other court fee") ||
    type.includes("other court fees")
  );
}

function isDirectProviderPaymentTransactionType(value: unknown) {
  const type = String(value ?? "").trim().toLowerCase();
  return (
    type === "prec to provider" ||
    type === "direct pay to provider" ||
    type === "direct pay to provider (pre-suit)"
  );
}

function receiptLineType(row: any): "receipt" | "filing_fee_payment" | "direct_pay_to_provider" {
  if (isFeeRecoveryTransactionType(row?.transactionType)) return "filing_fee_payment";
  if (isDirectProviderPaymentTransactionType(row?.transactionType)) return "direct_pay_to_provider";
  return "receipt";
}

function detailValue(details: Record<string, unknown>, keys: string[]): string {
  const hidden =
    details?._hiddenImportFields &&
    typeof details._hiddenImportFields === "object" &&
    !Array.isArray(details._hiddenImportFields)
      ? (details._hiddenImportFields as Record<string, unknown>)
      : {};

  for (const key of keys) {
    const directValue = details?.[key];
    if (directValue !== null && directValue !== undefined && clean(directValue)) return clean(directValue);

    const hiddenValue = hidden?.[key];
    if (hiddenValue !== null && hiddenValue !== undefined && clean(hiddenValue)) return clean(hiddenValue);
  }

  return "";
}

function retainerFeeForReceipt(row: any, client: any): number {
  if (isFeeRecoveryTransactionType(row?.transactionType)) return 0;

  const details = client?.details || {};
  const type = lower(row?.transactionType);
  const rate = type.includes("interest")
    ? numberFromPercent(detailValue(details, ["retainerNfInterest", "hidden_retainer_interest_percent", "hidden_retainer_nf_interest_percent", "retainer_nf_interest_percent"]))
    : numberFromPercent(detailValue(details, ["retainerNfPrincipal", "hidden_retainer_principal_nf_percent", "retainer_nf_principal_percent"]));

  return moneyNumber(row?.amount) * rate;
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

function invoiceNumberCandidate(providerDisplayName: unknown): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}${m}${d}-${providerInitials(providerDisplayName)}`;
}

function receiptLine(row: any, client: any) {
  const retainerFee = retainerFeeForReceipt(row, client);
  const amount = moneyNumber(row?.amount);

  return {
    lineType: receiptLineType(row),
    sourceTable: "MatterPaymentReceipt",
    sourceId: clean(row?.id),
    sortDate: clean(row?.transactionDate || row?.createdAt),
    matter: clean(row?.matter),
    patient: clean(row?.patient),
    provider: clean(row?.provider),
    dateOfLoss: clean(row?.dateOfLoss),
    dateOfService: clean(row?.dateOfService),
    dateOfServiceEnd: clean(row?.dateOfServiceEnd),
    insurer: clean(row?.insurer),
    lawsuit: clean(row?.lawsuit),
    caseType: clean(row?.caseType),
    description: clean(row?.transactionType),
    checkDate: clean(row?.checkDate),
    checkNumber: clean(row?.checkNumber),
    billedAmount: moneyNumber(row?.billedAmount),
    amount,
    retainerFee,
    rowSnapshot: row,
  };
}

function costLine(row: any) {
  return {
    lineType: "cost_expended",
    sourceTable: "Lawsuit.lawsuitOptions",
    sourceId: clean(row?.id),
    sortDate: clean(row?.dateEntered),
    matter: clean(row?.matter),
    patient: clean(row?.patient),
    provider: clean(row?.provider),
    dateOfLoss: clean(row?.dateOfLoss),
    dateOfService: clean(row?.dateOfService),
    dateOfServiceEnd: clean(row?.dateOfServiceEnd),
    insurer: clean(row?.insurer),
    lawsuit: clean(row?.lawsuit),
    caseType: clean(row?.caseType),
    description: clean(row?.costType),
    checkDate: "",
    checkNumber: "",
    billedAmount: moneyNumber(row?.billedAmount),
    amount: moneyNumber(row?.amount),
    retainerFee: 0,
    rowSnapshot: row,
  };
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> | { id: string } }) {
  try {
    const resolvedParams = await Promise.resolve(context.params);
    const id = clean(resolvedParams.id);

    if (!id) {
      return NextResponse.json({ ok: false, error: "Provider/client id is required." }, { status: 400 });
    }

    const requestUrl = new URL(request.url);
    const includeAlreadyInvoiced = requestUrl.searchParams.get("includeAlreadyInvoiced") === "true";
    const detailUrl = new URL(`/api/admin/clients/${encodeURIComponent(id)}`, requestUrl.origin);

    for (const key of ["status", "transactionType", "dateFrom", "dateTo", "checkNumber", "postingContext"]) {
      const value = requestUrl.searchParams.get(key);
      if (value) detailUrl.searchParams.set(key, value);
    }

    const detailRes = await fetch(detailUrl, { cache: "no-store" });
    const detail = await detailRes.json();

    if (!detailRes.ok || detail?.ok === false) {
      return NextResponse.json(
        { ok: false, error: detail?.error || "Could not build invoice create-preview." },
        { status: detailRes.status || 500 }
      );
    }

    const client = detail.client || {};
    const clientDetails = client.details || {};
    const remittanceRows = Array.isArray(detail.remittance?.rows) ? detail.remittance.rows : [];
    const costsExpendedRows = Array.isArray(detail.costsExpended?.rows) ? detail.costsExpended.rows : [];

    const receiptIds: number[] = Array.from(
      new Set<number>(
        remittanceRows
          .map((row: any) => Number(String(row?.id || "").trim()))
          .filter((value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value))
      )
    );

    const receiptInvoiceMarks = receiptIds.length
      ? await prisma.matterPaymentReceipt.findMany({
          where: { id: { in: receiptIds } },
          select: { id: true, invoiceId: true },
        })
      : [];

    const invoiceIdByReceiptId = new Map(
      receiptInvoiceMarks.map((row: any) => [row.id, clean(row.invoiceId)])
    );

    const showableRemittanceRows = remittanceRows.filter((row: any) => showOnRemittance(row?.transactionStatus));

    const eligibleRemittanceRows = includeAlreadyInvoiced
      ? showableRemittanceRows
      : showableRemittanceRows.filter((row: any) => {
          const receiptId = Number(String(row?.id || "").trim());
          return !invoiceIdByReceiptId.get(receiptId);
        });

    const excludedDoNotShowRows = remittanceRows.filter((row: any) => !showOnRemittance(row?.transactionStatus));

    const excludedAlreadyInvoicedRows = showableRemittanceRows.filter((row: any) => {
      const receiptId = Number(String(row?.id || "").trim());
      return Boolean(invoiceIdByReceiptId.get(receiptId));
    });

    const receiptLines = eligibleRemittanceRows.map((row: any) => receiptLine(row, client));
    const costSourceIds: string[] = Array.from(
      new Set<string>(
        costsExpendedRows
          .map((row: any) => clean(row?.id))
          .filter(Boolean)
      )
    );

    const finalizedCostLineMarks = costSourceIds.length
      ? await prisma.providerClientInvoiceLine.findMany({
          where: {
            lineType: "cost_expended",
            sourceTable: "Lawsuit.lawsuitOptions",
            sourceId: { in: costSourceIds },
            invoice: {
              status: "finalized",
              voidedAt: null,
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
              },
            },
          },
        })
      : [];

    const finalizedCostSourceIdSet = new Set(
      finalizedCostLineMarks
        .map((line: any) => clean(line?.sourceId))
        .filter(Boolean)
    );

    const eligibleCostsExpendedRows = costsExpendedRows.filter((row: any) => !finalizedCostSourceIdSet.has(clean(row?.id)));
    const excludedAlreadyInvoicedCostRows = costsExpendedRows.filter((row: any) => finalizedCostSourceIdSet.has(clean(row?.id)));

    const costLines = eligibleCostsExpendedRows.map((row: any) => costLine(row));
    const lines = [...receiptLines, ...costLines];

    const principalInterestLines = receiptLines.filter((line: any) => line.lineType === "receipt");
    const directProviderPaymentLines = receiptLines.filter((line: any) => line.lineType === "direct_pay_to_provider");
    const filingFeePaymentLines = receiptLines.filter((line: any) => line.lineType === "filing_fee_payment");

    const priorFinalizedInvoice = await prisma.providerClientInvoice.findFirst({
      where: { referenceEntityId: id, status: "finalized" },
      orderBy: [{ finalizedAt: "desc" }, { createdAt: "desc" }],
      select: { costBalanceLedgerAfter: true },
    });

    const principalInterestTotal = principalInterestLines.reduce((sum: number, line: any) => sum + moneyNumber(line.amount), 0);
    const directProviderPaymentTotal = directProviderPaymentLines.reduce((sum: number, line: any) => sum + moneyNumber(line.amount), 0);
    const directProviderRetainerFeeTotal = directProviderPaymentLines.reduce((sum: number, line: any) => sum + moneyNumber(line.retainerFee), 0);
    const filingFeePaymentTotal = filingFeePaymentLines.reduce((sum: number, line: any) => sum + moneyNumber(line.amount), 0);
    const costsExpendedTotal = costLines.reduce((sum: number, line: any) => sum + moneyNumber(line.amount), 0);
    const retainerFeeTotal = receiptLines.reduce((sum: number, line: any) => sum + moneyNumber(line.retainerFee), 0);
    const invoicePackageTotal = lines.reduce((sum: number, line: any) => sum + moneyNumber(line.amount), 0);

    const baseNetRemitToProvider = moneyNumber(principalInterestTotal - retainerFeeTotal);
    const costBalanceThisRemittancePeriod = moneyNumber(filingFeePaymentTotal - costsExpendedTotal);
    const costBalanceLedgerBefore = moneyNumber(Math.max(0, Number(priorFinalizedInvoice?.costBalanceLedgerAfter || 0)));
    const currentPeriodPositiveCostBalance = moneyNumber(Math.max(0, costBalanceThisRemittancePeriod));
    const currentPeriodNegativeCostBalance = moneyNumber(Math.max(0, -costBalanceThisRemittancePeriod));
    const costBalanceDeductionCap = moneyNumber(currentPeriodNegativeCostBalance > 0 ? Math.max(0, baseNetRemitToProvider * 0.25) : 0);
    const costBalanceAppliedToLedger = moneyNumber(Math.min(currentPeriodPositiveCostBalance, costBalanceLedgerBefore));
    const costBalanceReimbursementToProvider = moneyNumber(Math.max(0, currentPeriodPositiveCostBalance - costBalanceAppliedToLedger));
    const totalRecoverableNegativeCostBalance = moneyNumber(currentPeriodNegativeCostBalance + Math.max(0, costBalanceLedgerBefore - costBalanceAppliedToLedger));
    const costBalanceDeductionApplied = moneyNumber(Math.min(totalRecoverableNegativeCostBalance, costBalanceDeductionCap));
    const currentShortfallDeductionApplied = moneyNumber(Math.min(currentPeriodNegativeCostBalance, costBalanceDeductionApplied));
    const priorBalanceDeductionApplied = moneyNumber(Math.max(0, costBalanceDeductionApplied - currentShortfallDeductionApplied));
    const costBalanceAddedToLedger = moneyNumber(Math.max(0, currentPeriodNegativeCostBalance - currentShortfallDeductionApplied));
    const costBalanceLedgerAfter = moneyNumber(Math.max(0, costBalanceLedgerBefore - costBalanceAppliedToLedger - priorBalanceDeductionApplied + costBalanceAddedToLedger));
    const costBalanceLedgerChange = moneyNumber(costBalanceLedgerAfter - costBalanceLedgerBefore);
    const costBalanceAdjustmentToNetRemit = moneyNumber(costBalanceReimbursementToProvider - costBalanceDeductionApplied);
    const netRemitToProviderTotal = moneyNumber(baseNetRemitToProvider + costBalanceAdjustmentToNetRemit);

    const totalsSnapshot = {
      receiptRowCount: eligibleRemittanceRows.length,
      eligibleUnmarkedReceiptRowCount: eligibleRemittanceRows.length,
      excludedAlreadyInvoicedReceiptRowCount: includeAlreadyInvoiced ? 0 : excludedAlreadyInvoicedRows.length,
      includedAlreadyInvoicedReceiptRowCount: includeAlreadyInvoiced ? excludedAlreadyInvoicedRows.length : 0,
      lineCount: lines.length,
      totalLines: lines.length,
      principalInterestTotal,
      directProviderPaymentTotal,
      directProviderRetainerFeeTotal,
      filingFeePaymentTotal,
      costsExpendedTotal,
      retainerFeeTotal,
      invoicePackageTotal,
      baseNetRemitToProvider,
      costBalanceThisRemittancePeriod,
      costBalanceDeductionCap,
      costBalanceAppliedToLedger,
      costBalanceReimbursementToProvider,
      costBalanceDeductionApplied,
      costBalanceAddedToLedger,
      costBalanceAdjustmentToNetRemit,
      costBalanceLedgerBefore,
      costBalanceLedgerChange,
      costBalanceLedgerAfter,
      netRemitToProviderTotal,
      costBalanceFormula: "Cost Balance During This Remittance Period = Costs Received During This Remittance Period minus Costs Expended During This Remittance Period. Negative balances are deducted from Net Remit Before Costs up to the 25% cap and the excess is carried forward in the Cost Balance Ledger. Positive balances have no 25% deduction; they first reduce the Cost Balance Ledger and only the excess is added to Net Remit Before Costs.",
    };

    const clientSnapshot = {
      id: clean(client.id),
      type: clean(client.type),
      displayName: clean(client.displayName),
      normalizedName: clean(client.normalizedName),
      address: clean(clientDetails.address),
      owner: detailValue(clientDetails, ["hidden_owner", "owner", "Owner", "assigned_owner", "account_owner", "client_owner"]),
      providerGroup: detailValue(clientDetails, ["hidden_group_name", "hidden_provider_group_name", "group_name", "provider_group", "Provider Group", "Group Name"]),
      remit: detailValue(clientDetails, ["hidden_remit", "remit", "Remit", "remit_type", "remit_account"]),
      pullCosts: detailValue(clientDetails, ["hidden_pull_costs", "pull_costs", "Pull Costs", "Pull Cost"]),
      retainerNFPrincipal: detailValue(clientDetails, ["hidden_retainer_principal_nf_percent", "retainer_nf_principal_percent"]),
      retainerNFInterest: detailValue(clientDetails, ["hidden_retainer_interest_percent", "hidden_retainer_nf_interest_percent", "retainer_nf_interest_percent"]),
      retainerWCPrincipal: detailValue(clientDetails, ["hidden_retainer_wc_principal_percent", "hidden_retainer_principal_wc_percent", "retainer_wc_principal_percent"]),
      retainerWCInterest: detailValue(clientDetails, ["hidden_retainer_wc_interest_percent", "retainer_wc_interest_percent"]),
      retainerLiensPrincipal: detailValue(clientDetails, ["hidden_retainer_liens_principal_percent", "hidden_retainer_lien_principal_percent", "hidden_retainer_principal_liens_percent", "hidden_retainer_principal_lien_percent", "retainer_liens_principal_percent", "retainer_lien_principal_percent"]),
      retainerLiensInterest: detailValue(clientDetails, ["hidden_retainer_liens_interest_percent", "hidden_retainer_lien_interest_percent", "retainer_liens_interest_percent", "retainer_lien_interest_percent"]),
    };

    const filterSnapshot = {
      status: clean(detail.filters?.status || requestUrl.searchParams.get("status") || "posted"),
      transactionType: clean(detail.filters?.transactionType || requestUrl.searchParams.get("transactionType") || ""),
      checkNumber: clean(detail.filters?.checkNumber || requestUrl.searchParams.get("checkNumber") || ""),
      postingContext: clean(detail.filters?.postingContext || requestUrl.searchParams.get("postingContext") || ""),
      dateFrom: clean(detail.filters?.dateFrom || requestUrl.searchParams.get("dateFrom") || ""),
      dateTo: clean(detail.filters?.dateTo || requestUrl.searchParams.get("dateTo") || ""),
    };

    return NextResponse.json({
      ok: true,
      action: "provider-client-invoice-create-preview",
      mode: includeAlreadyInvoiced ? "read-only-preview-admin-include-already-invoiced" : "read-only-preview",
      safety: "Read-only invoice create preview. Ordinary mode excludes MatterPaymentReceipt rows already assigned to an invoiceId and cost-expended rows already frozen into finalized non-voided invoice lines. Admin include-already-invoiced mode is diagnostic only for MatterPaymentReceipt rows. This route does not create invoices, update MatterPaymentReceipt.invoiceId, write remittances, generate documents, send email, print, queue, update ClaimIndex, mutate Clio, or write any database rows.",
      invoiceDraftPreview: {
        invoiceNumberCandidate: invoiceNumberCandidate(client.displayName),
        status: "draft-preview",
        providerClientInfoId: "",
        referenceEntityId: clean(client.id),
        providerDisplayName: clean(client.displayName),
        filters: filterSnapshot,
        clientSnapshot,
        totalsSnapshot,
        lines,
        receiptMarkDiagnostics: {
          includeAlreadyInvoiced,
          sourceReceiptRowCount: remittanceRows.length,
          eligibleUnmarkedReceiptRowCount: eligibleRemittanceRows.length,
          sourceCostExpendedRowCount: costsExpendedRows.length,
          eligibleUninvoicedCostExpendedRowCount: eligibleCostsExpendedRows.length,
          excludedAlreadyInvoicedCostExpendedRowCount: excludedAlreadyInvoicedCostRows.length,
          finalizedCostExpendedLineMarkCount: finalizedCostLineMarks.length,
          excludedCostExpendedDetails: excludedAlreadyInvoicedCostRows.map((row: any) => {
            const sourceId = clean(row?.id);
            const mark = finalizedCostLineMarks.find((line: any) => clean(line?.sourceId) === sourceId);
            return {
              id: sourceId,
              invoiceId: clean(mark?.invoiceId),
              invoiceNumber: clean(mark?.invoice?.invoiceNumber),
              status: clean(mark?.invoice?.status),
              finalizedAt: mark?.invoice?.finalizedAt || null,
              matter: clean(row?.matter),
              lawsuit: clean(row?.lawsuit),
              patient: clean(row?.patient),
              costType: clean(row?.costType),
              amount: moneyNumber(row?.amount),
            };
          }),
          excludedDoNotShowReceiptRowCount: excludedDoNotShowRows.length,
          excludedAlreadyInvoicedReceiptRowCount: includeAlreadyInvoiced ? 0 : excludedAlreadyInvoicedRows.length,
          includedAlreadyInvoicedReceiptRowCount: includeAlreadyInvoiced ? excludedAlreadyInvoicedRows.length : 0,
          alreadyInvoicedReceiptDetails: excludedAlreadyInvoicedRows.map((row: any) => {
            const receiptId = Number(String(row?.id || "").trim());
            return {
              id: receiptId,
              invoiceId: invoiceIdByReceiptId.get(receiptId) || "",
              matter: clean(row?.matter),
              patient: clean(row?.patient),
              transactionType: clean(row?.transactionType),
              amount: moneyNumber(row?.amount),
            };
          }),
        },
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Could not build invoice create-preview." },
      { status: 500 }
    );
  }
}
