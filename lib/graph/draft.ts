export type GraphRecipientInput = {
  name?: string | null;
  email?: string | null;
};

export type GraphDraftAttachmentInput = {
  name: string;
  contentType?: string | null;
  sizeBytes?: number | null;
  source?: string | null;
  requiredForFinalGraphDraft?: boolean;
  clioDocumentId?: string | number | null;
  clioDocumentVersionUuid?: string | null;
  url?: string | null;
};

export type GraphDraftInput = {
  subject: string;
  bodyText: string;
  to?: GraphRecipientInput[];
  cc?: GraphRecipientInput[];
  bcc?: GraphRecipientInput[];
  attachments?: GraphDraftAttachmentInput[];
  matterContext?: {
    source?: string | null;
    matterId?: string | number | null;
    matterDisplayNumber?: string | null;
    masterLawsuitId?: string | null;
    clioMatterId?: string | number | null;
    clioDisplayNumber?: string | null;
    clioMaildropEmail?: string | null;
    clioMaildropLabel?: string | null;
  };
};

export type GraphDraftPayloadPreview = {
  graphMessagePayload: {
    subject: string;
    body: {
      contentType: "Text";
      content: string;
    };
    toRecipients: GraphRecipientPayload[];
    ccRecipients: GraphRecipientPayload[];
    bccRecipients: GraphRecipientPayload[];
    singleValueExtendedProperties?: Array<{
      id: string;
      value: string;
    }>;
  };
  attachmentPlan: Array<{
    name: string;
    contentType: string | null;
    sizeBytes: number | null;
    source: string | null;
    requiredForFinalGraphDraft: boolean;
    clioDocumentId: string | null;
    clioDocumentVersionUuid: string | null;
    url: string | null;
    graphUploadRequired: boolean;
  }>;
  validation: {
    hasToRecipient: boolean;
    hasMaildropCc: boolean;
    maildropInCcOnly: boolean;
    readyForGraphDraftCreate: boolean;
    warnings: string[];
  };
};

export type GraphRecipientPayload = {
  emailAddress: {
    name?: string;
    address: string;
  };
};

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function cleanOptionalString(value: unknown): string | null {
  const cleaned = clean(value);
  return cleaned || null;
}

function parseFormattedEmailRecipient(value: string): GraphRecipientInput | null {
  const raw = clean(value);
  if (!raw) return null;

  const match = raw.match(/^(.*?)<([^<>@\s]+@[^<>@\s]+)>$/);
  if (match) {
    const name = clean(match[1]).replace(/^"|"$/g, "");
    const email = clean(match[2]);
    return email ? { name: name || null, email } : null;
  }

  if (/^[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+$/.test(raw)) {
    return { email: raw };
  }

  return null;
}

export function normalizeGraphRecipients(input: unknown): GraphRecipientInput[] {
  if (!input) return [];

  const rawValues = Array.isArray(input) ? input : [input];
  const recipients: GraphRecipientInput[] = [];

  for (const value of rawValues) {
    if (!value) continue;

    if (typeof value === "string") {
      for (const part of value.split(",")) {
        const parsed = parseFormattedEmailRecipient(part);
        if (parsed?.email) recipients.push(parsed);
      }
      continue;
    }

    if (typeof value === "object") {
      const row = value as Record<string, unknown>;
      const email = clean(row.email || row.address || row.mail || row.value);
      const name = clean(row.name || row.label || row.displayName);
      if (email) recipients.push({ name: name || null, email });
    }
  }

  const seen = new Set<string>();
  return recipients.filter((recipient) => {
    const email = clean(recipient.email).toLowerCase();
    if (!email || seen.has(email)) return false;
    seen.add(email);
    return true;
  });
}

export function graphRecipientPayload(recipient: GraphRecipientInput): GraphRecipientPayload | null {
  const address = clean(recipient.email);
  if (!address) return null;

  const name = clean(recipient.name);
  return {
    emailAddress: {
      ...(name ? { name } : {}),
      address,
    },
  };
}

function toGraphRecipients(recipients: GraphRecipientInput[] | undefined): GraphRecipientPayload[] {
  return (recipients || [])
    .map(graphRecipientPayload)
    .filter((recipient): recipient is GraphRecipientPayload => Boolean(recipient));
}

function recipientEmails(recipients: GraphRecipientInput[] | undefined): Set<string> {
  return new Set((recipients || []).map((recipient) => clean(recipient.email).toLowerCase()).filter(Boolean));
}

export function buildGraphDraftPayloadPreview(input: GraphDraftInput): GraphDraftPayloadPreview {
  const subject = clean(input.subject) || "Document";
  const bodyText = clean(input.bodyText) || "Please see the attached document.";

  const to = normalizeGraphRecipients(input.to);
  const cc = normalizeGraphRecipients(input.cc);
  const bcc = normalizeGraphRecipients(input.bcc);

  const maildropEmail = clean(input.matterContext?.clioMaildropEmail).toLowerCase();
  const ccEmails = recipientEmails(cc);
  const bccEmails = recipientEmails(bcc);

  const hasMaildropCc = Boolean(maildropEmail && ccEmails.has(maildropEmail));
  const maildropInBcc = Boolean(maildropEmail && bccEmails.has(maildropEmail));

  const attachmentPlan = (input.attachments || []).map((attachment) => ({
    name: clean(attachment.name) || "document.pdf",
    contentType: cleanOptionalString(attachment.contentType),
    sizeBytes: typeof attachment.sizeBytes === "number" ? attachment.sizeBytes : null,
    source: cleanOptionalString(attachment.source),
    requiredForFinalGraphDraft: Boolean(attachment.requiredForFinalGraphDraft),
    clioDocumentId:
      attachment.clioDocumentId === null || attachment.clioDocumentId === undefined
        ? null
        : String(attachment.clioDocumentId),
    clioDocumentVersionUuid: cleanOptionalString(attachment.clioDocumentVersionUuid),
    url: cleanOptionalString(attachment.url),
    graphUploadRequired: true,
  }));

  const warnings: string[] = [];
  if (!to.length) warnings.push("No To recipient is available yet.");
  if (!maildropEmail) warnings.push("No Clio MailDrop address is available yet.");
  if (maildropEmail && !hasMaildropCc) warnings.push("Clio MailDrop must be included in Cc for thread capture.");
  if (maildropInBcc) warnings.push("Clio MailDrop must not be placed in Bcc because Reply All will not preserve it.");

  const matter = input.matterContext || {};
  const extendedProperties = [
    ["String {00020329-0000-0000-C000-000000000046} Name BarshMattersSource", matter.source],
    ["String {00020329-0000-0000-C000-000000000046} Name BarshMattersMatterId", matter.matterId],
    ["String {00020329-0000-0000-C000-000000000046} Name BarshMattersMatterDisplayNumber", matter.matterDisplayNumber],
    ["String {00020329-0000-0000-C000-000000000046} Name BarshMattersMasterLawsuitId", matter.masterLawsuitId],
    ["String {00020329-0000-0000-C000-000000000046} Name BarshMattersClioMatterId", matter.clioMatterId],
    ["String {00020329-0000-0000-C000-000000000046} Name BarshMattersClioDisplayNumber", matter.clioDisplayNumber],
  ]
    .map(([id, value]) => ({ id: String(id), value: clean(value) }))
    .filter((row) => row.value);

  return {
    graphMessagePayload: {
      subject,
      body: {
        contentType: "Text",
        content: bodyText,
      },
      toRecipients: toGraphRecipients(to),
      ccRecipients: toGraphRecipients(cc),
      bccRecipients: toGraphRecipients(bcc),
      ...(extendedProperties.length > 0
        ? { singleValueExtendedProperties: extendedProperties }
        : {}),
    },
    attachmentPlan,
    validation: {
      hasToRecipient: to.length > 0,
      hasMaildropCc,
      maildropInCcOnly: hasMaildropCc && !maildropInBcc,
      readyForGraphDraftCreate: to.length > 0 && hasMaildropCc && !maildropInBcc,
      warnings,
    },
  };
}
