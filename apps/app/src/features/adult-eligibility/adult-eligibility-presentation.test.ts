import { describe, expect, it } from "vitest";
import type { AdultEligibilityVerificationView } from "@pollycar/contracts";

import { adultEligibilityPresentation, failureText } from "./adult-eligibility-presentation";

const base = {
  accountId: "account-1",
  state: "not_started",
  version: 1,
  requiredDocumentSides: ["front", "back"],
  uploadedDocuments: [],
  checks: {
    document: { status: "not_started" },
    age: { status: "not_started" },
    liveness: { status: "not_started" },
    faceMatch: { status: "not_started" },
  },
  recoveryAction: "upload_document",
  captureStage: "intro",
  provider: { status: "not_started" },
  allowedActions: ["authorize"],
  businessAccessAllowed: false,
  realIdentityDataEnabled: false,
  realBiometricDataEnabled: false,
  externalIdentityProviderEnabled: false,
  consent: {
    identityProcessingAuthorized: false,
    biometricProcessingAuthorized: false,
    thirdPartyProcessingAuthorized: false,
  },
  synthetic: true,
} as const satisfies AdultEligibilityVerificationView;

describe("我的实名展示模型", () => {
  it("用产品目的解释首次确认", () => {
    const presentation = adultEligibilityPresentation(base);
    expect(presentation.title).toBe("先确认本人和成年条件");
    expect(presentation.description).toContain("行程服务");
  });

  it("完成后不承诺改变车主准入状态", () => {
    const presentation = adultEligibilityPresentation({
      ...base,
      state: "verified",
      businessAccessAllowed: true,
      result: {
        legalNameMasked: "林*",
        documentNumberMasked: "31**************12",
        adultConfirmed: true,
        legalGender: "female",
        source: "verified_identity_document",
        userEditable: false,
        verifiedAt: "2026-07-18T00:00:00.000Z",
      },
    });
    expect(presentation.description).toBe("现在可以使用乘客行程，也可以继续准备车主身份。");
  });

  it("失败原因不暴露服务商或内部状态", () => {
    const text = failureText("result_unknown");
    expect(text).not.toMatch(/provider|枚举|错误码|内部|沙箱/);
    expect(text).toContain("复核");
  });
});
