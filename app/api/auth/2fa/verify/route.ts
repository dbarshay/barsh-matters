import { NextRequest, NextResponse } from "next/server";
import { createMatterAuditLogEntry } from "@/lib/auditLog";
import { isAdminRequestAuthorized, setAdminGateCookie, setAdminIdentityCookie } from "@/lib/adminAuth";
import { prisma } from "@/lib/prisma";
import {
  ADMIN_USER_TWO_FACTOR_RUNTIME_PHASE21,
  buildTwoFactorChallengeClearDataPhase21,
  buildTwoFactorFailedAttemptDataPhase21,
  hashTwoFactorCodePhase21,
  twoFactorChallengeExpiredPhase21,
  twoFactorChallengeLockedPhase21,
} from "@/src/lib/auth/admin-user-two-factor-runtime-phase21";
import {
  checkVerification,
  matchesOwnerBreakGlass,
  twilioVerifyEnabled,
} from "@/src/lib/auth/twilio-verify-2fa";
import { readTwoFactorPendingToken, TWO_FACTOR_PENDING_COOKIE } from "@/src/lib/auth/two-factor-pending";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Configurable owner email (defaults to the live owner). Break-glass also requires the owner role
// key, so this email match is a redundant fail-safe, not the sole owner check.
const OWNER_ADMIN_EMAIL = (process.env.BARSH_OWNER_ADMIN_EMAIL || "dbarshay@brlfirm.com").trim().toLowerCase();

type TwoFactorVerifyBody = {
  email?: unknown;
  code?: unknown;
  returnTo?: unknown;
  setupVerification?: unknown;
};

function cleanString(value: unknown): string {
  return String(value ?? "").trim();
}

function cleanEmail(value: unknown): string {
  return cleanString(value).toLowerCase();
}

function safeReturnTo(value: unknown): string {
  const candidate = cleanString(value);
  return candidate.startsWith("/") ? candidate : "/admin";
}

// ---------------------------------------------------------------------------------------------
// Setup verification (unchanged Phase 21 behavior): the admin/users 2FA setup panel verifies a
// newly-entered phone using the hash-based challenge created by /api/auth/2fa/challenge. This does
// NOT sign anyone in; it only flips twoFactorPendingSetup off. Kept intact for that flow.
// ---------------------------------------------------------------------------------------------
async function handleSetupVerification(req: NextRequest, email: string, code: string) {
  if (!isAdminRequestAuthorized(req)) {
    return NextResponse.json({ ok: false, action: "admin-user-2fa-verify", error: "Administrator session required for setup verification." }, { status: 403 });
  }
  const user = await prisma.adminUser.findUnique({
    where: { email },
    select: {
      id: true, email: true, status: true, locked: true, inactive: true,
      twoFactorDisabled: true, twoFactorChallengeHash: true, twoFactorChallengeExpiresAt: true,
      twoFactorChallengeAttempts: true, twoFactorChallengeLockedAt: true, twoFactorPendingSetup: true,
    },
  });
  if (!user || user.status !== "active" || user.locked || user.inactive) {
    return NextResponse.json({ ok: false, action: "admin-user-2fa-verify", error: "Active admin user required." }, { status: 403 });
  }
  if (!user.twoFactorChallengeHash) {
    return NextResponse.json({ ok: false, action: "admin-user-2fa-verify", error: "No active 2FA challenge." }, { status: 400 });
  }
  if (twoFactorChallengeExpiredPhase21(user.twoFactorChallengeExpiresAt)) {
    return NextResponse.json({ ok: false, action: "admin-user-2fa-verify", error: "2FA challenge expired." }, { status: 400 });
  }
  if (twoFactorChallengeLockedPhase21(user.twoFactorChallengeAttempts, user.twoFactorChallengeLockedAt)) {
    return NextResponse.json({ ok: false, action: "admin-user-2fa-verify", error: "2FA challenge locked." }, { status: 423 });
  }
  if (hashTwoFactorCodePhase21(user.email, code) !== user.twoFactorChallengeHash) {
    await prisma.adminUser.update({ where: { id: user.id }, data: buildTwoFactorFailedAttemptDataPhase21(user.twoFactorChallengeAttempts) });
    return NextResponse.json({ ok: false, action: "admin-user-2fa-verify", error: "Invalid 2FA code." }, { status: 403 });
  }
  const updated = await prisma.adminUser.update({
    where: { id: user.id },
    data: { ...buildTwoFactorChallengeClearDataPhase21(), twoFactorPendingSetup: false, twoFactorDisabled: false, twoFactorConfiguredAt: new Date(), twoFactorMethod: "sms" },
    select: { id: true, email: true, twoFactorPendingSetup: true, twoFactorDisabled: true, twoFactorConfiguredAt: true, twoFactorMethod: true },
  });
  await createMatterAuditLogEntry({
    action: "admin-user-2fa-verified", summary: `2FA setup verified for admin user ${user.email}.`,
    entityType: "admin_user", fieldName: "AdminUser.twoFactorChallengeHash", priorValue: "[existing challenge hash]",
    newValue: { targetUserId: user.id, email: user.email, setupVerification: true, codeStoredPlaintext: false, source: ADMIN_USER_TWO_FACTOR_RUNTIME_PHASE21 },
  });
  return NextResponse.json({ ok: true, action: "admin-user-2fa-verify", user: updated, twoFactorVerified: true, setupVerification: true, source: ADMIN_USER_TWO_FACTOR_RUNTIME_PHASE21 });
}

// ---------------------------------------------------------------------------------------------
// Login completion (Twilio Verify): reached with a valid "2FA-pending" cookie proving the password
// step passed. Checks the code with Twilio Verify OR the Owner break-glass code, then sets the real
// session (gate + identity) cookies and clears the pending cookie.
// ---------------------------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as TwoFactorVerifyBody;
    const code = cleanString(body.code);
    const setupVerification = body.setupVerification === true;

    if (setupVerification) {
      const email = cleanEmail(body.email);
      if (!email || !code) {
        return NextResponse.json({ ok: false, action: "admin-user-2fa-verify", error: "Email and code are required." }, { status: 400 });
      }
      return handleSetupVerification(req, email, code);
    }

    // --- Login completion ---
    const pending = readTwoFactorPendingToken(req.cookies.get(TWO_FACTOR_PENDING_COOKIE)?.value);
    if (!pending) {
      return NextResponse.json({ ok: false, action: "auth-2fa-verify", authenticated: false, error: "Your verification session expired. Please sign in again." }, { status: 401 });
    }
    if (!code) {
      return NextResponse.json({ ok: false, action: "auth-2fa-verify", authenticated: false, error: "Enter the verification code." }, { status: 400 });
    }

    const user = await prisma.adminUser.findUnique({
      where: { email: pending.email },
      select: {
        id: true, email: true, username: true, status: true, locked: true, inactive: true,
        twoFactorPhone: true, twoFactorDisabled: true,
        roles: { select: { role: { select: { key: true, status: true } } } },
        permissionOverrides: { where: { action: "grant" }, select: { permissionKey: true } },
      },
    });

    if (!user || user.id !== pending.userId || user.status !== "active" || user.locked || user.inactive) {
      return NextResponse.json({ ok: false, action: "auth-2fa-verify", authenticated: false, error: "Active admin user required. Please sign in again." }, { status: 403 });
    }

    const roleKeys = user.roles.map((r) => (r.role?.status === "active" ? r.role.key : "")).filter(Boolean);
    const grantedAdminPermissionKeys = user.permissionOverrides.map((o) => o.permissionKey).filter(Boolean);
    const isOwner = user.email === OWNER_ADMIN_EMAIL || roleKeys.includes("owner_admin") || roleKeys.includes("owner");

    // Owner break-glass first (env-only recovery). Only ever true for the Owner.
    const brokeGlass = matchesOwnerBreakGlass({ isOwner, code });

    if (!brokeGlass) {
      if (!twilioVerifyEnabled()) {
        return NextResponse.json({ ok: false, action: "auth-2fa-verify", authenticated: false, error: "Two-factor verification is unavailable. Contact the Owner." }, { status: 503 });
      }
      const check = await checkVerification(cleanString(user.twoFactorPhone), code);
      if (!check.ok || !check.approved) {
        await createMatterAuditLogEntry({
          action: "auth-2fa-code-rejected", summary: `2FA code rejected for admin user ${user.email}.`,
          entityType: "admin_user", fieldName: "AdminUser.twoFactor", priorValue: null,
          newValue: { targetUserId: user.id, email: user.email, approved: false, codeStoredPlaintext: false, source: "TWILIO_VERIFY_2FA" },
        });
        return NextResponse.json({ ok: false, action: "auth-2fa-verify", authenticated: false, error: "Incorrect or expired code. Try again." }, { status: 403 });
      }
    }

    // Success: create the real session.
    const identityCookieInput = { id: user.id, email: user.email, username: user.username, roleKeys, grantedAdminPermissionKeys };
    const response = NextResponse.json({
      ok: true,
      action: "auth-2fa-verify",
      authenticated: true,
      authorized: true,
      twoFactorVerified: true,
      recoveryUsed: brokeGlass,
      returnTo: safeReturnTo(body.returnTo),
      user: { id: user.id, email: user.email, username: user.username, roleKeys },
    });
    setAdminGateCookie(response, identityCookieInput);
    setAdminIdentityCookie(response, identityCookieInput);
    response.cookies.set(TWO_FACTOR_PENDING_COOKIE, "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 });

    await createMatterAuditLogEntry({
      action: brokeGlass ? "auth-2fa-owner-break-glass-used" : "auth-2fa-verified",
      summary: brokeGlass ? `Owner break-glass recovery used to sign in ${user.email}.` : `2FA verified; session created for ${user.email}.`,
      entityType: "admin_user", fieldName: "AdminUser.twoFactor", priorValue: null,
      newValue: { targetUserId: user.id, email: user.email, twoFactorVerified: true, recoveryUsed: brokeGlass, codeStoredPlaintext: false, source: "TWILIO_VERIFY_2FA" },
    });

    return response;
  } catch (error) {
    return NextResponse.json({ ok: false, action: "auth-2fa-verify", authenticated: false, error: error instanceof Error ? error.message : "2FA verify route failed." }, { status: 500 });
  }
}
