export const ADMIN_USER_SESSION_RUNTIME_PHASE20 = "ADMIN_USER_SESSION_RUNTIME_PHASE20";

export const ADMIN_USER_IDLE_TIMEOUT_MINUTES_PHASE20 = 30;
export const ADMIN_USER_IDLE_WARNING_SECONDS_PHASE20 = 120;

export const ADMIN_USER_SESSION_COOKIE_CANDIDATES_PHASE20 = [
  "barsh_admin_gate",
  "barsh_admin_identity",
  "barsh_admin_session",
  "admin_session",
  "adminGate",
  "adminIdentity",
] as const;

export type AdminUserSessionRuntimePhase20 = {
  sessionInvalidatedAt?: Date | string | null;
  lastSignOutAt?: Date | string | null;
  lastLoginAt?: Date | string | null;
  now?: Date;
};

export function adminUserSessionInvalidatedPhase20(input: AdminUserSessionRuntimePhase20): boolean {
  const invalidatedAt = input.sessionInvalidatedAt ? new Date(input.sessionInvalidatedAt).getTime() : 0;
  const signedOutAt = input.lastSignOutAt ? new Date(input.lastSignOutAt).getTime() : 0;
  const loggedInAt = input.lastLoginAt ? new Date(input.lastLoginAt).getTime() : 0;
  return Math.max(invalidatedAt, signedOutAt) > loggedInAt;
}

export function adminUserIdleDeadlinePhase20(lastActivityAt: Date | string | null | undefined): Date | null {
  if (!lastActivityAt) return null;
  const last = new Date(lastActivityAt);
  if (Number.isNaN(last.getTime())) return null;
  return new Date(last.getTime() + ADMIN_USER_IDLE_TIMEOUT_MINUTES_PHASE20 * 60 * 1000);
}

export function adminUserIdleWarningAtPhase20(lastActivityAt: Date | string | null | undefined): Date | null {
  const deadline = adminUserIdleDeadlinePhase20(lastActivityAt);
  if (!deadline) return null;
  return new Date(deadline.getTime() - ADMIN_USER_IDLE_WARNING_SECONDS_PHASE20 * 1000);
}

export function adminUserIdleTimedOutPhase20(lastActivityAt: Date | string | null | undefined, now = new Date()): boolean {
  const deadline = adminUserIdleDeadlinePhase20(lastActivityAt);
  return Boolean(deadline && deadline.getTime() <= now.getTime());
}

export function adminUserIdleWarningDuePhase20(lastActivityAt: Date | string | null | undefined, now = new Date()): boolean {
  const warningAt = adminUserIdleWarningAtPhase20(lastActivityAt);
  const deadline = adminUserIdleDeadlinePhase20(lastActivityAt);
  return Boolean(warningAt && deadline && warningAt.getTime() <= now.getTime() && now.getTime() < deadline.getTime());
}
