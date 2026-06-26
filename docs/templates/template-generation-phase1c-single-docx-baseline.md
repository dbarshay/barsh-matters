# Template Generation Phase 1C — Initial Billing Letter Single-DOCX Baseline

## Scope

This phase resets Template Generation Phase 1 to a fresh single-document path for `initial-billing-letter` only.

The old layout-asset architecture is removed from the active repo path. Barsh Matters is not using the prior `letterhead-simple`, pleading-paper, or layout-composition architecture for this fresh generation track.

## Preserved

- `templates/docx/letters/initial-billing-letter.docx` remains the selected single DOCX source.
- The current Template Builder canonical merge-field library remains intact.
- Multiline address-block tokens remain canonical:
  - `{{insurer.fullAddressBlock}}`
  - `{{adversary.fullAddressBlock}}`
- No legacy-token compatibility layer is added.

## Removed / decommissioned

- Layout-composition admin validation page/API.
- Layout-composition validator/report/runtime registry files.
- Stale layout-composition docs/fixtures/verifiers.
- Stale letterhead/pleading layout-asset import and verification scripts.
- Stale package scripts that invoked the old layout-composition and letterhead/pleading asset architecture.

## Next phase

Template Generation Phase 1D should inspect the single Initial Billing Letter DOCX and add the smallest safe canonical-token render path for `BRL_202600001` only. It should not restore layout assets, should not add multiple templates, and should not add legacy-token compatibility.
