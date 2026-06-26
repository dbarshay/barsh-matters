export type TemplateContactDisplayDefaultPhase1H = "signer" | "firm";

export const TEMPLATE_CONTACT_DISPLAY_DEFAULT_OPTIONS_PHASE1H = [
  {
    value: "signer",
    label: "Signer contact",
    description: "Use the selected signer email, fax, extension, and signature profile by default.",
  },
  {
    value: "firm",
    label: "Firm contact",
    description: "Use the firm general contact information by default while keeping eligible signers selectable.",
  },
] as const;

export type TemplateContactDisplayDefaultMetadataPhase1H = {
  defaultContactDisplayMode: TemplateContactDisplayDefaultPhase1H;
};

export function normalizeTemplateContactDisplayDefaultPhase1H(value: unknown): TemplateContactDisplayDefaultPhase1H {
  return value === "firm" ? "firm" : "signer";
}

export const TEMPLATE_CONTACT_DISPLAY_DEFAULT_CONTRACT_PHASE1H = {
  metadataField: "defaultContactDisplayMode",
  allowedValues: ["signer", "firm"],
  defaultValue: "signer",
  selectedSignerRule: "The selected signer defaults to the signed-in generating user, but any eligible signer may be picked.",
  signerTokenRule: "signer.* tokens resolve from the selected signer, not necessarily the signed-in user.",
  eligibleSignerSelectorRemainsAvailable: true,
  noClio: true,
  noGraph: true,
  noDocxMutation: true,
  noDatabaseImport: true,
  noPrintQueue: true,
} as const;
