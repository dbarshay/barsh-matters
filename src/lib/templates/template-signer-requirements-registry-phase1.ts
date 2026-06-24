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
      tel: "(631) 210-7272",
      fax: "(516) 706-5055",
      email: "info@brlfirm.com",
      signature: "Barshay, Rizzo & Lopez, PLLC",
    },
  },
  {
    templateId: "vr-response",
    requiredSignerFields: [],
    staticOverrideBypass: {
      approvedPhase: "19D",
      tel: "(631) 210-7272",
      extension: "",
      fax: "(516) 706-5055",
      email: "info@brlfirm.com",
      signature: "Angelo F. Rizzo, Esquire",
    },
  },
];

export function getTemplateSignerRequirementPhase1(templateId: string): TemplateSignerRequirementPhase1 | undefined {
  return TEMPLATE_SIGNER_REQUIREMENTS_REGISTRY_PHASE1.find((item) => item.templateId === templateId);
}
