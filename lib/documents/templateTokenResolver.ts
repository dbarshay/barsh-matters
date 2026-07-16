import { prisma } from "@/lib/prisma";
import { getMatter } from "@/lib/claimIndex";
import { normalizeProviderName } from "@/lib/providerNameCase";
import { formatDate } from "@/lib/documents/templateTokenFormat";

// Server-side resolution of canonical template merge-field tokens.
//
// Returns a base-field -> { raw, type } map. The fill engine
// (app/api/documents/templates/generate-preview/route.ts) scans the docx for
// {{base|modifier}} tokens, looks up the base value here, and applies modifiers.
//
// Data layers (see docs/agent-orientation.md "Template token data model"):
//   1. Individual claim/matter (BRL_) via the claims index (getMatter).
//   2. Lawsuit (YYYY.MM.NNNNNN) via prisma.lawsuit (+ lawsuitOptions JSON).
//   3. Reference tables (ReferenceEntity.details) for insurer/provider/adversary/court.
//   4. Signer profile (resolved upstream and passed in).

export type TokenValueType = "text" | "date" | "currency";
export type TokenBaseValue = { raw: string | number | null; type: TokenValueType };

export type ResolvedTokenSigner = {
  email?: string | null;
  faxNumber?: string | null;
  phoneExtension?: string | null;
  displayName?: string | null;
  signatureBlockName?: string | null;
};

export type TemplateTokenContext = {
  hasClaim: boolean;
  hasLawsuit: boolean;
  masterLawsuitId: string;
  displayNumber: string;
};

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function numOrNull(value: unknown): number | null {
  if (value === null || value === undefined || clean(value) === "") return null;
  const parsed = Number(String(value).replace(/[$,\s]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function detailsObject(value: unknown): Record<string, any> {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) return value as Record<string, any>;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
    } catch {
      return {};
    }
  }
  return {};
}

// Reference entity addresses/tax IDs are often nested under details._hiddenImportFields
// with "hidden_"-prefixed keys (e.g. hidden_street/hidden_city/hidden_state/hidden_zipcode).
// Flatten those up so the same `pick` keys resolve them.
function flattenReferenceDetails(value: unknown): Record<string, any> {
  const base = detailsObject(value);
  const hidden = detailsObject(base._hiddenImportFields);
  const merged: Record<string, any> = { ...base };
  for (const [key, val] of Object.entries(hidden)) {
    if (!(key in merged)) merged[key] = val;
    const stripped = key.replace(/^hidden_/i, "");
    if (stripped && !(stripped in merged)) merged[stripped] = val;
  }
  return merged;
}

function pick(details: Record<string, any>, keys: string[]): string {
  for (const key of keys) {
    const v = clean(details[key]);
    if (v) return v;
  }
  return "";
}

function normalizeName(value: unknown): string {
  return clean(value).toLowerCase().replace(/\s+/g, " ");
}

function joinNonEmpty(parts: Array<string | null | undefined>, sep: string): string {
  return parts.map((p) => clean(p)).filter(Boolean).join(sep);
}

// Single-line address (street, city, state zip). Template authors compose multi-line
// addressee blocks by placing the structured tokens on separate lines.
function composeAddress(details: Record<string, any>): string {
  const street = joinNonEmpty(
    [pick(details, ["addressLine1", "address_line_1", "streetAddress", "street_address", "street", "address"]), pick(details, ["addressLine2", "address_line_2"])],
    ", ",
  );
  const city = pick(details, ["city"]);
  const state = pick(details, ["state"]);
  const zip = pick(details, ["zip", "zipcode", "zipCode", "postalCode"]);
  const cityStateZip = joinNonEmpty([city, joinNonEmpty([state, zip], " ")], ", ");
  // Newline-separated; the fill engine converts "\n" to a Word line break.
  return joinNonEmpty([street, cityStateZip], "\n");
}

async function findReferenceEntityByName(types: string[], name: string) {
  const normalized = normalizeName(name);
  if (!normalized) return null;
  try {
    return await prisma.referenceEntity.findFirst({
      where: {
        active: true,
        type: { in: types },
        OR: [
          { normalizedName: normalized },
          { displayName: { equals: clean(name), mode: "insensitive" } },
          { aliases: { some: { normalizedAlias: normalized } } },
        ],
      },
    });
  } catch {
    return null;
  }
}

export async function resolveTemplateTokenBaseValues(params: {
  directMatterDisplayNumber?: string | null;
  masterLawsuitId?: string | null;
  signer?: ResolvedTokenSigner | null;
}): Promise<{ values: Record<string, TokenBaseValue>; context: TemplateTokenContext; rows: Record<string, Array<Record<string, string>>> }> {
  const values: Record<string, TokenBaseValue> = {};
  // Repeating-table row-sets (e.g. `rows.matters` for the settlement stip): the fill engine clones a marked
  // table row once per item. Pre-formatted to strings since loop cells don't run through the modifier system.
  const rows: Record<string, Array<Record<string, string>>> = {};
  const fmtMoney = (n: unknown) => {
    const v = numOrNull(n);
    return v === null ? "" : "$" + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
  const text = (key: string, raw: unknown) => {
    values[key] = { raw: clean(raw) || null, type: "text" };
  };
  const date = (key: string, raw: unknown) => {
    values[key] = { raw: clean(raw) || null, type: "date" };
  };
  const money = (key: string, raw: unknown) => {
    const n = numOrNull(raw);
    values[key] = { raw: n, type: "currency" };
  };

  // 1. Signer (resolved upstream)
  const signer = params.signer || {};
  text("signer.email", signer.email);
  text("signer.fax", signer.faxNumber);
  text("signer.extension", signer.phoneExtension);
  text("signer.displayName", signer.displayName);
  text("signer.signatureName", signer.signatureBlockName);
  text("signer.title", "");

  // Letter date — stamped at generation in the firm's timezone (US Eastern),
  // independent of matter level. Use this instead of a live Word DATE field so the
  // date is fixed when the letter is generated and never drifts to UTC or to the
  // clock of whoever later opens the document. Rendered as "Month D, YYYY"
  // (e.g. June 30, 2026) to match the firm letterhead date format.
  const easternLetterDate = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date());
  text("letter.date", easternLetterDate);

  const displayNumber = clean(params.directMatterDisplayNumber);
  let masterLawsuitId = clean(params.masterLawsuitId);

  // 2. Individual claim / matter (claims index). The reliable key is display_number
  // (e.g. "BRL_202600001"); fall back to matter_id by the numeric portion.
  let claim: any = null;
  if (displayNumber) {
    const numericPart = displayNumber.replace(/[^0-9]/g, "");
    const displayVariants = Array.from(
      new Set([displayNumber, displayNumber.replace(/_/g, ""), numericPart].filter(Boolean)),
    );
    try {
      claim = await prisma.claimIndex.findFirst({ where: { display_number: { in: displayVariants } } });
    } catch {
      claim = null;
    }
    if (!claim) {
      const numericId = Number(numericPart);
      if (Number.isFinite(numericId) && numericId > 0) {
        claim = await getMatter(numericId).catch(() => null);
      }
    }
  }

  // Lawsuit-level context has no single matter, but a packet's members share one patient, provider, and
  // insurer (packets are one patient / one provider). Load a representative member claim so those SHARED
  // identity fields resolve — mirroring how the packet generator derives insurer/patient/provider from
  // members. Per-claim fields (balances, DOS, denial reason, claim number) stay blank: no single value.
  let isRepresentativeClaim = false;
  if (!claim && masterLawsuitId) {
    claim = await prisma.claimIndex
      .findFirst({ where: { master_lawsuit_id: masterLawsuitId }, orderBy: { display_number: "asc" } })
      .catch(() => null);
    isRepresentativeClaim = !!claim;
  }

  // File number resolves to the SAMPLE's own identifier: the lawsuit number at lawsuit level, the BRL matter
  // number at individual level.
  text("matter.fileNumber", (isRepresentativeClaim ? masterLawsuitId : claim?.display_number) || displayNumber || masterLawsuitId);

  if (claim) {
    if (!masterLawsuitId) masterLawsuitId = clean(claim.master_lawsuit_id);

    // Shared identity fields — valid whether from an individual matter OR a lawsuit's representative member.
    // Claim number and date of loss are shared too: a packet is one patient / one accident / one insurer claim.
    text("matter.providerName", normalizeProviderName(claim.client_name || claim.provider_name));
    text("matter.patientName", claim.patient_name);
    text("insurer.name", claim.insurer_name);
    text("claim.number", claim.claim_number_raw || claim.claim_number_normalized);
    date("claim.dateOfLoss", claim.date_of_loss);

    // Per-claim fields — only for an individual matter, not a lawsuit's representative member (they vary by
    // member and have no single lawsuit-level value).
    if (!isRepresentativeClaim) {
      money("matter.billedAmount", claim.claim_amount);

      const dosStart = clean(claim.dos_start);
      const dosEnd = clean(claim.dos_end);
      if (dosStart && dosEnd && dosStart !== dosEnd) {
        // A range is pre-formatted text; date modifiers do not apply.
        values["claim.dateOfService"] = { raw: `${dosStart} – ${dosEnd}`, type: "text" };
      } else {
        date("claim.dateOfService", dosStart || dosEnd);
      }

      text("claim.denialReason", claim.denial_reason);
      money("claim.balance", claim.balance_presuit);
      money("claim.payments", claim.payment_voluntary);
    }

    // 3a. Insurer reference address (by insurer name)
    const insurerEntity = await findReferenceEntityByName(
      ["insurer", "insurer_company", "company"],
      claim.insurer_name,
    );
    const insurerDetails = flattenReferenceDetails(insurerEntity?.details);
    text("insurer.street", joinNonEmpty([pick(insurerDetails, ["addressLine1", "address_line_1", "streetAddress", "street_address", "street", "address"]), pick(insurerDetails, ["addressLine2", "address_line_2"])], ", "));
    text("insurer.city", pick(insurerDetails, ["city"]));
    text("insurer.state", pick(insurerDetails, ["state"]));
    text("insurer.zipcode", pick(insurerDetails, ["zip", "zipcode", "zipCode", "postalCode"]));
    text("insurer.fullAddressBlock", composeAddress(insurerDetails));

    // 3b. Provider reference tax id (by provider name)
    const providerEntity = await findReferenceEntityByName(
      ["provider", "client", "company"],
      claim.client_name || claim.provider_name,
    );
    const providerDetails = flattenReferenceDetails(providerEntity?.details);
    text("provider.taxId", pick(providerDetails, ["taxId", "tax_id", "federalTaxId", "ein", "EIN"]));
    // Provider/client reference address (same details record as the tax id).
    text("provider.street", joinNonEmpty([pick(providerDetails, ["addressLine1", "address_line_1", "streetAddress", "street_address", "street", "address"]), pick(providerDetails, ["addressLine2", "address_line_2"])], ", "));
    text("provider.city", pick(providerDetails, ["city"]));
    text("provider.state", pick(providerDetails, ["state"]));
    text("provider.zipcode", pick(providerDetails, ["zip", "zipcode", "zipCode", "postalCode"]));
    text("provider.fullAddressBlock", composeAddress(providerDetails));
  }

  // 4. Lawsuit (YYYY.MM.NNNNNN)
  let lawsuit: any = null;
  if (masterLawsuitId) {
    lawsuit = await prisma.lawsuit.findUnique({ where: { masterLawsuitId } }).catch(() => null);
  }

  if (lawsuit) {
    const opts = detailsObject(lawsuit.lawsuitOptions);

    text("lawsuit.indexNumber", lawsuit.indexAaaNumber || opts.indexAaaNumber);
    date("lawsuit.dateFiled", opts.dateFiled);
    date("lawsuit.dateServed", opts.dateServed);
    date("lawsuit.dateServiceComplete", opts.dateServiceComplete);
    // Date Answer Received: the lawsuit-row override if set, else derived live from the Answer's upload
    // date in Litigation → Pleadings/Receipts (the FiledDocument createdAt = the received date).
    let answerReceived = clean(opts.dateAnswerReceived);
    if (!answerReceived && masterLawsuitId) {
      const answerDoc = await prisma.filedDocument
        .findFirst({
          where: {
            masterLawsuitId,
            folderKey: "litigation.pleadings_receipts",
            titleKey: "answer",
            status: "active",
          },
          orderBy: { createdAt: "asc" },
          select: { createdAt: true },
        })
        .catch(() => null);
      if (answerDoc?.createdAt) {
        const d = answerDoc.createdAt;
        answerReceived = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      }
    }
    date("lawsuit.dateAnswerReceived", answerReceived);
    money("lawsuit.amount", lawsuit.amountSought);

    const indexFee = numOrNull(opts.indexFee ?? opts.filingFee);
    const serviceFee = numOrNull(opts.serviceFee);
    const otherCosts = numOrNull(opts.otherCourtCosts ?? opts.otherCourtFees);
    money("cost.indexFee", indexFee);
    money("cost.serviceFee", serviceFee);
    money("cost.otherCourtCosts", otherCosts);

    const anyCost = indexFee !== null || serviceFee !== null || otherCosts !== null;
    const totalCosts = (indexFee || 0) + (serviceFee || 0) + (otherCosts || 0);
    values["cost.total"] = { raw: anyCost ? totalCosts : null, type: "currency" };
    values["lawsuit.costs"] = { raw: anyCost ? totalCosts : null, type: "currency" };

    const lawsuitAmount = numOrNull(lawsuit.amountSought) || 0;
    const postFilingPayments = numOrNull(opts.postFilingPayments ?? opts.lawsuitPayments) || 0;
    values["lawsuit.balance"] = { raw: lawsuitAmount + totalCosts - postFilingPayments, type: "currency" };

    // Adversary attorney (name + address)
    const adversaryName = clean(opts.adversaryAttorney);
    text("lawsuit.adversaryAttorney", adversaryName);
    text("lawsuit.adversaryAttorneyFileNo", clean(opts.adversaryAttorneyFileNo));
    let adversaryDetails =
      opts.selectedAdversaryAttorneyDetails && typeof opts.selectedAdversaryAttorneyDetails === "object"
        ? (opts.selectedAdversaryAttorneyDetails as Record<string, any>)
        : null;
    if (!adversaryDetails && adversaryName) {
      const adversaryEntity = await findReferenceEntityByName(
        ["adversary_attorney", "attorney", "adversary"],
        adversaryName,
      );
      adversaryDetails = flattenReferenceDetails(adversaryEntity?.details);
    }
    const adv = adversaryDetails || {};
    text("adversaryAttorney.street", joinNonEmpty([pick(adv, ["addressLine1", "address_line_1", "streetAddress", "street_address", "street", "address"]), pick(adv, ["addressLine2", "address_line_2"])], ", "));
    text("adversaryAttorney.city", pick(adv, ["city"]));
    text("adversaryAttorney.state", pick(adv, ["state"]));
    text("adversaryAttorney.zipcode", pick(adv, ["zip", "zipcode", "zipCode", "postalCode"]));
    text("adversary.fullAddressBlock", composeAddress(adv));

    // Court — mirror the packet generator (app/api/documents/packet/route.ts): prefer the embedded
    // `selectedCourtDetails` set by the venue picker, then fall back to a court reference entity. Two prior
    // bugs made the preview show blanks while the real doc filled in: (1) no embedded-details path, and
    // (2) the reference lookup used types ["court","venue"] but entities are stored as "court_venue".
    const courtName = clean(lawsuit.venue || lawsuit.venueSelection || opts.venue || opts.courtName);
    let courtDetails: Record<string, any> = flattenReferenceDetails(opts.selectedCourtDetails);
    if (!Object.keys(courtDetails).length && courtName) {
      const courtEntity = await findReferenceEntityByName(["court_venue", "court", "venue"], courtName);
      courtDetails = flattenReferenceDetails(courtEntity?.details);
    }
    if (courtName || Object.keys(courtDetails).length) {
      // Court details use a `court`-prefixed key convention (courtAddressLine1/courtCity/courtState/courtZip)
      // in addition to the generic keys — include both so it resolves whichever the stored data uses.
      text("court.name", pick(courtDetails, ["shortName", "name", "courtName"]) || courtName);
      text("court.longName1", pick(courtDetails, ["longName1", "longName", "courtLongName1"]));
      text("court.longName2", pick(courtDetails, ["longName2", "courtLongName2"]));
      // `addressStreet` is the actual stored key (confirmed from the Edit Court dialog rendering); keep the
      // others as fallbacks. Court reference data has no zip field, so court.zipcode stays blank by design.
      text("court.street", joinNonEmpty([pick(courtDetails, ["addressStreet", "courtAddressLine1", "addressLine1", "address_line_1", "streetAddress", "street_address", "street", "address"]), pick(courtDetails, ["addressStreet2", "courtAddressLine2", "addressLine2", "address_line_2"])], ", "));
      text("court.city", pick(courtDetails, ["courtCity", "city"]));
      text("court.state", pick(courtDetails, ["courtState", "state"]));
      text("court.zipcode", pick(courtDetails, ["courtZip", "courtZipcode", "courtZipCode", "zip", "zipcode", "zipCode", "postalCode"]));
    }
  }

  // 5. Settlement record + settled-with — keyed by masterLawsuitId, so it resolves for BOTH lawsuit and
  // individual samples that belong to a settled lawsuit. Source of truth: the latest non-voided
  // LocalSettlementRecord (what the settlement dialog writes). The settled-with party's contact info
  // (email/fax/phone/company) comes from the "individual" reference list (Settlement Contacts) — note fax
  // may be sparsely seeded, so it can legitimately come back blank.
  if (masterLawsuitId) {
    const settlement = await prisma.localSettlementRecord
      .findFirst({ where: { masterLawsuitId, voided: false }, orderBy: { recordedAt: "desc" } })
      .catch(() => null);

    const settledWithRaw = clean(settlement?.settledWith) || clean(claim?.settled_with);
    if (settledWithRaw) {
      const swEntity = await findReferenceEntityByName(["individual"], settledWithRaw);
      const sw = flattenReferenceDetails(swEntity?.details);
      // The stored value can be the contact DISPLAY string ("Name <email>"). Prefer the entity's clean
      // displayName; otherwise strip the trailing "<email>" so documents show just the name.
      text("settledWith.name", clean(swEntity?.displayName) || settledWithRaw.replace(/\s*<[^>]*>\s*$/, ""));
      text("settledWith.email", pick(sw, ["email"]));
      text("settledWith.fax", pick(sw, ["fax", "faxNumber", "fax_number"]));
      text("settledWith.phone", pick(sw, ["phone", "phoneNumber", "phone_number"]));
      text("settledWith.company", pick(sw, ["company"]));
    } else {
      text("settledWith.name", "");
    }

    date("settlement.date", settlement?.settlementDate);
    date("settlement.paymentExpectedDate", settlement?.paymentExpectedDate);
    text("settlement.allocationMode", settlement?.allocationMode);
    money("settlement.grossAmount", settlement?.grossSettlementAmount);
    money("settlement.interestAmount", settlement?.interestAmountTotal);
    money("settlement.allocatedTotal", settlement?.allocatedSettlementTotal);
    money("settlement.totalFee", settlement?.totalFee);
    money("settlement.providerNet", settlement?.providerNetTotal);

    // Per-matter table rows (the stip "matters" table). One LocalSettlementRow per member matter — same data
    // the settlement dialog wrote. Filing fees are the summed court costs; per-row allocation lives in
    // rowSnapshot when present, else 0 (the lawsuit-level total is settlement.filingFeesTotal below).
    const settlementRows = settlement
      ? await prisma.localSettlementRow
          .findMany({ where: { settlementRecordId: settlement.id }, orderBy: { displayNumber: "asc" } })
          .catch(() => [] as any[])
      : [];
    // Filing fees = summed court costs, applied to the FIRST case (matching the settlement dialog's logic).
    // Prefer an explicit per-row value from the dialog snapshot; else put the lawsuit-level total on row 0.
    const lopts = detailsObject(lawsuit?.lawsuitOptions);
    const filingFeesTotal =
      (numOrNull(lopts.indexFee ?? lopts.filingFee) ?? 0) +
      (numOrNull(lopts.serviceFee) ?? 0) +
      (numOrNull(lopts.otherCourtCosts ?? lopts.otherCourtFees) ?? 0);
    const snapFiling = settlementRows.map((r: any) => {
      const s = detailsObject(r.rowSnapshot);
      return numOrNull(r.filingFees ?? s.filingFees ?? s.filing_fees ?? s.courtCosts ?? s.costs);
    });
    const hasSnapFiling = snapFiling.some((v) => v !== null);
    const filingForRow = (i: number) => (hasSnapFiling ? snapFiling[i] ?? 0 : i === 0 ? filingFeesTotal : 0);
    let tBalance = 0, tPrincipal = 0, tInterest = 0, tAtty = 0, tFiling = 0;
    rows.matters = settlementRows.map((r: any, i: number) => {
      const filing = filingForRow(i);
      tBalance += numOrNull(r.claimAmount) ?? 0;
      tPrincipal += numOrNull(r.allocatedSettlement) ?? 0;
      tInterest += numOrNull(r.interestAmount) ?? 0;
      tAtty += numOrNull(r.totalFee) ?? 0;
      tFiling += filing;
      // Stack the patient name (first line = given name(s), second line = surname)
      // and the dates of service (start over end) so those columns stay narrow and
      // the File No / Balance columns keep enough width to render on one line.
      // The fill engine turns "\n" into a Word line break inside the cell.
      const patientStacked = (() => {
        const full = clean(r.patient);
        const sp = full.lastIndexOf(" ");
        return sp > 0 ? `${full.slice(0, sp)}\n${full.slice(sp + 1)}` : full;
      })();
      const dosStacked = (() => {
        // Normalize DOS to MM/DD/YYYY (matches the rest of the document's dates).
        const s = clean(r.dosStart) ? formatDate(clean(r.dosStart)) : "";
        const e = clean(r.dosEnd) ? formatDate(clean(r.dosEnd)) : "";
        if (s && e) return s === e ? s : `${s}\n${e}`;
        return s || e;
      })();
      return {
        "row.fileNo": clean(r.displayNumber),
        "row.patient": patientStacked,
        "row.dos": dosStacked,
        "row.balance": fmtMoney(r.claimAmount),
        "row.settledPrincipal": fmtMoney(r.allocatedSettlement),
        "row.interest": fmtMoney(r.interestAmount),
        "row.attyFees": fmtMoney(r.totalFee),
        "row.filingFees": fmtMoney(filing),
      };
    });
    // Column totals for the table's Total row.
    text("total.balance", fmtMoney(tBalance));
    text("total.settledPrincipal", fmtMoney(tPrincipal));
    text("total.interest", fmtMoney(tInterest));
    text("total.attyFees", fmtMoney(tAtty));
    text("total.filingFees", fmtMoney(tFiling));
    // (Lawsuit-level filing-fees total is already available as {{cost.total}} = index + service + other costs.)
  }

  return {
    values,
    rows,
    context: {
      hasClaim: Boolean(claim),
      hasLawsuit: Boolean(lawsuit),
      masterLawsuitId,
      displayNumber,
    },
  };
}
