import { createHash, randomInt } from "node:crypto";

export const ADMIN_USER_TWO_FACTOR_RUNTIME_PHASE21 = "ADMIN_USER_TWO_FACTOR_RUNTIME_PHASE21";
export const ADMIN_USER_TWO_FACTOR_CODE_LENGTH_PHASE21 = 6;
export const ADMIN_USER_TWO_FACTOR_CHALLENGE_MINUTES_PHASE21 = 10;
export const ADMIN_USER_TWO_FACTOR_MAX_ATTEMPTS_PHASE21 = 5;

export type AdminUserTwoFactorSubjectPhase21 = {
  id: string;
  email: string;
  twoFactorPhone?: string | null;
  twoFactorPhoneMasked?: string | null;
  twoFactorDisabled?: boolean | null;
  twoFactorPendingSetup?: boolean | null;
  twoFactorChallengeHash?: string | null;
  twoFactorChallengeExpiresAt?: Date | string | null;
  twoFactorChallengeAttempts?: number | null;
  twoFactorChallengeLockedAt?: Date | string | null;
};

export function adminUserTwoFactorRequiredPhase21(user: AdminUserTwoFactorSubjectPhase21 | null | undefined): boolean {
  if (!user) return false;
  if (user.twoFactorDisabled) return false;
  if (!user.twoFactorPhone && !user.twoFactorPhoneMasked) return false;
  return true;
}

export function maskTwoFactorPhonePhase21(phone: string | null | undefined): string | null {
  const digits = String(phone ?? "").replace(/\\D/g, "");
  if (!digits) return null;
  const last4 = digits.slice(-4);
  return `***-***-${last4}`;
}

export function generateTwoFactorCodePhase21(): string {
  const max = 10 ** ADMIN_USER_TWO_FACTOR_CODE_LENGTH_PHASE21;
  return String(randomInt(0, max)).padStart(ADMIN_USER_TWO_FACTOR_CODE_LENGTH_PHASE21, "0");
}

export function hashTwoFactorCodePhase21(email: string, code: string): string {
  return createHash("sha256").update(`${String(email).toLowerCase()}:${code}`).digest("hex");
}

export function twoFactorChallengeExpiresAtPhase21(now = new Date()): Date {
  return new Date(now.getTime() + ADMIN_USER_TWO_FACTOR_CHALLENGE_MINUTES_PHASE21 * 60 * 1000);
}

export function twoFactorChallengeExpiredPhase21(expiresAt: Date | string | null | undefined, now = new Date()): boolean {
  if (!expiresAt) return true;
  const expires = new Date(expiresAt);
  return Number.isNaN(expires.getTime()) || expires.getTime() <= now.getTime();
}

export function twoFactorChallengeLockedPhase21(attempts: number | null | undefined, lockedAt: Date | string | null | undefined): boolean {
  if (lockedAt) return true;
  return Number(attempts || 0) >= ADMIN_USER_TWO_FACTOR_MAX_ATTEMPTS_PHASE21;
}

export function buildTwoFactorChallengeDataPhase21(email: string, phone: string | null | undefined) {
  const code = generateTwoFactorCodePhase21();
  return {
    code,
    data: {
      twoFactorPhoneMasked: maskTwoFactorPhonePhase21(phone),
      twoFactorPendingSetup: false,
      twoFactorChallengeHash: hashTwoFactorCodePhase21(email, code),
      twoFactorChallengeExpiresAt: twoFactorChallengeExpiresAtPhase21(),
      twoFactorChallengeAttempts: 0,
      twoFactorChallengeLockedAt: null,
    },
  };
}

export function buildTwoFactorChallengeClearDataPhase21() {
  return {
    twoFactorChallengeHash: null,
    twoFactorChallengeExpiresAt: null,
    twoFactorChallengeAttempts: 0,
    twoFactorChallengeLockedAt: null,
  };
}

export function buildTwoFactorFailedAttemptDataPhase21(currentAttempts: number | null | undefined) {
  const nextAttempts = Number(currentAttempts || 0) + 1;
  return {
    twoFactorChallengeAttempts: nextAttempts,
    twoFactorChallengeLockedAt: nextAttempts >= ADMIN_USER_TWO_FACTOR_MAX_ATTEMPTS_PHASE21 ? new Date() : null,
  };
}
