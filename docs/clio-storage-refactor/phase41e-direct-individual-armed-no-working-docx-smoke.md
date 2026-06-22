# Phase 41E — Direct/Individual Finalize Armed No-Working-DOCX Smoke Lock

## Purpose

Phase 41E is a no-upload armed-path lock for the future direct/individual finalized-document upload path.

It proves that even when the future direct/individual finalize path is conceptually armed, the path must stop before upload unless a saved working DOCX exists for the Barsh Matters direct/individual matter.

## Scope

Phase 41E does not upload documents, create Clio folders, delete Clio folders, mutate the database, start a local server, call Clio, call Microsoft Graph, or change production environment variables.

## Current lock result

At this lock point, the actual `/api/documents/finalize` route still has no direct/individual target-input branch. That means direct/individual live upload remains blocked before any working-DOCX, Graph conversion, Clio upload, or DB finalization operation can occur.

If the route is later wired for direct/individual finalization, the armed path must still require a saved working DOCX before it can proceed to PDF conversion or upload.

## Intended future armed target input

When direct/individual finalization is later wired, the direct target input remains:

```ts
{
  storageTargetKind: "individual_matter",
  directMatterFileNumber: "BRL_YYYYNNNNN",
  bmMatterId: "BRL_YYYYNNNNN",
  displayNumber: "BRL_YYYYNNNNN"
}
```

## Required future no-working-DOCX behavior

A future armed direct/individual finalize request must stop before upload when no saved working DOCX exists.

The failure must occur before:

- Microsoft Graph PDF conversion.
- Clio document upload.
- Clio folder creation.
- DocumentFinalization DB record creation.
- Any movement of existing direct matter documents.

## Safety requirements

Phase 41E preserves:

- Clio is storage only.
- Barsh Matters owns and assigns file numbers and lawsuit numbers.
- Direct/individual file numbers use `BRL_YYYYNNNNN`.
- Lawsuit/master numbers use `YYYY.MM.NNNNN`.
- No patient/provider/insurer/claim/denial facts in Clio folder names.
- Existing direct matter documents are not automatically moved when later aggregated into a lawsuit.
- No hard-coded direct live folder IDs in the finalize route.
- Lawsuit finalize flow remains unchanged.
- Direct live upload remains disabled until direct target wiring and explicit upload/folder/live controls are intentionally enabled.
