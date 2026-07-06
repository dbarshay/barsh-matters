// OCR reference cross-reference + matter prediction (READ-ONLY).
//
// Turns best-effort OCR values into authoritative lookups: extracted provider/carrier/patient are
// resolved against the reference-entity registry + patient master (canonical names, TIN), and the
// document's keys (our file number / claim # / index # / policy #, then patient+provider) are matched
// against ClaimIndex to PREDICT the matter. Nothing is written here — the operator confirms, and the
// reference-value rules (registry authoritative; OCR never overrides) are honored by the caller.

import { resolveCarrier, resolveProvider } from "@/lib/referenceResolution";
import { resolvePatient } from "@/lib/patientResolution";
import { normalizeClaimNumber } from "@/lib/claimIndex";

type Db = { [k: string]: any };
function asDb(prisma: unknown): Db {
  return prisma as Db;
}

export type CrossRefEntity = {
  raw: string | null;
  matched: boolean;
  canonical: string | null;
  entityId: string | null;
  via: "name" | "alias" | null;
};

export type CrossRefPatient = {
  raw: string | null;
  status: "exact" | "suggest" | "new";
  patientId: string | null;
  name: string | null;
  candidates: { id: string; name: string; kind: "exact" | "close" }[];
};

export type MatterCandidate = {
  matterId: number;
  displayNumber: string | null;
  patientName: string | null;
  providerName: string | null;
  insurerName: string | null;
  caseType: string | null;
  masterLawsuitId: string | null;
  matchedOn: string; // "file" | "claim" | "index" | "policy" | "patient+provider"
  score: number; // 0..100
};

export type CrossReferenceResult = {
  provider: CrossRefEntity & { tin: string | null };
  carrier: CrossRefEntity;
  patient: CrossRefPatient;
  matterCandidates: MatterCandidate[];
  /** Set only when a single, strong-key match exists (file/claim/index) — safe to auto-select. */
  predictedMatterId: number | null;
  predictedMatchedOn: string | null;
};

export type ExtractedForCrossRef = {
  patientName?: string | null;
  providerName?: string | null;
  insurerName?: string | null;
  claimNumber?: string | null;
  policyNumber?: string | null;
  indexNumber?: string | null;
  bmFileNumber?: string | null;
};

const MATTER_SELECT = {
  matter_id: true,
  display_number: true,
  patient_name: true,
  provider_name: true,
  insurer_name: true,
  case_type: true,
  master_lawsuit_id: true,
} as const;

function toCandidate(row: any, matchedOn: string, score: number): MatterCandidate {
  return {
    matterId: row.matter_id,
    displayNumber: row.display_number ?? null,
    patientName: row.patient_name ?? null,
    providerName: row.provider_name ?? null,
    insurerName: row.insurer_name ?? null,
    caseType: row.case_type ?? null,
    masterLawsuitId: row.master_lawsuit_id ?? null,
    matchedOn,
    score,
  };
}

/** Resolve extracted entities to canonical records and predict the matter from the strongest keys. */
export async function crossReferenceExtraction(
  prisma: unknown,
  e: ExtractedForCrossRef,
): Promise<CrossReferenceResult> {
  const db = asDb(prisma);

  // --- Entity normalization (registry-authoritative) ---
  const providerRes = e.providerName ? await resolveProvider(e.providerName) : { status: "unmatched" as const };
  let providerTin: string | null = null;
  if (providerRes.status === "matched") {
    try {
      const pci = await db.providerClientInfo.findFirst({
        where: { referenceEntityId: providerRes.entityId },
        select: { tin: true },
      });
      providerTin = pci?.tin ?? null;
    } catch {
      providerTin = null;
    }
  }
  const carrierRes = e.insurerName ? await resolveCarrier(e.insurerName) : { status: "unmatched" as const };

  const patientRes = e.patientName ? await resolvePatient(e.patientName) : { status: "new" as const };

  // --- Matter prediction from ClaimIndex ---
  const byId = new Map<number, MatterCandidate>();
  const add = (rows: any[], matchedOn: string, score: number) => {
    for (const r of rows) {
      const existing = byId.get(r.matter_id);
      if (!existing || score > existing.score) byId.set(r.matter_id, toCandidate(r, matchedOn, score));
    }
  };
  const q = (where: any) => db.claimIndex.findMany({ where, select: MATTER_SELECT, take: 5 }).catch(() => []);

  // Strong keys (unique → safe to predict).
  if (e.bmFileNumber) add(await q({ display_number: e.bmFileNumber }), "file", 100);
  if (e.claimNumber) {
    const norm = normalizeClaimNumber(e.claimNumber);
    if (norm) add(await q({ claim_number_normalized: norm }), "claim", 90);
  }
  if (e.indexNumber) add(await q({ index_aaa_number: e.indexNumber }), "index", 85);
  // Medium key.
  if (e.policyNumber) add(await q({ policy_number: e.policyNumber }), "policy", 70);
  // Weak corroborating key — patient + provider together.
  if (e.patientName && e.providerName) {
    add(
      await q({
        patient_name: { contains: e.patientName, mode: "insensitive" },
        provider_name: { contains: e.providerName, mode: "insensitive" },
      }),
      "patient+provider",
      40,
    );
  }

  const matterCandidates = [...byId.values()].sort((a, b) => b.score - a.score);

  // Predict only on a strong key (>= 85) AND a single matter carrying that key (no ambiguity).
  let predictedMatterId: number | null = null;
  let predictedMatchedOn: string | null = null;
  if (matterCandidates.length) {
    const top = matterCandidates[0];
    const sameScore = matterCandidates.filter((c) => c.score === top.score);
    if (top.score >= 85 && sameScore.length === 1) {
      predictedMatterId = top.matterId;
      predictedMatchedOn = top.matchedOn;
    }
  }

  return {
    provider: {
      raw: e.providerName ?? null,
      matched: providerRes.status === "matched",
      canonical: providerRes.status === "matched" ? providerRes.displayName : null,
      entityId: providerRes.status === "matched" ? providerRes.entityId : null,
      via: providerRes.status === "matched" ? providerRes.via : null,
      tin: providerTin,
    },
    carrier: {
      raw: e.insurerName ?? null,
      matched: carrierRes.status === "matched",
      canonical: carrierRes.status === "matched" ? carrierRes.displayName : null,
      entityId: carrierRes.status === "matched" ? carrierRes.entityId : null,
      via: carrierRes.status === "matched" ? carrierRes.via : null,
    },
    patient: {
      raw: e.patientName ?? null,
      status: patientRes.status,
      patientId: patientRes.status === "exact" ? patientRes.patientId : null,
      name: patientRes.status === "exact" ? patientRes.name : null,
      candidates: patientRes.status === "suggest" ? patientRes.candidates : [],
    },
    matterCandidates,
    predictedMatterId,
    predictedMatchedOn,
  };
}
