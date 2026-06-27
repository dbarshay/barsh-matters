# Admin Users Data Update - Delete Jane Doe and Assign Tara Luisi Administrator

Status: guarded one-time DB data update.

Requested changes:

- Delete `jane.doe.limited@example.com` as an AdminUser.
- Assign Tara Luisi the `administrator` role.

Safety guarantees:

- Owner remains protected.
- Jane is only deleted if she is not owner_admin and not bootstrapSafe.
- Tara is only changed if exactly one Tara Luisi AdminUser is found.
- Tara is not modified if she is owner_admin or bootstrapSafe.
- Runtime permission enforcement remains disabled.
- Session behavior is unchanged.
- Passwords and 2FA are unchanged.
- Clio, documents, email, and print queue are unchanged.
