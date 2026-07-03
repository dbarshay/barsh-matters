# Document Folder Structure (BM-wide) — spec, in progress

Supersedes the provisional flat 17-folder list in `manual-creation-intake.md`.
Accessed via the existing **Documents** action button → **View Documents** → the master-folder tree.
Applies to every matter (all intake paths), not just manual creation.

Clio note: Clio storage stays **flat** under the matter folder (no subfolders in Clio); this nested
tree is the **BM-side** organization (folder = BM metadata on each document). (Confirm still true.)

## Folder tree (as described — some names/branches TBD)

```
View Documents
├── Arbitration
│   ├── Correspondence / AR1
│   └── Awards
├── Claim Documents
│   ├── Bills
│   ├── Reports
│   ├── Denials
│   ├── Verification
│   │   ├── Requests
│   │   └── Responses
│   ├── Payments
│   └── Miscellaneous
├── Litigation
│   ├── Pleadings / Receipts
│   ├── Discovery
│   ├── Motions
│   ├── Stipulations
│   ├── Judgments
│   ├── Court Correspondence
│   └── Other Filings
└── Workers' Comp                     (documents only — NO subfolders)
```

## Drag-and-drop + controlled-title behavior
- Users drag/drop a document into a **terminal (leaf) folder**.
- On drop, a **picklist appears** asking "which document is this?" — showing **only that folder's
  allowed titles** (a controlled, per-folder list).
- The document then **displays in the UI under the picked title** — the display label is **decoupled
  from the actual saved filename** (BM shows the friendly title regardless of how the file is stored).
- The stored file is a **Clio-supported document type**, so the document stays **callable and savable**
  from Clio (Clio = the file store; BM owns the title/label + folder placement as metadata).
- **OCR pre-fill (ANY dropped document):** on drop, OCR/extract from the document to **pre-fill the
  chosen title's prompt fields** (dates, descriptions, amounts, outcomes, etc.) for the user to
  **VERIFY/correct**. **Never auto-commit** — review required (especially for money); accuracy
  depends on document format/scan quality.
- ⇒ Need, per terminal folder: **the allowed title list**.

### Terminal folders (each needs an allowed-title list) — 17
Arbitration: **Correspondence / AR1**, **Awards** ·
Claim Documents: **Bills**, **Reports**, **Denials**, **Payments**, **Miscellaneous**, and
Verification → **Requests**, **Responses** ·
Litigation: **Pleadings / Receipts**, **Discovery**, **Motions**, **Stipulations**, **Judgments**,
**Court Correspondence**, **Other Filings** ·
**Workers' Comp** (itself terminal — documents only).

## Template-generated (merge/save) documents auto-file to a designated folder
- Documents BM **merges/saves from a template** are **auto-filed** into a folder (no manual drag-drop).
- **Target folder:** the template designates a **default** target folder (add a **"target folder"**
  setting to `DocumentTemplate`). It is **changeable at finalize** — the user can redirect to another
  folder; doing so swaps the available titles to that folder's list.
- **Title at finalize:** the user **picks from the target folder's allowed-title list**. If the
  template has a **preset title that matches one of that folder's allowed titles, it defaults to
  that** (pre-selected). → `DocumentTemplate` also stores an optional preset title.
- So every document on a matter — **manually uploaded** (drag→title picklist) or **template-generated**
  (auto-filed) — lands in a folder with a controlled title.

## Attach documents to a finalized template merge
- On **finalizing a template merge**, prompt: **"Do you want to attach any documents?"** Yes / No.
- **Yes** → a **document picker** listing the **existing documents already on the matter** (from the
  folder tree). (Picker source = existing matter documents; no new upload at this step.)
- User **selects and orders** the attachments (user-defined sequence, e.g., exhibits after the main
  document).
- **User chooses each time** what "attach" produces:
  - **Combine into one PDF** — finalized document + ordered attachments merged into a single PDF, OR
  - **Keep separate but linked** — each file stays separate, grouped/associated with the finalized doc.
- TBD: how the combined/linked result is **titled & filed** (target folder + title) — likely the
  template's target folder + a title.

## Document search / visibility UX
Goal: when a user looks for a document, it must be **visually obvious what the matter has**, so no
time is wasted clicking through empty folders. **All of the following (decided):**
- **Count badges per folder** — each folder shows its document count (e.g. `Bills (3)`).
- **Flat searchable list of all documents** on the matter (index view alongside the folder tree).
- **Title search box** — filters documents by title across every folder.
- **Highlight folders that contain documents**; **empty folders are greyed out but stay visible**
  (so the full structure is always discoverable).

## Document-driven deadlines (adopted, enhancement #1)
On drop into certain folders, prompt **"Do you want to create a deadline?"** (opt-in). If Yes → create
a tickler/deadline (user sets it) — ties to BM's existing tickler system. Deadline is **manual/opt-in**
(not auto-calculated from the document date unless we later specify per-title rules).

Folders that **DO** prompt:
- **Arbitration** — all documents (Correspondence / AR1, Awards)
- **Claim Documents → Miscellaneous**
- **Claim Documents → Verification → Requests**
- **Claim Documents → Verification → Responses**
- **Litigation → Judgments**
- **Litigation → Motions**
- **Litigation → Stipulations**
- **Litigation → Discovery**
- **Litigation → Other Filings**
- **Litigation → Court Correspondence**
- **Workers' Comp**

Folders that do **NOT** prompt: Claim Documents → Bills, Reports, Denials, Payments;
Litigation → Pleadings / Receipts.

## Matter-level vs lawsuit-level documents (aggregation)
The **lawsuit is its own BM matter** (the "lawsuit file matter"). Documents split by level:
- **Lawsuit-level folders (live on the lawsuit matter):** **Arbitration** and **Litigation** (and all
  their subfolders/titles).
- **Child / per-bill folders (live on each individual matter):** **Claim Documents** (Bills, Reports,
  Denials, Verification Req/Resp, Payments, Miscellaneous) and **Workers' Comp**.
- **Lawsuit's View Documents shows:** the lawsuit's own Arbitration + Litigation branches, **plus one
  collapsed folder per child matter, named by the child's BM matter number** (`BRL_YYYYNNNNN`).
  Expanding a child reveals that child's **subfolders + documents that are present** (not empty
  scaffolding).
- From the lawsuit, the user can **view child documents** and **attach/call them into templates
  generated from the lawsuit file matter**.
- Applies even to **single-matter lawsuits** (litigation still lives on the lawsuit matter; the one
  child rolls up).
- _Minor opens:_ whether an individual child matter's view also surfaces the lawsuit-level docs;
  where deadlines/emails attach (lawsuit vs child). Revisit.

## Adopted enhancements
1. **Document audit trail** — log every add / move / retitle / delete (who + when + source) on the
   existing AuditLog. Chain-of-custody for the legal file.
2. **Move / re-file documents** — a document can be moved to another folder later; on move the user
   re-picks a title valid for the new folder (audited).
3. **Delete policy (tiered):**
   - Regular/BPO users: **cannot delete**.
   - **Admin: soft-delete only** — archives (hidden, recoverable) + audit.
   - **Owner (dbarshay) can ALSO hard-delete** — permanent, audited. (Only the Owner role.)
4. **Server-side title enforcement** — allowed-title picklists enforced on the server (not just UI),
   so no uncontrolled title can be injected via a bug or direct API call.
5. **Full-text OCR search** — index OCR'd document text so search can match **content**, with a
   user-selectable **search mode: Title (default) · Content · Both**.
6. **Bulk categorize on scan** — during intake scanning, assign folder + title to many documents at
   once (BPO throughput).
7. **Inline preview + timeline** — quick preview in View Documents + chronological view by entered
   date, **only if preview renders/streams from Clio and does NOT duplicate files into BM (non-Clio)
   storage** (no storage bloat). If streaming from Clio isn't feasible without local caching, limit.

_Deferred (not now):_ **Missing-document checklist** per case type/stage; **per-folder role
restrictions** (view/edit) — defer to the RBAC rollout (delete tiering still applies now).

## Adopted enhancements (round 2)
- **#2 Auto-suggested attachments on finalize** — each template can define its **usual attachments**
  (by folder + title, e.g. latest AOB / Denial / Bills). At finalize, the attach picker **surfaces
  them as SUGGESTIONS (never required)** — the user can accept, deselect, or add others. Nothing is
  forced.

- **#3 Documents callable into templates** — a template can reference a filed document by
  **folder + title** to (a) merge its **structured fields** (e.g. Denial date, Award amounts) and/or
  (b) **embed the document** itself. Makes the "callable" promise concrete.

- **#4 Exhibit labeling on combine** — when combining attachments into one PDF for **Litigation and
  Arbitration** documents: label exhibits **numerically (1, 2, 3…)**, each preceded by a **separate
  exhibit cover/label page** ("Exhibit 1", etc.) before the actual document. **Per attachment, ask
  the user: "labeled exhibit" or "just attached"** (plain, no cover page). Not applied to other
  branches. (No Bates numbering.)

- **#5 Duplicate-file detection (content hash)** — on add, hash the file; **only an EXACT
  byte-for-byte duplicate** already on the matter triggers a **warning** (user may proceed or cancel).
  **Never flag "substantially similar" files** — exact match only. Complements title-based `(#)`
  handling (that's labels; this is the actual file).

- **#6 Native matter email (REPLACES the maildrop-address idea)** — the old Clio maildrop is dead;
  instead, **email is fully integrated into the matter UI**. **No visible maildrop address.**
  - **Outbound:** compose/send a matter-relevant email **from the matter UI** (via Graph, from the
    firm mailbox). The sent email is recorded in the matter's existing **"View Emails"** area.
  - **Attach documents to outgoing email:** the compose dialog includes a **document picker** to
    attach the matter's filed documents (from the folder tree) — for **both new emails and replies**.
  - **Sender identity:** send as the **individual logged-in user** (their name + signature); replies
    come back to them and thread to the matter.
  - **Reply-matching = threading + standardized subject tag:** primary match via invisible threading
    headers (Message-ID / In-Reply-To / References); **plus a standardized subject tag containing the
    matter number as a LEADING prefix** (e.g. `[BRL_YYYYNNNNN] Subject…`) — front-loaded so it's easy
    to spot when scrolling in Outlook, and a durable fallback when headers are stripped/forwarded/new.
    Exact tag format TBD.
  - **Attachments (template-based):** stored **as part of the email** (visible when the email is
    viewed) **AND** filed into the **applicable document folder** in the tree.
  - **Inbound replies:** the recipient's replies come back to the firm mailbox; BM (existing **Graph
    thread-sync**) matches them to the originating matter by **conversation thread / Message-ID**
    (In-Reply-To / References) and shows them in the same matter's View Emails — **no maildrop address
    needed**, matching is by thread.
  - **Email backend = Outlook / Microsoft 365 (unchanged).** Outlook stays the mail server; BM
    integrates via **Graph** (send + receive/thread-sync). BM does NOT become a mail server / replace
    Outlook.
  - **UX mimics Outlook** (familiar, not a replacement). A **"Send Email" button** in the matter UI
    opens the compose dialog; sending is matter-scoped.
  - **Net-new inbound tagging (confidence-tiered):** when the matter is **obvious → auto-tag with no
    user action**; when **unsure → show suggestion(s)** the user can **accept or reassign** to another
    matter. (Reuse `app/api/graph/thread-sync` + `local-thread-preview`.)
  - **Core requirement:** both incoming and outgoing emails are always **tagged to the relevant matter
    in BM** (the goal that replaces the maildrop address). Confirm which firm mailbox BM sends
    from / monitors.

- **#7 Case-type-aware folder relevance** — folders irrelevant to a matter's case type
  (No-Fault / WC / Arbitration) are **greyed but still visible** (never hidden/blocked). **Case type
  remains a user-editable toggle** on the matter; changing it re-computes which folders are greyed.
  **Greying never buries content:** a folder is greyed only when it is BOTH case-type-irrelevant AND
  **empty**. **Any folder that contains a document stays fully available** even if the case type later
  changes to one where it would otherwise be greyed. (Define the folder↔case-type mapping at build.)

- **#8 OCR confidence highlighting** — **every OCR-prefilled field requires user confirmation** (never
  auto-commit). Color-coded by extraction confidence: **low = yellow highlight + message**,
  **high = green highlight + message**, so the user knows exactly what to verify.

## Allowed titles per terminal folder (collected folder-by-folder)
Each folder: its controlled title picklist, and whether it also offers a **freehand "Other"** entry
(user types a custom title). Freehand is **off by default** — only where the user says so.

Title behavior: a title can be **static** (label = the title) or **prompt for structured fields** on
select (e.g. a date + a brief description) that compose the display label. Prompted fields are noted
per title below.

- Arbitration → Correspondence / AR1:
    - `AR1` (static title)
    - `Correspondence` → on select, prompt for **Date of correspondence** + **Brief description**;
      display label composed as e.g. `Correspondence — {date} — {description}` (confirm label format)
    - Freehand "Other": no
- Arbitration → Awards:
    - `Award` → on drop, prompt for **Date of award** (required) + **Outcome** picklist:
      `Win` | `Loss` | `Partial Win`. Label composed e.g. `Award — {outcome} — {date}`.
    - If Outcome = **Win** or **Partial Win** → additionally prompt for amounts awarded:
      **Principal**, **Interest**, **Attorney's Fees**, **Costs** (money). Loss → no amounts.
    - Outcome + amounts are structured data (arbitration win/loss + award-amount reporting).
    - Freehand "Other": no
- Claim Documents → Bills: titles = `Bill`, `AOB`, `Proof of Mailing`, `Liens`. (Freehand "Other":
  no. Per-title prompts, if any, TBD — none specified yet.) _Note: AOB, Proof of Mailing, and Liens
  from the old flat list live here as titles, not separate folders._
- Claim Documents → Reports: titles = `Prescription`, `Report`. (Freehand "Other": no. Prompts: none specified.)
- Claim Documents → Denials: titles = `NF-10`, `EOB/EOR`, `Peer Review/IME`. (Freehand "Other": no. Prompts: none specified.)
- Claim Documents → Verification → Requests: title = `Request Dated` → prompt for a **date**; label =
  `Request Dated {date}`. (Freehand "Other": no.)
- Claim Documents → Verification → Responses: title = `Response Dated` → prompt for a **date**; label =
  `Response Dated {date}`. (Freehand "Other": no.)
- Claim Documents → Payments: title = `Payment` → prompt to pick a category —
  **Principal / Interest** OR **Attorney's Fee / Filing** — and enter **an amount for both**
  components of the chosen category (Principal + Interest, or Attorney's Fee + Filing). Amounts are
  structured money data (**metadata only — not posted to the ledger**). (Freehand "Other": no.)
    - **Payment-posting integration:** the **payment-posting modal** includes a **drop zone**; a
      payment document dropped there is **auto-filed into this Payments folder**, tagged with the
      **payment type being posted** (Principal/Interest or Attorney's Fee/Filing) — type inherited
      from the posting, no separate title prompt. (The ledger posting remains the financial source of
      truth; the filed document is the reference copy.)
    - **Payment-modal OCR pre-fill** (instance of the system-wide OCR pre-fill above): dropping a
      payment doc in the modal can OCR/extract payment data (amounts, type, date, check #) to
      **pre-fill the modal fields for VERIFY/correct** before posting — never auto-post. Scope:
      **firm-received payments only** (that's all we post); no Carisk pre-fill needed.
- Claim Documents → Miscellaneous: titles = `Police Report`, `Other` (**freehand** — user types a
  custom title). **Freehand "Other": YES.**
- Litigation → Pleadings / Receipts: titles = `Complaint`, `Answer`, `Affidavit of Service`,
  `DFS Receipts`, `Other Receipts`. (Freehand "Other": no. Prompts: none specified.)
- Litigation → Discovery: titles = `Plaintiff's Demands`, `Defendant's Demands`,
  `Plaintiff's Responses`, `Defendant's Responses`. (Freehand "Other": no. Prompts: none specified.)
- Litigation → Motions: titles = `Plaintiff's Motion`, `Defendant's Motion`,
  `Plaintiff's Opposition / Cross-Motion`, `Defendant's Opposition / Cross-Motion`,
  `Plaintiff's Reply`, `Defendant's Reply`, `Decisions / Orders`. (Freehand "Other": no. Prompts: none specified.)
- Litigation → Stipulations: titles = `Stipulation of Settlement`, `Stipulation of Discontinuance`,
  `Other` (**freehand**). **Freehand "Other": YES.**
- Litigation → Judgments: titles = `Judgment`, `Execution`, `Judgment Entered`,
  `Other Correspondence (Marshal/Sheriff)`. (Freehand "Other": no. Prompts: none specified — flag if
  `Judgment Entered` should capture date/amount later.)
- Litigation → Court Correspondence: on drop, prompt for **Date of correspondence** + **Description**;
  label composed e.g. `Court Correspondence — {date} — {description}`. (Freehand "Other": no.)
- Litigation → Other Filings: titles = `Notice of Entry`, `Notice of Trial`,
  `Demand for Trial de Novo`, `Other` (**freehand**). **Freehand "Other": YES.**
- Workers' Comp: titles = `HP-1`, `HPJ-1`, `C8.1`, `C8.4`, `Rejections`, `Other` (**freehand**
  description). **Freehand "Other": YES.**

## Open / TBD
1. ✅ **Allowed-title list per terminal folder — COMPLETE (all 17).** Freehand "Other" enabled on:
   Claim Documents→Miscellaneous, Litigation→Stipulations, Litigation→Other Filings, Workers' Comp.
   Document *type/format* = whatever Clio supports (not restricted per folder); only the **title** is
   controlled.
2. **Label formats** for prompt-composed titles — proposed inline per folder (e.g.,
   `Correspondence — {date} — {description}`); finalize exact display strings at build.
3. ✅ **Intake-scan targets — DECIDED (assumed, confirm):** bulk scanning uses the **same tree + same
   drag→title-picklist** as any document; no separate scan-only folders.
4. ✅ **Duplicate titles — DECIDED.** Allowed when the entered prompt values differ (labels are
   naturally distinct). When the composed label would be **identical** (same prompt values, or a
   no-prompt title), the UI **appends a `(2)`, `(3)`, … counter** to disambiguate.
5. ✅ **Structured data capture — DECIDED.** Award outcome + amounts (principal/interest/fees/costs),
   Payment amounts (P/I or AF/Filing), and dated fields are stored as **queryable structured fields**
   (power reporting: arbitration win rate, award totals, payment totals) — not just baked into labels.
   **Payment-document amounts are METADATA ONLY** — captured for reference/reporting, **NOT posted to
   the financial ledger / balance** (real payment posting stays in the existing settlement flow; no
   double-counting).
6. `DocumentTemplate` gets a **target-folder** setting (per template) for auto-filed merged docs.

_Resolved: Stips = Stipulations. Arbitration subfolder = "Correspondence / AR1" (AR1 = A-R-1).
Workers' Comp = documents only, no subfolders. Title is a display label decoupled from the saved
filename; underlying file is a Clio-supported type (callable/savable)._
