// OCR human-in-the-loop learning (deterministic, auditable — no ML on PHI).
//
// Every filing records the classifier's suggestion vs the operator's final pick (OcrFilingFeedback),
// and increments a per-business-entity rollup (OcrEntityDefault) of where the operator files
// documents from each provider / carrier. On future uploads, getLearnedSuggestion returns the
// dominant folder/title for a recognized sender so the suggestion improves over time — without any
// model, batch job, or patient PHI in the learning store.
//
// NOTE: the new Prisma models are referenced through a widened client (`asDb`) so this compiles
// before `prisma generate` has regenerated the client on the developer's machine.

type Db = { [k: string]: any };
function asDb(prisma: unknown): Db {
  return prisma as Db;
}

const MIN_OBSERVATIONS = 2; // don't bias a suggestion until we've seen an entity file this way twice
const DROP_TOKENS = new Set([
  "pllc", "pc", "llc", "llp", "pa", "inc", "corp", "co", "ltd",
  "the", "a", "an", "of", "and", "dr",
]);

/**
 * Normalize a provider/carrier name to a stable key so the same entity matches across documents.
 * Lowercases, strips punctuation, and drops common legal/business-suffix tokens. Returns null when
 * there's nothing usable (so we never key memory on an empty/garbage entity).
 */
export function entityKey(name?: string | null): string | null {
  if (!name) return null;
  const cleaned = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((w) => w && !DROP_TOKENS.has(w))
    .join(" ")
    .trim();
  return cleaned.length >= 3 ? cleaned : null;
}

export type FilingFeedbackInput = {
  matterId?: number | null;
  masterLawsuitId?: string | null;
  fileName?: string | null;
  fileHash?: string | null;
  ocrExtractionId?: string | null;
  suggestedFolderKey?: string | null;
  suggestedTitleKey?: string | null;
  suggestedConfidence?: number | null;
  chosenFolderKey: string;
  chosenTitleKey: string;
  caseType?: string | null;
  providerName?: string | null;
  insurerName?: string | null;
  createdById?: string | null;
};

/** Record one filing outcome and fold it into the per-entity memory. Never throws to the caller. */
export async function recordFilingFeedback(prisma: unknown, input: FilingFeedbackInput): Promise<void> {
  const db = asDb(prisma);
  const providerKey = entityKey(input.providerName);
  const insurerKey = entityKey(input.insurerName);
  const wasCorrected = Boolean(
    input.suggestedFolderKey &&
      (input.suggestedFolderKey !== input.chosenFolderKey || input.suggestedTitleKey !== input.chosenTitleKey),
  );

  try {
    await db.ocrFilingFeedback.create({
      data: {
        matterId: input.matterId ?? null,
        masterLawsuitId: input.masterLawsuitId ?? null,
        fileName: input.fileName ?? null,
        fileHash: input.fileHash ?? null,
        ocrExtractionId: input.ocrExtractionId ?? null,
        suggestedFolderKey: input.suggestedFolderKey ?? null,
        suggestedTitleKey: input.suggestedTitleKey ?? null,
        suggestedConfidence: input.suggestedConfidence ?? null,
        chosenFolderKey: input.chosenFolderKey,
        chosenTitleKey: input.chosenTitleKey,
        caseType: input.caseType ?? null,
        providerKey,
        insurerKey,
        wasCorrected,
        createdById: input.createdById ?? null,
      },
    });
  } catch {
    // Feedback logging is best-effort — a filing must never fail because the learning write failed.
  }

  // Roll up per entity. Record both a case-type-specific memory and a case-type-agnostic ("") memory.
  const caseTypes = Array.from(new Set([input.caseType || "", ""]));
  const entities: { entityType: "provider" | "insurer"; key: string | null }[] = [
    { entityType: "provider", key: providerKey },
    { entityType: "insurer", key: insurerKey },
  ];
  for (const { entityType, key } of entities) {
    if (!key) continue;
    for (const ct of caseTypes) {
      try {
        await db.ocrEntityDefault.upsert({
          where: {
            entityType_entityKey_caseType_folderKey_titleKey: {
              entityType,
              entityKey: key,
              caseType: ct,
              folderKey: input.chosenFolderKey,
              titleKey: input.chosenTitleKey,
            },
          },
          create: {
            entityType,
            entityKey: key,
            caseType: ct,
            folderKey: input.chosenFolderKey,
            titleKey: input.chosenTitleKey,
            count: 1,
          },
          update: { count: { increment: 1 }, lastSeenAt: new Date() },
        });
      } catch {
        // best-effort
      }
    }
  }
}

export type LearnedSuggestion = {
  folderKey: string;
  titleKey: string;
  count: number;
  entityType: "provider" | "insurer";
  entityKey: string;
};

/**
 * The dominant folder/title the operator has historically chosen for this document's provider or
 * carrier. Provider is tried first (stronger signal), case-type-specific memory before agnostic.
 * Returns null unless a clear leader exists (>= MIN_OBSERVATIONS and strictly ahead of the runner-up).
 */
export async function getLearnedSuggestion(
  prisma: unknown,
  args: { providerName?: string | null; insurerName?: string | null; caseType?: string | null },
): Promise<LearnedSuggestion | null> {
  const db = asDb(prisma);
  const providerKey = entityKey(args.providerName);
  const insurerKey = entityKey(args.insurerName);
  const wantedCaseTypes = Array.from(new Set([args.caseType || "", ""]));

  const order: { entityType: "provider" | "insurer"; key: string | null }[] = [
    { entityType: "provider", key: providerKey },
    { entityType: "insurer", key: insurerKey },
  ];
  for (const { entityType, key } of order) {
    if (!key) continue;
    for (const ct of wantedCaseTypes) {
      let rows: any[] = [];
      try {
        rows = await db.ocrEntityDefault.findMany({
          where: { entityType, entityKey: key, caseType: ct },
          orderBy: [{ count: "desc" }, { lastSeenAt: "desc" }],
          take: 2,
        });
      } catch {
        rows = [];
      }
      if (rows.length === 0) continue;
      const top = rows[0];
      if (top.count < MIN_OBSERVATIONS) continue;
      const dominant = rows.length === 1 || top.count > rows[1].count;
      if (!dominant) continue;
      return {
        folderKey: top.folderKey,
        titleKey: top.titleKey,
        count: top.count,
        entityType,
        entityKey: key,
      };
    }
  }
  return null;
}
