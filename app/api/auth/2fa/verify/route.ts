import { NextRequest, NextResponse } from "next/server";
import { createMatterAuditLogEntry } from "@/lib/auditLog";
import { prisma } from "@/lib/prisma";
import {
  ADMIN_USER_TWO_FACTOR_RUNTIME_PHASE21,
  buildTwoFactorChallengeClearDataPhase21,
  buildTwoFactorFailedAttemptDataPhase21,
  hashTwoFactorCodePhase21,
  twoFactorChallengeExpiredPhase21,
  twoFactorChallengeLockedPhase21,
} from "@/src/lib/auth/admin-user-two-factor-runtime-phase21";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TwoFactorVerifyBody = {
  email?: unknown;
  code?: unknown;
};

function cleanString(value: unknown): string {
  return String(value ?? "").trim();
}

function cleanEmail(value: unknown): string {
  return cleanString(value).toLowerCase();
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as TwoFactorVerifyBody;
    const email = cleanEmail(body.email);
    const code = cleanString(body.code);
    if (!email || !code) {
      return NextResponse.json({ ok: false, action: "admin-user-2fa-verify", error: "Email and code are required." }, { status: 400 });
    }

    const user = await prisma.adminUser.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        status: true,
        locked: true,
        inactive: true,
        twoFactorDisabled: true,
        twoFactorChallengeHash: true,
        twoFactorChallengeExpiresAt: true,
        twoFactorChallengeAttempts: true,
        twoFactorChallengeLockedAt: true,
      },
    });

    if (!user || user.status !== "active" || user.locked || user.inactive) {
      return NextResponse.json({ ok: false, action: "admin-user-2fa-verify", error: "Active admin user required." }, { status: 403 });
    }
    if (user.twoFactorDisabled) {
      return NextResponse.json({ ok: true, action: "admin-user-2fa-verify", twoFactorVerified: true, twoFactorDisabled: true, source: ADMIN_USER_TWO_FACTOR_RUNTIME_PHASE21 });
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

    const expectedHash = hashTwoFactorCodePhase21(user.email, code);
    if (expectedHash !== user.twoFactorChallengeHash) {
      await prisma.adminUser.update({
        where: { id: user.id },
        data: buildTwoFactorFailedAttemptDataPhase21(user.twoFactorChallengeAttempts),
      });
      return NextResponse.json({ ok: false, action: "admin-user-2fa-verify", error: "Invalid 2FA code.", codeStoredPlaintext: false }, { status: 403 });
    }

    const updated = await prisma.adminUser.update({
      where: { id: user.id },
      data: buildTwoFactorChallengeClearDataPhase21(),
      select: { id: true, email: true },
    });

    await createMatterAuditLogEntry({
      action: "admin-user-2fa-verified",
      summary: `2FA verified for admin user ${user.email}.`,
      entityType: "admin_user",
      fieldName: "AdminUser.twoFactorChallengeHash",
      priorValue: "[existing non-recoverable challenge hash]",
      newValue: {
        targetUserId: user.id,
        email: user.email,
        twoFactorVerified: true,
        codeStoredPlaintext: false,
        codeReturned: false,
        source: ADMIN_USER_TWO_FACTOR_RUNTIME_PHASE21,
      },
    });

    return NextResponse.json({ ok: true, action: "admin-user-2fa-verify", user: updated, twoFactorVerified: true, codeStoredPlaintext: false, source: ADMIN_USER_TWO_FACTOR_RUNTIME_PHASE21 });
  } catch (error) {
    return NextResponse.json({ ok: false, action: "admin-user-2fa-verify", error: error instanceof Error ? error.message : "2FA verify route failed." }, { status: 500 });
  }
}
