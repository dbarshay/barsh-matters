# Phase 41G — Direct/Individual Finalize Target-Input Guarded Wiring Lock

## Purpose

Phase 41G wires the direct/individual target-input construction in `/api/documents/finalize` without enabling direct/individual upload by default.

This phase keeps direct/individual finalized-document upload blocked unless an explicit direct-target-input flag is enabled later.

## Scope

Phase 41G does not upload documents, create Clio folders, delete Clio folders, mutate the database, start a local server, call Clio, call Microsoft Graph, or change production environment variables.

## New default-off guard

The route must reject direct/individual target-input construction unless:

```text
CLIO_DIRECT_INDIVIDUAL_FINALIZE_TARGET_INPUT_ENABLED=1
```

This guard is separate from the existing single-master folder/live upload controls.

## Locked direct target input

When the guard is explicitly enabled later, the direct/individual target input must be built only from the Barsh Matters direct matter file number:

```ts
{
  storageTargetKind: "individual_matter",
  directMatterFileNumber: "BRL_YYYYNNNNN",
  bmMatterId: "BRL_YYYYNNNNN",
  displayNumber: "BRL_YYYYNNNNN"
}
```

The direct matter file number must match:

```text
BRL_YYYYNNNNN
```

## Safety requirements

Phase 41G preserves:

- Clio is storage only.
- Barsh Matters owns and assigns file numbers and lawsuit numbers.
- Direct/individual file numbers use `BRL_YYYYNNNNN`.
- Lawsuit/master numbers use `YYYY.MM.NNNNN`.
- No patient/provider/insurer/claim/denial facts in Clio folder names.
- Existing direct matter documents are not automatically moved when later aggregated into a lawsuit.
- Lawsuit finalize flow remains unchanged.
- Direct/individual upload is not enabled merely by this route-target-input patch.
- The finalize route must not hard-code known direct live folder IDs.
