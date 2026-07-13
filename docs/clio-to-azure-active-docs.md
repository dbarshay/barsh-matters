# Scope: Replace Clio with Azure Blob for active document storage

**Goal:** make Azure Blob the document backend for Barsh Matters, and remove Clio entirely. There are
**no existing Clio documents to migrate**, no export, and — critically — **BM is not live yet.** So there is
NO cutover, NO dual-write, and NO parallel run: just build Azure as the backend from the start and treat Clio
as if it never existed. Storage cost ≈ **$1,200/yr**, replacing Clio's per-seat platform fee.

Clio is used *only* as a document locker + versioning (verified in code: `/api/v4/documents`,
`document_versions`, and a single Master-Repository `matters` entry — no billing, trust, calendar, or tasks).
So retiring it unwinds nothing but document storage.

---

## The interface we're replacing (small, in `lib/clioDocumentUpload.ts`)

- `uploadBufferToClioMatterDocuments(...)` — upload a file to a matter's folder. **~9 call sites**
  (document generation/finalize, print queue, email attachments, manual upload).
- `listClioMatterDocuments(matterId)` / `listClioFolderDocuments(...)` — list a matter's docs. **~15 call sites.**
- `findExistingClioDocumentsByFilename(...)` — dedup by name.
- `lib/clioStoragePlan.ts` — computes the folder path (Individual Matters / range / matter number).

Note: Clio's upload already works like Azure under the hood — it returns a `put_url` you PUT bytes to (S3).
So this is swapping one blob store for one **you own**, not a paradigm change.

## Already built & reusable (from the LawSpades→Azure work)

Azure Blob store, short-lived **SAS-link serving**, per-user **access logging** (`legacy_doc_access_log`),
the **storage-plan** pattern, and the dedicated-DB manifest approach. The active-docs feature is a
generalization of these.

---

## What to build (the delta)

1. **Active-documents registry (Prisma model, app DB).** Replaces Clio's document index:
   `matterId, folder, fileName, blobKey, contentType, byteSize, version, createdBy, createdAt`.
   Versioning lives here (Clio was doing `document_versions`). Normal Prisma model — operational data BM owns.
2. **`lib/azureDocumentStore.ts`** — three functions mirroring Clio's signatures so call sites barely change:
   - `uploadBuffer({ matterId, fileName, buffer, contentType, folder })` → blob path from an Azure storage
     plan, insert registry row, bump `version` on same-name re-upload. Returns the doc record.
   - `listMatterDocuments(matterId)` → query the registry, return the same shape callers expect from Clio.
   - `openDocument(docId)` → SAS URL (reuse `lib/legacyDocs.ts` serving code).
3. **Swap the ~24 call sites to the Azure store** and delete the Clio calls. A thin `lib/documentStore.ts`
   facade is still worth it (one import for all callers, easy to test) — but no backend *flag* is needed since
   there's nothing to fall back to. Clio wiring gets removed, not toggled.
4. **Adapt the tricky flows** — document generation, finalize, print-queue, and email-attachment paths
   assume Clio's response shape (folder IDs, `put_url`). Each needs per-flow adaptation + testing. **This is
   the bulk of the work**, not the storage itself.
5. **Azure storage plan for active docs** — folder pathing (mirror `clioStoragePlan.ts`; can reuse the
   Individual-Matters/range/matter-number layout, or simplify).

## The gating work — DR / ops (what Clio quietly provided)

Active client documents are business-critical AND changing daily; losing them is a malpractice event.
Before cutting Clio:

- [ ] **Geo-redundant storage (GRS / RA-GRS)** for the active-docs container — a second-region copy.
      (The legacy archive can stay LRS; active docs cannot.)
- [ ] **Blob versioning enabled** on the account (replaces Clio's `document_versions`).
- [ ] **Tested restore** — prove you can recover a matter's documents, not just "we have backups."
- [ ] **BAA with Microsoft**, private container (no public access), access controls, audit log (built),
      breach-response plan.
- [ ] Optional: lifecycle policy to tier truly-old active docs to Cool.

## Rollout (BM is pre-launch — no transition needed)

Because nothing is live, this is a straight build, not a migration:
1. Build the Azure store + registry + serving; stand up DR (GRS + versioning).
2. Swap the ~24 call sites to Azure; remove the Clio document code and OAuth wiring.
3. Test the flows end-to-end on a scratch matter (generate → finalize → print queue → email attach → open).
4. Cancel Clio.

No dual-write, no parallel run, no cutover drill against live data — those are only for migrating a
production system, which this isn't. (Do still run the restore drill once as a launch-readiness check.)

---

## Effort (rough)

- Azure store + registry + serving ≈ the legacy build → **a few focused days.**
- Call-site swap + generation/finalize/print-queue/email adaptation + testing → **~1–1.5 weeks** (the bulk).
- DR setup + restore drill → **1–2 days.**
- Total **~2–3 weeks of focused build.** No parallel-run overhead since BM isn't live.

## Cost

- Storage/ops ≈ **$1,200/yr** on GRS at active-doc volumes (low TB), replacing Clio's per-seat fee.

## Biggest risks

1. Generation/finalize/print flows silently depending on Clio behavior → mitigated by thorough end-to-end
   testing on a scratch matter before launch (cheap, since nothing is live).
2. Under-building DR — active client docs demand geo-redundancy + a tested restore, full stop.

## Decision owner

This is a compliance/malpractice call for the firm, not purely technical. Loop in whoever owns malpractice
coverage (some carriers care where client files live) and confirm Clio's contract export/termination terms.
