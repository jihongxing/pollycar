import { describe, expect, it } from "vitest";
import {
  defaultCapabilityLifecycleStates,
  isCapabilityLifecycleReady,
  resolveFeatureGates,
} from "./feature-gates.js";

describe("能力生命周期", () => {
  it("只有实现、批准、配置和启用全部满足时才可生效", () => {
    expect(isCapabilityLifecycleReady({
      implemented: true,
      approved: true,
      configured: true,
      enabled: true,
    })).toBe(true);
    expect(isCapabilityLifecycleReady({
      implemented: true,
      approved: true,
      configured: false,
      enabled: true,
    })).toBe(false);
  });

  it("所有真实生产能力默认保持未批准、未配置和未启用", () => {
    expect(defaultCapabilityLifecycleStates.productionEnabled).toMatchObject({
      implemented: true,
      approved: false,
      configured: false,
      enabled: false,
    });
    expect(defaultCapabilityLifecycleStates.realPayment).toEqual({
      implemented: false,
      approved: false,
      configured: false,
      enabled: false,
    });
  });
});

describe("新增门禁依赖", () => {
  it("合成财务后台依赖账本、对账和运营主体资金", () => {
    const dependencies = {
      internalSandbox: true,
      syntheticAdminMultiOrganization: true,
      syntheticAdminFinanceOperations: true,
      syntheticFinancialLedger: true,
      syntheticFinancialReconciliation: true,
      syntheticOperatorFunds: true,
    };

    expect(resolveFeatureGates(dependencies).syntheticAdminFinanceOperations).toBe(true);
    expect(resolveFeatureGates({
      ...dependencies,
      syntheticFinancialReconciliation: false,
    }).syntheticAdminFinanceOperations).toBe(false);
  });

  it("真实结算、提现和提前结算按风险顺序失败关闭", () => {
    const dependencies = {
      productionEnabled: true,
      shanghaiPilot: true,
      realUserInvitation: true,
      realDataIngestion: true,
      realSmsDelivery: true,
      realPhoneData: true,
      productionAuthentication: true,
      realAdminOrganizationAccounts: true,
      realPayment: true,
      realAdminFinanceOperations: true,
      realSettlement: true,
      realWithdrawal: true,
      driverEarlySettlementEnabled: true,
    };

    expect(resolveFeatureGates(dependencies)).toMatchObject({
      realPayment: true,
      realSettlement: true,
      realWithdrawal: true,
      driverEarlySettlementEnabled: true,
    });
    expect(resolveFeatureGates({
      ...dependencies,
      realSettlement: false,
    })).toMatchObject({
      realSettlement: false,
      realWithdrawal: false,
      driverEarlySettlementEnabled: false,
    });
  });
});
