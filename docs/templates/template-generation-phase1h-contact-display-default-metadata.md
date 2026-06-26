# Template Generation Phase 1H — Template Contact-Display Default Metadata

## Purpose

Template creation must record which contact display mode should be shown by default when a user generates that template.

This is a template-level default only. It does not lock the signer and does not prevent choosing another eligible signer.

## Metadata field

```ts
type TemplateContactDisplayDefault = "signer" | "firm";
```

Recommended metadata property:

```ts
defaultContactDisplayMode: TemplateContactDisplayDefault
```

## Meaning

- `signer`: default generation view shows selected-signer contact information.
- `firm`: default generation view shows firm/general contact information.

## Signer-selection rule

- The selected signer defaults to the signed-in generating user.
- The user may choose any other eligible signer.
- Other eligible signers remain available regardless of the template default contact-display mode.
- `{{signer.*}}` tokens always resolve from the selected signer, not necessarily the signed-in user.

## Canonical selected-signer tokens

- `{{signer.email}}` resolves from selectedSigner.email.
- `{{signer.fax}}` resolves from selectedSigner.faxNumber.
- `{{signer.extension}}` resolves from selectedSigner.phoneExtension.
- `{{signer.displayName}}` resolves from selectedSigner.displayName.
- `{{signer.signatureName}}` resolves from selectedSigner.signatureBlockName.

## Firm-contact mode

`firm` mode controls the default display/contact presentation shown in the Generate Documents flow. It does not change the meaning of `{{signer.*}}` tokens. If a DOCX contains signer tokens, those tokens still resolve from the selected signer.

## Explicitly out of scope

This phase does not:

- mutate any DOCX file;
- import a DOCX into the database;
- upload to Clio;
- call Microsoft Graph;
- print or queue documents;
- implement production document generation;
- build legacy-token compatibility;
- remove the eligible signer selector.

## Future implementation notes

When template creation is wired, the Create Template UI should include a required field:

```text
Default generation contact display:
( ) Signer contact
( ) Firm contact
```

Suggested helper text:

> Choose what the user sees by default when generating this template. Eligible signers remain selectable.

Suggested option descriptions:

- Signer contact: Use the selected signer’s email, fax, extension, and signature profile by default.
- Firm contact: Use the firm’s general contact information by default, while still allowing the user to select an eligible signer.

## Phase 1H exact verification locks

- {{signer.*}} tokens always resolve from the selected signer.
- This phase does not mutate any DOCX file.
- This phase does not import a DOCX into the database.
