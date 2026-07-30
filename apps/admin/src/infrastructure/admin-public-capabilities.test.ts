import { describe, expect, it } from "vitest";
import { createAdminPublicConfig } from "@pollycar/configuration/public";
import { resolveAdminPublicCapabilities } from "./admin-public-capabilities";

describe("resolveAdminPublicCapabilities", () => {
  it("集中解析 Profile 生成的 Admin 能力", () => {
    const capabilities = resolveAdminPublicCapabilities(
      createAdminPublicConfig({
        profile: "test",
        apiBaseUrl: "http://127.0.0.1:4321",
        capabilities: {
          multiOrganization: true,
          authentication: true,
          roleAccessMatrix: true,
          operatorManagement: true,
          tripOperations: true,
          caseManagement: true,
          financeOperations: true,
          executiveDashboard: true,
        },
      }),
    );

    expect(capabilities).toEqual({
      multiOrganizationEnabled: true,
      authenticationEnabled: true,
      roleAccessMatrixEnabled: true,
      operatorManagementEnabled: true,
      tripOperationsEnabled: true,
      caseManagementEnabled: true,
      financeOperationsEnabled: true,
      executiveDashboardEnabled: true,
    });
  });

  it("未知或缺失值保持关闭", () => {
    expect(
      resolveAdminPublicCapabilities(
        createAdminPublicConfig({
          profile: "test",
          apiBaseUrl: "http://127.0.0.1:4321",
        }),
      ),
    ).toEqual({
      multiOrganizationEnabled: false,
      authenticationEnabled: false,
      roleAccessMatrixEnabled: false,
      operatorManagementEnabled: false,
      tripOperationsEnabled: false,
      caseManagementEnabled: false,
      financeOperationsEnabled: false,
      executiveDashboardEnabled: false,
    });
  });
});
