# Barsh Matters permission model (reworked)

Authoritative definition of permission tiers and roles. Enforcement wiring is a separate step;
this doc + the catalog/role-matrix code define WHAT each role may do. Default runtime is OFF
(no behavior change) until enforcement is wired and activated behind the kill-switch.

## Permission tiers (each catalog permission is tagged with exactly one)

1. **view** — read-only: open screens, view data, search. No changes.
2. **edit** — routine create/modify: edit matter fields, lawsuit info, draft documents,
   edit court calendar, manage reference data, print-queue actions. No money, no irreversible.
3. **process** — high-stakes operational actions (money + irreversible, bundled):
   post/void payments, settlement amounts, invoices/billing, finalize documents,
   close matters/lawsuits, void/close settlements.
4. **admin** — general administrator functions: audits, backups, reference-data admin,
   document templates, ticklers, lawsuit cleanup, claim-index rebuild, etc. Grantable
   **per-user** to Administrators.
5. **security** — manage admin users, roles, permissions, and security settings
   (`/admin/users`, `/admin/permissions` + their APIs). **Owner only.**

(If a future need arises to separate money from irreversible-close, split `process` into
`process.money` + `process.commit`. Not needed for the current roles.)

## Staff roles (cumulative ladder; 1 = most powerful)

| Rank | Role | view | edit | process | admin | security | Notes |
|:--:|------|:----:|:----:|:-------:|:-----:|:--------:|-------|
| 1 | **Owner** | ✓ | ✓ | ✓ | all | ✓ | Everything, incl. user/role/permission management + no-lockout. |
| 2 | **Administrator** | ✓ | ✓ | ✓ | granted | – | All of Full User + the admin functions granted to that user (per-user). Never security. |
| 3 | **Full User** | ✓ | ✓ | ✓ | – | – | Full non-admin app incl. payments + finalize/close. No admin, no security. |
| 4 | **Partial User** | ✓ | ✓ | – | – | – | View + routine edits/drafts only. No process, admin, or security. |
| 5 | **View Only** | ✓ | – | – | – | – | View non-admin screens only. |

(Note: `/admin/users` + `/admin/permissions` are the `security` tier — Owner only, even for
Administrators. All other `/admin/*` functions are the `admin` tier and grantable per-user.)

## Client Access (special, OFF-ladder, external)

A non-staff role for the firm's clients (providers) themselves:
- **Assigned per-provider (client).** A Client Access login is tied to one provider/client record.
- **Read-only access to ONLY that client's own matters**, for reporting.
- Cannot see other clients' matters, any admin screen, or staff functions.
- Architecturally distinct from the staff ladder: it's **row-level data scoping** (filter to the
  client's own provider), not a tier of app-wide capability. Implies external client logins and a
  restricted client/reporting view. Likely a separate phase from the staff RBAC.

## Owner-safety (non-negotiable when enforcement is wired)

- Owner bypasses all permission checks; never-block paths preserved.
- Resolver errors fail OPEN for owner, CLOSED for others.
- Single env kill-switch disables all role enforcement instantly; one-line rollback.

## Admin granularity

- `admin` tier for **Administrator** is per-user: each Administrator is granted specific admin
  functions (admin cards). Owner gets all admin. Full User / Basic User / View Only get none.

## Role keys (stable)

`owner`, `administrator`, `full_user`, `partial_user`, `view_only`, plus `client_access` (later phase)
(migrating off the prior `owner_admin` / `read_only_admin` etc.).
