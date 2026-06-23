# Templates Phase 2 — Layout Composition Metadata Schema Proposal

## Status

Locked proposal target: repository-side metadata only.

This phase is docs-only. It does not implement runtime schema validation, mutate the database, alter Prisma, edit DOCX files, convert DOCX files, map merge fields into templates, touch Clio, touch Graph, finalize documents, upload documents, or perform live document generation.

## Purpose

Templates Phase 2 defines a practical repository-side metadata shape for Barsh Matters production document templates and non-generation layout assets. The goal is to describe how a production template declares its layout asset chain, signer/addressee requirements, merge-field requirements, workflow applicability, and compatibility behavior before any runtime implementation occurs.

This proposal implements the Templates Phase 1 layout-composition decisions as metadata vocabulary.

## Core model

Barsh Matters should treat a production template as a DOCX-based generation template plus repository metadata. Layout assets are also DOCX-based repository assets, but they are non-generation assets. Layout assets are attached to production templates through metadata and must not appear as standalone Generate Documents choices.

The initial layout asset roles are:

- `cover_fax`
- `letterhead`
- `pleading_paper`

The `cover_fax` role supports two distinct modes:

- `cover_page`
- `fax_transmittal`

Invoices and remittance documents remain app-generated/code-rendered and are outside the normal document-template workflow.

## Production template metadata shape

A production template metadata file should define these top-level keys.

```json
{
  "templateId": "lawsuit-stipulation-of-settlement",
  "templateDisplayName": "Stipulation of Settlement",
  "templateKind": "lawsuit_document",
  "templateStatus": "draft",
  "generationEligible": false,
  "layoutComposition": {
    "assets": []
  },
  "requiredMergeFields": [],
  "signerRequirements": {},
  "addresseeRequirements": {},
  "workflowApplicability": {}
}
```

### `templateId`

Stable repository identifier for the production template.

Requirements:

- Must be unique within the Barsh Matters template repository.
- Should be lowercase kebab-case.
- Should not depend on a DOCX filename remaining unchanged.
- Should not encode a version number unless the entire template identity is version-specific.

### `templateDisplayName`

Human-readable name for UI display, admin review, and repository inspection.

### `templateKind`

Classifies the production template for workflow and filtering purposes.

Initial proposed values:

- `lawsuit_document`
- `direct_matter_document`
- `letter`
- `settlement_document`
- `court_document`
- `internal_admin_document`

### `templateStatus`

Repository lifecycle status.

Initial proposed values:

- `draft`
- `testing`
- `approved`
- `retired`

Meaning:

- `draft`: repository artifact exists but is not ready for generation.
- `testing`: admin/template-management testing may inspect or test the template subject to safety gates.
- `approved`: eligible for ordinary generation only if `generationEligible` is also true and required data is present.
- `retired`: retained for history but unavailable for ordinary generation.

### `generationEligible`

Boolean gate indicating whether the production template may appear as a normal Generate Documents choice.

Rules:

- Layout assets must have `generationEligible: false`.
- Imported but unfinished production templates, including the current Stipulation of Settlement, should remain `generationEligible: false` until layout adaptation, field mapping, and validation are complete.
- A template with `templateStatus: "approved"` still should not generate if `generationEligible` is false.
- A template with missing required signer, addressee, or merge-field data should be blocked even if `generationEligible` is true.

## `layoutComposition`

`layoutComposition` defines the ordered chain of layout assets attached to a production template.

```json
{
  "layoutComposition": {
    "assets": [
      {
        "role": "letterhead",
        "assetId": "letterhead-simple",
        "assetKind": "docx_layout_asset",
        "mode": null,
        "versionPolicy": "latest_approved",
        "pinnedVersion": null,
        "order": 10,
        "flowAfterAsset": "same_page_continuation",
        "pageNumberingPolicy": "template_specific",
        "relationshipToOtherAssets": {
          "mayCombineWith": ["pleading_paper"],
          "notes": "Template-specific metadata decides whether letterhead and pleading paper are combined."
        },
        "duplicateRolePolicy": {
          "allowed": false,
          "exceptionReason": null
        },
        "compatibilityPolicy": {
          "ordinaryUserBehavior": "block",
          "adminTestingBehavior": "warn"
        }
      }
    ]
  }
}
```

### `assets`

Ordered array of non-generation layout assets.

Rules:

- A production template may attach, omit, order, and compose layout assets.
- A production template may not override individual internal layout asset settings at this stage.
- Layout settings remain controlled by the layout asset itself.
- The chain order should be explicit and stable.

### `role`

Layout asset role.

Allowed initial values:

- `cover_fax`
- `letterhead`
- `pleading_paper`

### `assetId`

Stable identifier for the layout asset.

Examples:

- `letterhead-simple`
- `pleading-paper`
- `simple-cover-fax-default`

### `assetKind`

Initial proposed value:

- `docx_layout_asset`

This makes clear that the asset is repository-backed and DOCX-based but is not a standalone generation template.

### `mode`

Mode is required when role is `cover_fax`.

Allowed `cover_fax` modes:

- `cover_page`
- `fax_transmittal`

For non-cover/fax assets, `mode` may be `null` or omitted, depending on the final implementation schema.

Rules:

- Fax-specific fields are part of the cover/fax standard.
- Fax-specific fields are required only when `mode` is `fax_transmittal`.
- A generic default simple cover/fax asset may support both modes if its own asset metadata allows it.
- A production template may define or reference a template-specific cover/fax page when needed.

### `versionPolicy`

Controls layout asset version resolution.

Allowed values:

- `latest_approved`
- `pinned`

Rules:

- `latest_approved` is the default.
- `pinned` is available for production templates that require a specific approved layout asset version.
- Version policy applies to the asset reference, not to internal asset settings overrides.

### `pinnedVersion`

Specific layout asset version when `versionPolicy` is `pinned`.

Rules:

- Required when `versionPolicy` is `pinned`.
- Must be null or omitted when `versionPolicy` is `latest_approved`.
- Should identify a repository-approved asset version, not an arbitrary working file.

### `order`

Numeric order within the layout composition chain.

Rules:

- Lower numbers apply earlier.
- Suggested spacing is by tens, such as 10, 20, 30, to allow later insertion.
- The order must be deterministic.

### `flowAfterAsset`

Defines whether the next content segment begins on a new page, continues on the same page, or requires section-specific handling.

Allowed values:

- `new_page`
- `same_page_continuation`
- `section_specific`

Rules:

- Template-specific metadata decides new-page versus same-page continuation.
- `section_specific` should be used only when a template requires more granular handling that cannot be captured at the whole-asset level.

### `pageNumberingPolicy`

Defines how page numbering treats cover/fax assets and body content.

Allowed values:

- `include_cover_in_total_and_show_number`
- `include_cover_in_total_but_hide_number`
- `exclude_cover_and_start_body_at_one`
- `template_specific`

Rules:

- Metadata decides cover/fax page numbering.
- `template_specific` is allowed where a production template requires more nuanced page-number behavior.
- Page-numbering policy should be explicit when a `cover_fax` asset is attached.

### `relationshipToOtherAssets`

Documents expected composition behavior with other layout roles.

Suggested fields:

```json
{
  "mayCombineWith": ["letterhead", "pleading_paper"],
  "mustNotCombineWith": [],
  "notes": "Template-specific metadata decides whether letterhead and pleading paper are both used."
}
```

Rules:

- Some production templates may require letterhead plus pleading paper.
- Some production templates may require a cover/fax page plus letterhead or pleading paper.
- The metadata should state relationship intent rather than relying on filename assumptions.

### `duplicateRolePolicy`

Controls duplicate layout roles within the same production template.

Default:

```json
{
  "allowed": false,
  "exceptionReason": null
}
```

Rules:

- Duplicate layout roles are blocked by default.
- Any exception must be explicit in metadata.
- Any exception must include a non-empty reason.
- Exception metadata should be rare and should identify why two assets with the same role are required.

### `compatibilityPolicy`

Controls behavior when the asset chain is invalid, incompatible, incomplete, or internally contradictory.

Suggested shape:

```json
{
  "ordinaryUserBehavior": "block",
  "adminTestingBehavior": "warn"
}
```

Rules:

- ordinary users are blocked on invalid or incompatible layout composition.
- admin/template-management testing may allow warnings during repository testing.
- Admin warnings are for testing only and should not silently approve ordinary generation.

## No-overrides rule

At this stage, production templates may not override individual internal layout asset settings.

Allowed:

- attach asset
- omit asset
- order asset
- choose asset role
- choose cover/fax mode
- choose version policy
- pin approved version
- define flow policy
- define page-numbering policy
- declare compatibility behavior
- declare duplicate-role exception with reason

Not allowed:

- overriding margins inside a layout asset
- overriding header/footer internals inside a layout asset
- overriding logo placement inside a layout asset
- overriding pleading-paper line numbering inside a layout asset
- overriding cover/fax asset internal text placement
- overriding asset-owned section settings through production template metadata

If a production template needs different internal layout settings, the repository should define a new or versioned layout asset rather than permitting ad hoc production-template overrides.

## Required merge fields

`requiredMergeFields` declares fields that must be resolved before generation.

```json
{
  "requiredMergeFields": [
    {
      "fieldKey": "matter.patient.fullName",
      "requiredWhen": "always",
      "missingBehavior": "block",
      "source": "matter"
    },
    {
      "fieldKey": "coverFax.recipientFaxNumber",
      "requiredWhen": "layoutComposition.assets[role=cover_fax].mode=fax_transmittal",
      "missingBehavior": "block",
      "source": "cover_fax"
    }
  ]
}
```

Rules:

- Merge fields must eventually cover all visible Barsh Matters UI fields and all non-viewable/internal fields in already-created DB tables.
- Missing required data blocks generation.
- Missing addressee data warns and requires manual completion where addressee requirements apply.
- Fax-specific fields are required only when the selected cover/fax mode is `fax_transmittal`.

## Signer requirements

`signerRequirements` declares signer eligibility and required signer profile fields.

```json
{
  "signerRequirements": {
    "required": true,
    "defaultSignerSource": "current_user",
    "allowNonLoginSigners": true,
    "eligibleByDefault": true,
    "requiredProfileFields": [
      "displayName",
      "title",
      "email",
      "faxNumber",
      "extension"
    ],
    "missingRequiredFieldBehavior": "block"
  }
}
```

Rules:

- Non-login signers are allowed.
- Signer eligibility is separately enabled but defaults to enabled.
- Incomplete signer profiles are allowed in the repository/system.
- Generation is blocked when the selected production template requires missing signer fields.
- The signer should default to the user generating the document unless template/workflow metadata says otherwise.
- Other eligible signers should be selectable where the workflow permits.

## Addressee requirements

`addresseeRequirements` declares default addressee source behavior and missing-data handling.

```json
{
  "addresseeRequirements": {
    "required": true,
    "defaultSourceType": "adversary_attorney",
    "allowWorkflowOverride": true,
    "missingDataBehavior": "warn_and_require_manual_completion",
    "allowedSourceTypes": [
      "adversary_attorney",
      "insurer",
      "court",
      "settled_with_contact"
    ]
  }
}
```

Rules:

- Addressee source defaults come from the selected template.
- Workflow/context may override the template default where permitted.
- Missing addressee data warns and requires manual completion.
- Addressee source types may include adversary attorney, insurer, court, or settled-with contact.
- settled_with_contact resolves only from settlement contact data and has no silent fallback.
- On lawsuit/master matters, the lawsuit matter insurer controls because insurer will not differ among children.

## Workflow applicability

`workflowApplicability` defines where a production template is available.

```json
{
  "workflowApplicability": {
    "matterScopes": ["lawsuit"],
    "caseTypes": ["NF"],
    "requiredMatterStatus": ["Open"],
    "allowedEntryPoints": ["generate_documents"],
    "excludedEntryPoints": ["invoice_remittance"]
  }
}
```

Rules:

- Production templates should declare direct matter, lawsuit/master matter, or other workflow scope.
- Invoice/remittance workflows remain excluded from normal document-template generation.
- Workflow applicability should not bypass `generationEligible`, required merge fields, signer requirements, addressee requirements, or compatibility validation.

## Layout asset metadata shape

Layout assets should have their own repository metadata. They remain non-generation assets.

```json
{
  "assetId": "letterhead-simple",
  "assetDisplayName": "Simple Letterhead",
  "assetKind": "docx_layout_asset",
  "assetRole": "letterhead",
  "assetStatus": "approved",
  "generationEligible": false,
  "version": "1.0.0",
  "approved": true,
  "supportedModes": [],
  "ownedSettings": {
    "headers": true,
    "footers": true,
    "margins": true,
    "sectionSettings": true
  }
}
```

Rules:

- Layout assets are DOCX-based.
- Layout assets are non-generation assets.
- Layout assets control their own internal settings.
- Production templates may compose layout assets but may not override layout asset internals.
- Cover/fax layout assets should declare supported modes.
- Letterhead and pleading-paper assets generally do not require modes.

## Future UI/readout fields

The eventual admin/template-management UI should expose metadata in read-only or repository-sourced form.

Useful readout fields:

- visible asset chain
- asset role
- asset display name
- asset kind
- mode
- asset version policy
- resolved asset version
- pinned asset version
- page-numbering policy
- flow policy
- duplicate-role policy
- duplicate-role exception reason
- compatibility warnings
- blocked reasons
- required missing fields
- missing signer fields
- missing addressee fields
- ordinary-user generation eligibility
- admin-testing warning state

Editing should remain repository-first for now. The UI may eventually display the metadata and validation results, but repository metadata remains the source of truth unless a later phase approves database-backed template management.

## Example: Stipulation of Settlement draft metadata

The imported lawsuit Stipulation of Settlement is repository-backed but not final. It still requires layout adaptation and field mapping.

```json
{
  "templateId": "lawsuit-stipulation-of-settlement",
  "templateDisplayName": "Stipulation of Settlement",
  "templateKind": "settlement_document",
  "templateStatus": "draft",
  "generationEligible": false,
  "layoutComposition": {
    "assets": [
      {
        "role": "letterhead",
        "assetId": "letterhead-simple",
        "assetKind": "docx_layout_asset",
        "mode": null,
        "versionPolicy": "latest_approved",
        "pinnedVersion": null,
        "order": 10,
        "flowAfterAsset": "same_page_continuation",
        "pageNumberingPolicy": "template_specific",
        "relationshipToOtherAssets": {
          "mayCombineWith": ["pleading_paper"],
          "mustNotCombineWith": [],
          "notes": "Template-specific metadata decides final layout composition."
        },
        "duplicateRolePolicy": {
          "allowed": false,
          "exceptionReason": null
        },
        "compatibilityPolicy": {
          "ordinaryUserBehavior": "block",
          "adminTestingBehavior": "warn"
        }
      }
    ]
  },
  "requiredMergeFields": [],
  "signerRequirements": {
    "required": true,
    "defaultSignerSource": "current_user",
    "allowNonLoginSigners": true,
    "eligibleByDefault": true,
    "requiredProfileFields": [],
    "missingRequiredFieldBehavior": "block"
  },
  "addresseeRequirements": {
    "required": false,
    "defaultSourceType": null,
    "allowWorkflowOverride": true,
    "missingDataBehavior": "warn_and_require_manual_completion",
    "allowedSourceTypes": [
      "adversary_attorney",
      "insurer",
      "court",
      "settled_with_contact"
    ]
  },
  "workflowApplicability": {
    "matterScopes": ["lawsuit"],
    "caseTypes": [],
    "requiredMatterStatus": [],
    "allowedEntryPoints": ["generate_documents"],
    "excludedEntryPoints": ["invoice_remittance"]
  }
}
```

## Phase 2 non-goals

This phase does not:

- implement runtime schema validation
- mutate the database
- alter Prisma
- edit DOCX files
- convert DOCX files
- map fields into templates
- create template-management UI
- expose layout assets as generation choices
- generate invoices or remittance documents through templates
- touch Clio
- touch Graph
- finalize documents
- upload documents
- perform live document generation

## Phase 2 lock criteria

This phase is ready to lock when:

1. The Phase 1 layout-composition decisions verifier passes.
2. This Phase 2 proposal document exists and includes the required schema vocabulary.
3. The Phase 2 verifier confirms the required metadata categories and safety prohibitions.
4. TypeScript no-emit passes.
5. The git diff is limited to this docs-only proposal and its focused verifier.
