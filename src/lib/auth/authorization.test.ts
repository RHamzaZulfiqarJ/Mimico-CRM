import { describe, expect, it } from "vitest";

import {
  canAccessLead,
  canAccessTask,
  canAssignRole,
  canCreateLead,
  canDecideApproval,
  canDeleteOperationalRecord,
  canManageOrganization,
  canManageMember,
  canManageSale,
  canReadAuditLog,
  canUpdateTask,
  isStaff,
  membershipRoles,
} from "@/lib/auth/authorization";

describe("role authorization", () => {
  it.each([
    ["CLIENT", false, false],
    ["EMPLOYEE", true, false],
    ["MANAGER", true, true],
    ["SUPER_ADMIN", true, true],
  ] as const)(
    "%s receives the expected staff and management access",
    (role, expectedStaff, expectedManagement) => {
      expect(isStaff(role)).toBe(expectedStaff);
      expect(canCreateLead(role)).toBe(expectedStaff);
      expect(canManageOrganization(role)).toBe(expectedManagement);
      expect(canDeleteOperationalRecord(role)).toBe(expectedManagement);
      expect(canDecideApproval(role)).toBe(expectedManagement);
      expect(canReadAuditLog(role)).toBe(expectedManagement);
    },
  );

  it("keeps the role matrix exhaustive", () => {
    expect(membershipRoles).toEqual([
      "CLIENT",
      "EMPLOYEE",
      "MANAGER",
      "SUPER_ADMIN",
    ]);
  });

  it("limits employee lead access to assigned leads", () => {
    expect(
      canAccessLead({
        role: "EMPLOYEE",
        isAssigned: true,
        isPortalClient: false,
      }),
    ).toBe(true);
    expect(
      canAccessLead({
        role: "EMPLOYEE",
        isAssigned: false,
        isPortalClient: false,
      }),
    ).toBe(false);
  });

  it("limits clients to leads attached to their portal profile", () => {
    expect(
      canAccessLead({
        role: "CLIENT",
        isAssigned: false,
        isPortalClient: true,
      }),
    ).toBe(true);
    expect(
      canAccessLead({
        role: "CLIENT",
        isAssigned: true,
        isPortalClient: false,
      }),
    ).toBe(false);
  });

  it.each(["MANAGER", "SUPER_ADMIN"] as const)(
    "allows %s to access any organization lead",
    (role) => {
      expect(
        canAccessLead({
          role,
          isAssigned: false,
          isPortalClient: false,
        }),
      ).toBe(true);
    },
  );

  it("prevents privilege escalation and super-admin management by managers", () => {
    expect(canAssignRole("MANAGER", "MANAGER")).toBe(true);
    expect(canAssignRole("MANAGER", "SUPER_ADMIN")).toBe(false);
    expect(canManageMember("MANAGER", "SUPER_ADMIN")).toBe(false);
    expect(canAssignRole("SUPER_ADMIN", "SUPER_ADMIN")).toBe(true);
    expect(canManageMember("SUPER_ADMIN", "SUPER_ADMIN")).toBe(true);
  });

  it("lets employees read created tasks but update only assigned tasks", () => {
    expect(canAccessTask({ role: "EMPLOYEE", isAssigned: false, isCreator: true })).toBe(true);
    expect(canUpdateTask({ role: "EMPLOYEE", isAssigned: false, isCreator: true })).toBe(false);
    expect(canUpdateTask({ role: "EMPLOYEE", isAssigned: true, isCreator: false })).toBe(true);
  });

  it("keeps task access staff-only and gives management organization access", () => {
    expect(canAccessTask({ role: "CLIENT", isAssigned: true, isCreator: true })).toBe(false);
    expect(canAccessTask({ role: "MANAGER", isAssigned: false, isCreator: false })).toBe(true);
    expect(canUpdateTask({ role: "SUPER_ADMIN", isAssigned: false, isCreator: false })).toBe(true);
  });

  it("limits employees to their own sales while management can manage all sales", () => {
    expect(canManageSale({ role: "EMPLOYEE", isOwner: true })).toBe(true);
    expect(canManageSale({ role: "EMPLOYEE", isOwner: false })).toBe(false);
    expect(canManageSale({ role: "CLIENT", isOwner: true })).toBe(false);
    expect(canManageSale({ role: "MANAGER", isOwner: false })).toBe(true);
    expect(canManageSale({ role: "SUPER_ADMIN", isOwner: false })).toBe(true);
  });
});
