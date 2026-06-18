import { NextRequest, NextResponse } from "next/server";
import * as bcrypt from "bcryptjs";
import { adminSessionIdentityDiagnostics, isAdminRequestAuthorized } from "@/lib/adminAuth";
import { createMatterAuditLogEntry } from "@/lib/auditLog";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cleanString(value: unknown): string {
  return String(value ?? "").trim();
}

function passwordPolicyErrors(password: string): string[] {
  const errors: string[] = [];
  if (password.length < 10) errors.push("Password must be at least 10 characters.");
  if (!/[A-Z]/.test(password)) errors.push("Password must include at least one uppercase letter.");
  if (!/[a-z]/.test(password)) errors.push("Password must include at least one lowercase letter.");
  if (!/[0-9]/.test(password)) errors.push("Password must include at least one number.");
  if (!/[^A-Za-z0-9]/.test(password)) errors.push("Password must include at least one symbol.");
  return errors;
}

export async function POST(req: NextRequest) {
  try {
    if (!isAdminRequestAuthorized(req)) {
      return NextResponse.json(
        {
          ok: false,
          action: "auth-change-password",
          error: "Authenticated administrator session required.",
          passwordExposed: false,
          impersonationEnabled: false,
          enforcementChanged: false,
        },
        { status: 401 }
      );
    }

    const identity = adminSessionIdentityDiagnostics(req);
    if (!identity.identityBound || !identity.id || !identity.email) {
      return NextResponse.json(
        {
          ok: false,
          action: "auth-change-password",
          error: "A signed AdminUser identity session is required to change password.",
          identityBound: false,
          passwordExposed: false,
          impersonationEnabled: false,
          enforcementChanged: false,
        },
        { status: 409 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const currentPassword = cleanString(body?.currentPassword);
    const newPassword = cleanString(body?.newPassword);
    const confirmPassword = cleanString(body?.confirmPassword);

    if (!currentPassword) {
      return NextResponse.json({ ok: false, action: "auth-change-password", error: "Current temporary/current password is required.", passwordExposed: false, impersonationEnabled: false, enforcementChanged: false }, { status: 400 });
    }

    if (!newPassword || newPassword !== confirmPassword) {
      return NextResponse.json({ ok: false, action: "auth-change-password", error: "New password and confirmation must match.", passwordExposed: false, impersonationEnabled: false, enforcementChanged: false }, { status: 400 });
    }

    const policyErrors = passwordPolicyErrors(newPassword);
    if (policyErrors.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          action: "auth-change-password",
          error: "New password does not meet the Phase 12D password policy.",
          passwordPolicyErrors: policyErrors,
          policy: {
            minimumLength: 10,
            requiresUppercase: true,
            requiresLowercase: true,
            requiresNumber: true,
            requiresSymbol: true,
          },
          passwordExposed: false,
          impersonationEnabled: false,
          enforcementChanged: false,
        },
        { status: 400 }
      );
    }

    const user = await prisma.adminUser.findUnique({ where: { id: identity.id } });
    if (!user || user.email !== identity.email || user.status !== "active") {
      return NextResponse.json(
        {
          ok: false,
          action: "auth-change-password",
          error: "Active AdminUser identity could not be verified.",
          passwordExposed: false,
          impersonationEnabled: false,
          enforcementChanged: false,
        },
        { status: 403 }
      );
    }

    if (!user.passwordHash) {
      return NextResponse.json(
        {
          ok: false,
          action: "auth-change-password",
          error: "This AdminUser does not have a password hash yet. Use owner password reset tools first.",
          passwordExposed: false,
          impersonationEnabled: false,
          enforcementChanged: false,
        },
        { status: 409 }
      );
    }

    const currentMatches = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!currentMatches) {
      return NextResponse.json(
        {
          ok: false,
          action: "auth-change-password",
          error: "Current password is incorrect.",
          passwordExposed: false,
          impersonationEnabled: false,
          enforcementChanged: false,
        },
        { status: 403 }
      );
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    const updated = await prisma.$transaction(async (tx) => {
      const changed = await tx.adminUser.update({
        where: { id: user.id },
        data: {
          passwordHash,
          passwordSetAt: new Date(),
          passwordChangeRequired: false,
          failedLoginCount: 0,
          lastFailedLoginAt: null,
        },
      });

      await createMatterAuditLogEntry({
        action: "admin-user-change-own-password",
        summary: `Admin user ${user.email} changed their own password.`,
        entityType: "admin_user",
        fieldName: "AdminUser.passwordHash",
        priorValue: "[existing non-recoverable hash]",
        newValue: "[new non-recoverable hash]",
        details: {
          route: "/api/auth/change-password",
          userId: user.id,
          email: user.email,
          passwordChangeRequiredCleared: true,
          passwordExposed: false,
          passwordReturned: false,
          impersonationEnabled: false,
          enforcementChanged: false,
        },
        sourcePage: "/change-password",
        workflow: "admin-users-phase13a",
        actorName: user.displayName || "Administrator",
        actorEmail: user.email,
      });

      return changed;
    });

    return NextResponse.json({
      ok: true,
      action: "auth-change-password",
      user: {
        id: updated.id,
        email: updated.email,
        username: updated.username,
        passwordChangeRequired: updated.passwordChangeRequired,
      },
      passwordChanged: true,
      passwordExposed: false,
      passwordReturned: false,
      impersonationEnabled: false,
      enforcementChanged: false,
      note: "Password changed. Only the bcrypt hash was stored; the password was not returned.",
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        action: "auth-change-password",
        error: error?.message || "Password change failed.",
        passwordExposed: false,
        impersonationEnabled: false,
        enforcementChanged: false,
      },
      { status: 500 }
    );
  }
}
