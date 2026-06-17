import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { isAdminRequestAuthorized } from "@/lib/adminAuth";
import { createMatterAuditLogEntry } from "@/lib/auditLog";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_ADMIN_USER_STATUSES = new Set(["active", "inactive"]);

function cleanString(value: unknown): string {
  return String(value ?? "").trim();
}

function cleanEmail(value: unknown): string {
  return cleanString(value).toLowerCase();
}

function cleanOptionalString(value: unknown): string | null {
  const cleaned = cleanString(value);
  return cleaned || null;
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

export async function POST(req: NextRequest) {
  try {
    if (!isAdminRequestAuthorized(req)) {
      return NextResponse.json(
        {
          ok: false,
          action: "admin-user-create",
          mode: "blocked",
          error: "Authenticated administrator session required.",
          enforcementChanged: false,
        },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const apply = isApplyRequested(body?.apply);
    const email = cleanEmail(body?.email);
    const displayName = cleanOptionalString(body?.displayName);
    const notes = cleanOptionalString(body?.notes);
    const status = cleanString(body?.status || "active").toLowerCase();
    const actorEmail = cleanEmail(body?.actorEmail);

    if (!actorEmail) {
      return NextResponse.json(
        {
          ok: false,
          action: "admin-user-create",
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
          action: "admin-user-create",
          mode: apply ? "apply-blocked" : "preview-blocked",
          error: "Active owner_admin actor required.",
          actorEmail,
          enforcementChanged: false,
        },
        { status: 403 }
      );
    }

    const actorEffectivePermissionKeys = effectivePermissionKeysForUser(actor);
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        {
          ok: false,
          action: "admin-user-create",
          mode: apply ? "apply-blocked" : "preview-blocked",
          error: "A valid admin user email is required.",
          actorEmail,
          actorRoleRequired: "owner_admin",
          actorEffectivePermissionCount: actorEffectivePermissionKeys.length,
          enforcementChanged: false,
        },
        { status: 400 }
      );
    }

    if (!VALID_ADMIN_USER_STATUSES.has(status)) {
      return NextResponse.json(
        {
          ok: false,
          action: "admin-user-create",
          mode: apply ? "apply-blocked" : "preview-blocked",
          error: "Invalid status. Use active or inactive.",
          allowedStatuses: Array.from(VALID_ADMIN_USER_STATUSES),
          actorEmail,
          enforcementChanged: false,
        },
        { status: 400 }
      );
    }

    const existing = await prisma.adminUser.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        {
          ok: false,
          action: "admin-user-create",
          mode: apply ? "apply-blocked" : "preview-blocked",
          error: "An admin user with this email already exists.",
          duplicateEmailPrevented: true,
          existingUser: {
            id: existing.id,
            email: existing.email,
            displayName: existing.displayName,
            status: existing.status,
            bootstrapSafe: existing.bootstrapSafe,
          },
          actorEmail,
          enforcementChanged: false,
        },
        { status: 409 }
      );
    }

    const preview = {
      email,
      displayName,
      status,
      bootstrapSafe: false,
      notes,
    };

    if (!apply) {
      return NextResponse.json({
        ok: true,
        action: "admin-user-create",
        mode: "preview",
        previewOnly: true,
        applyRequiredForWrite: true,
        wouldCreate: preview,
        duplicateEmailPrevented: false,
        actorEmail,
        actorRoleRequired: "owner_admin",
        actorEffectivePermissionCount: actorEffectivePermissionKeys.length,
        enforcementChanged: false,
        note: "Preview only. No AdminUser row, role assignment, permission override, enforcement setting, Clio record, document, email, or print queue item was changed.",
      });
    }

    const created = await prisma.$transaction(async (tx) => {
      const user = await tx.adminUser.create({
        data: {
          email,
          displayName,
          status,
          bootstrapSafe: false,
          notes,
        },
      });

      await createMatterAuditLogEntry({
        action: "admin-user-create",
        summary: `Created admin user ${email}.`,
        entityType: "admin_user",
        fieldName: "AdminUser",
        priorValue: Prisma.JsonNull,
        newValue: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          status: user.status,
          bootstrapSafe: user.bootstrapSafe,
        },
        details: {
          route: "/api/admin/users/create",
          mode: "apply",
          duplicateEmailPrevented: true,
          statusValidation: Array.from(VALID_ADMIN_USER_STATUSES),
          enforcementChanged: false,
          rolesAssigned: [],
          permissionOverridesCreated: [],
        },
        sourcePage: "/admin/users",
        workflow: "admin-users-phase3",
        actorName: actor.displayName || "Administrator",
        actorEmail,
      });

      return user;
    });

    return NextResponse.json({
      ok: true,
      action: "admin-user-create",
      mode: "apply",
      created: {
        id: created.id,
        email: created.email,
        displayName: created.displayName,
        status: created.status,
        bootstrapSafe: created.bootstrapSafe,
      },
      rolesAssigned: [],
      permissionOverridesCreated: [],
      actorEmail,
      actorRoleRequired: "owner_admin",
      actorEffectivePermissionCount: actorEffectivePermissionKeys.length,
      enforcementChanged: false,
      note: "Admin user row created. Permission enforcement remains disabled and unchanged.",
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        action: "admin-user-create",
        mode: "error",
        error: error?.message || "Admin user create route failed.",
        enforcementChanged: false,
      },
      { status: 500 }
    );
  }
}
