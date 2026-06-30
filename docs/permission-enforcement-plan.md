# Permission enforcement — current state + activation plan

Status: PLANNING. Nothing in here is implemented yet. No enforcement behavior changes
until the decisions below are made and a safe, reviewed change is applied.

## 1. What already exists (read-only findings)

Three layers are built, but **request-time enforcement is not wired** — the only thing
actually gating access today is the blanket **owner-only** admin gate in `proxy.ts`
(owner email or `owner_admin` role gets into all of `/admin` + `/api/admin`; everyone else
is fully blocked). Non-admin app pages (matters, lawsuits, documents, etc.) are not gated by
role at all right now.

### Layer A — App-wide permission catalog (`lib/admin-permissions/catalog.ts`)
28 permissions across 8 groups (Administrator, Matters, Lawsuits, Documents, Settlements,
Court Calendar, Print Queue, Claim Index/Search). Each permission carries:
- `routeScopes` (URLs it governs) and `functionScopes` (named actions),
- a **risk level**: `view` | `edit` | `financial` | `destructive` | `administrative`,
- an `enforcementStatus`: only `admin.access` is `enforced-currently` (the owner-only gate);
  everything else is `planned-not-enforced`.

### Layer B — Static role→permission matrix (`lib/admin-permissions/roleMatrix.ts`)
Marked `planning-only`. Configures **two** roles:
- `owner_admin` → **allow** everything.
- `read_only_admin` → **allow** the 7 `view`-level permissions
  (matters/lawsuits/documents/settlements/courtCalendar/printQueue view + claimIndex.search);
  **block** the 21 `edit`/`financial`/`destructive`/`administrative` permissions
  (all create/edit/close/post/void/generate/finalize/manage/admin actions).
Other role keys appear in the DB (`billing_admin`, `operations_admin`, `full_user`,
`view_only`) but are **not configured** in the matrix (`not-configured`).

### Layer C — DB RBAC schema (`prisma`)
`AdminUser`, `AdminRole`, `AdminRolePermission`, `AdminUserRole`, `AdminUserPermissionOverride`
exist — a full per-user, per-role grant model with per-user overrides.

### Layer D — Env-override global model (`lib/adminPermissions.ts`, Phase 20/21)
A SEPARATE, transitional, admin-pages-only model: a global block-list via
`BARSH_ADMIN_PERMISSION_OVERRIDES_JSON`, gated by `BARSH_ADMIN_PERMISSIONS_ENFORCEMENT(_ENABLED)`.
It is a **dry-run/simulator only** — `adminPermissionEnforcementDecision()` is called only by
the `/api/admin/permissions/check` simulator endpoint, never to actually block a request.
Includes good lockout safety: never-block paths (`/admin`, `/admin/permissions`,
`/api/admin/permissions*`), default-allow for unmapped routes, and an env kill-switch.

## 2. The gap

The catalog + matrix + DB define *what each role may do*, and the gate cookie already carries
`identity.roleKeys`, but **no resolver maps (role → catalog permission → requested route/function)
at request time**, and nothing calls it to allow/deny. So "enforcement" today = "owner-only admin
gate"; the view/edit/financial/destructive distinctions are defined but inert.

## 3. Proposed architecture (to review)

1. **Resolver** `resolveAccess(roleKeys, pathname, method, functionScope?)` → allow/block, using
   the role matrix + catalog `routeScopes`/`functionScopes`, plus per-user overrides
   (`AdminUserPermissionOverride`). Owner = always allow.
2. **Wire it in** at:
   - the **proxy** (coarse: page + API access by URL), and/or
   - **per-route guards** / **server actions** (fine: function-level, e.g. block
     `documents.finalize` while allowing `documents.view`),
   - and the **UI** (hide/disable controls a role can't use — UX, not security).
3. **Owner safety (non-negotiable):** `owner_admin`/owner-email bypasses everything;
   never-block paths preserved; resolver errors **fail open for owner, closed for others**;
   single env kill-switch to disable all role enforcement instantly; rollback documented.
4. **Source of truth:** drive from the **static matrix** (simple, in-code, 2 roles) OR the
   **DB grants** (richer: all roles + per-user overrides, editable without deploy). Pick one as
   authoritative for v1.
5. **Rollout:** behind a flag, default off → seed/confirm grants → test with a `read_only_admin`
   user (Jane Doe) while owner keeps full access → enable → watch → keep rollback ready.
6. **Reconcile guard proofs:** `verify-admin-users-phase4/phase7-*` currently assert enforcement
   stays OFF and the gate is the strict `=== "1"` form; `permission-enforcement-engine-safety`
   wants the proxy wired. These will be updated to match the activated design.

## 3b. Confirmed role model (5 roles) — supersedes the 2-role matrix in code

The current `roleMatrix.ts` only configures `owner_admin` + `read_only_admin`. The actual model
is FIVE roles (must rebuild the matrix to these). Risk tiers: `view` is the open baseline;
`edit` / `financial` / `destructive` / `administrative` are the four restricted tiers.

- **Owner** — everything; full system + all admin cards + user/security controls; no-lockout.
- **Administrator** — everything outside Admin (all non-admin view/edit/financial/destructive);
  admin access limited to the specific admin-card grants selected for the role.
- **Full User** — full non-admin app access incl. payments (view/edit/financial/destructive);
  no admin screen.
- **Basic User** — full non-admin app access EXCEPT payment / billing / payment-status
  (i.e. blocked from `financial` tier); no admin screen. (Confirm whether `destructive`
  non-payment actions like close/finalize are allowed.)
- **View Only** — view-only on non-admin screens; no create/edit/delete/upload/finalize/
  payment/admin (only the `view` tier).

Open sub-decisions: (a) Basic User's `destructive` access; (b) how Administrator admin-card
grants are chosen (per-role default vs per-user); (c) stable role keys
(owner / administrator / full_user / basic_user / view_only) and migrating off the current
`owner_admin` / `read_only_admin` / etc. keys.

D2 = enforce all five of the above.

## 4. Decisions needed before building

- **D1. Scope:** admin pages only, or app-wide (also enforce matters/lawsuits/documents/
  settlements view-vs-edit for non-admin users)? The catalog is built for app-wide.
- **D2. Roles for v1:** just `owner_admin` + `read_only_admin` (matrix-ready), or also
  `billing_admin` / `operations_admin` / `full_user` / `view_only` (need grants defined)?
- **D3. Source of truth:** static code matrix vs DB grants (see 3.4).
- **D4. Permission categories:** the catalog tags each permission with a risk level — currently
  FIVE (`view`, `edit`, `financial`, `destructive`, `administrative`). (User mentioned "4
  categories" — confirm the intended set / how administrative folds in.)
- **D5. Enforcement point:** proxy-only (coarse) vs proxy + per-route/function guards (fine).
- **D6. Test user + rollback:** confirm the `read_only_admin` test account and the exact
  kill-switch/rollback before any activation.
