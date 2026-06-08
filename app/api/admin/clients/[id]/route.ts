import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function lower(value: unknown): string {
  return clean(value).toLowerCase();
}

function json(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

function detailObject(entity: any): Record<string, unknown> {
  const details = entity?.details;
  if (details && typeof details === "object" && !Array.isArray(details)) {
    return details as Record<string, unknown>;
  }
  return {};
}

function aliasTexts(entity: any): string[] {
  const aliases = Array.isArray(entity?.aliases) ? entity.aliases : [];
  return aliases
    .map((alias: any) => clean(alias?.alias || alias?.displayName || alias?.name || alias?.value))
    .filter(Boolean);
}

function primaryName(entity: any): string {
  const details = detailObject(entity);
  return clean(
    entity?.displayName ||
      entity?.name ||
      entity?.referenceName ||
      details.provider_name ||
      details.client_name ||
      details.reference_name
  );
}

function moneyNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(String(value ?? "").replace(/[$,]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDateValue(value: unknown): string {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString();
  return clean(value);
}

function claimDisplay(row: any): string {
  return clean(row.display_number || row.displayNumber || row.matter_display_number || row.matterDisplayNumber || row.matterId || row.id);
}

function claimProvider(row: any): string {
  return clean(row.provider_name || row.client_name || row.treating_provider || row.providerName || row.clientName);
}

function claimPatient(row: any): string {
  return clean(row.patient_name || row.patientName || row.patient || row.client_patient_name);
}

function claimInsurer(row: any): string {
  return clean(row.insurer_name || row.insurerName || row.insurer);
}

function claimBillAmount(row: any): number {
  return moneyNumber(row.claim_amount ?? row.claimAmount ?? row.bill_amount ?? row.billAmount);
}

function claimBalance(row: any): number {
  return moneyNumber(row.balance ?? row.current_balance ?? row.currentBalance);
}

function receiptMatterKey(row: any): string {
  return clean(row.matterId || row.matter_id || row.claimIndexMatterId || row.claimIndexId || row.clioMatterId || row.displayNumber || row.display_number);
}

function receiptAmount(row: any): number {
  return moneyNumber(row.amount ?? row.paymentAmount ?? row.payment_amount);
}

function receiptType(row: any): string {
  return clean(row.transactionType || row.transaction_type || row.type);
}

function receiptStatus(row: any): string {
  return clean(row.transactionStatus || row.transaction_status || row.status);
}

function receiptPostingContext(row: any): string {
  return clean(row.postingContext || row.posting_context);
}

function receiptCheckNumber(row: any): string {
  return clean(row.checkNumber || row.check_number);
}

function receiptCheckDate(row: any): string {
  return formatDateValue(row.checkDate || row.check_date);
}

function receiptTransactionDate(row: any): string {
  return formatDateValue(row.transactionDate || row.transaction_date || row.createdAt || row.created_at);
}

function isVoided(row: any): boolean {
  const status = lower(receiptStatus(row));
  return Boolean(row.voidedAt || row.voided_at || row.isVoided || row.is_voided || status.includes("void"));
}

function buildReceiptWhere(keys: string[]) {
  const unique = Array.from(new Set(keys.map(clean).filter(Boolean)));
  const OR: any[] = [];
  for (const key of unique) {
    OR.push({ matterId: key });
    OR.push({ matter_id: key });
    OR.push({ claimIndexId: key });
    OR.push({ claimIndexMatterId: key });
    OR.push({ displayNumber: key });
    OR.push({ display_number: key });
  }
  return OR.length ? { OR } : {};
}

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> | { id: string } }) {
  try {
    const params = await context.params;
    const id = clean(params.id);
    const url = req.nextUrl;
    const statusFilter = lower(url.searchParams.get("status") || "posted");
    const transactionTypeFilter = lower(url.searchParams.get("transactionType"));
    const checkNumberFilter = lower(url.searchParams.get("checkNumber"));
    const postingContextFilter = lower(url.searchParams.get("postingContext"));
    const dateFrom = clean(url.searchParams.get("dateFrom"));
    const dateTo = clean(url.searchParams.get("dateTo"));

    const entity = await (prisma as any).referenceEntity.findUnique({
      where: { id },
      include: {
        aliases: {
          orderBy: { alias: "asc" },
        },
      },
    });

    if (!entity || clean(entity.type) !== "provider_client") {
      return json(
        {
          action: "admin-client-detail",
          error: "Client/provider reference record was not found.",
        },
        { status: 404 }
      );
    }

    const details = detailObject(entity);
    const displayName = primaryName(entity);
    const aliases = aliasTexts(entity);
    const nameCandidates: string[] = Array.from(
      new Set(
        [displayName, entity.normalizedName, entity.normalizedDisplayName, ...aliases]
          .map(clean)
          .filter((value): value is string => Boolean(value))
      )
    );

    const claimOr: any[] = [];
    for (const name of nameCandidates) {
      claimOr.push({ provider_name: { contains: name } });
      claimOr.push({ client_name: { contains: name } });
      claimOr.push({ treating_provider: { contains: name } });
    }

    const claimRows = claimOr.length
      ? await (prisma as any).claimIndex.findMany({
          where: { OR: claimOr },
          orderBy: [{ display_number: "asc" }],
          take: 1000,
        })
      : [];

    const matterKeys: string[] = Array.from(
      new Set<string>(
        claimRows
          .flatMap((row: any) => [
            row.matterId,
            row.matter_id,
            row.clioMatterId,
            row.clio_matter_id,
            row.displayNumber,
            row.display_number,
            row.id,
          ])
          .map((value: unknown) => clean(value))
          .filter((value: string): value is string => Boolean(value))
      )
    );

    let receiptRows: any[] = [];
    let receiptError = "";
    try {
      if (matterKeys.length) {
        receiptRows = await (prisma as any).matterPaymentReceipt.findMany({
          where: buildReceiptWhere(matterKeys),
          orderBy: [{ createdAt: "desc" }],
          take: 2000,
        });
      }
    } catch (error: any) {
      receiptError = error?.message || "Could not load MatterPaymentReceipt rows for this client.";
    }

    const claimByKey = new Map<string, any>();
    for (const claim of claimRows) {
      for (const key of [
        claim.matterId,
        claim.matter_id,
        claim.clioMatterId,
        claim.clio_matter_id,
        claim.displayNumber,
        claim.display_number,
        claim.id,
      ]) {
        const cleaned = clean(key);
        if (cleaned) claimByKey.set(cleaned, claim);
      }
    }

    const receiptReportRows = receiptRows
      .map((receipt: any) => {
        const claim = claimByKey.get(receiptMatterKey(receipt)) || {};
        return {
          id: clean(receipt.id),
          matter: claimDisplay(claim) || receiptMatterKey(receipt),
          patient: claimPatient(claim),
          provider: claimProvider(claim),
          insurer: claimInsurer(claim),
          lawsuit: clean(claim.master_lawsuit_id || claim.masterLawsuitId || receipt.masterLawsuitId || receipt.master_lawsuit_id),
          transactionDate: receiptTransactionDate(receipt),
          transactionType: receiptType(receipt),
          transactionStatus: receiptStatus(receipt),
          postingContext: receiptPostingContext(receipt),
          amount: receiptAmount(receipt),
          checkDate: receiptCheckDate(receipt),
          checkNumber: receiptCheckNumber(receipt),
          isVoided: isVoided(receipt),
          voidReason: clean(receipt.voidReason || receipt.void_reason),
          createdAt: formatDateValue(receipt.createdAt || receipt.created_at),
        };
      })
      .filter((row: any) => {
        if (statusFilter === "posted" && row.isVoided) return false;
        if (statusFilter === "voided" && !row.isVoided) return false;
        if (transactionTypeFilter && !lower(row.transactionType).includes(transactionTypeFilter)) return false;
        if (checkNumberFilter && !lower(row.checkNumber).includes(checkNumberFilter)) return false;
        if (postingContextFilter && !lower(row.postingContext).includes(postingContextFilter)) return false;
        const rowDate = row.transactionDate.slice(0, 10);
        if (dateFrom && rowDate && rowDate < dateFrom) return false;
        if (dateTo && rowDate && rowDate > dateTo) return false;
        return true;
      });

    const matterRows = claimRows.map((claim: any) => ({
      id: clean(claim.id),
      matter: claimDisplay(claim),
      patient: claimPatient(claim),
      provider: claimProvider(claim),
      insurer: claimInsurer(claim),
      lawsuit: clean(claim.master_lawsuit_id || claim.masterLawsuitId),
      claimNumber: clean(claim.claim_number || claim.claimNumber),
      billNumber: clean(claim.bill_number || claim.billNumber),
      dateOfService: formatDateValue(claim.date_of_service || claim.dateOfService || claim.dos),
      billAmount: claimBillAmount(claim),
      balance: claimBalance(claim),
      finalStatus: clean(claim.final_status || claim.finalStatus || claim.status),
    }));

    const totalsByType = new Map<string, number>();
    let activeTotal = 0;
    let voidedTotal = 0;
    for (const row of receiptReportRows) {
      if (row.isVoided) {
        voidedTotal += row.amount;
      } else {
        activeTotal += row.amount;
        const key = row.transactionType || "Unspecified";
        totalsByType.set(key, (totalsByType.get(key) || 0) + row.amount);
      }
    }

    return json({
      action: "admin-client-detail",
      sourceOfTruth:
        "Local Barsh Matters ReferenceEntity/ReferenceAlias provider_client records, ClaimIndex child matters, and MatterPaymentReceipt child-ledger rows.",
      safety:
        "Read-only Admin Client detail/remittance preview. This route reads local tables only. It does not call Clio, write payments, edit ClaimIndex, generate documents, send email, print, queue, or export files.",
      client: {
        id: clean(entity.id),
        type: clean(entity.type),
        displayName,
        normalizedName: clean(entity.normalizedName || entity.normalizedDisplayName || entity.normalized_name),
        isActive: entity.active !== false,
        source: clean(entity.source || entity.importSource || details.source),
        aliases,
        details,
        createdAt: entity.createdAt ?? null,
        updatedAt: entity.updatedAt ?? null,
      },
      filters: {
        status: statusFilter,
        transactionType: transactionTypeFilter,
        checkNumber: checkNumberFilter,
        postingContext: postingContextFilter,
        dateFrom,
        dateTo,
      },
      matters: {
        count: matterRows.length,
        rows: matterRows,
      },
      remittance: {
        receiptError,
        count: receiptReportRows.length,
        activeTotal,
        voidedTotal,
        totalsByType: Array.from(totalsByType.entries()).map(([transactionType, amount]) => ({
          transactionType,
          amount,
        })),
        rows: receiptReportRows,
      },
    });
  } catch (error: any) {
    return json(
      {
        action: "admin-client-detail",
        error: error?.message || "Admin Client detail failed.",
      },
      { status: 500 }
    );
  }
}
