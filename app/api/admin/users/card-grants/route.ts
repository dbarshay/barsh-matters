import { NextRequest, NextResponse } from "next/server";
import { isAdminRequestAuthorized } from "@/lib/adminAuth";
import { createMatterAuditLogEntry } from "@/lib/auditLog";
import { prisma } from "@/lib/prisma";
import { ADMIN_USERS_PHASE_V1_ADMIN_CARDS } from "@/src/lib/admin-users/admin-users-final-role-model-phase-v1";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ADMIN_CARD_GRANT_KEYS = ADMIN_USERS_PHASE_V1_ADMIN_CARDS.map((card) => card.grantPermissionKey);
const ADMIN_CARD_GRANT_KEY_SET = new Set(ADMIN_CARD_GRANT_KEYS);

function cleanString(value: unknown): string {
  return String(value ?? "").trim();
}

function cleanEmail(value: unknown): string {
  return cleanString(value).toLowerCase();
}

function isApplyRequested(value: unknown): boolean {
  return value === true || value === "true" || value === "apply";
}

function uniqueAdminCardGrantKeys(value: unknown): string[] {
  const raw = Array.isArray(value) ? value : [];
  return Array.from(
    new Set(
      raw
        .map((entry) => cleanString(entry))
        .filter((entry) => ADMIN_CARD_GRANT_KEY_SET.has(entry))
    )
  ).sort();
}

function invalidAdminCardGrantKeys(value: unknown): string[] {
  const raw = Array.isArray(value) ? value : [];
  return Array.from(
    new Set(
      raw
        .map((entry) => cleanString(entry))
        .filter((entry) => entry.length > 0 && !ADMIN_CARD_GRANT_KEY_SET.has(entry))
    )
  ).sort();
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

export async function POST(req: NextRequest) {
  try {
    if (!isAdminRequestAuthorized(req)) {
      return NextResponse.json(
        {
          ok: false,
          action: "admin-user-card-grants",
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
    const requestedGrantKeys = uniqueAdminCardGrantKeys(body?.grantPermissionKeys ?? body?.adminCardGrantKeys);
    const invalidGrantKeys = invalidAdminCardGrantKeys(body?.grantPermissionKeys ?? body?.adminCardGrantKeys);
    const reason = cleanString(body?.reason) || "Administrator admin-card grants updated by owner.";

    if (!actorEmail) {
      return NextResponse.json(
        {
          ok: false,
          action: "admin-user-card-grants",
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
          action: "admin-user-card-grants",
          mode: apply ? "apply-blocked" : "preview-blocked",
          error: "Active owner_admin actor required.",
          actorEmail,
          enforcementChanged: false,
        },
        { status: 403 }
      );
    }

    if (!targetEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(targetEmail)) {
      return NextResponse.json(
        {
          ok: false,
          action: "admin-user-card-grants",
          mode: apply ? "apply-blocked" : "preview-blocked",
          error: "A valid target admin user email is required.",
          actorEmail,
          enforcementChanged: false,
        },
        { status: 400 }
      );
    }

    if (invalidGrantKeys.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          action: "admin-user-card-grants",
          mode: apply ? "apply-blocked" : "preview-blocked",
          error: "One or more requested admin-card grant keys are not recognized.",
          invalidGrantKeys,
          allowedGrantKeys: ADMIN_CARD_GRANT_KEYS,
          actorEmail,
          targetEmail,
          enforcementChanged: false,
        },
        { status: 400 }
      );
    }

    const targetUser = await prisma.adminUser.findUnique({
      where: { email: targetEmail },
      include: {
        roles: { include: { role: true } },
        permissionOverrides: true,
      },
    });

    if (!targetUser) {
      return NextResponse.json(
        {
          ok: false,
          action: "admin-user-card-grants",
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
          action: "admin-user-card-grants",
          mode: apply ? "apply-blocked" : "preview-blocked",
          error: "Target admin user must be active before admin-card grants are changed.",
          targetEmail,
          targetStatus: targetUser.status,
          actorEmail,
          enforcementChanged: false,
        },
        { status: 409 }
      );
    }

    const targetRoleKeys = (targetUser.roles || []).map((entry: any) => entry.role?.key).filter(Boolean).sort();
    const isOwner = targetRoleKeys.includes("owner_admin");
    const isAdministrator = targetRoleKeys.includes("administrator");

    if (isOwner) {
      return NextResponse.json(
        {
          ok: false,
          action: "admin-user-card-grants",
          mode: apply ? "apply-blocked" : "preview-blocked",
          error: "Owner users receive all Admin cards through owner_admin and do not need per-card grants.",
          targetEmail,
          targetRoleKeys,
          ownerAllCards: true,
          enforcementChanged: false,
        },
        { status: 409 }
      );
    }

    if (!isAdministrator) {
      return NextResponse.json(
        {
          ok: false,
          action: "admin-user-card-grants",
          mode: apply ? "apply-blocked" : "preview-blocked",
          error: "Target user must have the administrator role before per-card Admin grants can be saved.",
          targetEmail,
          targetRoleKeys,
          enforcementChanged: false,
        },
        { status: 409 }
      );
    }

    const existingAdminCardOverrides = (targetUser.permissionOverrides || [])
      .filter((entry: any) => ADMIN_CARD_GRANT_KEY_SET.has(entry.permissionKey))
      .map((entry: any) => ({
        id: entry.id,
        permissionKey: entry.permissionKey,
        action: entry.action,
        reason: entry.reason,
      }))
      .sort((a: any, b: any) => a.permissionKey.localeCompare(b.permissionKey));

    const existingAllowedGrantKeys = existingAdminCardOverrides
      .filter((entry: any) => entry.action === "allow")
      .map((entry: any) => entry.permissionKey)
      .sort();

    const toAllow = requestedGrantKeys.filter((key) => !existingAllowedGrantKeys.includes(key));
    const toRemoveAllow = existingAllowedGrantKeys.filter((key) => !requestedGrantKeys.includes(key));
    const toClearBlocks = existingAdminCardOverrides
      .filter((entry: any) => entry.action === "block" && requestedGrantKeys.includes(entry.permissionKey))
      .map((entry: any) => entry.permissionKey)
      .sort();

    const preview = {
      ok: true,
      action: "admin-user-card-grants",
      mode: apply ? "apply" : "preview",
      actorEmail,
      targetEmail,
      targetUserId: targetUser.id,
      targetRoleKeys,
      requestedGrantKeys,
      existingAllowedGrantKeys,
      existingAdminCardOverrides,
      toAllow,
      toRemoveAllow,
      toClearBlocks,
      allowedGrantKeys: ADMIN_CARD_GRANT_KEYS,
      enforcementChanged: false,
      runtimeEnforcementChanged: false,
      sessionBehaviorChanged: false,
      note: "Admin-card grants are persisted as AdminUserPermissionOverride allow rows. Runtime enforcement remains disabled.",
    };

    if (!apply) {
      return NextResponse.json({
        ...preview,
        previewOnly: true,
        databaseChanged: false,
      });
    }

    const saved = await prisma.$transaction(async (tx) => {
      for (const permissionKey of requestedGrantKeys) {
        await tx.adminUserPermissionOverride.upsert({
          where: {
            userId_permissionKey: {
              userId: targetUser.id,
              permissionKey,
            },
          },
          update: {
            action: "allow",
            reason,
            updatedAt: new Date(),
          },
          create: {
            userId: targetUser.id,
            permissionKey,
            action: "allow",
            reason,
          },
        });
      }

      if (toRemoveAllow.length > 0) {
        await tx.adminUserPermissionOverride.deleteMany({
          where: {
            userId: targetUser.id,
            permissionKey: { in: toRemoveAllow },
            action: "allow",
          },
        });
      }

      const refreshed = await tx.adminUser.findUnique({
        where: { id: targetUser.id },
        include: { permissionOverrides: true, roles: { include: { role: true } } },
      });

      await createMatterAuditLogEntry({
        action: "admin-user-card-grants",
        summary: `Updated Administrator Admin-card grants for ${targetUser.email}.`,
        entityType: "admin_user_permission_override",
        entityId: targetUser.id,
        fieldName: "AdminUserPermissionOverride",
        oldValue: JSON.stringify(existingAllowedGrantKeys),
        newValue: JSON.stringify(requestedGrantKeys),
        source: "barsh_matters_admin",
        changedBy: actorEmail,
        metadata: {
          route: "/api/admin/users/card-grants",
          targetEmail,
          targetUserId: targetUser.id,
          requestedGrantKeys,
          toAllow,
          toRemoveAllow,
          enforcementChanged: false,
          runtimeEnforcementChanged: false,
        },
      }, tx);

      return refreshed;
    });

    const savedGrantKeys = (saved?.permissionOverrides || [])
      .filter((entry: any) => ADMIN_CARD_GRANT_KEY_SET.has(entry.permissionKey) && entry.action === "allow")
      .map((entry: any) => entry.permissionKey)
      .sort();

    return NextResponse.json({
      ...preview,
      mode: "apply",
      databaseChanged: true,
      savedGrantKeys,
      permissionOverrideChanged: true,
      enforcementChanged: false,
      runtimeEnforcementChanged: false,
      sessionBehaviorChanged: false,
      note: "Administrator Admin-card grants saved. Runtime permission enforcement remains disabled.",
    });
  } catch (error: any) {
    console.error("Admin user card grants route failed", error);
    return NextResponse.json(
      {
        ok: false,
        action: "admin-user-card-grants",
        mode: "error",
        error: error?.message || "Admin user card grants route failed.",
        enforcementChanged: false,
      },
      { status: 500 }
    );
  }
}
