# Admin Users Phase W8 - Enforcement Kill-Switch Scaffold

Status: scaffold only.

This phase adds the permission-decision helper and kill-switch contract for future enforcement planning.

No runtime enforcement is enabled.
No route imports or calls this helper.
No UI hiding is enabled.
No backend route blocking is enabled.
No database changes are made.
No session mode is changed.

The kill-switch variable is:

`BARSH_ADMIN_USERS_PERMISSION_ENFORCEMENT=1`

Even when the helper sees the kill-switch as enabled, Phase W8 returns dry-run decisions only and sets `routeBlockingActive: false`.

Future enforcement must not wire this helper into routes until a later phase adds:
- owner no-lockout tests,
- rollback instructions,
- route-level proof,
- production kill-switch proof,
- controlled smoke testing.
