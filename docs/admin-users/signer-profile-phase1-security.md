# Admin Users / Signer Profile Phase 1 — Security and Signer Profiles

This phase adds additive user-profile, signer/contact, password-security, failed-login, 2FA scaffolding, signout, idle-timeout, and verification coverage.

## Scope locks

- This phase is implemented through the existing Users admin area.
- This phase does not change DOCX templates.
- This phase does not alter the approved Initial Billing Letter Phase 18L behavior.
- This phase does not wire production document-generation signer validation.

## Signer completeness

Signer completeness is derived from the current admin user profile. Required Phase 1 signer fields are display name, email, phone extension, fax number, and signature block name. The Users admin table may show only Complete or Missing Fields. Specific missing fields belong in the edit form.

## Password security

Password setup/reset stores hashes only. Temporary passwords are one-time display values for the owner/admin reset modal. Password history blocks reuse of the last three passwords on all password-setting paths.

Passwords and 2FA codes must never be logged in plaintext or otherwise exposed in audit entries, routine diagnostics, or verifier output.

## 2FA

Phase 1 supports SMS/text-message 2FA scaffolding and guards. A live SMS provider may be wired only if a reliable provider/config path already exists. 2FA phone numbers are separate from signer phone extension and must be masked in routine audit display.

## Idle timeout

Idle timeout is 30 minutes with a warning 2 minutes before timeout. The warning modal must use the standard Barsh Matters modal style, with Stay Signed In and Sign Out Now actions.

## Initial Billing Letter static override bypass

The Initial Billing Letter has an approved static signer/contact override bypass for Phase 18K/18L only:

- Tel: (631) 210-7272
- Fax: (516) 706-5055
- Email: info@brlfirm.com
- Signature: Barshay, Rizzo & Lopez, PLLC

Future templates may use static signer/contact overrides only when expressly approved for that specific template.
