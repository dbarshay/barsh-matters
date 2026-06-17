import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { isAdminRequestAuthorized } from "@/lib/adminAuth";
import { createMatterAuditLogEntry } from "@/lib/auditLog";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cleanString(value: unknown): string {
  return String(value ?? "").trim();
}

function cleanEmail(value: unknown): string {
  return cleanString(value).toLowerCase();
}

function cleanRoleKey(value: unknown): string {
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

async function activeBootstrapOwnerAdminCount(excludingAssignmentId?: string | null) {
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

  if (!excludingAssignmentId) return activeBootstrapOwners.length;

  return activeBootstrapOwners.filter((user: any) =>
    (user.roles || []).some((entry: any) => entry.id !== excludingAssignmentId && entry.role?.key === "owner_admin" && entry.role?.status === "active")
  ).length;
}

export async function POST(req: NextRequest) {
  try {
    if (!isAdminRequestAuthorized(req)) {
      return NextResponse.json(
        {
          ok: false,
          action: "admin-user-remove-role",
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
    const roleKey = cleanRoleKey(body?.roleKey);

    if (!actorEmail) {
      return NextResponse.json(
        {
          ok: false,
          action: "admin-user-remove-role",
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
          action: "admin-user-remove-role",
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
          action: "admin-user-remove-role",
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

    if (!roleKey) {
      return NextResponse.json(
        {
          ok: false,
          action: "admin-user-remove-role",
          mode: apply ? "apply-blocked" : "preview-blocked",
          error: "roleKey is required.",
          actorEmail,
          enforcementChanged: false,
        },
        { status: 400 }
      );
    }

    const [targetUser, role, bootstrapOwnerCountBefore] = await Promise.all([
      prisma.adminUser.findUnique({
        where: { email: targetEmail },
        include: { roles: { include: { role: true } } },
      }),
      prisma.adminRole.findUnique({ where: { key: roleKey } }),
      activeBootstrapOwnerAdminCount(),
    ]);

    if (bootstrapOwnerCountBefore < 1) {
      return NextResponse.json(
        {
          ok: false,
          action: "admin-user-remove-role",
          mode: apply ? "apply-blocked" : "preview-blocked",
          error: "At least one active bootstrapSafe owner_admin user must exist before role removal.",
          bootstrapOwnerCountBefore,
          lockoutProtection: true,
          enforcementChanged: false,
        },
        { status: 409 }
      );
    }

    if (!targetUser) {
      return NextResponse.json(
        {
          ok: false,
          action: "admin-user-remove-role",
          mode: apply ? "apply-blocked" : "preview-blocked",
          error: "Target admin user does not exist.",
          targetEmail,
          actorEmail,
          enforcementChanged: false,
        },
        { status: 404 }
      );
    }

    if (!role) {
      return NextResponse.json(
        {
          ok: false,
          action: "admin-user-remove-role",
          mode: apply ? "apply-blocked" : "preview-blocked",
          error: "Admin role does not exist.",
          roleKey,
          actorEmail,
          enforcementChanged: false,
        },
        { status: 404 }
      );
    }

    const existingAssignment = targetUser.roles.find((entry: any) => entry.roleId === role.id || entry.role?.key === role.key) || null;
    if (!existingAssignment) {
      return NextResponse.json(
        {
          ok: false,
          action: "admin-user-remove-role",
          mode: apply ? "apply-blocked" : "preview-blocked",
          error: "Target admin user does not have this role.",
          missingAssignmentPrevented: true,
          targetUser: {
            id: targetUser.id,
            email: targetUser.email,
            status: targetUser.status,
            bootstrapSafe: targetUser.bootstrapSafe,
          },
          role: {
            id: role.id,
            key: role.key,
            label: role.label,
            status: role.status,
          },
          actorEmail,
          enforcementChanged: false,
        },
        { status: 404 }
      );
    }

    const bootstrapOwnerCountAfterPreview =
      role.key === "owner_admin" && targetUser.status === "active" && targetUser.bootstrapSafe
        ? await activeBootstrapOwnerAdminCount(existingAssignment.id)
        : bootstrapOwnerCountBefore;

    if (role.key === "owner_admin" && targetUser.status === "active" && targetUser.bootstrapSafe && bootstrapOwnerCountAfterPreview < 1) {
      return NextResponse.json(
        {
          ok: false,
          action: "admin-user-remove-role",
          mode: apply ? "apply-blocked" : "preview-blocked",
          error: "Cannot remove owner_admin from the last active bootstrapSafe owner_admin user.",
          targetUser: {
            id: targetUser.id,
            email: targetUser.email,
            status: targetUser.status,
            bootstrapSafe: targetUser.bootstrapSafe,
          },
          role: {
            id: role.id,
            key: role.key,
            label: role.label,
            status: role.status,
          },
          lockoutProtection: {
            activeBootstrapOwnerAdminCountBefore: bootstrapOwnerCountBefore,
            activeBootstrapOwnerAdminCountAfterRemovalPreview: bootstrapOwnerCountAfterPreview,
            preserved: false,
          },
          actorEmail,
          enforcementChanged: false,
        },
        { status: 409 }
      );
    }

    const preview = {
      assignmentId: existingAssignment.id,
      userId: targetUser.id,
      email: targetUser.email,
      displayName: targetUser.displayName,
      userStatus: targetUser.status,
      bootstrapSafe: targetUser.bootstrapSafe,
      roleId: role.id,
      roleKey: role.key,
      roleLabel: role.label,
      roleStatus: role.status,
      bootstrapOwnerCountBefore,
      bootstrapOwnerCountAfterRemovalPreview: bootstrapOwnerCountAfterPreview,
    };

    if (!apply) {
      return NextResponse.json({
        ok: true,
        action: "admin-user-remove-role",
        mode: "preview",
        previewOnly: true,
        applyRequiredForWrite: true,
        wouldRemove: preview,
        lockoutProtection: {
          activeBootstrapOwnerAdminCountBefore: bootstrapOwnerCountBefore,
          activeBootstrapOwnerAdminCountAfterRemovalPreview: bootstrapOwnerCountAfterPreview,
          preserved: bootstrapOwnerCountAfterPreview >= 1,
        },
        actorEmail,
        actorRoleRequired: "owner_admin",
        actorEffectivePermissionCount: actorEffectivePermissionKeys.length,
        enforcementChanged: false,
        note: "Preview only. No AdminUserRole row, permission override, enforcement setting, Clio record, document, email, or print queue item was changed.",
      });
    }

    const removed = await prisma.$transaction(async (tx) => {
      const deleted = await tx.adminUserRole.delete({
        where: {
          id: existingAssignment.id,
        },
      });

      await createMatterAuditLogEntry({
        action: "admin-user-remove-role",
        summary: `Removed role ${role.key} from admin user ${targetUser.email}.`,
        entityType: "admin_user_role",
        fieldName: "AdminUserRole",
        priorValue: {
          id: deleted.id,
          userId: deleted.userId,
          roleId: deleted.roleId,
          targetEmail: targetUser.email,
          roleKey: role.key,
        },
        newValue: Prisma.JsonNull,
        details: {
          route: "/api/admin/users/remove-role",
          mode: "apply",
          bootstrapOwnerCountBefore,
          bootstrapOwnerCountAfterRemovalPreview: bootstrapOwnerCountAfterPreview,
          lockoutProtection: true,
          enforcementChanged: false,
          permissionOverridesCreated: [],
        },
        sourcePage: "/admin/users",
        workflow: "admin-users-phase3",
        actorName: actor.displayName || "Administrator",
        actorEmail,
      });

      return deleted;
    });

    const bootstrapOwnerCountAfter = await activeBootstrapOwnerAdminCount();

    return NextResponse.json({
      ok: true,
      action: "admin-user-remove-role",
      mode: "apply",
      removed: {
        id: removed.id,
        userId: removed.userId,
        roleId: removed.roleId,
        targetEmail: targetUser.email,
        roleKey: role.key,
        roleLabel: role.label,
      },
      lockoutProtection: {
        activeBootstrapOwnerAdminCountBefore: bootstrapOwnerCountBefore,
        activeBootstrapOwnerAdminCountAfterRemovalPreview: bootstrapOwnerCountAfterPreview,
        activeBootstrapOwnerAdminCountAfter: bootstrapOwnerCountAfter,
        preserved: bootstrapOwnerCountAfter >= 1,
      },
      permissionOverridesCreated: [],
      actorEmail,
      actorRoleRequired: "owner_admin",
      actorEffectivePermissionCount: actorEffectivePermissionKeys.length,
      enforcementChanged: false,
      note: "Admin role removed. Permission enforcement remains disabled and unchanged.",
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        action: "admin-user-remove-role",
        mode: "error",
        error: error?.message || "Admin user remove-role route failed.",
        enforcementChanged: false,
      },
      { status: 500 }
    );
  }
}
