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

async function activeBootstrapOwnerAdminCount() {
  return prisma.adminUser.count({
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
  });
}

export async function POST(req: NextRequest) {
  try {
    if (!isAdminRequestAuthorized(req)) {
      return NextResponse.json(
        {
          ok: false,
          action: "admin-user-assign-role",
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
          action: "admin-user-assign-role",
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
          action: "admin-user-assign-role",
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
          action: "admin-user-assign-role",
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
          action: "admin-user-assign-role",
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
      prisma.adminRole.findUnique({ where: { key: roleKey }, include: { permissions: true } }),
      activeBootstrapOwnerAdminCount(),
    ]);

    if (bootstrapOwnerCountBefore < 1) {
      return NextResponse.json(
        {
          ok: false,
          action: "admin-user-assign-role",
          mode: apply ? "apply-blocked" : "preview-blocked",
          error: "At least one active bootstrapSafe owner_admin user must exist before role assignment.",
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
          action: "admin-user-assign-role",
          mode: apply ? "apply-blocked" : "preview-blocked",
          error: "Target admin user does not exist.",
          targetEmail,
          actorEmail,
          enforcementChanged: false,
        },
        { status: 404 }
      );
    }

    if (targetUser.status !== "active") {
      return NextResponse.json(
        {
          ok: false,
          action: "admin-user-assign-role",
          mode: apply ? "apply-blocked" : "preview-blocked",
          error: "Target admin user must be active before role assignment.",
          targetUser: {
            id: targetUser.id,
            email: targetUser.email,
            status: targetUser.status,
            bootstrapSafe: targetUser.bootstrapSafe,
          },
          actorEmail,
          enforcementChanged: false,
        },
        { status: 409 }
      );
    }

    if (!role) {
      return NextResponse.json(
        {
          ok: false,
          action: "admin-user-assign-role",
          mode: apply ? "apply-blocked" : "preview-blocked",
          error: "Admin role does not exist.",
          roleKey,
          actorEmail,
          enforcementChanged: false,
        },
        { status: 404 }
      );
    }

    if (role.status !== "active") {
      return NextResponse.json(
        {
          ok: false,
          action: "admin-user-assign-role",
          mode: apply ? "apply-blocked" : "preview-blocked",
          error: "Admin role must be active before assignment.",
          role: {
            id: role.id,
            key: role.key,
            label: role.label,
            status: role.status,
          },
          actorEmail,
          enforcementChanged: false,
        },
        { status: 409 }
      );
    }

    const existingAssignment = targetUser.roles.find((entry: any) => entry.roleId === role.id || entry.role?.key === role.key) || null;
    if (existingAssignment) {
      return NextResponse.json(
        {
          ok: false,
          action: "admin-user-assign-role",
          mode: apply ? "apply-blocked" : "preview-blocked",
          error: "Target admin user already has this role.",
          duplicateAssignmentPrevented: true,
          existingAssignment: {
            id: existingAssignment.id,
            userId: existingAssignment.userId,
            roleId: existingAssignment.roleId,
            roleKey: existingAssignment.role?.key || role.key,
          },
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
        { status: 409 }
      );
    }

    const preview = {
      userId: targetUser.id,
      email: targetUser.email,
      displayName: targetUser.displayName,
      userStatus: targetUser.status,
      roleId: role.id,
      roleKey: role.key,
      roleLabel: role.label,
      roleStatus: role.status,
      rolePermissionCount: role.permissions.length,
      bootstrapOwnerCountBefore,
    };

    if (!apply) {
      return NextResponse.json({
        ok: true,
        action: "admin-user-assign-role",
        mode: "preview",
        previewOnly: true,
        applyRequiredForWrite: true,
        wouldAssign: preview,
        duplicateAssignmentPrevented: false,
        lockoutProtection: {
          activeBootstrapOwnerAdminCountBefore: bootstrapOwnerCountBefore,
          preserved: bootstrapOwnerCountBefore >= 1,
        },
        actorEmail,
        actorRoleRequired: "owner_admin",
        actorEffectivePermissionCount: actorEffectivePermissionKeys.length,
        enforcementChanged: false,
        note: "Preview only. No AdminUserRole row, permission override, enforcement setting, Clio record, document, email, or print queue item was changed.",
      });
    }

    const assignment = await prisma.$transaction(async (tx) => {
      const created = await tx.adminUserRole.create({
        data: {
          userId: targetUser.id,
          roleId: role.id,
        },
      });

      await createMatterAuditLogEntry({
        action: "admin-user-assign-role",
        summary: `Assigned role ${role.key} to admin user ${targetUser.email}.`,
        entityType: "admin_user_role",
        fieldName: "AdminUserRole",
        priorValue: Prisma.JsonNull,
        newValue: {
          id: created.id,
          userId: created.userId,
          roleId: created.roleId,
          targetEmail: targetUser.email,
          roleKey: role.key,
        },
        details: {
          route: "/api/admin/users/assign-role",
          mode: "apply",
          duplicateAssignmentPrevented: true,
          bootstrapOwnerCountBefore,
          lockoutProtection: true,
          enforcementChanged: false,
          permissionOverridesCreated: [],
        },
        sourcePage: "/admin/users",
        workflow: "admin-users-phase3",
        actorName: actor.displayName || "Administrator",
        actorEmail,
      });

      return created;
    });

    const bootstrapOwnerCountAfter = await activeBootstrapOwnerAdminCount();

    return NextResponse.json({
      ok: true,
      action: "admin-user-assign-role",
      mode: "apply",
      assigned: {
        id: assignment.id,
        userId: assignment.userId,
        roleId: assignment.roleId,
        targetEmail: targetUser.email,
        roleKey: role.key,
        roleLabel: role.label,
      },
      lockoutProtection: {
        activeBootstrapOwnerAdminCountBefore: bootstrapOwnerCountBefore,
        activeBootstrapOwnerAdminCountAfter: bootstrapOwnerCountAfter,
        preserved: bootstrapOwnerCountAfter >= 1,
      },
      permissionOverridesCreated: [],
      actorEmail,
      actorRoleRequired: "owner_admin",
      actorEffectivePermissionCount: actorEffectivePermissionKeys.length,
      enforcementChanged: false,
      note: "Admin role assigned. Permission enforcement remains disabled and unchanged.",
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        action: "admin-user-assign-role",
        mode: "error",
        error: error?.message || "Admin user assign-role route failed.",
        enforcementChanged: false,
      },
      { status: 500 }
    );
  }
}
