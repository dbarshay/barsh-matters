// Per-user mailbox model. The email workflow is user-specific: each logged-in user works their OWN
// BRL Outlook mailbox (their account email). There is NO shared firm mailbox. Interactive routes derive
// the mailbox from the signed session identity; background sync/webhooks enumerate active users.

import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { adminSessionIdentityDiagnostics } from "@/lib/adminAuth";

function clean(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/** The logged-in user's own mailbox address (their account email), or "" when the session is unbound. */
export function getRequestUserMailbox(req: NextRequest): string {
  try {
    return clean(adminSessionIdentityDiagnostics(req)?.email).toLowerCase();
  } catch {
    return "";
  }
}

/** Every active user's mailbox — the set of mailboxes to sync + subscribe. Grows as users are added. */
export async function listActiveUserMailboxes(): Promise<string[]> {
  try {
    const users = await (prisma as any).adminUser.findMany({
      where: { status: "active" },
      select: { email: true },
    });
    const set = new Set<string>();
    for (const u of users) {
      const email = clean(u?.email).toLowerCase();
      if (email.includes("@")) set.add(email);
    }
    return Array.from(set);
  } catch {
    return [];
  }
}
