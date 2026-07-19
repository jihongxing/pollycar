import type {
  AdultEligibilityFailureCode,
  AdultEligibilityVerificationView,
} from "@pollycar/contracts";

export type AdultEligibilityPresentation = Readonly<{
  eyebrow: string;
  title: string;
  description: string;
  statusLabel: string;
  currentStep: number;
  tone: "neutral" | "passenger" | "safety";
}>;

export function adultEligibilityPresentation(
  verification: AdultEligibilityVerificationView,
): AdultEligibilityPresentation {
  if (verification.state === "verified") {
    return {
      eyebrow: "账户 · 使用条件",
      title: "实名信息已确认",
      description: "现在可以使用乘客行程，也可以继续准备车主身份。",
      statusLabel: "已完成",
      currentStep: 2,
      tone: "passenger",
    };
  }
  if (verification.state === "processing" || verification.state === "needs_review") {
    return {
      eyebrow: "账户 · 使用条件",
      title: "正在确认使用条件",
      description: "当前无需重复操作，结果更新后会显示下一步。",
      statusLabel: "确认中",
      currentStep: 1,
      tone: "neutral",
    };
  }
  if (
    verification.state === "needs_retry" ||
    verification.state === "rejected" ||
    verification.state === "expired" ||
    verification.state === "suspended" ||
    verification.state === "revoked"
  ) {
    return {
      eyebrow: "账户 · 使用条件",
      title: verification.state === "rejected" ? "暂时无法完成实名" : "实名信息需要继续处理",
      description: failureText(verification.failureCode),
      statusLabel: "需要处理",
      currentStep: 1,
      tone: "safety",
    };
  }
  return {
    eyebrow: "账户 · 使用条件",
    title: verification.consent.identityProcessingAuthorized
      ? "准备完成实名确认"
      : "先确认本人和成年条件",
    description: verification.consent.identityProcessingAuthorized
      ? "接下来会连续完成证件拍摄和本人验证。"
      : "一次完成必要确认，结果只用于判断是否可以使用行程服务。",
    statusLabel: verification.consent.identityProcessingAuthorized ? "待验证" : "待了解",
    currentStep: verification.consent.identityProcessingAuthorized ? 1 : 0,
    tone: "passenger",
  };
}

export function failureText(code?: AdultEligibilityFailureCode): string {
  return ({
    document_incomplete: "证件信息不完整，请按提示重新拍摄。",
    document_invalid: "证件图像或证件状态未通过，请重新拍摄。",
    document_expired: "证件已过有效期，请更换有效证件。",
    document_unsupported: "当前证件类型暂不支持，请查看可用方式。",
    underage: "当前结果显示暂不符合成年使用条件。",
    liveness_failed: "本人验证未通过，请在光线充足处重试。",
    face_mismatch: "本人信息暂未匹配，请重新完成拍摄。",
    provider_timeout: "结果返回时间较长，请稍后查看最新进展。",
    provider_unavailable: "实名服务暂时不可用，请稍后重试。",
    result_unknown: "结果暂时无法确认，请勿重复操作，可提交复核说明。",
    manual_review_required: "当前情况需要进一步复核，请提交说明后等待处理。",
  } satisfies Record<AdultEligibilityFailureCode, string>)[code ?? "provider_unavailable"];
}
