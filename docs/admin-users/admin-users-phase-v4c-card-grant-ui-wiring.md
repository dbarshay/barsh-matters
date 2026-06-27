# Admin Users Phase V4C - Administrator Card Grant UI Wiring

Status: UI wiring only.

This phase wires the Admin Users edit-panel Admin-card checkboxes to `/api/admin/users/card-grants`.

Safety guarantees:

- The card-grant route from Phase V4B remains the only persistence route.
- Users can preview before applying.
- Save uses the guarded route requiring owner_admin actor and administrator target.
- Owner users remain all-cards and do not use per-card grants.
- Runtime permission enforcement remains disabled.
- Session behavior is unchanged.
- No role assignment/removal behavior is changed.
- No user creation/deletion behavior is changed.

Next phase: smoke-test assigning Administrator to a test user, saving selected Admin-card grants, and confirming planning read model reflects the saved grants.
