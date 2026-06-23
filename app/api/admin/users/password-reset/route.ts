import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { isAdminRequestAuthorized } from "@/lib/adminAuth";
import { createMatterAuditLogEntry } from "@/lib/auditLog";
import { prisma } from "@/lib/prisma";
import {
  generateTemporaryPassword,
  hashPasswordForPhase1,
  passwordReusesLastThree,
  updatePasswordHistory,
  validatePasswordPolicy,
} from "@/src/lib/auth/admin-user-password-security-phase1";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PasswordResetBody = {
  actorEmail?: unknown;
  targetEmail?: unknown;
  reason?: unknown;
  apply?: unknown;
};

function cleanString(value: unknown): string {
  return String(value ?? "").trim();
}

function cleanEmail(value: unknown): string {
  return cleanString(value).toLowerCase();
}

function isApplyRequested(value: unknown): boolean {
  return value === true || value === "true" || value === "apply";
}

async function requireOwnerAdminActor(actorEmail: string) {
  if (!actorEmail) return null;
  return prisma.adminUser.findFirst({
    where: {
      email: actorEmail,
      status: "active",
      roles: {
        some: {
          role: {
            key: "owner_admin",
            status: "active",
          },
        },
      },
    },
    select: {
      id: true,
      email: true,
      displayName: true,
    },
  });
}

export async function POST(req: NextRequest) {
  if (!isAdminRequestAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as PasswordResetBody;
    const actorEmail = cleanEmail(body.actorEmail);
    const targetEmail = cleanEmail(body.targetEmail);
    const reason = cleanString(body.reason);
    const apply = isApplyRequested(body.apply);

    if (!actorEmail) {
      return NextResponse.json({
        ok: false,
        action: "admin-user-password-reset",
        error: "actorEmail is required so the route can verify an active owner_admin actor before any password reset.",
        passwordExposed: false,
        passwordReturned: false,
      }, { status: 400 });
    }

    const actor = await requireOwnerAdminActor(actorEmail);
    if (!actor) {
      return NextResponse.json({
        ok: false,
        action: "admin-user-password-reset",
        error: "Active owner_admin actor required.",
        actorRoleRequired: "owner_admin",
        passwordExposed: false,
        passwordReturned: false,
      }, { status: 403 });
    }

    if (!targetEmail || !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(targetEmail)) {
      return NextResponse.json({
        ok: false,
        action: "admin-user-password-reset",
        error: "A valid targetEmail is required.",
        actorRoleRequired: "owner_admin",
        passwordExposed: false,
        passwordReturned: false,
      }, { status: 400 });
    }

    if (reason.length < 6) {
      return NextResponse.json({
        ok: false,
        action: "admin-user-password-reset",
        error: "An explicit reason of at least 6 characters is required for a password reset.",
        actorRoleRequired: "owner_admin",
        passwordExposed: false,
        passwordReturned: false,
      }, { status: 400 });
    }

    const targetUser = await prisma.adminUser.findUnique({
      where: { email: targetEmail },
      select: {
        id: true,
        email: true,
        displayName: true,
        status: true,
        passwordHash: true,
        passwordHistoryJson: true,
        notes: true,
      },
    });

    if (!targetUser) {
      return NextResponse.json({
        ok: false,
        action: "admin-user-password-reset",
        error: "Admin user not found.",
        targetEmail,
        actorRoleRequired: "owner_admin",
        passwordExposed: false,
        passwordReturned: false,
      }, { status: 404 });
    }

    if (!apply) {
      return NextResponse.json({
        ok: true,
        action: "admin-user-password-reset",
        mode: "preview",
        previewOnly: true,
        wouldReset: {
          id: targetUser.id,
          email: targetUser.email,
          displayName: targetUser.displayName,
          passwordHashWillChange: true,
          forcePasswordChangeWillBe: true,
          failedLoginCountWillReset: true,
          failedLoginLockoutWillClear: true,
          temporaryPasswordWillBeGeneratedOnApply: true,
          passwordReturnedOnlyOnApply: true,
          passwordExposed: false,
        },
        actorEmail,
        actorRoleRequired: "owner_admin",
        passwordExposed: false,
        passwordReturned: false,
        note: "Preview only. Temporary password is generated only when Apply is submitted and is returned exactly once in the apply response.",
      });
    }

    let temporaryPassword = generateTemporaryPassword();
    let policyErrors = validatePasswordPolicy(temporaryPassword);
    let guard = 0;
    while ((policyErrors.length > 0 || passwordReusesLastThree(temporaryPassword, targetUser.passwordHistoryJson)) && guard < 10) {
      temporaryPassword = generateTemporaryPassword();
      policyErrors = validatePasswordPolicy(temporaryPassword);
      guard += 1;
    }

    if (policyErrors.length > 0 || passwordReusesLastThree(temporaryPassword, targetUser.passwordHistoryJson)) {
      return NextResponse.json({
        ok: false,
        action: "admin-user-password-reset",
        error: "Could not generate a compliant non-reused temporary password.",
        passwordExposed: false,
        passwordReturned: false,
      }, { status: 500 });
    }

    const passwordHash = hashPasswordForPhase1(temporaryPassword);
    const passwordHistoryJson = updatePasswordHistory(targetUser.passwordHistoryJson, passwordHash);

    const updated = await prisma.$transaction(async (tx) => {
      const user = await tx.adminUser.update({
        where: { id: targetUser.id },
        data: {
          passwordHash,
          passwordHistoryJson,
          forcePasswordChange: true,
          passwordChangeRequired: true,
          passwordSetAt: new Date(),
          failedLoginCount: 0,
          failedLoginLockedAt: null,
          notes: targetUser.notes
            ? `${targetUser.notes}\\n[${new Date().toISOString()}] PASSWORD RESET by ${actorEmail}: ${reason}`
            : `[${new Date().toISOString()}] PASSWORD RESET by ${actorEmail}: ${reason}`,
        },
        select: {
          id: true,
          email: true,
          displayName: true,
          status: true,
          forcePasswordChange: true,
          passwordChangeRequired: true,
          passwordSetAt: true,
          failedLoginCount: true,
          failedLoginLockedAt: true,
        },
      });

      await createMatterAuditLogEntry({
        action: "admin-user-password-reset",
        summary: `Reset password for admin user ${targetUser.email}.`,
        entityType: "admin_user",
        fieldName: "AdminUser.passwordHash",
        priorValue: targetUser.passwordHash ? "[existing non-recoverable hash]" : null,
        newValue: {
          passwordHashChanged: true,
          forcePasswordChange: true,
          passwordChangeRequired: true,
          passwordHistoryUpdated: true,
          failedLoginCountReset: true,
          failedLoginLockoutCleared: true,
          temporaryPasswordStored: false,
          temporaryPasswordReturned: true,
          temporaryPasswordReturnedOnlyOnce: true,
          passwordExposedInAudit: false,
          auditContext: {
            actorEmail,
            actorId: actor.id,
            targetUserId: targetUser.id,
            targetEmail: targetUser.email,
            source: "admin-users-signer-profile-phase14",
            reason,
          },
        } as Prisma.InputJsonValue,
      });

      return user;
    });

    return NextResponse.json({
      ok: true,
      action: "admin-user-password-reset",
      mode: "apply",
      reset: {
        id: updated.id,
        email: updated.email,
        displayName: updated.displayName,
        status: updated.status,
        forcePasswordChange: updated.forcePasswordChange,
        passwordChangeRequired: updated.passwordChangeRequired,
        passwordSetAt: updated.passwordSetAt,
        failedLoginCount: updated.failedLoginCount,
        failedLoginLockedAt: updated.failedLoginLockedAt,
      },
      temporaryPassword,
      temporaryPasswordOneTimeDisplay: true,
      copyButtonRecommended: true,
      warning: "This temporary password is shown once. Copy it now; it is not stored or recoverable.",
      actorEmail,
      actorRoleRequired: "owner_admin",
      passwordHashChanged: true,
      passwordHistoryUpdated: true,
      passwordExposedInAudit: false,
      note: "Password reset complete. The temporary password was generated by the server, hashed immediately, returned once, and the user must change it at next login.",
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      action: "admin-user-password-reset",
      error: error instanceof Error ? error.message : "Admin user password reset route failed.",
      passwordExposed: false,
      passwordReturned: false,
    }, { status: 500 });
  }
}
