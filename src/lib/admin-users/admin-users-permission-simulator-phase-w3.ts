import type {
  AdminUsersPhaseW1OperationKey,
  AdminUsersPhaseW1RoleKey,
} from "./admin-users-final-permission-coverage-phase-w1";
import type {
  AdminUsersPhaseW2Classification,
} from "./admin-users-route-classification-phase-w2";

export const ADMIN_USERS_PHASE_W3_DRY_RUN_PERMISSION_SIMULATOR = true as const;

export type AdminUsersPhaseW3Decision = "allow" | "block";

export type AdminUsersPhaseW3SimulatedActor = {
  actorKey: string;
  displayName: string;
  roleKeys: AdminUsersPhaseW1RoleKey[];
  adminCardGrantKeys: string[];
};

export type AdminUsersPhaseW3SimulationResult = {
  actorKey: string;
  displayName: string;
  roleKeys: AdminUsersPhaseW1RoleKey[];
  path: string;
  areaKey: string;
  operationFamilies: AdminUsersPhaseW1OperationKey[];
  paymentSensitive: boolean;
  adminOnly: boolean;
  adminCardGrantKey: string | null;
  decision: AdminUsersPhaseW3Decision;
  reasons: string[];
  dryRunOnly: true;
  enforcementActive: false;
  uiHidingActive: false;
};

export type AdminUsersPhaseW3ActorSummary = {
  actorKey: string;
  displayName: string;
  roleKeys: AdminUsersPhaseW1RoleKey[];
  allowCount: number;
  blockCount: number;
  blockedAdminCount: number;
  blockedPaymentCount: number;
  blockedMutationCount: number;
};

export const ADMIN_USERS_PHASE_W3_SAMPLE_ACTORS: AdminUsersPhaseW3SimulatedActor[] = [
  {
    actorKey: "owner-baseline",
    displayName: "Owner Baseline",
    roleKeys: ["owner_admin"],
    adminCardGrantKeys: [],
  },
  {
    actorKey: "administrator-selected-cards",
    displayName: "Administrator Selected Admin Cards",
    roleKeys: ["administrator"],
    adminCardGrantKeys: [
      "admin.card.clientsBilling",
      "admin.card.documentTemplates",
      "admin.card.ticklers",
    ],
  },
  {
    actorKey: "full-user-baseline",
    displayName: "Full User Baseline",
    roleKeys: ["full_user"],
    adminCardGrantKeys: [],
  },
  {
    actorKey: "basic-user-baseline",
    displayName: "Basic User Baseline",
    roleKeys: ["basic_user"],
    adminCardGrantKeys: [],
  },
  {
    actorKey: "view-only-baseline",
    displayName: "View Only Baseline",
    roleKeys: ["view_only"],
    adminCardGrantKeys: [],
  },
] as const;

export function adminUsersPhaseW3HasAnyRole(actor: AdminUsersPhaseW3SimulatedActor, roleKeys: AdminUsersPhaseW1RoleKey[]): boolean {
  return roleKeys.some((roleKey) => actor.roleKeys.includes(roleKey));
}

export function adminUsersPhaseW3HasMutationOperation(operationFamilies: AdminUsersPhaseW1OperationKey[]): boolean {
  return operationFamilies.some((operation) =>
    [
      "create",
      "edit",
      "delete",
      "archive",
      "generate",
      "finalize",
      "upload",
      "email",
      "run",
      "void",
      "payment_manage",
      "admin_manage",
    ].includes(operation)
  );
}

export function adminUsersPhaseW3SimulateClassification(
  actor: AdminUsersPhaseW3SimulatedActor,
  classification: AdminUsersPhaseW2Classification
): AdminUsersPhaseW3SimulationResult {
  const reasons: string[] = [];

  if (adminUsersPhaseW3HasAnyRole(actor, ["owner_admin"])) {
    reasons.push("Owner allows all classified areas and operations.");
    return {
      actorKey: actor.actorKey,
      displayName: actor.displayName,
      roleKeys: actor.roleKeys,
      path: classification.path,
      areaKey: classification.areaKey,
      operationFamilies: classification.operationFamilies,
      paymentSensitive: classification.paymentSensitive,
      adminOnly: classification.adminOnly,
      adminCardGrantKey: classification.adminCardGrantKey,
      decision: "allow",
      reasons,
      dryRunOnly: true,
      enforcementActive: false,
      uiHidingActive: false,
    };
  }

  if (classification.adminOnly) {
    if (adminUsersPhaseW3HasAnyRole(actor, ["administrator"])) {
      if (!classification.adminCardGrantKey) {
        reasons.push("Administrator may reach Admin screen context, but this file is not mapped to a selected Admin-card grant.");
        return {
          actorKey: actor.actorKey,
          displayName: actor.displayName,
          roleKeys: actor.roleKeys,
          path: classification.path,
          areaKey: classification.areaKey,
          operationFamilies: classification.operationFamilies,
          paymentSensitive: classification.paymentSensitive,
          adminOnly: classification.adminOnly,
          adminCardGrantKey: classification.adminCardGrantKey,
          decision: "allow",
          reasons,
          dryRunOnly: true,
          enforcementActive: false,
          uiHidingActive: false,
        };
      }
      if (actor.adminCardGrantKeys.includes(classification.adminCardGrantKey)) {
        reasons.push("Administrator has the selected Admin-card grant for this route.");
        return {
          actorKey: actor.actorKey,
          displayName: actor.displayName,
          roleKeys: actor.roleKeys,
          path: classification.path,
          areaKey: classification.areaKey,
          operationFamilies: classification.operationFamilies,
          paymentSensitive: classification.paymentSensitive,
          adminOnly: classification.adminOnly,
          adminCardGrantKey: classification.adminCardGrantKey,
          decision: "allow",
          reasons,
          dryRunOnly: true,
          enforcementActive: false,
          uiHidingActive: false,
        };
      }
      reasons.push("Administrator lacks the selected Admin-card grant for this route.");
    } else {
      reasons.push("Non-admin role cannot access Admin-only routes.");
    }

    return {
      actorKey: actor.actorKey,
      displayName: actor.displayName,
      roleKeys: actor.roleKeys,
      path: classification.path,
      areaKey: classification.areaKey,
      operationFamilies: classification.operationFamilies,
      paymentSensitive: classification.paymentSensitive,
      adminOnly: classification.adminOnly,
      adminCardGrantKey: classification.adminCardGrantKey,
      decision: "block",
      reasons,
      dryRunOnly: true,
      enforcementActive: false,
      uiHidingActive: false,
    };
  }

  if (adminUsersPhaseW3HasAnyRole(actor, ["administrator", "full_user"])) {
    reasons.push("Role allows non-admin app access, including payment-sensitive functions.");
    return {
      actorKey: actor.actorKey,
      displayName: actor.displayName,
      roleKeys: actor.roleKeys,
      path: classification.path,
      areaKey: classification.areaKey,
      operationFamilies: classification.operationFamilies,
      paymentSensitive: classification.paymentSensitive,
      adminOnly: classification.adminOnly,
      adminCardGrantKey: classification.adminCardGrantKey,
      decision: "allow",
      reasons,
      dryRunOnly: true,
      enforcementActive: false,
      uiHidingActive: false,
    };
  }

  if (adminUsersPhaseW3HasAnyRole(actor, ["basic_user"])) {
    if (classification.paymentSensitive || classification.operationFamilies.includes("payment_manage") || classification.operationFamilies.includes("void")) {
      reasons.push("Basic User blocks payment, billing, invoice, void, and settlement-payment functions.");
      return {
        actorKey: actor.actorKey,
        displayName: actor.displayName,
        roleKeys: actor.roleKeys,
        path: classification.path,
        areaKey: classification.areaKey,
        operationFamilies: classification.operationFamilies,
        paymentSensitive: classification.paymentSensitive,
        adminOnly: classification.adminOnly,
        adminCardGrantKey: classification.adminCardGrantKey,
        decision: "block",
        reasons,
        dryRunOnly: true,
        enforcementActive: false,
        uiHidingActive: false,
      };
    }
    reasons.push("Basic User allows non-admin, non-payment-sensitive functions.");
    return {
      actorKey: actor.actorKey,
      displayName: actor.displayName,
      roleKeys: actor.roleKeys,
      path: classification.path,
      areaKey: classification.areaKey,
      operationFamilies: classification.operationFamilies,
      paymentSensitive: classification.paymentSensitive,
      adminOnly: classification.adminOnly,
      adminCardGrantKey: classification.adminCardGrantKey,
      decision: "allow",
      reasons,
      dryRunOnly: true,
      enforcementActive: false,
      uiHidingActive: false,
    };
  }

  if (adminUsersPhaseW3HasAnyRole(actor, ["view_only"])) {
    if (classification.paymentSensitive || adminUsersPhaseW3HasMutationOperation(classification.operationFamilies)) {
      reasons.push("View Only blocks payment-sensitive and mutation/action operations.");
      return {
        actorKey: actor.actorKey,
        displayName: actor.displayName,
        roleKeys: actor.roleKeys,
        path: classification.path,
        areaKey: classification.areaKey,
        operationFamilies: classification.operationFamilies,
        paymentSensitive: classification.paymentSensitive,
        adminOnly: classification.adminOnly,
        adminCardGrantKey: classification.adminCardGrantKey,
        decision: "block",
        reasons,
        dryRunOnly: true,
        enforcementActive: false,
        uiHidingActive: false,
      };
    }
    reasons.push("View Only allows non-admin view/search-style operations.");
    return {
      actorKey: actor.actorKey,
      displayName: actor.displayName,
      roleKeys: actor.roleKeys,
      path: classification.path,
      areaKey: classification.areaKey,
      operationFamilies: classification.operationFamilies,
      paymentSensitive: classification.paymentSensitive,
      adminOnly: classification.adminOnly,
      adminCardGrantKey: classification.adminCardGrantKey,
      decision: "allow",
      reasons,
      dryRunOnly: true,
      enforcementActive: false,
      uiHidingActive: false,
    };
  }

  reasons.push("No recognized role allowed this route.");
  return {
    actorKey: actor.actorKey,
    displayName: actor.displayName,
    roleKeys: actor.roleKeys,
    path: classification.path,
    areaKey: classification.areaKey,
    operationFamilies: classification.operationFamilies,
    paymentSensitive: classification.paymentSensitive,
    adminOnly: classification.adminOnly,
    adminCardGrantKey: classification.adminCardGrantKey,
    decision: "block",
    reasons,
    dryRunOnly: true,
    enforcementActive: false,
    uiHidingActive: false,
  };
}

export function adminUsersPhaseW3SummarizeActor(results: AdminUsersPhaseW3SimulationResult[]): AdminUsersPhaseW3ActorSummary {
  const first = results[0];
  return {
    actorKey: first?.actorKey || "unknown",
    displayName: first?.displayName || "Unknown",
    roleKeys: first?.roleKeys || [],
    allowCount: results.filter((row) => row.decision === "allow").length,
    blockCount: results.filter((row) => row.decision === "block").length,
    blockedAdminCount: results.filter((row) => row.decision === "block" && row.adminOnly).length,
    blockedPaymentCount: results.filter((row) => row.decision === "block" && row.paymentSensitive).length,
    blockedMutationCount: results.filter((row) => row.decision === "block" && adminUsersPhaseW3HasMutationOperation(row.operationFamilies)).length,
  };
}
