# Templates Phase 18K — Initial Billing Letter Template-Specific Letterhead Overrides

## Scope

This phase records and verifies static letterhead overrides for the Initial Billing Letter only.

Other letterhead-based templates remain dynamic and should continue to resolve signer/contact values from the selected signer or generating user profile.

## Initial Billing Letter only

For `initial-billing-letter`, use:

- Tel: `(631) 210-7272` with no extension
- Fax: `(516) 706-5055`
- Email: `info@brlfirm.com`
- Signer/signature name: `Barshay, Rizzo & Lopez, PLLC`

## Shared asset rule

The shared `letterhead-simple` asset remains the common layout source for letterhead-based documents. This phase does not mutate that shared asset and does not make these static values the default for other templates.

## Pending dynamic behavior for other templates

Other templates should still use signer-profile values, including:

- signer extension
- signer fax
- signer email
- signer/signature display name

These dynamic fields should be collected and managed in BM user creation/profile setup before production generation wiring.

## Non-goals

This phase does not wire app/API generation, does not upload to Clio, and does not write to storage. Generated proof output remains under ignored local output.

## Phase 18L approved visual correction

After visual QA, the Initial Billing Letter contact block is locked as template-specific behavior only:

- This applies only to `initial-billing-letter`.
- The shared `templates/docx/base/letterhead-simple.docx` asset is not mutated.
- Other letterhead-based templates remain dynamic for signer extension, fax, email, and signer-specific contact fields unless separately approved.
- The right-side contact block is rendered as one compact hard-break block.
- The contact block is positioned one line lower and one tab farther right than the inherited source position.
- Approved contact text: `445 Broadhollow Road | Suite CL18`; `Melville, New York 11747`; `Tel: (631) 210-7272`; `Fax: (516) 706-5055`; `Email: info@brlfirm.com`.
- Approved signature override: `Barshay, Rizzo & Lopez, PLLC`.
