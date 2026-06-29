import { BARSH_FIRM_CONTACT } from "@/lib/firmContact";

export type TemplateSignerRequirementPhase1 = {
  templateId: string;
  requiredSignerFields: string[];
  staticOverrideBypass?: {
    approvedPhase: string;
    tel?: string;
    extension?: string;
    fax?: string;
    email?: string;
    signature?: string;
  };
};

export const TEMPLATE_SIGNER_REQUIREMENTS_REGISTRY_PHASE1: TemplateSignerRequirementPhase1[] = [
  {
    templateId: "initial-billing-letter",
    requiredSignerFields: [],
    staticOverrideBypass: {
      approvedPhase: "18K/18L",
      tel: BARSH_FIRM_CONTACT.telephone,
      fax: BARSH_FIRM_CONTACT.faxNumber,
      email: BARSH_FIRM_CONTACT.email,
      signature: BARSH_FIRM_CONTACT.signatureBlockName,
    },
  },
  {
    templateId: "vr-response",
    requiredSignerFields: [],
    staticOverrideBypass: {
      approvedPhase: "19D",
      tel: BARSH_FIRM_CONTACT.telephone,
      extension: BARSH_FIRM_CONTACT.phoneExtension,
      fax: BARSH_FIRM_CONTACT.faxNumber,
      email: BARSH_FIRM_CONTACT.email,
      // Individual attorney signer (not the firm block); name stays explicit.
      signature: "Angelo F. Rizzo, Esquire",
    },
  },
];

export function getTemplateSignerRequirementPhase1(templateId: string): TemplateSignerRequirementPhase1 | undefined {
  return TEMPLATE_SIGNER_REQUIREMENTS_REGISTRY_PHASE1.find((item) => item.templateId === templateId);
}
