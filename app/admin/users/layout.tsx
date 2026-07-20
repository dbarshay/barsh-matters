import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_IDENTITY_COOKIE_NAME, readSignedAdminIdentityCookie } from "@/lib/adminAuth";

// Owner-only gate for the Admin Users page. Enforced server-side before the page renders:
// only a session whose signed identity cookie carries the owner_admin role (or the configured
// owner email) may view this segment; everyone else is redirected to /admin. The signed
// identity cookie is only issued by the real username/password + 2FA login, so a generic
// legacy admin session (no bound identity) is denied here by design.
const OWNER_ADMIN_EMAIL = (process.env.BARSH_OWNER_ADMIN_EMAIL || "dbarshay@brlfirm.com").trim().toLowerCase();

export default async function AdminUsersOwnerOnlyLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const identity = readSignedAdminIdentityCookie(cookieStore.get(ADMIN_IDENTITY_COOKIE_NAME)?.value);
  const roleKeys = Array.isArray(identity?.roleKeys) ? identity.roleKeys : [];
  const isOwner =
    Boolean(identity) &&
    (identity!.email === OWNER_ADMIN_EMAIL || roleKeys.includes("owner_admin") || roleKeys.includes("owner"));

  if (!isOwner) {
    redirect("/admin");
  }

  return <>{children}</>;
}
