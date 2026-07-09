import { prisma } from "@/lib/prisma";

export const REFERENCE_ENTITY_TYPES = [
  "individual",
  "adversary_attorney",
  "insurer_company",
  "provider_client",
  "treating_provider",
  "patient",
  "court_venue",
  "service_type",
  "denial_reason",
  "closed_reason",
  "transaction_type",
  "transaction_status",
  "other",
] as const;

export type ReferenceEntityType = (typeof REFERENCE_ENTITY_TYPES)[number];

export function cleanReferenceText(value: unknown): string {
  return String(value ?? "").trim();
}

export function normalizeReferenceText(value: unknown): string {
  return cleanReferenceText(value)
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeReferenceEntityType(value: unknown): ReferenceEntityType {
  const raw = cleanReferenceText(value).toLowerCase().replace(/[\s-]+/g, "_");

  const aliases: Record<string, ReferenceEntityType> = {
    individuals: "individual",
    person: "individual",
    persons: "individual",
    people: "individual",

    // "individual" is the Settlement Contacts list (label only; key kept for back-compat)
    settlement_contact: "individual",
    settlement_contacts: "individual",
    settled_with: "individual",
    settledwith: "individual",
    settlement: "individual",
    settlements: "individual",
    adjuster: "individual",
    adjusters: "individual",

    adversary_attorneys: "adversary_attorney",
    attorney: "adversary_attorney",
    attorneys: "adversary_attorney",

    insurer: "insurer_company",
    insurers: "insurer_company",
    company: "insurer_company",
    companies: "insurer_company",
    insurance_company: "insurer_company",
    insurance_companies: "insurer_company",

    provider: "provider_client",
    providers: "provider_client",
    client: "provider_client",
    clients: "provider_client",
    provider_clients: "provider_client",

    treating_provider: "treating_provider",
    treating_providers: "treating_provider",
    treating: "treating_provider",
    rendering_provider: "treating_provider",
    rendering_providers: "treating_provider",

    patients: "patient",

    court: "court_venue",
    courts: "court_venue",
    venue: "court_venue",
    venues: "court_venue",
    court_venues: "court_venue",

    services: "service_type",
    service: "service_type",
    service_types: "service_type",

    denial: "denial_reason",
    denials: "denial_reason",
    denial_reasons: "denial_reason",

    closed_reason: "closed_reason",
    closed_reasons: "closed_reason",
    close_reason: "closed_reason",
    close_reasons: "closed_reason",
    final_status: "closed_reason",
    final_statuses: "closed_reason",

    transaction: "transaction_type",
    transactions: "transaction_type",
    transaction_types: "transaction_type",

    status: "transaction_status",
    statuses: "transaction_status",
    transaction_statuses: "transaction_status",

    misc: "other",
    miscellaneous: "other",
  };

  const mapped = aliases[raw] || raw;
  if ((REFERENCE_ENTITY_TYPES as readonly string[]).includes(mapped)) {
    return mapped as ReferenceEntityType;
  }

  throw new Error(`Unsupported reference entity type: ${cleanReferenceText(value) || "(blank)"}`);
}

export function referenceTypeOptions() {
  return REFERENCE_ENTITY_TYPES.map((value) => ({
    value,
    label: referenceTypeLabel(value),
  }));
}

export function referenceTypeLabel(type: ReferenceEntityType): string {
  const labels: Record<ReferenceEntityType, string> = {
    individual: "Settlement Contacts",
    adversary_attorney: "Adversary Attorneys",
    insurer_company: "Insurers / Companies",
    provider_client: "Providers / Clients",
    treating_provider: "Treating Providers",
    patient: "Patients",
    court_venue: "Courts / Venues",
    service_type: "Service Types",
    denial_reason: "Denial Reasons",
    closed_reason: "Closed Reasons / Final Statuses",
    transaction_type: "Transaction Types",
    transaction_status: "Transaction Statuses",
    other: "Other",
  };

  return labels[type];
}

export function parseActiveFilter(value: unknown): boolean | undefined {
  const raw = cleanReferenceText(value).toLowerCase();
  if (!raw || raw === "all") return undefined;
  if (["true", "1", "yes", "active"].includes(raw)) return true;
  if (["false", "0", "no", "inactive"].includes(raw)) return false;
  return undefined;
}

export function safeLimit(value: unknown, fallback = 50, max = 100): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.min(max, Math.floor(n)));
}

export async function findReferenceEntityById(id: unknown) {
  const cleaned = cleanReferenceText(id);
  if (!cleaned) return null;

  return prisma.referenceEntity.findUnique({
    where: { id: cleaned },
    include: { aliases: { orderBy: { alias: "asc" } } },
  });
}
