import { NextRequest, NextResponse } from "next/server";
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

function isApplyRequested(value: unknown): boolean {
  return value === true || value === "true" || value === "apply";
}

async function activeOwnerAdminActor(actorEmail: string) {
  if (!actorEmail) return null;
  return prisma.adminUser.findFirst({
    where: {
      email: actorEmail,
      status: "active",
      roles: { some: { role: { key: "owner_admin", status: "active" } } },
    },
    select: { id: true, email: true, displayName: true },
  });
}

function hasActiveOwnerAdminRole(user: any): boolean {
  return Boolean((user?.roles || []).some((entry: any) => entry?.role?.key === "owner_admin" && entry?.role?.status === "active"));
}

// Count active bootstrapSafe owner_admins other than the excluded user — used to refuse a delete that
// would leave the system with no way back in.
async function activeBootstrapOwnerAdminCount(excludingUserId?: string | null) {
  const owners = await prisma.adminUser.findMany({
    where: {
      status: "active",
      bootstrapSafe: true,
      roles: { some: { role: { key: "owner_admin", status: "active" } } },
    },
    include: { roles: { include: { role: true } } },
  });
  return owners.filter((user: any) => user.id !== excludingUserId && hasActiveOwnerAdminRole(user)).length;
}

export async function POST(req: NextRequest) {
  try {
    if (!isAdminRequestAuthorized(req)) {
      return NextResponse.json(
        { ok: false, action: "admin-user-delete", mode: "blocked", error: "Authenticated administrator session required." },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const apply = isApplyRequested(body?.apply);
    const actorEmail = cleanEmail(body?.actorEmail);
    const targetEmail = cleanEmail(body?.targetEmail ?? body?.email);
    const reason = cleanString(body?.reason);

    if (!actorEmail) {
      return NextResponse.json(
        {
          ok: false,
          action: "admin-user-delete",
          mode: apply ? "apply-blocked" : "preview-blocked",
          error: "actorEmail is required so the route can verify an active owner_admin actor before any delete.",
        },
        { status: 400 }
      );
    }

    const actor = await activeOwnerAdminActor(actorEmail);
    if (!actor) {
      return NextResponse.json(
        {
          ok: false,
          action: "admin-user-delete",
          mode: apply ? "apply-blocked" : "preview-blocked",
          error: "Active owner_admin actor required.",
          actorEmail,
        },
        { status: 403 }
      );
    }

    if (!targetEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(targetEmail)) {
      return NextResponse.json(
        {
          ok: false,
          action: "admin-user-delete",
          mode: apply ? "apply-blocked" : "preview-blocked",
          error: "A valid target admin user email is required.",
          actorEmail,
          actorRoleRequired: "owner_admin",
        },
        { status: 400 }
      );
    }

    // Self-delete guard: an owner cannot delete their own account.
    if (targetEmail === actorEmail) {
      return NextResponse.json(
        {
          ok: false,
          action: "admin-user-delete",
          mode: apply ? "apply-blocked" : "preview-blocked",
          error: "You cannot delete your own account.",
          selfDeletePrevented: true,
          actorEmail,
        },
        { status: 409 }
      );
    }

    if (!reason || reason.length < 6) {
      return NextResponse.json(
        {
          ok: false,
          action: "admin-user-delete",
          mode: apply ? "apply-blocked" : "preview-blocked",
          error: "An explicit reason of at least 6 characters is required to permanently delete a user.",
          actorEmail,
        },
        { status: 400 }
      );
    }

    const targetUser = await prisma.adminUser.findUnique({
      where: { email: targetEmail },
      include: { roles: { include: { role: true } }, permissionOverrides: true },
    });

    if (!targetUser) {
      return NextResponse.json(
        {
          ok: false,
          action: "admin-user-delete",
          mode: apply ? "apply-blocked" : "preview-blocked",
          error: "Target admin user does not exist.",
          targetEmail,
          actorEmail,
        },
        { status: 404 }
      );
    }

    // Sole-owner guard: never delete the last active bootstrapSafe owner_admin.
    const targetIsActiveBootstrapOwner = targetUser.status === "active" && targetUser.bootstrapSafe && hasActiveOwnerAdminRole(targetUser);
    if (targetIsActiveBootstrapOwner) {
      const remainingOwners = await activeBootstrapOwnerAdminCount(targetUser.id);
      if (remainingOwners < 1) {
        return NextResponse.json(
          {
            ok: false,
            action: "admin-user-delete",
            mode: apply ? "apply-blocked" : "preview-blocked",
            error: "Deleting this user is blocked because it would leave no active bootstrapSafe owner_admin user.",
            soleBootstrapOwnerProtection: true,
            targetEmail,
            actorEmail,
          },
          { status: 409 }
        );
      }
    }

    const preview = {
      id: targetUser.id,
      email: targetUser.email,
      displayName: targetUser.displayName,
      status: targetUser.status,
      bootstrapSafe: targetUser.bootstrapSafe,
      roleKeys: targetUser.roles.map((entry: any) => entry.role.key).sort(),
      rolesToCascade: targetUser.roles.length,
      permissionOverridesToCascade: targetUser.permissionOverrides.length,
      reason,
      permanent: true,
      reversible: false,
    };

    if (!apply) {
      return NextResponse.json({
        ok: true,
        action: "admin-user-delete",
        mode: "preview",
        previewOnly: true,
        applyRequiredForWrite: true,
        wouldDelete: preview,
        actorEmail,
        actorRoleRequired: "owner_admin",
        note: "Preview only. No AdminUser row was deleted. On apply, the user and their role assignments + permission overrides are permanently removed (cascade). This is not reversible.",
      });
    }

    const snapshot = {
      id: targetUser.id,
      email: targetUser.email,
      displayName: targetUser.displayName,
      username: targetUser.username,
      status: targetUser.status,
      bootstrapSafe: targetUser.bootstrapSafe,
      roleKeys: targetUser.roles.map((entry: any) => entry.role.key).sort(),
      permissionOverrideKeys: targetUser.permissionOverrides.map((entry: any) => entry.permissionKey).sort(),
    };

    await prisma.$transaction(async (tx) => {
      await createMatterAuditLogEntry({
        action: "admin-user-delete",
        summary: `Permanently deleted admin user ${targetUser.email}.`,
        entityType: "admin_user",
        fieldName: "AdminUser",
        priorValue: snapshot,
        newValue: null,
        details: {
          route: "/api/admin/users/delete",
          mode: "apply",
          targetUserId: targetUser.id,
          targetEmail: targetUser.email,
          reason,
          permanent: true,
          rolesCascaded: targetUser.roles.length,
          permissionOverridesCascaded: targetUser.permissionOverrides.length,
          soleBootstrapOwnerProtection: true,
          selfDeletePrevented: false,
        },
        sourcePage: "/admin/users",
        workflow: "admin-users-delete",
        actorName: actor.displayName || "Administrator",
        actorEmail,
      });

      // Cascade (AdminUserRole + AdminUserPermissionOverride) is enforced by onDelete: Cascade in the schema.
      await tx.adminUser.delete({ where: { id: targetUser.id } });
    });

    return NextResponse.json({
      ok: true,
      action: "admin-user-delete",
      mode: "apply",
      deleted: snapshot,
      actorEmail,
      actorRoleRequired: "owner_admin",
      permanent: true,
      note: "Admin user permanently deleted. Role assignments and permission overrides were cascaded. An audit snapshot was recorded.",
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, action: "admin-user-delete", mode: "error", error: error?.message || "Admin user delete route failed." },
      { status: 500 }
    );
  }
}
