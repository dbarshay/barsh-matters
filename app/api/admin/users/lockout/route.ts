import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { isAdminRequestAuthorized } from "@/lib/adminAuth";
import { createMatterAuditLogEntry } from "@/lib/auditLog";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_LOCKOUT_ACTIONS = new Set(["lock", "unlock"]);

function cleanString(value: unknown): string {
  return String(value ?? "").trim();
}

function cleanEmail(value: unknown): string {
  return cleanString(value).toLowerCase();
}

function isApplyRequested(value: unknown): boolean {
  return value === true || value === "true" || value === "apply";
}

async function activeOwnerAdminActor(actorEmail: string) {
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
    include: {
      roles: {
        include: {
          role: {
            include: {
              permissions: true,
            },
          },
        },
      },
      permissionOverrides: true,
    },
  });
}

function effectivePermissionKeysForUser(user: any): string[] {
  const rolePermissionKeys = Array.from(
    new Set(
      (user?.roles || []).flatMap((entry: any) =>
        entry?.role?.status === "active"
          ? (entry.role.permissions || []).map((permission: any) => permission.permissionKey)
          : []
      )
    )
  ).sort();

  const explicitOverrides = user?.permissionOverrides || [];
  const explicitBlocks = new Set(
    explicitOverrides
      .filter((entry: any) => entry.action === "block")
      .map((entry: any) => entry.permissionKey)
  );
  const explicitAllows = explicitOverrides
    .filter((entry: any) => entry.action === "allow")
    .map((entry: any) => entry.permissionKey);

  return Array.from(
    new Set([...rolePermissionKeys.filter((permissionKey: any) => !explicitBlocks.has(permissionKey)), ...explicitAllows])
  ).sort() as string[];
}

function hasActiveOwnerAdminRole(user: any): boolean {
  return Boolean((user?.roles || []).some((entry: any) => entry?.role?.key === "owner_admin" && entry?.role?.status === "active"));
}

async function activeBootstrapOwnerAdminCount(excludingUserId?: string | null) {
  const activeBootstrapOwners = await prisma.adminUser.findMany({
    where: {
      status: "active",
      bootstrapSafe: true,
      roles: {
        some: {
          role: {
            key: "owner_admin",
            status: "active",
          },
        },
      },
    },
    include: {
      roles: {
        include: {
          role: true,
        },
      },
    },
  });

  return activeBootstrapOwners.filter((user: any) => user.id !== excludingUserId && hasActiveOwnerAdminRole(user)).length;
}

export async function POST(req: NextRequest) {
  try {
    if (!isAdminRequestAuthorized(req)) {
      return NextResponse.json(
        {
          ok: false,
          action: "admin-user-lockout",
          mode: "blocked",
          error: "Authenticated administrator session required.",
          enforcementChanged: false,
        },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const apply = isApplyRequested(body?.apply);
    const actorEmail = cleanEmail(body?.actorEmail);
    const targetEmail = cleanEmail(body?.targetEmail ?? body?.email);
    const lockoutAction = cleanString(body?.lockoutAction ?? body?.action).toLowerCase();
    const reason = cleanString(body?.reason);

    if (!actorEmail) {
      return NextResponse.json(
        {
          ok: false,
          action: "admin-user-lockout",
          mode: apply ? "apply-blocked" : "preview-blocked",
          error: "actorEmail is required so the route can verify an active owner_admin actor before any write.",
          enforcementChanged: false,
        },
        { status: 400 }
      );
    }

    const actor = await activeOwnerAdminActor(actorEmail);
    if (!actor) {
      return NextResponse.json(
        {
          ok: false,
          action: "admin-user-lockout",
          mode: apply ? "apply-blocked" : "preview-blocked",
          error: "Active owner_admin actor required.",
          actorEmail,
          enforcementChanged: false,
        },
        { status: 403 }
      );
    }

    const actorEffectivePermissionKeys = effectivePermissionKeysForUser(actor);

    if (!targetEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(targetEmail)) {
      return NextResponse.json(
        {
          ok: false,
          action: "admin-user-lockout",
          mode: apply ? "apply-blocked" : "preview-blocked",
          error: "A valid target admin user email is required.",
          actorEmail,
          actorRoleRequired: "owner_admin",
          actorEffectivePermissionCount: actorEffectivePermissionKeys.length,
          enforcementChanged: false,
        },
        { status: 400 }
      );
    }

    if (!VALID_LOCKOUT_ACTIONS.has(lockoutAction)) {
      return NextResponse.json(
        {
          ok: false,
          action: "admin-user-lockout",
          mode: apply ? "apply-blocked" : "preview-blocked",
          error: "lockoutAction must be lock or unlock.",
          lockoutAction,
          allowedActions: Array.from(VALID_LOCKOUT_ACTIONS),
          actorEmail,
          enforcementChanged: false,
        },
        { status: 400 }
      );
    }

    if (!reason || reason.length < 6) {
      return NextResponse.json(
        {
          ok: false,
          action: "admin-user-lockout",
          mode: apply ? "apply-blocked" : "preview-blocked",
          error: "An explicit reason of at least 6 characters is required for lock/unlock.",
          lockoutAction,
          actorEmail,
          enforcementChanged: false,
        },
        { status: 400 }
      );
    }

    const targetUser = await prisma.adminUser.findUnique({
      where: { email: targetEmail },
      include: {
        roles: { include: { role: { include: { permissions: true } } } },
        permissionOverrides: true,
      },
    });

    if (!targetUser) {
      return NextResponse.json(
        {
          ok: false,
          action: "admin-user-lockout",
          mode: apply ? "apply-blocked" : "preview-blocked",
          error: "Target admin user does not exist.",
          targetEmail,
          actorEmail,
          enforcementChanged: false,
        },
        { status: 404 }
      );
    }

    const priorStatus = targetUser.status;
    const nextStatus = lockoutAction === "lock" ? "inactive" : "active";
    const targetIsActiveBootstrapOwner = priorStatus === "active" && targetUser.bootstrapSafe && hasActiveOwnerAdminRole(targetUser);
    const activeBootstrapOwnerCountAfterPreview = targetIsActiveBootstrapOwner && nextStatus !== "active" ? await activeBootstrapOwnerAdminCount(targetUser.id) : await activeBootstrapOwnerAdminCount();

    if (targetIsActiveBootstrapOwner && nextStatus !== "active" && activeBootstrapOwnerCountAfterPreview < 1) {
      return NextResponse.json(
        {
          ok: false,
          action: "admin-user-lockout",
          mode: apply ? "apply-blocked" : "preview-blocked",
          error: "Locking this user is blocked because it would leave no active bootstrapSafe owner_admin user.",
          targetUser: {
            id: targetUser.id,
            email: targetUser.email,
            displayName: targetUser.displayName,
            priorStatus,
            bootstrapSafe: targetUser.bootstrapSafe,
            roleKeys: targetUser.roles.map((entry: any) => entry.role.key).sort(),
          },
          lockoutAction,
          nextStatus,
          activeBootstrapOwnerCountAfterPreview,
          lockoutProtection: true,
          actorEmail,
          enforcementChanged: false,
        },
        { status: 409 }
      );
    }

    const preview = {
      id: targetUser.id,
      email: targetUser.email,
      displayName: targetUser.displayName,
      priorStatus,
      nextStatus,
      bootstrapSafe: targetUser.bootstrapSafe,
      roleKeys: targetUser.roles.map((entry: any) => entry.role.key).sort(),
      lockoutAction,
      reason,
      activeBootstrapOwnerCountAfterPreview,
      loginCredentialChanged: false,
      passwordExposed: false,
      impersonationEnabled: false,
      enforcementChanged: false,
    };

    if (!apply) {
      return NextResponse.json({
        ok: true,
        action: "admin-user-lockout",
        mode: "preview",
        previewOnly: true,
        applyRequiredForWrite: true,
        wouldChange: preview,
        actorEmail,
        actorRoleRequired: "owner_admin",
        actorEffectivePermissionCount: actorEffectivePermissionKeys.length,
        lockoutProtection: true,
        enforcementChanged: false,
        note: "Preview only. No AdminUser row, credential, password, impersonation session, permission enforcement setting, Clio record, document, email, or print queue item was changed.",
      });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const user = await tx.adminUser.update({
        where: { id: targetUser.id },
        data: {
          status: nextStatus,
          notes: targetUser.notes
            ? `${targetUser.notes}\n[${new Date().toISOString()}] ${lockoutAction.toUpperCase()} by ${actorEmail}: ${reason}`
            : `[${new Date().toISOString()}] ${lockoutAction.toUpperCase()} by ${actorEmail}: ${reason}`,
        },
      });

      await createMatterAuditLogEntry({
        action: lockoutAction === "lock" ? "admin-user-lock" : "admin-user-unlock",
        summary: `${lockoutAction === "lock" ? "Locked" : "Unlocked"} admin user ${targetUser.email}.`,
        entityType: "admin_user",
        fieldName: "AdminUser.status",
        priorValue: priorStatus,
        newValue: nextStatus,
        details: {
          route: "/api/admin/users/lockout",
          mode: "apply",
          targetUserId: targetUser.id,
          targetEmail: targetUser.email,
          lockoutAction,
          reason,
          activeBootstrapOwnerCountAfterPreview,
          lockoutProtection: true,
          loginCredentialChanged: false,
          passwordExposed: false,
          impersonationEnabled: false,
          enforcementChanged: false,
        },
        sourcePage: "/admin/users",
        workflow: "admin-users-phase12j",
        actorName: actor.displayName || "Administrator",
        actorEmail,
      });

      return user;
    });

    return NextResponse.json({
      ok: true,
      action: "admin-user-lockout",
      mode: "apply",
      updated: {
        id: updated.id,
        email: updated.email,
        displayName: updated.displayName,
        priorStatus,
        status: updated.status,
        bootstrapSafe: updated.bootstrapSafe,
      },
      actorEmail,
      actorRoleRequired: "owner_admin",
      actorEffectivePermissionCount: actorEffectivePermissionKeys.length,
      lockoutProtection: true,
      loginCredentialChanged: false,
      passwordExposed: false,
      impersonationEnabled: false,
      enforcementChanged: false,
      note: "Admin user status changed. Credentials were not exposed, impersonation was not enabled, and permission enforcement was not changed.",
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        action: "admin-user-lockout",
        mode: "error",
        error: error?.message || "Admin user lockout route failed.",
        enforcementChanged: false,
      },
      { status: 500 }
    );
  }
}
