import { describe, expect, it } from "vitest";

import {
  ownerAccessPresentation,
  ownerQualificationPresentation,
  ownerSafetyPresentation,
} from "./owner-access-presentation";

describe("车主账户与安全展示模型", () => {
  it("按车辆、资格和安全顺序给出唯一恢复入口", () => {
    expect(ownerAccessPresentation({
      reviewStatus: "draft",
      qualificationState: "invited",
      safetyState: "open_frozen",
    }).kind).toBe("vehicle");

    expect(ownerAccessPresentation({
      reviewStatus: "approved",
      qualificationState: "invited",
      safetyState: "open_frozen",
    }).kind).toBe("eligibility");

    expect(ownerAccessPresentation({
      reviewStatus: "approved",
      qualificationState: "active",
      safetyState: "open_frozen",
    })).toMatchObject({
      kind: "safety",
      actionLabel: "查看安全状态",
      target: "privacy-safety-settings",
    });
  });

  it("全部条件满足时只承诺进入车主首页", () => {
    expect(ownerAccessPresentation({
      reviewStatus: "approved",
      qualificationState: "active",
      safetyState: "restored",
    })).toEqual({
      kind: "ready",
      eyebrow: "车主准备 · 当前可用",
      title: "车主身份已经准备好",
      description: "可以进入车主首页查看当前任务；每次开始参与前仍会重新确认额度和安全状态。",
      actionLabel: "进入车主首页",
      target: "owner-workbench",
    });
  });

  it("资格状态不暴露内部枚举或试验字段", () => {
    const presentations = [
      ownerQualificationPresentation("invited"),
      ownerQualificationPresentation("under_review"),
      ownerQualificationPresentation("awaiting_confirmation"),
      ownerQualificationPresentation("active"),
      ownerQualificationPresentation("rejected"),
      ownerQualificationPresentation("expired"),
    ];

    expect(JSON.stringify(presentations)).not.toMatch(
      /under_review|awaiting_confirmation|batch_0|synthetic|合成|内部审核/i,
    );
  });

  it("安全状态转换为影响和下一步", () => {
    expect(ownerSafetyPresentation({ safetyState: "appealing" })).toEqual({
      title: "安全事项正在复核",
      description: "复核期间暂不能开始新的车主任务，结果更新后会显示下一步。",
      statusLabel: "复核中",
      needsAction: true,
    });
    expect(ownerSafetyPresentation({ safetyState: "restored" }).needsAction).toBe(false);
  });
});
