// Document folder taxonomy — the SINGLE source of truth for the BM-side document tree.
//
// Per docs/document-folder-structure.md the tree is FIXED and controlled: Clio storage stays flat;
// BM owns folders + controlled titles as metadata. This config drives the UI (tree, picklists,
// prompts) AND server-side enforcement (no uncontrolled title/folder can be written). It is code,
// not a DB table, precisely so titles/folders are versioned and enforceable.
//
// LEVEL: which matter the folder's docs live on — "matter" (individual BRL_ claim) vs "lawsuit"
// (the aggregated YYYY.MM.NNNNNN lawsuit file). CASE-TYPE relevance drives greying (a folder is
// greyed only when case-type-irrelevant AND empty; any folder with a doc always stays available).

export type MatterLevel = "matter" | "lawsuit";
export type CaseType = "no_fault" | "wc" | "arbitration";
export type PromptFieldType = "date" | "text" | "money" | "select";

export type TitlePromptField = {
  key: string;
  label: string;
  type: PromptFieldType;
  required?: boolean;
  options?: string[]; // for type "select"
  /** Conditional display: only prompt when another field equals one of these values. */
  showWhen?: { field: string; equals: string[] };
};

export type TitleSpec = {
  key: string; // stable, e.g. "bill", "request_dated", "award"
  label: string; // display title, e.g. "Bill"
  /** Static title = label is the title, no prompts. */
  static?: boolean;
  prompts?: TitlePromptField[];
  /** Compose the display label from prompt values, e.g. "Request Dated {date}". */
  labelTemplate?: string;
};

// Sentinel title key for a folder's freehand "Other" (operator types a custom title).
export const FREEHAND_TITLE_KEY = "__freehand_other__";

export type FolderSpec = {
  /** Stable dotted path, filled by normalize(): e.g. "claim_documents.verification.requests". */
  key: string;
  /** Single-segment key as authored (joined into `key`). */
  segment: string;
  name: string; // display name, e.g. "Bills"
  level: MatterLevel;
  terminal: boolean;
  /** Controlled titles (terminal folders only). */
  titles: TitleSpec[];
  /** Whether the folder offers a freehand "Other" title. */
  allowFreehandOther: boolean;
  /** On drop into this folder, prompt "create a deadline?" (opt-in). */
  promptsDeadline: boolean;
  /** Case types this folder is relevant to; empty = relevant to all. */
  caseTypes: CaseType[];
  children?: FolderSpec[];
};

// --- Raw authored tree (segment-relative). normalize() fills `key`, inherits level/caseTypes. ---

type RawFolder = {
  segment: string;
  name: string;
  level?: MatterLevel;
  caseTypes?: CaseType[];
  terminal?: boolean;
  titles?: TitleSpec[];
  allowFreehandOther?: boolean;
  promptsDeadline?: boolean;
  children?: RawFolder[];
};

const staticTitle = (key: string, label: string): TitleSpec => ({ key, label, static: true });

const RAW_TAXONOMY: RawFolder[] = [
  {
    segment: "arbitration",
    name: "Arbitration",
    level: "lawsuit",
    caseTypes: ["arbitration"],
    terminal: false,
    children: [
      {
        segment: "correspondence_ar1",
        name: "Correspondence / AR1",
        terminal: true,
        allowFreehandOther: false,
        promptsDeadline: true,
        titles: [
          staticTitle("ar1", "AR1"),
          {
            key: "correspondence",
            label: "Correspondence",
            prompts: [
              { key: "date", label: "Date of correspondence", type: "date", required: true },
              { key: "description", label: "Brief description", type: "text" },
            ],
            labelTemplate: "Correspondence — {date} — {description}",
          },
        ],
      },
      {
        segment: "awards",
        name: "Awards",
        terminal: true,
        allowFreehandOther: false,
        promptsDeadline: true,
        titles: [
          {
            key: "award",
            label: "Award",
            prompts: [
              { key: "date", label: "Date of award", type: "date", required: true },
              {
                key: "outcome",
                label: "Outcome",
                type: "select",
                required: true,
                options: ["Win", "Loss", "Partial Win"],
              },
              { key: "principal", label: "Principal", type: "money", showWhen: { field: "outcome", equals: ["Win", "Partial Win"] } },
              { key: "interest", label: "Interest", type: "money", showWhen: { field: "outcome", equals: ["Win", "Partial Win"] } },
              { key: "attorneys_fees", label: "Attorney's Fees", type: "money", showWhen: { field: "outcome", equals: ["Win", "Partial Win"] } },
              { key: "costs", label: "Costs", type: "money", showWhen: { field: "outcome", equals: ["Win", "Partial Win"] } },
            ],
            labelTemplate: "Award — {outcome} — {date}",
          },
        ],
      },
    ],
  },
  {
    segment: "claim_documents",
    name: "Claim Documents",
    level: "matter",
    caseTypes: [], // relevant to all case types
    terminal: false,
    children: [
      {
        segment: "bills",
        name: "Bills",
        terminal: true,
        allowFreehandOther: false,
        promptsDeadline: false,
        titles: [
          staticTitle("bill", "Bill"),
          staticTitle("aob", "AOB"),
          staticTitle("proof_of_mailing", "Proof of Mailing"),
          staticTitle("liens", "Liens"),
        ],
      },
      {
        segment: "reports",
        name: "Reports",
        terminal: true,
        allowFreehandOther: false,
        promptsDeadline: false,
        titles: [staticTitle("prescription", "Prescription"), staticTitle("report", "Report")],
      },
      {
        segment: "denials",
        name: "Denials",
        terminal: true,
        allowFreehandOther: false,
        promptsDeadline: false,
        titles: [
          staticTitle("nf10", "NF-10"),
          staticTitle("eob_eor", "EOB/EOR"),
          staticTitle("peer_review_ime", "Peer Review/IME"),
        ],
      },
      {
        segment: "verification",
        name: "Verification",
        terminal: false,
        children: [
          {
            segment: "requests",
            name: "Requests",
            terminal: true,
            allowFreehandOther: false,
            promptsDeadline: true,
            titles: [
              {
                key: "request_dated",
                label: "Request Dated",
                prompts: [{ key: "date", label: "Request date", type: "date", required: true }],
                labelTemplate: "Request Dated {date}",
              },
            ],
          },
          {
            segment: "responses",
            name: "Responses",
            terminal: true,
            allowFreehandOther: false,
            promptsDeadline: true,
            titles: [
              {
                key: "response_dated",
                label: "Response Dated",
                prompts: [{ key: "date", label: "Response date", type: "date", required: true }],
                labelTemplate: "Response Dated {date}",
              },
            ],
          },
        ],
      },
      {
        segment: "payments",
        name: "Payments",
        terminal: true,
        allowFreehandOther: false,
        promptsDeadline: false,
        titles: [
          {
            key: "payment",
            label: "Payment",
            prompts: [
              {
                key: "category",
                label: "Category",
                type: "select",
                required: true,
                options: ["Principal / Interest", "Attorney's Fee / Filing"],
              },
              { key: "amount_primary", label: "Amount (Principal or Attorney's Fee)", type: "money", required: true },
              { key: "amount_secondary", label: "Amount (Interest or Filing)", type: "money", required: true },
            ],
            labelTemplate: "Payment — {category}",
          },
        ],
      },
      {
        segment: "miscellaneous",
        name: "Miscellaneous",
        terminal: true,
        allowFreehandOther: true,
        promptsDeadline: true,
        titles: [staticTitle("police_report", "Police Report")],
      },
    ],
  },
  {
    segment: "litigation",
    name: "Litigation",
    level: "lawsuit",
    caseTypes: ["no_fault"],
    terminal: false,
    children: [
      {
        segment: "pleadings_receipts",
        name: "Pleadings / Receipts",
        terminal: true,
        allowFreehandOther: false,
        promptsDeadline: false,
        titles: [
          staticTitle("complaint", "Complaint"),
          staticTitle("answer", "Answer"),
          staticTitle("affidavit_of_service", "Affidavit of Service"),
          staticTitle("dfs_receipts", "DFS Receipts"),
          staticTitle("other_receipts", "Other Receipts"),
        ],
      },
      {
        segment: "discovery",
        name: "Discovery",
        terminal: true,
        allowFreehandOther: false,
        promptsDeadline: true,
        titles: [
          staticTitle("plaintiffs_demands", "Plaintiff's Demands"),
          staticTitle("defendants_demands", "Defendant's Demands"),
          staticTitle("plaintiffs_responses", "Plaintiff's Responses"),
          staticTitle("defendants_responses", "Defendant's Responses"),
        ],
      },
      {
        segment: "motions",
        name: "Motions",
        terminal: true,
        allowFreehandOther: false,
        promptsDeadline: true,
        titles: [
          staticTitle("plaintiffs_motion", "Plaintiff's Motion"),
          staticTitle("defendants_motion", "Defendant's Motion"),
          staticTitle("plaintiffs_opposition_cross", "Plaintiff's Opposition / Cross-Motion"),
          staticTitle("defendants_opposition_cross", "Defendant's Opposition / Cross-Motion"),
          staticTitle("plaintiffs_reply", "Plaintiff's Reply"),
          staticTitle("defendants_reply", "Defendant's Reply"),
          staticTitle("decisions_orders", "Decisions / Orders"),
        ],
      },
      {
        segment: "stipulations",
        name: "Stipulations",
        terminal: true,
        allowFreehandOther: true,
        promptsDeadline: true,
        titles: [
          staticTitle("stip_settlement", "Stipulation of Settlement"),
          staticTitle("stip_discontinuance", "Stipulation of Discontinuance"),
        ],
      },
      {
        segment: "judgments",
        name: "Judgments",
        terminal: true,
        allowFreehandOther: false,
        promptsDeadline: true,
        titles: [
          staticTitle("judgment", "Judgment"),
          staticTitle("execution", "Execution"),
          staticTitle("judgment_entered", "Judgment Entered"),
          staticTitle("other_corr_marshal_sheriff", "Other Correspondence (Marshal/Sheriff)"),
        ],
      },
      {
        segment: "court_correspondence",
        name: "Court Correspondence",
        terminal: true,
        allowFreehandOther: false,
        promptsDeadline: true,
        titles: [
          {
            key: "court_correspondence",
            label: "Court Correspondence",
            prompts: [
              { key: "date", label: "Date of correspondence", type: "date", required: true },
              { key: "description", label: "Description", type: "text" },
            ],
            labelTemplate: "Court Correspondence — {date} — {description}",
          },
        ],
      },
      {
        segment: "other_filings",
        name: "Other Filings",
        terminal: true,
        allowFreehandOther: true,
        promptsDeadline: true,
        titles: [
          staticTitle("notice_of_entry", "Notice of Entry"),
          staticTitle("notice_of_trial", "Notice of Trial"),
          staticTitle("demand_trial_de_novo", "Demand for Trial de Novo"),
        ],
      },
    ],
  },
  {
    segment: "workers_comp",
    name: "Workers' Comp",
    level: "matter",
    caseTypes: ["wc"],
    terminal: true,
    allowFreehandOther: true,
    promptsDeadline: true,
    titles: [
      staticTitle("hp1", "HP-1"),
      staticTitle("hpj1", "HPJ-1"),
      staticTitle("c81", "C8.1"),
      staticTitle("c84", "C8.4"),
      staticTitle("rejections", "Rejections"),
    ],
  },
];

// --- Normalize: fill dotted `key`, inherit level/caseTypes, default flags, then freeze. ---

function normalize(
  raw: RawFolder,
  parentKey: string,
  inheritedLevel: MatterLevel,
  inheritedCaseTypes: CaseType[],
): FolderSpec {
  const key = parentKey ? `${parentKey}.${raw.segment}` : raw.segment;
  const level = raw.level ?? inheritedLevel;
  const caseTypes = raw.caseTypes ?? inheritedCaseTypes;
  const terminal = raw.terminal ?? !raw.children;
  const spec: FolderSpec = {
    key,
    segment: raw.segment,
    name: raw.name,
    level,
    terminal,
    titles: raw.titles ?? [],
    allowFreehandOther: raw.allowFreehandOther ?? false,
    promptsDeadline: raw.promptsDeadline ?? false,
    caseTypes,
    children: raw.children?.map((c) => normalize(c, key, level, caseTypes)),
  };
  return spec;
}

export const FOLDER_TAXONOMY: FolderSpec[] = RAW_TAXONOMY.map((b) =>
  normalize(b, "", b.level ?? "matter", b.caseTypes ?? []),
);

// --- Lookups / helpers (used by the tree UI and server-side write enforcement) ---

const byKey = new Map<string, FolderSpec>();
(function index(folders: FolderSpec[]) {
  for (const f of folders) {
    byKey.set(f.key, f);
    if (f.children) index(f.children);
  }
})(FOLDER_TAXONOMY);

export function getFolder(key: string): FolderSpec | undefined {
  return byKey.get(key);
}

export function listTerminalFolders(): FolderSpec[] {
  return [...byKey.values()].filter((f) => f.terminal);
}

export function getAllowedTitles(folderKey: string): TitleSpec[] {
  return getFolder(folderKey)?.titles ?? [];
}

export function findTitle(folderKey: string, titleKey: string): TitleSpec | undefined {
  return getAllowedTitles(folderKey).find((t) => t.key === titleKey);
}

/** Server-side enforcement: is this (folder, title) legal? Freehand allowed only where enabled. */
export function isTitleAllowed(folderKey: string, titleKey: string): boolean {
  const folder = getFolder(folderKey);
  if (!folder || !folder.terminal) return false;
  if (titleKey === FREEHAND_TITLE_KEY) return folder.allowFreehandOther;
  return folder.titles.some((t) => t.key === titleKey);
}

/** Is a folder relevant to a case type? (empty caseTypes = relevant to all.) */
export function folderAppliesToCaseType(folderKey: string, caseType: CaseType): boolean {
  const folder = getFolder(folderKey);
  if (!folder) return false;
  return folder.caseTypes.length === 0 || folder.caseTypes.includes(caseType);
}

/**
 * Compose the display label for a filed document from its title + prompt values.
 * - freehand "Other": returns the operator's typed title.
 * - static / no template: returns the title label.
 * - templated: substitutes {field} tokens, then tidies empty segments (e.g. a missing optional
 *   description won't leave a dangling " — "). A (#) disambiguation suffix is added at WRITE time
 *   (Phase 3), not here.
 */
export function composeTitleLabel(
  folderKey: string,
  titleKey: string,
  fields: Record<string, unknown> = {},
  freehandTitle?: string | null,
): string {
  if (titleKey === FREEHAND_TITLE_KEY) {
    return (freehandTitle || "").replace(/\s+/g, " ").trim() || "Other";
  }
  const title = findTitle(folderKey, titleKey);
  if (!title) return "";
  if (!title.labelTemplate) return title.label;

  let out = title.labelTemplate.replace(/\{(\w+)\}/g, (_, k: string) => {
    const v = fields[k];
    return v == null ? "" : String(v).trim();
  });
  // Tidy: collapse repeated/dangling " — " separators left by empty optional fields.
  out = out
    .replace(/\s*—\s*—\s*/g, " — ")
    .replace(/\s*—\s*$/g, "")
    .replace(/^\s*—\s*/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return out;
}
