# Phase 48G — Signer Profile and Addressee Source Design Proposal

## Scope

This is a docs-only design lock. It performs no database mutation, no Prisma migration, no DOCX conversion, no template field mapping, no document finalization, no Clio action, no Microsoft Graph action, no email action, no print action, and no print-queue action.

## Locked User Decisions

1. Non-login signers are allowed.
2. Signer eligibility is separately enabled, but defaults to enabled.
3. Incomplete signer profiles are allowed, but generation is blocked when the selected template requires missing signer fields.
4. Addressee source defaults come from the selected template, with workflow/context override.
5. Missing addressee data warns and requires manual completion.
6. Insurer will not differ among child matters. On lawsuit/master matters, the lawsuit matter insurer controls.
7. settled_with_contact resolves only from settlement contact data. No fallback is allowed.

## Signer Storage Decision

Signer fields should not live directly on AdminUser. AdminUser remains the auth, credential, role, permission, and lockout identity. Signer data is document-production identity and should be stored separately.

Recommended model concept:

SignerProfile fields:
- id
- adminUserId, nullable
- displayName
- signatureName
- title
- phoneExtension
- fax
- email
- signerEnabled
- status
- isDefaultForAdminUser
- sortOrder
- notes
- createdAt
- updatedAt

adminUserId should be nullable because non-login signers are allowed. Signer eligibility should be stored separately from AdminUser status and should default to enabled.

## Generate Documents Signer Default

Generate Documents should read the current session, resolve the current AdminUser.id when available, find active signer-enabled profiles linked to that user, and preselect the only/default profile. Other active signer profiles, including active non-login signers, may be selected manually. The selected signer profile ID should be passed through the document-generation request/preview contract.

## Required Signer Fields

Signer profiles may be incomplete. Validation occurs at generation time. If the selected template requires signer email, fax, title, extension, or signature name and the selected profile lacks that field, generation blocks with a clear warning. Missing fields not required by the selected template do not block generation.

## Addressee Source Types

AddresseeSourceType values:
- adversary_attorney
- insurer
- court
- settled_with_contact
- manual

The selected template controls the default addressee source. Workflow/context may override it.

## Addressee Missing Data Rule

Missing or incomplete addressee data must warn and require manual completion. The system must not silently fall back to a legally different recipient.

## Source-Specific Rules

- adversary_attorney: resolve from lawsuit/master selected adversary attorney; missing data warns and requires manual completion.
- insurer: resolve from the lawsuit matter insurer on lawsuit/master matters; Dave confirmed child insurers will not differ.
- court: resolve from lawsuit/master court reference data; missing data warns and requires manual completion.
- settled_with_contact: resolve only from settlement contact data; no fallback to insurer, adversary attorney, court, or manual blank output.
- manual: user-entered request-scoped values only unless a later save-back feature is separately approved.

## Future Implementation Boundary

Implementation requires separate approval. A future phase may add a Prisma SignerProfile model, signer admin UI, Generate Documents signer selector, addressee resolver, template metadata validation, and focused safety verifiers.
