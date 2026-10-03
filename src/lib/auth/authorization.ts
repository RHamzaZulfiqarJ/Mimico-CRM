export const membershipRoles = [
  "CLIENT",
  "EMPLOYEE",
  "MANAGER",
  "SUPER_ADMIN",
] as const;

export type MembershipRole = (typeof membershipRoles)[number];

export type LeadAccessContext = {
  role: MembershipRole;
  isAssigned: boolean;
  isPortalClient: boolean;
};

export type TaskAccessContext = {
  role: MembershipRole;
  isAssigned: boolean;
  isCreator: boolean;
};

export type SaleAccessContext = {
  role: MembershipRole;
  isOwner: boolean;
};

const staffRoles = new Set<MembershipRole>([
  "EMPLOYEE",
  "MANAGER",
  "SUPER_ADMIN",
]);

const managementRoles = new Set<MembershipRole>(["MANAGER", "SUPER_ADMIN"]);

export function isStaff(role: MembershipRole): boolean {
  return staffRoles.has(role);
}

export function canManageOrganization(role: MembershipRole): boolean {
  return managementRoles.has(role);
}

export function canDeleteOperationalRecord(role: MembershipRole): boolean {
  return managementRoles.has(role);
}

export function canCreateLead(role: MembershipRole): boolean {
  return staffRoles.has(role);
}

export function canAccessLead({
  role,
  isAssigned,
  isPortalClient,
}: LeadAccessContext): boolean {
  if (managementRoles.has(role)) {
    return true;
  }

  if (role === "EMPLOYEE") {
    return isAssigned;
  }

  return isPortalClient;
}

export function canAccessTask({ role, isAssigned, isCreator }: TaskAccessContext): boolean {
  if (managementRoles.has(role)) return true;
  return role === "EMPLOYEE" && (isAssigned || isCreator);
}

export function canUpdateTask({ role, isAssigned }: TaskAccessContext): boolean {
  if (managementRoles.has(role)) return true;
  return role === "EMPLOYEE" && isAssigned;
}

export function canManageSale({ role, isOwner }: SaleAccessContext): boolean {
  if (managementRoles.has(role)) return true;
  return role === "EMPLOYEE" && isOwner;
}

export function canDecideApproval(role: MembershipRole): boolean {
  return managementRoles.has(role);
}

export function canReadAuditLog(role: MembershipRole): boolean {
  return managementRoles.has(role);
}

export function canAssignRole(
  actorRole: MembershipRole,
  assignedRole: MembershipRole,
): boolean {
  if (!managementRoles.has(actorRole)) {
    return false;
  }

  return assignedRole !== "SUPER_ADMIN" || actorRole === "SUPER_ADMIN";
}

export function canManageMember(
  actorRole: MembershipRole,
  targetRole: MembershipRole,
): boolean {
  if (!managementRoles.has(actorRole)) {
    return false;
  }

  return targetRole !== "SUPER_ADMIN" || actorRole === "SUPER_ADMIN";
}
