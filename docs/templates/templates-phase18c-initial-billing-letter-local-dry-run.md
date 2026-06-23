# Templates Phase 18C - Initial Billing Letter Local Dry-Run for BRL_202600003

This phase runs a local dry-run only for the Initial Billing Letter against individual Barsh Matter `BRL_202600003`.

The dry-run reads `public.ClaimIndex` by `display_number` and resolves insurer mailing address data from `public.ReferenceEntity.details._hiddenImportFields`.

No generated output is committed.

## Non-goals

- No Clio calls.
- No storage calls.
- No matter mutation.
- No production generation wiring.
- No broad template readiness work.

## Expected resolved values

- `matter.fileNumber` -> `BRL_202600003`
- `provider.name` -> `ATLANTIC MEDICAL & DIAGNOSTIC, P.C.`
- `patient.name` -> `David Barshay`
- `insurer.name` -> `Allstate Indemnity Company`
- `insurer.mailingAddress` -> `3100 Sanders Road, Suite 201` plus `Northbrook, Illinois 60062`
- `claim.number` -> `1111`
- `claim.amount` -> `$836.75`
- `claim.dosRange` -> `02/03/2021`

## Dry-run output rule

The generated local proof must not contain any legacy chevron tokens such as `<<NOWDT>>`, `<<CASE_ID>>`, or `<<PROVIDER_SUITNAME>>`.


## Hidden-field merge-source requirement

Hidden import/reference fields are valid template source fields and must be mappable.

For this dry-run, `insurer.mailingAddress` resolves from:

- `ReferenceEntity.details._hiddenImportFields.hidden_street`
- `ReferenceEntity.details._hiddenImportFields.hidden_city`
- `ReferenceEntity.details._hiddenImportFields.hidden_state`
- `ReferenceEntity.details._hiddenImportFields.hidden_zipcode`

A later hidden-field mapping contract phase should make all hidden fields from all relevant tables discoverable and mappable as template merge sources.

