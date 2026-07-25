import { readFile } from "node:fs/promises";
import { fileURLToPath, URL as NodeUrl } from "node:url";
import { describe, expect, it } from "vitest";

import type { AdminProductRole } from "@pollycar/contracts";
import {
  adminV2CanonicalShell,
  adminV2CanonicalShellModules,
  adminV2CompatibilityShells,
  adminV2DetailRoutePatterns,
  adminV2Domains,
  adminV2MissingAcceptanceRoles,
  adminV2RequiredViewports,
  adminV2RoleTaskModes,
} from "./admin-v2-governance";

const contractRoles = [
  "platform_access_administrator",
  "operations_officer",
  "operations_lead",
  "operator_management_officer",
  "reviewer",
  "senior_reviewer",
  "customer_support",
  "support_lead",
  "safety_officer",
  "safety_lead",
  "finance_officer",
  "finance_lead",
  "privacy_compliance",
  "data_analyst",
  "auditor",
  "technical_operations",
  "executive_sponsor",
  "operator_account_administrator",
  "operator_operations_lead",
  "operator_fleet_officer",
  "operator_customer_support",
  "operator_safety_liaison",
  "operator_finance_officer",
  "operator_finance_lead",
  "operator_auditor",
  "operator_executive",
] satisfies readonly AdminProductRole[];

describe("Admin v2 治理", () => {
  it("唯一产品壳和兼容壳边界保持明确", async () => {
    const shell = await source("../app/shell.tsx");
    const build = await source("../../scripts/build-admin-environment.mjs");
    const productShell = await source(
      "../features/admin-productization/productized-admin-shell.tsx",
    );
    const productLayout = await source(
      "../features/admin-productization/productized-admin-layout.tsx",
    );
    const masterDetailWorkspace = await source(
      "../features/admin-productization/admin-master-detail-workspace.tsx",
    );
    const governanceActions = await source(
      "../features/admin-productization/admin-governance-actions.tsx",
    );
    const vehicleWorkspace = await source(
      "../features/admin-productization/vehicle-review-workspace.tsx",
    );
    const supportingExperience = await source(
      "../features/admin-productization/admin-supporting-experience.tsx",
    );

    expect(adminV2CanonicalShell).toBe("ProductizedAdminShell");
    expect(adminV2CanonicalShellModules).toEqual([
      "ProductizedAdminLayout",
      "AdminMasterDetailWorkspace",
      "AdminRiskConfirmationDialog",
      "VehicleReviewWorkspace",
      "FocusTrapDialog",
    ]);
    expect(adminV2CompatibilityShells).toEqual([
      "LegacyShell",
      "StageOneShell",
    ]);
    expect(shell).toContain("return <LegacyShell />");
    expect(shell).toContain("return <ProductizedAdminShell");
    expect(shell).toContain("<StageOneShell");
    expect(build).toContain('VITE_SYNTHETIC_ADMIN_MULTI_ORGANIZATION: "true"');
    expect(build).toContain('VITE_SYNTHETIC_ADMIN_AUTHENTICATION: "true"');
    expect(build).toContain('VITE_SYNTHETIC_ADMIN_ROLE_ACCESS_MATRIX: "true"');
    expect(productShell).toContain("ProductizedAdminLayout");
    expect(productShell).toContain('label="角色任务工作区"');
    expect(productShell).toContain('label="运营公司工作区"');
    expect(productShell).toContain('label="行程运营工作区"');
    expect(productShell).toContain('label="客服与安全工作区"');
    expect(productShell).toContain('label="车主名录工作区"');
    expect(productShell).toContain('label="财务与对账工作区"');
    expect(productShell).toContain('label="成员与权限工作区"');
    expect(productShell).toContain('label="数据与报表工作区"');
    expect(productShell).toContain('label="高层驾驶舱工作区"');
    expect(productShell).toContain('label="审计与系统工作区"');
    expect(productShell).toContain('titleId="data-report-refresh-confirmation-title"');
    expect(productShell).toContain('titleId="executive-export-confirmation-title"');
    expect(productShell).toContain('titleId="audit-action-confirmation-title"');
    expect(masterDetailWorkspace).toContain("admin-master-detail-workspace");
    expect(governanceActions).toContain("<FocusTrapDialog");
    expect(governanceActions).toContain("你的工作范围");
    expect(governanceActions).toContain("是否可恢复");
    expect(productShell).toContain("VehicleReviewWorkspace");
    expect(productLayout).toContain('aria-haspopup="menu"');
    expect(productLayout).toContain("确认工作范围");
    expect(vehicleWorkspace).toContain('aria-label="车辆审核主从工作区"');
    expect(vehicleWorkspace).toContain("<FocusTrapDialog");
    expect(vehicleWorkspace).toContain("正在确认");
    expect(supportingExperience).toContain("AdminEntryShell");
    expect(supportingExperience).toContain("AdminEntryHeader");
    expect(supportingExperience).toContain("AdminPageState");
    expect(productShell).not.toContain("EntryFrame");
    expect(productShell).not.toContain("任务闭环标准");
    expect(productShell).not.toContain("接入服务端数据");
  });

  it("十个导航领域和详情路由保持完整且唯一", () => {
    expect(adminV2Domains).toHaveLength(10);
    expect(new Set(adminV2Domains.map((domain) => domain.id)).size).toBe(10);
    expect(new Set(adminV2Domains.map((domain) => domain.route)).size).toBe(10);
    expect(adminV2DetailRoutePatterns).toHaveLength(11);
    expect(adminV2RequiredViewports).toEqual([
      { id: "desktop-standard", width: 1280, height: 800 },
      { id: "desktop-wide", width: 1440, height: 900 },
    ]);
  });

  it("二十六个角色被七种任务模式完整且唯一覆盖", () => {
    const groupedRoles = Object.values(adminV2RoleTaskModes).flat();

    expect(groupedRoles).toHaveLength(contractRoles.length);
    expect(new Set(groupedRoles).size).toBe(contractRoles.length);
    expect([...groupedRoles].sort()).toEqual([...contractRoles].sort());
  });

  it("二十六个角色均具备可登录验收身份样本", () => {
    expect(adminV2MissingAcceptanceRoles).toEqual([]);
  });

  it("产品壳保持视口固定和内容区内部滚动", async () => {
    const styles = await source(
      "../features/admin-productization/productized-admin-shell.css",
    );

    expect(styles).toContain(
      ".product-shell{height:100vh;min-height:0;overflow:hidden}",
    );
    expect(styles).toContain(
      ".product-main{height:100vh;min-height:0;display:grid;grid-template-rows:72px minmax(0,1fr);overflow:hidden}",
    );
    expect(styles).toContain(
      ".product-content{min-height:0;margin:0 auto;overflow:auto;overscroll-behavior:contain}",
    );
    expect(styles).toContain("overflow-wrap:anywhere");
    expect(styles).toContain(
      '[data-theme="dark"] .product-shell{background:var(--page);color:var(--text)}',
    );
    expect(styles).toContain(
      '[data-theme="dark"] .task-panel',
    );
    expect(styles).toContain(".admin-page-state");
    expect(styles).toContain('[data-theme="dark"] .admin-page-state');
  });
});

async function source(relativePath: string): Promise<string> {
  return readFile(
    fileURLToPath(new NodeUrl(relativePath, import.meta.url)),
    "utf8",
  );
}
