# Templates Phase 3 — Layout Composition Metadata Validator Design

## Status

Design-only lock. This phase defines the validator contract for template layout composition metadata. It does not implement runtime document generation, DOCX assembly, PDF conversion, upload, or Clio interaction.

## Locked context

Templates Phase 2 locked the layout-composition metadata schema proposal. Phase 3 defines the validator design on top of that schema.

Layout assets are composable non-generation assets, not mutually exclusive single wrappers.

Canonical layout asset roles:

- `letterhead`
- `pleadingPaper`
- `simpleCoverFaxPage`

The user-facing phrase is **simple cover/fax page**. Locked metadata must not use the obsolete phrase “simple cover page.”

## Composition combinations

A production template may require any of the following:

- letterhead only
- pleading paper only
- simple cover/fax page only
- letterhead plus pleading paper
- letterhead plus simple cover/fax page
- pleading paper plus simple cover/fax page
- letterhead plus pleading paper plus simple cover/fax page
- no layout asset, where expressly permitted by template type

## Validator purpose

The validator should prevent invalid or ambiguous template metadata from reaching document-generation workflows.

The validator must answer:

1. whether the declared layout composition is structurally valid;
2. whether all referenced layout assets are known, active, and compatible with the template;
3. whether required merge-field dependencies are declared by the template/workflow context; and
4. whether the composition is deterministic enough to generate the same output repeatedly.

## Validation levels

### 1. Shape validation

Required checks:

- `layoutComposition` must exist unless the template kind is expressly exempt.
- `mode` must be `none`, `single`, or `composed`.
- `assets` must be an array.
- `mode: none` must have zero assets.
- `mode: single` must have exactly one asset.
- `mode: composed` must have two or more assets.
- every asset must have a canonical role.
- every asset must have a non-empty asset key.
- every asset must declare whether it is required.
- every asset must declare where it applies, such as cover only, first page, body only, or all pages.
- every asset must declare its merge-field policy.

### 2. Registry validation

Required checks:

- every asset key must resolve in the layout asset registry.
- inactive assets are rejected unless the validator is running in archived/historical mode.
- the registry role must match the declared role.
- duplicate roles are prohibited unless a later explicit multi-asset rule permits them.
- duplicate asset keys are prohibited.
- the selected composition must be allowed by the composition-rule registry.
- output order must reference only selected roles.
- output order must include every selected role exactly once when supplied.

Default deterministic output ordering:

1. `simpleCoverFaxPage`
2. `letterhead`
3. `pleadingPaper`

This order is for deterministic validation/generation only. It does not mean every asset is physically stacked on every page.

### 3. Dependency validation

Required checks:

- layout-required merge fields must exist in merge-field definitions.
- template-required merge fields must not conflict with layout-required merge fields.
- signer fields must be declared when letterhead requires signer-specific extension, fax, email, or signature data.
- addressee fields must be declared when a letterhead or letter template requires addressee data.
- Re: fields must be declared when the selected letterhead or letter template requires a Re: section.
- court and caption fields must be declared when pleading paper requires caption/court metadata.
- simple cover/fax page fields must be declared when the selected asset requires fax cover metadata.
- incomplete signer profiles are allowed at profile-storage time, but generation must be blocked if a selected template requires missing signer fields.

## Canonical role rules

Accepted role values:

- `letterhead`
- `pleadingPaper`
- `simpleCoverFaxPage`

Rejected aliases:

- `simpleCoverPage`
- `coverPage`
- `faxCover`
- `pleading`
- `pleadingTemplate`

Aliases may be handled by a future migration helper, but locked template metadata should reject them.

## Result model

The validator should return structured findings.

Recommended result concepts:

- `ok`
- `errors`
- `warnings`
- `normalizedComposition`

Finding fields should include:

- `code`
- `severity`
- `templateId`
- `role`
- `assetKey`
- `message`

## Blocking error categories

The following should be blocking errors:

- missing layout composition metadata;
- invalid mode;
- invalid or obsolete role name;
- unresolved asset key;
- inactive selected asset;
- role/asset mismatch;
- duplicate role;
- duplicate asset key;
- disallowed composition;
- non-deterministic output order;
- missing signer fields required by selected letterhead;
- missing addressee fields required by selected letterhead/letter template;
- missing Re: fields required by selected letterhead/letter template;
- missing court/caption fields required by selected pleading paper;
- missing fax-cover fields required by selected simple cover/fax page.

## Warning categories

The following may be warnings:

- output order omitted but default ordering can be applied;
- optional selected asset has missing optional merge fields;
- template kind permits no layout asset but none is declared;
- archived/historical validation references an inactive asset intentionally.

## Design acceptance criteria

Phase 3 is complete when this repository contains:

1. this validator design document;
2. a verifier proving the locked terminology and validation categories are present;
3. no runtime generation changes;
4. no Clio interaction changes; and
5. a clean sync/commit/tag/push proof.

## Implementation guardrail

A future implementation phase should add the validator as a pure function first, with fixture-driven tests. It should not be wired into production generation until after the validator behavior is locked independently.
