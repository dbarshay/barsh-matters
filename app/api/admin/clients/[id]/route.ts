import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createMatterAuditLogEntry } from "@/lib/auditLog";

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function lower(value: unknown): string {
  return clean(value).toLowerCase();
}

function compactProviderName(value: unknown): string {
  const stopWords = new Set(["and", "the", "pc", "p", "c", "pllc", "llc", "md", "m", "d", "dc", "do"]);
  return clean(value)
    .replace(/&/g, " and ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .map((part) => part.trim())
    .filter((part) => part && !stopWords.has(part))
    .join("");
}

function providerSearchTerms(values: unknown[]): string[] {
  const stopWords = new Set(["and", "the", "pc", "p", "c", "pllc", "llc", "md", "m", "d", "dc", "do"]);
  const terms = new Set<string>();

  for (const value of values) {
    const cleaned = clean(value);
    if (!cleaned) continue;

    for (const part of cleaned.replace(/&/g, " and ").replace(/[^a-zA-Z0-9]+/g, " ").split(/\s+/)) {
      const term = part.trim();
      if (term.length < 3) continue;
      if (stopWords.has(term.toLowerCase())) continue;
      terms.add(term);
      terms.add(term.toUpperCase());
      terms.add(term.toLowerCase());
    }
  }

  return Array.from(terms);
}

function claimMatchesProviderCandidate(row: any, candidates: string[]): boolean {
  const rowValues = [row.provider_name, row.client_name, row.treating_provider]
    .map(compactProviderName)
    .filter(Boolean);

  const candidateValues = candidates.map(compactProviderName).filter(Boolean);

  return rowValues.some((rowValue) =>
    candidateValues.some((candidateValue) => rowValue === candidateValue || rowValue.includes(candidateValue) || candidateValue.includes(rowValue))
  );
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

function providerClientInfoDetails(info: any, fallbackDetails: Record<string, unknown>): Record<string, unknown> {
  if (!info) return fallbackDetails;

  const existingHidden = fallbackDetails._hiddenImportFields;
  const hidden =
    existingHidden && typeof existingHidden === "object" && !Array.isArray(existingHidden)
      ? { ...(existingHidden as Record<string, unknown>) }
      : {};

  const hiddenPairs: Array<[string, unknown]> = [
    ["hidden_owner", info.owner],
    ["hidden_group_name", info.providerGroup],
    ["hidden_retainer_principal_nf_percent", info.retainerNFPrincipal],
    ["hidden_retainer_interest_percent", info.retainerNFInterest],
    ["hidden_retainer_wc_principal_percent", info.retainerWCPrincipal],
    ["hidden_retainer_wc_interest_percent", info.retainerWCInterest],
    ["hidden_retainer_liens_principal_percent", info.retainerLiensPrincipal],
    ["hidden_retainer_liens_interest_percent", info.retainerLiensInterest],
    ["hidden_pull_costs", info.pullCosts],
    ["hidden_remit", info.remit],
  ];

  for (const [key, value] of hiddenPairs) {
    const cleaned = clean(value);
    if (cleaned) hidden[key] = cleaned;
  }

  return {
    ...fallbackDetails,
    address: clean(info.address) || fallbackDetails.address,
    notes: clean(info.notes) || fallbackDetails.notes,
    _hiddenImportFields: hidden,
  };
}

function providerClientInfoDataFromDetails(referenceEntityId: string, displayName: unknown, details: Record<string, unknown>) {
  const hidden =
    details._hiddenImportFields && typeof details._hiddenImportFields === "object" && !Array.isArray(details._hiddenImportFields)
      ? (details._hiddenImportFields as Record<string, unknown>)
      : {};

  return {
    referenceEntityId,
    displayNameSnapshot: clean(displayName) || null,
    address: clean(details.address) || null,
    owner: clean(hidden.hidden_owner) || null,
    providerGroup: clean(hidden.hidden_group_name) || null,
    retainerNFPrincipal: clean(hidden.hidden_retainer_principal_nf_percent) || null,
    retainerNFInterest: clean(hidden.hidden_retainer_interest_percent) || null,
    retainerWCPrincipal: clean(hidden.hidden_retainer_wc_principal_percent) || null,
    retainerWCInterest: clean(hidden.hidden_retainer_wc_interest_percent) || null,
    retainerLiensPrincipal: clean(hidden.hidden_retainer_liens_principal_percent) || null,
    retainerLiensInterest: clean(hidden.hidden_retainer_liens_interest_percent) || null,
    pullCosts: clean(hidden.hidden_pull_costs) || null,
    remit: clean(hidden.hidden_remit) || null,
    notes: clean(details.notes) || null,
    source: "admin-client-info",
  };
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

function isoDateOnly(value: unknown): string {
  const text = clean(value);
  if (!text) return "";

  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

  const dotMatch = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (dotMatch) {
    const month = dotMatch[1].padStart(2, "0");
    const day = dotMatch[2].padStart(2, "0");
    return `${dotMatch[3]}-${month}-${day}`;
  }

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);

  return "";
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
  return moneyNumber(row.balance_amount ?? row.balanceAmount ?? row.balance_presuit ?? row.balancePresuit ?? row.balance ?? row.current_balance ?? row.currentBalance);
}

function claimNumber(row: any): string {
  return clean(row.claim_number_raw || row.claimNumberRaw || row.claim_number_normalized || row.claimNumberNormalized || row.claim_number || row.claimNumber);
}

function claimDateOfLoss(row: any): string {
  return formatDateValue(row.date_of_loss || row.dateOfLoss || row.dol);
}

function claimDateOfService(row: any): string {
  return formatDateValue(row.date_of_service || row.dateOfService || row.dos_start || row.dosStart || row.dos);
}

function claimDateOfServiceEnd(row: any): string {
  return formatDateValue(row.dos_end || row.dosEnd || row.date_of_service_end || row.dateOfServiceEnd);
}

function plainObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function optionValue(options: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = clean(options[key]);
    if (value) return value;
  }
  return "";
}

function optionAmount(options: Record<string, unknown>, keys: string[]): number {
  for (const key of keys) {
    const amount = moneyNumber(options[key]);
    if (amount) return amount;
  }
  return 0;
}

function parseCostEntryHistory(value: unknown): { amount: number; date: string }[] {
  const text = clean(value);
  if (!text) return [];

  try {
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((row) => ({
        amount: moneyNumber(row?.amount),
        date: formatDateValue(row?.date),
      }))
      .filter((row) => row.amount && row.date);
  } catch {
    return [];
  }
}

function costEntryHistoryFromOptions(options: Record<string, unknown>, field: "filingFee" | "serviceFee" | "otherCourtCosts"): { amount: number; date: string }[] {
  if (field === "filingFee") return parseCostEntryHistory(options.filingFeeEntryHistory);
  if (field === "serviceFee") return parseCostEntryHistory(options.serviceFeeEntryHistory);
  return parseCostEntryHistory(options.otherCourtCostsEntryHistory);
}

function costEntryDateFromOptions(options: Record<string, unknown>, field: "filingFee" | "serviceFee" | "otherCourtCosts"): string {
  if (field === "filingFee") {
    return formatDateValue(optionValue(options, ["filingFeeEntryDate", "filing_fee_entry_date", "indexFeeEntryDate", "index_fee_entry_date"]));
  }
  if (field === "serviceFee") {
    return formatDateValue(optionValue(options, ["serviceFeeEntryDate", "service_fee_entry_date"]));
  }
  return formatDateValue(optionValue(options, ["otherCourtCostsEntryDate", "other_court_costs_entry_date", "otherCourtFeesEntryDate", "other_court_fees_entry_date"]));
}

function costEntryDateInSelectedPeriod(entryDate: string, dateFrom: string, dateTo: string): boolean {
  const rowDate = isoDateOnly(entryDate);
  if (!rowDate) return false;
  if (dateFrom && rowDate < dateFrom) return false;
  if (dateTo && rowDate > dateTo) return false;
  return true;
}

function splitMetadataList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(clean).filter(Boolean);

  const text = clean(value);
  if (!text) return [];

  return text
    .split(/[,\\n;|]+/g)
    .map((part) => clean(part))
    .filter(Boolean);
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
    const numeric = Number(key);
    if (Number.isInteger(numeric) && Number.isSafeInteger(numeric)) {
      OR.push({ matterId: numeric });
    }

    OR.push({ displayNumber: key });
  }

  return OR.length ? { OR } : {};
}

function setDetailValue(details: Record<string, unknown>, key: string, value: unknown) {
  const text = clean(value);
  if (text) {
    details[key] = text;
  } else {
    delete details[key];
  }
}

function ensureHiddenImportFields(details: Record<string, unknown>): Record<string, unknown> {
  const existing = details._hiddenImportFields;
  if (existing && typeof existing === "object" && !Array.isArray(existing)) {
    return existing as Record<string, unknown>;
  }

  const hidden: Record<string, unknown> = {};
  details._hiddenImportFields = hidden;
  return hidden;
}

function setHiddenDetailValue(details: Record<string, unknown>, key: string, value: unknown) {
  const hidden = ensureHiddenImportFields(details);
  const text = clean(value);
  if (text) {
    hidden[key] = text;
  } else {
    delete hidden[key];
  }

  if (!Object.keys(hidden).length) {
    delete details._hiddenImportFields;
  }
}

function timestampedClientNote(value: unknown) {
  const text = clean(value);
  if (!text) return "";

  const timestamp = new Date().toLocaleString("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  return `[${timestamp}] ${text}`;
}

function appendClientNote(details: Record<string, unknown>, value: unknown) {
  const stamped = timestampedClientNote(value);
  if (!stamped) return;

  const existing = clean(details.notes);
  details.notes = existing ? `${existing}\n\n${stamped}` : stamped;
}

function clientEditFieldNames(body: any): string[] {
  const fields: string[] = [];

  if ("address" in body) fields.push("Address");
  if ("owner" in body) fields.push("Owner");
  if ("providerGroup" in body) fields.push("Provider Group");
  if ("retainerNFPrincipal" in body) fields.push("Retainer NF Principal");
  if ("retainerNFInterest" in body) fields.push("Retainer NF Interest");
  if ("retainerWCPrincipal" in body) fields.push("Retainer WC Principal");
  if ("retainerWCInterest" in body) fields.push("Retainer WC Interest");
  if ("retainerLiensPrincipal" in body) fields.push("Retainer Liens Principal");
  if ("retainerLiensInterest" in body) fields.push("Retainer Liens Interest");
  if ("pullCosts" in body) fields.push("Pull Costs");
  if ("remit" in body) fields.push("Remit");
  if ("notes" in body) fields.push("Notes");
  if ("appendNote" in body) fields.push("Notes");

  return fields;
}

function clientAuditAction(body: any): string {
  return "appendNote" in body ? "admin-client-note-add" : "admin-client-detail-update";
}

function jsonSafeValue(value: unknown) {
  return JSON.parse(JSON.stringify(value ?? null));
}

function editableClientDetails(details: Record<string, unknown>, body: any) {
  const next = { ...details };
  const existingHidden = details._hiddenImportFields;
  if (existingHidden && typeof existingHidden === "object" && !Array.isArray(existingHidden)) {
    next._hiddenImportFields = { ...(existingHidden as Record<string, unknown>) };
  }

  if ("address" in body) setDetailValue(next, "address", body.address);
  if ("notes" in body) setDetailValue(next, "notes", body.notes);
  if ("appendNote" in body) appendClientNote(next, body.appendNote);

  if ("owner" in body) setHiddenDetailValue(next, "hidden_owner", body.owner);
  if ("providerGroup" in body) setHiddenDetailValue(next, "hidden_group_name", body.providerGroup);
  if ("retainerNFPrincipal" in body) setHiddenDetailValue(next, "hidden_retainer_principal_nf_percent", body.retainerNFPrincipal);
  if ("retainerNFInterest" in body) setHiddenDetailValue(next, "hidden_retainer_interest_percent", body.retainerNFInterest);
  if ("retainerWCPrincipal" in body) setHiddenDetailValue(next, "hidden_retainer_wc_principal_percent", body.retainerWCPrincipal);
  if ("retainerWCInterest" in body) setHiddenDetailValue(next, "hidden_retainer_wc_interest_percent", body.retainerWCInterest);
  if ("retainerLiensPrincipal" in body) setHiddenDetailValue(next, "hidden_retainer_liens_principal_percent", body.retainerLiensPrincipal);
  if ("retainerLiensInterest" in body) setHiddenDetailValue(next, "hidden_retainer_liens_interest_percent", body.retainerLiensInterest);
  if ("pullCosts" in body) setHiddenDetailValue(next, "hidden_pull_costs", body.pullCosts);
  if ("remit" in body) setHiddenDetailValue(next, "hidden_remit", body.remit);

  return next;
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> | { id: string } }) {
  try {
    const params = await context.params;
    const id = clean(params.id);
    const body = await req.json();

    const entity = await (prisma as any).referenceEntity.findUnique({
      where: { id },
      select: {
        id: true,
        type: true,
        displayName: true,
        normalizedName: true,
        details: true,
      },
    });

    if (!entity || clean(entity.type) !== "provider_client") {
      return json(
        {
          ok: false,
          action: "admin-client-detail-update",
          error: "Client/provider reference record was not found.",
        },
        { status: 404 }
      );
    }

    const currentInfo = await (prisma as any).providerClientInfo.findUnique({
      where: { referenceEntityId: id },
    });
    const currentDetails = providerClientInfoDetails(currentInfo, detailObject(entity));
    const nextDetails = editableClientDetails(currentDetails, body);
    const changedFields = clientEditFieldNames(body);
    const auditAction = clientAuditAction(body);

    const updatedInfo = await (prisma as any).providerClientInfo.upsert({
      where: { referenceEntityId: id },
      create: providerClientInfoDataFromDetails(id, entity.displayName, nextDetails),
      update: providerClientInfoDataFromDetails(id, entity.displayName, nextDetails),
    });

    const updated = await (prisma as any).referenceEntity.findUnique({
      where: { id },
      include: {
        aliases: { orderBy: { alias: "asc" } },
      },
    });

    const updatedDetails = providerClientInfoDetails(updatedInfo, detailObject(updated));

    await createMatterAuditLogEntry({
      action: auditAction,
      summary:
        auditAction === "admin-client-note-add"
          ? `Added client note for ${clean(updated.displayName) || id}`
          : `Updated client info for ${clean(updated.displayName) || id}`,
      entityType: "provider_client",
      fieldName: changedFields.length === 1 ? changedFields[0] : "Client Details",
      priorValue: jsonSafeValue(currentDetails),
      newValue: jsonSafeValue(updatedDetails),
      details: jsonSafeValue({
        clientId: id,
        displayName: clean(updated?.displayName),
        normalizedName: clean(updated?.normalizedName),
        changedFields,
        appendedNote: "appendNote" in body ? clean(body.appendNote) : null,
        localOnly: true,
        noClioRecordsChanged: true,
        noClaimIndexRecordsChanged: true,
        noPaymentRecordsChanged: true,
      }),
      sourcePage: "/admin/clients/[id]",
      workflow: "admin-client-info",
      actorName: clean(body?.actorName) || "Barsh Matters User",
      actorEmail: clean(body?.actorEmail) || null,
    });

    return json({
      ok: true,
      action: "admin-client-detail-update",
      sourceOfTruth: "Local Barsh Matters ProviderClientInfo source-of-truth table linked to ReferenceEntity",
      safety: {
        localOnly: true,
        noClioRecordsChanged: true,
        noClaimIndexRecordsChanged: true,
        noPaymentRecordsChanged: true,
        noDocumentsGenerated: true,
        noPrintQueueRecordsChanged: true,
      },
      client: {
        id: clean(updated.id),
        displayName: clean(updated?.displayName),
        normalizedName: clean(updated?.normalizedName),
        isActive: updated?.active !== false,
        details: updatedDetails,
        updatedAt: updated?.updatedAt ?? null,
      },
    });
  } catch (error: any) {
    return json(
      {
        ok: false,
        action: "admin-client-detail-update",
        error: error?.message || "Admin Client detail update failed.",
      },
      { status: 500 }
    );
  }
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

    const providerClientInfo = await (prisma as any).providerClientInfo.findUnique({
      where: { referenceEntityId: id },
    });
    const details = providerClientInfoDetails(providerClientInfo, detailObject(entity));
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
    for (const term of providerSearchTerms(nameCandidates)) {
      claimOr.push({ provider_name: { contains: term } });
      claimOr.push({ client_name: { contains: term } });
      claimOr.push({ treating_provider: { contains: term } });
    }

    const rawClaimRows = claimOr.length
      ? await (prisma as any).claimIndex.findMany({
          where: { OR: claimOr },
          orderBy: [{ display_number: "asc" }],
          take: 2000,
        })
      : [];

    const claimRows = rawClaimRows.filter((row: any) => claimMatchesProviderCandidate(row, nameCandidates));

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
            row.masterLawsuitId,
            row.master_lawsuit_id,
            row.masterDisplayNumber,
            row.master_display_number,
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
        claim.masterLawsuitId,
        claim.master_lawsuit_id,
        claim.masterDisplayNumber,
        claim.master_display_number,
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
          dateOfLoss: claimDateOfLoss(claim),
          dateOfService: claimDateOfService(claim),
          dateOfServiceEnd: claimDateOfServiceEnd(claim),
          insurer: claimInsurer(claim),
          lawsuit: clean(claim.master_lawsuit_id || claim.masterLawsuitId || receipt.masterLawsuitId || receipt.master_lawsuit_id),
          caseType: "NF",
          transactionDate: receiptTransactionDate(receipt),
          transactionType: receiptType(receipt),
          transactionStatus: receiptStatus(receipt),
          postingContext: receiptPostingContext(receipt),
          amount: receiptAmount(receipt),
          billedAmount: claimBillAmount(claim),
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
        const rowDate = isoDateOnly(row.transactionDate);
        if (dateFrom && rowDate && rowDate < dateFrom) return false;
        if (dateTo && rowDate && rowDate > dateTo) return false;
        return true;
      });

    const matterKeySet = new Set(matterKeys.map((key: string) => clean(key)).filter(Boolean));
    const expendedCostRows: any[] = [];

    try {
      const lawsuitRows = await (prisma as any).lawsuit.findMany({ take: 2000 });

      for (const lawsuit of lawsuitRows) {
        const options = plainObject(lawsuit.lawsuitOptions || lawsuit.lawsuit_options || lawsuit.options);
        const possibleKeys = [
          lawsuit.id,
          lawsuit.matterId,
          lawsuit.matter_id,
          lawsuit.masterMatterId,
          lawsuit.master_matter_id,
          lawsuit.displayNumber,
          lawsuit.display_number,
          lawsuit.masterDisplayNumber,
          lawsuit.master_display_number,
          lawsuit.masterLawsuitId,
          lawsuit.master_lawsuit_id,
          options.matterId,
          options.matter_id,
          options.masterMatterId,
          options.master_matter_id,
          options.masterLawsuitId,
          options.master_lawsuit_id,
          options.indexAaaNumber,
          options.index_aaa_number,
          options.indexNumber,
          options.index_number,
          options.masterIndexNumber,
          options.master_index_number,
          options.displayNumber,
          options.display_number,
          options.masterDisplayNumber,
          options.master_display_number,
          ...(Array.isArray(options.matterIds) ? options.matterIds : []),
          ...(Array.isArray(options.matter_ids) ? options.matter_ids : []),
          ...(Array.isArray(options.childMatterIds) ? options.childMatterIds : []),
          ...(Array.isArray(options.childDisplayNumbers) ? options.childDisplayNumbers : []),
          ...splitMetadataList(options.lawsuitMatterDisplayNumbers),
          ...splitMetadataList(options.lawsuit_matter_display_numbers),
          ...splitMetadataList(options.childMatterDisplayNumbers),
          ...splitMetadataList(options.child_matter_display_numbers),
          ...splitMetadataList(options.lawsuitMatterIds),
          ...splitMetadataList(options.lawsuit_matter_ids),
          ...splitMetadataList(options.indexAaaNumberClioMatterIds),
          ...splitMetadataList(options.index_aaa_number_clio_matter_ids),
          ...splitMetadataList(options.lawsuitMatterDisplayNumbersWrittenToClio),
          ...splitMetadataList(options.lawsuit_matter_display_numbers_written_to_clio),
          ...splitMetadataList(options.lawsuitMatterDisplayNumbersMissingFieldMatterIds),
          ...splitMetadataList(options.lawsuit_matter_display_numbers_missing_field_matter_ids),
        ].map(clean).filter(Boolean);

        const matchedKey = possibleKeys.find((key) => matterKeySet.has(key));
        if (!matchedKey) continue;

        const claim = claimByKey.get(matchedKey) || {};

        const costCandidates = [
          {
            metadataField: "filingFee" as const,
            costType: "Index Fee",
            amount: optionAmount(options, ["filingFeeEntryAmount", "filing_fee_entry_amount", "indexFeeEntryAmount", "index_fee_entry_amount", "indexFee", "index_fee", "filingFee", "filing_fee"]),
          },
          {
            metadataField: "serviceFee" as const,
            costType: "Service Fee",
            amount: optionAmount(options, ["serviceFeeEntryAmount", "service_fee_entry_amount", "serviceFee", "service_fee"]),
          },
          {
            metadataField: "otherCourtCosts" as const,
            costType: "Other Court Costs",
            amount: optionAmount(options, ["otherCourtCostsEntryAmount", "other_court_costs_entry_amount", "otherCourtCosts", "other_court_costs", "otherCourtFees", "other_court_fees"]),
          },
        ];

        for (const candidate of costCandidates) {
          const historyRows = costEntryHistoryFromOptions(options, candidate.metadataField);

          if (historyRows.length) {
            for (const historyRow of historyRows) {
              if (!costEntryDateInSelectedPeriod(historyRow.date, dateFrom, dateTo)) continue;

              expendedCostRows.push({
                id: `${clean(lawsuit.id) || matchedKey}-${candidate.metadataField}-${historyRow.date}-${historyRow.amount}`,
                matter: claimDisplay(claim) || matchedKey,
                patient: claimPatient(claim),
                provider: claimProvider(claim),
                dateOfLoss: claimDateOfLoss(claim),
                dateOfService: claimDateOfService(claim),
                dateOfServiceEnd: claimDateOfServiceEnd(claim),
                insurer: claimInsurer(claim),
                caseType: "NF",
                costType: candidate.costType,
                dateEntered: historyRow.date,
                amount: historyRow.amount,
                source: "Lawsuit.lawsuitOptions cost entry history",
              });
            }
            continue;
          }

          const entryDate = costEntryDateFromOptions(options, candidate.metadataField);
          if (!candidate.amount) continue;
          if (!costEntryDateInSelectedPeriod(entryDate, dateFrom, dateTo)) continue;

          expendedCostRows.push({
            id: `${clean(lawsuit.id) || matchedKey}-${candidate.metadataField}`,
            matter: claimDisplay(claim) || matchedKey,
            patient: claimPatient(claim),
            provider: claimProvider(claim),
            dateOfLoss: claimDateOfLoss(claim),
            dateOfService: claimDateOfService(claim),
            dateOfServiceEnd: claimDateOfServiceEnd(claim),
            insurer: claimInsurer(claim),
            caseType: "NF",
            costType: candidate.costType,
            dateEntered: entryDate,
            amount: candidate.amount,
            source: "Lawsuit.lawsuitOptions cost entry date",
          });
        }
      }
    } catch {
      // If lawsuit cost metadata is unavailable, payment reporting still loads.
    }

    const matterRows = claimRows.map((claim: any) => ({
      id: clean(claim.id),
      matter: claimDisplay(claim),
      patient: claimPatient(claim),
      provider: claimProvider(claim),
      insurer: claimInsurer(claim),
      lawsuit: clean(claim.master_lawsuit_id || claim.masterLawsuitId),
      claimNumber: claimNumber(claim),
      billNumber: clean(claim.bill_number || claim.billNumber),
      dateOfService: claimDateOfService(claim),
      dateOfServiceEnd: claimDateOfServiceEnd(claim),
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
        "Local Barsh Matters ProviderClientInfo source-of-truth table, ReferenceEntity/ReferenceAlias identity records, ClaimIndex child matters, MatterPaymentReceipt child-ledger rows, and Lawsuit.lawsuitOptions cost metadata with per-cost entry dates.",
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
      costsExpended: {
        count: expendedCostRows.length,
        total: expendedCostRows.reduce((sum: number, row: any) => sum + Number(row.amount || 0), 0),
        rows: expendedCostRows,
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
