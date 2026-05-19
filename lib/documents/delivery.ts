export type DocumentDeliverySource =
  | "direct_matter"
  | "master_lawsuit"
  | "settlement"
  | "other";

export type DocumentDeliveryContext = {
  source: DocumentDeliverySource;
  documentKey: string;
  documentLabel: string;
  documentUrl?: string;
  pdfUrl?: string;
  docxUrl?: string;
  subject?: string;
  providerName?: string;
  patientName?: string;
  insurerName?: string;
  indexNumber?: string;
  ourCaseNumber?: string;
  suggestedRecipientName?: string;
  suggestedRecipientEmail?: string;
  suggestedCcEmail?: string;
  settledWithName?: string;
  settledWithEmail?: string;
  clioMaildropEmail?: string;
  clioMaildropLabel?: string;
  matterId?: string;
  masterLawsuitId?: string;
};

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function compactJoin(values: string[], separator: string): string {
  return values.map(clean).filter(Boolean).join(separator);
}

export function buildNoFaultDocumentEmailSubject(context: DocumentDeliveryContext): string {
  const explicitSubject = clean(context.subject);
  if (explicitSubject) return explicitSubject;

  const providerName = clean(context.providerName);
  const patientName = clean(context.patientName);
  const insurerName = clean(context.insurerName);
  const indexNumber = clean(context.indexNumber);
  const ourCaseNumber =
    clean(context.ourCaseNumber) ||
    clean(context.matterId) ||
    clean(context.masterLawsuitId);

  const caption = providerName && patientName
    ? `${providerName} a/a/o ${patientName}`
    : compactJoin([providerName, patientName], " a/a/o ");

  const partyLine = compactJoin([caption, insurerName], " and ");
  const referenceLine = compactJoin(
    [
      indexNumber ? `Index No. ${indexNumber}` : "",
      ourCaseNumber ? `Our Case No. ${ourCaseNumber}` : "",
    ],
    ", "
  );

  if (partyLine && referenceLine) return `${partyLine} -- ${referenceLine}`;
  if (partyLine) return partyLine;
  if (referenceLine) return referenceLine;

  return clean(context.documentLabel) || "Document";
}

export function buildDocumentEmailSubject(context: DocumentDeliveryContext): string {
  return buildNoFaultDocumentEmailSubject(context);
}

export function buildDocumentEmailBody(context: DocumentDeliveryContext): string {
  const documentKey = clean(context.documentKey).toLowerCase();
  const documentLabel = clean(context.documentLabel) || "document";

  if (documentKey.includes("bill-schedule")) {
    return "Please see the attached bill schedule.\n\nThank you.";
  }

  if (documentKey.includes("summons") || documentKey.includes("complaint")) {
    return "Please see the attached summons and complaint.\n\nThank you.";
  }

  if (documentKey.includes("packet-summary")) {
    return "Please see the attached packet summary.\n\nThank you.";
  }

  if (documentKey.includes("demand")) {
    return "Please see the attached demand letter.\n\nThank you.";
  }

  if (documentKey.includes("cover")) {
    return "Please see the attached cover letter.\n\nThank you.";
  }

  return `Please see the attached ${documentLabel}.\n\nThank you.`;
}

function encodeMailtoComponent(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) =>
    `%${char.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

function formatEmailRecipient(label: unknown, email: unknown): string {
  const cleanLabel = clean(label);
  const cleanEmail = clean(email);

  if (!cleanEmail) return "";
  if (!cleanLabel) return cleanEmail;

  return `${cleanLabel} <${cleanEmail}>`;
}

export function buildMailtoHref(context: DocumentDeliveryContext): string {
  const to = clean(context.settledWithEmail) || clean(context.suggestedRecipientEmail);
  const cc =
    formatEmailRecipient(context.clioMaildropLabel, context.clioMaildropEmail) ||
    clean(context.suggestedCcEmail);
  const subject = buildDocumentEmailSubject(context);
  const body = buildDocumentEmailBody(context);

  const queryParts = [
    `subject=${encodeMailtoComponent(subject)}`,
    `body=${encodeMailtoComponent(body)}`,
  ];

  if (cc) {
    queryParts.unshift(`cc=${encodeMailtoComponent(cc)}`);
  }

  return `mailto:${encodeMailtoComponent(to)}?${queryParts.join("&")}`;
}

export function resolvePrintableUrl(context: DocumentDeliveryContext): string {
  return clean(context.pdfUrl) || clean(context.documentUrl) || clean(context.docxUrl);
}

export function documentDeliverySafetyNote(): string {
  return "Delivery actions use the shared Barsh Matters document delivery contract.  Email opens Outlook/mail compose with local recipient and subject data where available.  Print requires a generated PDF/printable URL.  Send to Print Queue requires a finalized document queue backend.";
}
