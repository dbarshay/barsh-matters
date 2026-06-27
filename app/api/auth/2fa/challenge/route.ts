import { NextRequest, NextResponse } from "next/server";
import { createMatterAuditLogEntry } from "@/lib/auditLog";
import { isAdminRequestAuthorized } from "@/lib/adminAuth";
import { prisma } from "@/lib/prisma";
import {
  ADMIN_USER_TWO_FACTOR_RUNTIME_PHASE21,
  adminUserTwoFactorRequiredPhase21,
  buildTwoFactorChallengeDataPhase21,
} from "@/src/lib/auth/admin-user-two-factor-runtime-phase21";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TwoFactorChallengeBody = {
  email?: unknown;
  setupVerification?: unknown;
};

function cleanString(value: unknown): string {
  return String(value ?? "").trim();
}

function cleanEmail(value: unknown): string {
  return cleanString(value).toLowerCase();
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as TwoFactorChallengeBody;
    const email = cleanEmail(body.email);
    const setupVerification = body.setupVerification === true;
    if (setupVerification && !isAdminRequestAuthorized(req)) {
      return NextResponse.json({ ok: false, action: "admin-user-2fa-challenge", error: "Administrator session required for setup verification." }, { status: 403 });
    }
    if (!email) {
      return NextResponse.json({ ok: false, action: "admin-user-2fa-challenge", error: "Email is required." }, { status: 400 });
    }

    const user = await prisma.adminUser.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        status: true,
        locked: true,
        inactive: true,
        twoFactorPhone: true,
        twoFactorPhoneMasked: true,
        twoFactorDisabled: true,
        twoFactorPendingSetup: true,
      },
    });

    if (!user || user.status !== "active" || user.locked || user.inactive) {
      return NextResponse.json({ ok: false, action: "admin-user-2fa-challenge", error: "Active admin user required." }, { status: 403 });
    }

    if (!adminUserTwoFactorRequiredPhase21(user)) {
      return NextResponse.json({
        ok: true,
        action: "admin-user-2fa-challenge",
        twoFactorRequired: false,
        twoFactorDisabled: Boolean(user.twoFactorDisabled),
        twoFactorPendingSetup: Boolean(user.twoFactorPendingSetup),
        source: ADMIN_USER_TWO_FACTOR_RUNTIME_PHASE21,
      });
    }

    const challenge = buildTwoFactorChallengeDataPhase21(user.email, user.twoFactorPhone);
    const updated = await prisma.adminUser.update({
      where: { id: user.id },
      data: challenge.data,
      select: {
        id: true,
        email: true,
        twoFactorPhoneMasked: true,
        twoFactorChallengeExpiresAt: true,
      },
    });

    await createMatterAuditLogEntry({
      action: "admin-user-2fa-challenge-created",
      summary: `2FA challenge created for admin user ${user.email}.`,
      entityType: "admin_user",
      fieldName: "AdminUser.twoFactorChallengeHash",
      priorValue: null,
      newValue: {
        targetUserId: user.id,
        email: user.email,
        twoFactorRequired: true,
        codeStoredPlaintext: false,
        codeReturned: false,
        deliveryPendingExternalSms: true,
        source: ADMIN_USER_TWO_FACTOR_RUNTIME_PHASE21,
      },
    });

    return NextResponse.json({
      ok: true,
      action: "admin-user-2fa-challenge",
      twoFactorRequired: true,
      setupVerification,
      deliveryPendingExternalSms: !setupVerification,
      codeReturned: setupVerification,
      setupVerificationCode: setupVerification ? challenge.code : null,
      maskedPhone: updated.twoFactorPhoneMasked,
      expiresAt: updated.twoFactorChallengeExpiresAt,
      source: ADMIN_USER_TWO_FACTOR_RUNTIME_PHASE21,
      note: setupVerification
        ? "Setup verification code is returned only for owner-admin setup verification before SMS delivery is wired."
        : "2FA code was not returned; external SMS delivery remains pending.",
    });
  } catch (error) {
    return NextResponse.json({ ok: false, action: "admin-user-2fa-challenge", error: error instanceof Error ? error.message : "2FA challenge route failed." }, { status: 500 });
  }
}
