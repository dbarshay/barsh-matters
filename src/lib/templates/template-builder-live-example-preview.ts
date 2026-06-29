import { prisma } from "@/lib/prisma";
import { resolveTemplateTokenBaseValues } from "@/lib/documents/templateTokenResolver";
import { parseTemplateToken, formatTokenValue } from "@/lib/documents/templateTokenFormat";
import { BARSH_FIRM_CONTACT } from "@/lib/firmContact";
import { TEMPLATE_BUILDER_CANONICAL_MERGE_FIELDS } from "@/src/lib/templates/template-builder-merge-field-library";

// Builder live-example preview.
//
// This delegates to the SAME generation resolver + formatter used to fill real documents
// (lib/documents/templateTokenResolver + templateTokenFormat). That guarantees the values
// shown in the Template Builder match what generation actually produces — there is one
// source of truth, so the two cannot drift.

export type TemplateBuilderExamplePreviewDiagnostics = {
  requestedMatter: string;
  context: "lawsuit" | "direct" | "unknown";
  usedPreviewFallback: false;
  liveRowCounts: {
    claimRows: number;
    lawsuitRows: number;
    providerRows: number;
    costRows: number;
  };
  providerTaxIdResolved: boolean;
  insurerAddressResolved: boolean;
  lawsuitResolved: boolean;
  costResolved: boolean;
};

export type TemplateBuilderExamplePreviewResult = {
  matter: string;
  requestedMatter: string;
  exampleOutputMatter: string;
  exampleOutputMap: Record<string, string>;
  diagnostics: TemplateBuilderExamplePreviewDiagnostics;
};

const DASH = "—";

const clean = (value: unknown): string => String(value ?? "").trim();

const isLawsuitMatterKey = (value: string): boolean => /^\d{4}\.\d{2}\.\d+$/.test(value);

export async function resolveTemplateBuilderExamplePreview(
  matterKey: string,
): Promise<TemplateBuilderExamplePreviewResult> {
  const requestedMatter = clean(matterKey) || "2026.06.00011";
  const lawsuitContext = isLawsuitMatterKey(requestedMatter);

  // Lawsuit context: pass ONLY the master lawsuit id. Per-claim tokens (matter.billedAmount,
  // claim.balance, claim.payments, etc.) intentionally stay unresolved -> dash, because a
  // lawsuit document never mixes per-claim money fields with aggregate lawsuit fields.
  // Direct (BRL_) context: the matter display number drives the claim and, via its
  // master_lawsuit_id, any linked lawsuit. This mirrors generation exactly (one resolver).
  let directMatterDisplayNumber = "";
  let masterLawsuitId = "";
  let claimRowsCount = 0;

  if (lawsuitContext) {
    masterLawsuitId = requestedMatter;
    claimRowsCount = await prisma.claimIndex
      .count({ where: { master_lawsuit_id: requestedMatter } })
      .catch(() => 0);
  } else {
    directMatterDisplayNumber = requestedMatter;
  }

  const { values, context } = await resolveTemplateTokenBaseValues({
    directMatterDisplayNumber: directMatterDisplayNumber || undefined,
    masterLawsuitId: masterLawsuitId || undefined,
    // Example output uses the firm signer (single source of truth).
    signer: {
      email: BARSH_FIRM_CONTACT.email,
      faxNumber: BARSH_FIRM_CONTACT.faxNumber,
      phoneExtension: BARSH_FIRM_CONTACT.phoneExtension,
      displayName: BARSH_FIRM_CONTACT.displayName,
      signatureBlockName: BARSH_FIRM_CONTACT.signatureBlockName,
    },
  });

  if (!lawsuitContext) claimRowsCount = context.hasClaim ? 1 : 0;

  const exampleOutputMap: Record<string, string> = {};
  for (const field of TEMPLATE_BUILDER_CANONICAL_MERGE_FIELDS) {
    const token = field.mergeField;
    const { base, modifiers } = parseTemplateToken(token);
    const entry = values[base];
    const formatted = entry ? formatTokenValue(entry, modifiers) : "";
    exampleOutputMap[token] = clean(formatted) || DASH;
  }

  const insurerAddressResolved = [
    exampleOutputMap["{{insurer.street}}"],
    exampleOutputMap["{{insurer.city}}"],
    exampleOutputMap["{{insurer.state}}"],
    exampleOutputMap["{{insurer.zipcode}}"],
  ].some((value) => value && value !== DASH);

  const costRowsResolved = [
    exampleOutputMap["{{cost.indexFee}}"],
    exampleOutputMap["{{cost.serviceFee}}"],
    exampleOutputMap["{{cost.otherCourtCosts}}"],
  ].filter((value) => value && value !== DASH).length;

  return {
    matter: requestedMatter,
    requestedMatter,
    exampleOutputMatter: requestedMatter,
    exampleOutputMap,
    diagnostics: {
      requestedMatter,
      context: context.hasLawsuit ? "lawsuit" : context.hasClaim ? "direct" : "unknown",
      usedPreviewFallback: false,
      liveRowCounts: {
        claimRows: claimRowsCount,
        lawsuitRows: context.hasLawsuit ? 1 : 0,
        providerRows: exampleOutputMap["{{provider.taxId}}"] !== DASH ? 1 : 0,
        costRows: costRowsResolved,
      },
      providerTaxIdResolved: exampleOutputMap["{{provider.taxId}}"] !== DASH,
      insurerAddressResolved,
      lawsuitResolved: context.hasLawsuit,
      costResolved: costRowsResolved > 0,
    },
  };
}
