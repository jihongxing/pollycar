import { describe, expect, it } from "vitest";
import { resolveFeatureGates } from "@pollycar/contracts";
import { createInternalSandboxConfig, createProductionConfig } from "./config.js";

describe("内部生产级沙箱功能门禁", () => {
  it("默认关闭所有真实能力", () => {
    expect(createInternalSandboxConfig()).toEqual({
      environment: "internal-sandbox",
      dataMode: "synthetic",
      persistence: {
        mode: "memory",
      },
      http: {
        host: "127.0.0.1",
        port: 4310,
        allowedOrigins: [
          "http://127.0.0.1:4173",
          "http://localhost:4173",
          "http://127.0.0.1:4174",
          "http://localhost:4174",
          "http://127.0.0.1:8081",
          "http://localhost:8081",
          "http://127.0.0.1:8181",
          "http://localhost:8181",
        ],
      },
      featureGates: {
        productionEnabled: false,
        syntheticAdminMultiOrganization: false,
        syntheticAdminAuthentication: false,
        syntheticAdminRoleAccessMatrix: false,
        syntheticAdminOperatorManagement: false,
        syntheticAdminDriverVehicle: false,
        syntheticAdminTripOperations: false,
        syntheticAdminCaseManagement: false,
        syntheticAdminFinanceOperations: false,
        syntheticAdminExecutiveDashboard: false,
        syntheticAdminAuditSystem: false,
        syntheticAdminDataReports: false,
        syntheticAdminOrganizationAccounts: false,
        realAdminOrganizationAccounts: false,
        realAdminFinanceOperations: false,
        productionAdminEnabled: false,
        syntheticFinancialLedger: false,
        syntheticFinancialReconciliation: false,
        syntheticOperatorFunds: false,
        realPayment: false,
        realSettlement: false,
        realWithdrawal: false,
        driverEarlySettlementEnabled: false,
        realOperatorOnboarding: false,
        paidFlexTrial: false,
        realUserInvitation: false,
        shanghaiPilot: false,
        realDataIngestion: false,
        realIdentityVerification: false,
        realBiometricVerification: false,
        externalIdentityProvider: false,
        realSmsDelivery: false,
        realPhoneData: false,
        productionAuthentication: false,
        realMap: false,
        externalMapProvider: false,
        realDeviceLocation: false,
        backgroundLocation: false,
        realVehicleLocationStream: false,
        amapSdk: false,
        amapWebService: false,
        internalSandbox: true,
      },
    });
  });

  it("只允许显式配置本机 PostgreSQL", () => {
    expect(
      createInternalSandboxConfig({
        databaseUrl: "postgresql://pollycar@127.0.0.1:5432/pollycar_sandbox",
      }).persistence,
    ).toEqual({
      mode: "postgres",
      databaseUrl: "postgresql://pollycar@127.0.0.1:5432/pollycar_sandbox",
    });
    expect(() =>
      createInternalSandboxConfig({
        databaseUrl: "postgresql://pollycar@db.example.com:5432/pollycar",
      }),
    ).toThrow("INTERNAL_SANDBOX_DATABASE_MUST_BE_LOCAL");
  });

  it("单一开关不能绕过依赖门禁", () => {
    expect(
      resolveFeatureGates({
        realPayment: true,
        paidFlexTrial: true,
        realUserInvitation: true,
        shanghaiPilot: true,
        realIdentityVerification: true,
        realBiometricVerification: true,
        externalIdentityProvider: true,
      }),
    ).toMatchObject({
      syntheticAdminMultiOrganization: false,
      realPayment: false,
      paidFlexTrial: false,
      realUserInvitation: false,
      shanghaiPilot: false,
      realIdentityVerification: false,
      realBiometricVerification: false,
      externalIdentityProvider: false,
    });
  });

  it("多组织后台只能在内部沙箱显式开启", () => {
    expect(
      resolveFeatureGates({
        syntheticAdminMultiOrganization: true,
        internalSandbox: true,
      }).syntheticAdminMultiOrganization,
    ).toBe(true);
    expect(
      resolveFeatureGates({
        syntheticAdminMultiOrganization: true,
        internalSandbox: false,
      }).syntheticAdminMultiOrganization,
    ).toBe(false);
  });

  it("组织与运力门禁依赖阶段一多组织底座", () => {
    expect(
      resolveFeatureGates({
        syntheticAdminOperatorManagement: true,
        internalSandbox: true,
      }).syntheticAdminOperatorManagement,
    ).toBe(false);
    expect(
      resolveFeatureGates({
        syntheticAdminMultiOrganization: true,
        syntheticAdminOperatorManagement: true,
        internalSandbox: true,
      }).syntheticAdminOperatorManagement,
    ).toBe(true);
  });

  it("车主车辆闭环门禁依赖认证权限矩阵和运营主体内核", () => {
    const dependencies = {
      syntheticAdminMultiOrganization: true,
      syntheticAdminAuthentication: true,
      syntheticAdminRoleAccessMatrix: true,
      syntheticAdminOperatorManagement: true,
      syntheticAdminDriverVehicle: true,
      internalSandbox: true,
    };
    expect(
      resolveFeatureGates(dependencies).syntheticAdminDriverVehicle,
    ).toBe(true);
    for (const dependency of [
      "syntheticAdminMultiOrganization",
      "syntheticAdminAuthentication",
      "syntheticAdminRoleAccessMatrix",
      "syntheticAdminOperatorManagement",
      "internalSandbox",
    ] as const) {
      expect(
        resolveFeatureGates({
          ...dependencies,
          [dependency]: false,
        }).syntheticAdminDriverVehicle,
      ).toBe(false);
    }
  });

  it("高层驾驶舱对阶段一至四门禁失败关闭", () => {
    const allDependencies = {
      syntheticAdminMultiOrganization: true,
      syntheticAdminOperatorManagement: true,
      syntheticAdminTripOperations: true,
      syntheticAdminCaseManagement: true,
      syntheticAdminFinanceOperations: true,
      syntheticFinancialLedger: true,
      syntheticFinancialReconciliation: true,
      syntheticOperatorFunds: true,
      syntheticAdminExecutiveDashboard: true,
      internalSandbox: true,
    };

    expect(
      resolveFeatureGates(allDependencies).syntheticAdminExecutiveDashboard,
    ).toBe(true);

    for (const dependency of [
      "syntheticAdminMultiOrganization",
      "syntheticAdminOperatorManagement",
      "syntheticAdminTripOperations",
      "syntheticAdminCaseManagement",
      "syntheticAdminFinanceOperations",
      "syntheticFinancialLedger",
      "syntheticFinancialReconciliation",
      "syntheticOperatorFunds",
      "internalSandbox",
    ] as const) {
      expect(
        resolveFeatureGates({
          ...allDependencies,
          [dependency]: false,
        }).syntheticAdminExecutiveDashboard,
      ).toBe(false);
    }
  });

  it("审计与系统依赖统一多组织和高层驾驶舱门禁", () => {
    const dependencies = {
      syntheticAdminMultiOrganization: true,
      syntheticAdminOperatorManagement: true,
      syntheticAdminTripOperations: true,
      syntheticAdminCaseManagement: true,
      syntheticAdminFinanceOperations: true,
      syntheticFinancialLedger: true,
      syntheticFinancialReconciliation: true,
      syntheticOperatorFunds: true,
      syntheticAdminExecutiveDashboard: true,
      syntheticAdminAuditSystem: true,
      internalSandbox: true,
    };
    expect(resolveFeatureGates(dependencies).syntheticAdminAuditSystem).toBe(true);
    for (const dependency of [
      "syntheticAdminMultiOrganization",
      "syntheticAdminExecutiveDashboard",
      "internalSandbox",
    ] as const) {
      expect(
        resolveFeatureGates({
          ...dependencies,
          [dependency]: false,
        }).syntheticAdminAuditSystem,
      ).toBe(false);
    }
  });

  it("数据与报表依赖高层驾驶舱和统一审计门禁", () => {
    const dependencies = {
      syntheticAdminMultiOrganization: true,
      syntheticAdminOperatorManagement: true,
      syntheticAdminTripOperations: true,
      syntheticAdminCaseManagement: true,
      syntheticAdminFinanceOperations: true,
      syntheticFinancialLedger: true,
      syntheticFinancialReconciliation: true,
      syntheticOperatorFunds: true,
      syntheticAdminExecutiveDashboard: true,
      syntheticAdminAuditSystem: true,
      syntheticAdminDataReports: true,
      internalSandbox: true,
    };
    expect(resolveFeatureGates(dependencies).syntheticAdminDataReports).toBe(true);
    for (const dependency of [
      "syntheticAdminMultiOrganization",
      "syntheticAdminExecutiveDashboard",
      "syntheticAdminAuditSystem",
      "internalSandbox",
    ] as const) {
      expect(
        resolveFeatureGates({
          ...dependencies,
          [dependency]: false,
        }).syntheticAdminDataReports,
      ).toBe(false);
    }
  });
});

describe("生产基础设施配置", () => {
  const validEnvironment = {
    POLLYCAR_PRODUCTION_DATABASE_URL:
      "postgresql://pollycar@db.pollycar.example:5432/pollycar?sslmode=verify-full",
    POLLYCAR_PRODUCTION_DATABASE_CA_PATH: "/run/secrets/pollycar-postgres-ca.crt",
    POLLYCAR_PRODUCTION_PUBLIC_BASE_URL: "https://api.pollycar.example",
    POLLYCAR_PRODUCTION_ALLOWED_ORIGINS:
      "https://app.pollycar.example,https://admin.pollycar.example",
    POLLYCAR_SECRET_PROVIDER_REFERENCE: "vault://pollycar/production",
    POLLYCAR_OTLP_ENDPOINT: "https://otel.pollycar.example",
  };

  it("创建独立生产基础设施配置并强制关闭全部业务能力", () => {
    const config = createProductionConfig(validEnvironment);

    expect(config).toMatchObject({
      environment: "production",
      releaseMode: "infrastructure-readiness",
      dataMode: "real-disabled",
      persistence: {
        mode: "postgres",
        requireTls: true,
      },
      http: {
        publicBaseUrl: "https://api.pollycar.example",
        requireForwardedHttps: true,
      },
      secrets: {
        provider: "managed",
        rawVendorSecretsAllowed: false,
      },
      monitoring: {
        serviceName: "pollycar-server",
        otlpEndpoint: "https://otel.pollycar.example",
      },
    });
    expect(Object.values(config.featureGates).every((enabled) => !enabled)).toBe(true);
  });

  it("拒绝本机数据库、无 TLS 数据库和非 HTTPS 服务边界", () => {
    expect(() => createProductionConfig({
      ...validEnvironment,
      POLLYCAR_PRODUCTION_DATABASE_URL:
        "postgresql://pollycar@localhost:5432/pollycar?sslmode=require",
    })).toThrow("PRODUCTION_DATABASE_MUST_BE_REMOTE");
    expect(() => createProductionConfig({
      ...validEnvironment,
      POLLYCAR_PRODUCTION_DATABASE_URL:
        "postgresql://pollycar@db.pollycar.example:5432/pollycar",
    })).toThrow("PRODUCTION_DATABASE_TLS_REQUIRED");
    expect(() => createProductionConfig({
      ...validEnvironment,
      POLLYCAR_PRODUCTION_PUBLIC_BASE_URL: "http://api.pollycar.example",
    })).toThrow("PRODUCTION_PUBLIC_BASE_URL_HTTPS_REQUIRED");
  });

  it("拒绝缺少托管密钥引用、非 HTTPS 监控和原始供应商密钥", () => {
    expect(() => createProductionConfig({
      ...validEnvironment,
      POLLYCAR_SECRET_PROVIDER_REFERENCE: "",
    })).toThrow("PRODUCTION_CONFIGURATION_REQUIRED:POLLYCAR_SECRET_PROVIDER_REFERENCE");
    expect(() => createProductionConfig({
      ...validEnvironment,
      POLLYCAR_OTLP_ENDPOINT: "http://otel.pollycar.example",
    })).toThrow("PRODUCTION_OTLP_HTTPS_REQUIRED");
    expect(() => createProductionConfig({
      ...validEnvironment,
      POLLYCAR_AMAP_API_KEY: "raw-secret",
    })).toThrow("PRODUCTION_RAW_VENDOR_SECRET_FORBIDDEN:POLLYCAR_AMAP_API_KEY");
  });
});
