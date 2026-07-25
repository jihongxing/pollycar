import type { VehicleReviewStatus, VehicleReviewView } from "@pollycar/contracts";
import { describe, expect, it } from "vitest";

import {
  formatVehicleReviewDate,
  vehicleReviewEntryCopy,
  vehicleReviewMaterialCopy,
  vehicleReviewMaterialRequirements,
  vehicleReviewStatusLabel,
  vehicleReviewTimeline,
} from "./vehicle-review-presentation";

describe("车辆审核产品展示模型", () => {
  it.each([
    ["draft", "准备中", "开始准备"],
    ["under_review", "审核中", "查看审核进度"],
    ["needs_material", "待补充", "继续补充资料"],
    ["approved", "审核完成", "查看审核结果"],
  ] satisfies readonly [VehicleReviewStatus, string, string][])(
    "将 %s 转换为用户可理解的状态",
    (status, label, actionLabel) => {
      expect(vehicleReviewStatusLabel(status)).toBe(label);
      expect(vehicleReviewEntryCopy(status).actionLabel).toBe(actionLabel);
    },
  );

  it("把审核时间线转换为明确的当前步骤", () => {
    const timeline = vehicleReviewTimeline({
      ...review("under_review"),
      timeline: [
        {
          code: "submitted",
          label: "vehicle_review_submitted",
          occurredAt: "2026-07-18T02:00:00.000Z",
          state: "complete",
        },
        {
          code: "review_started",
          label: "vehicle_review_started",
          occurredAt: "2026-07-18T02:05:00.000Z",
          state: "current",
        },
      ],
    });

    expect(timeline).toEqual([
      {
        label: "资料已提交",
        value: "7月18日 10:00",
        tone: "driver",
      },
      {
        label: "审核已开始",
        value: "7月18日 10:05",
        detail: "当前正在处理",
        tone: "driver",
      },
    ]);
  });

  it("审核中缺少当前节点时提供稳定的等待说明", () => {
    expect(vehicleReviewTimeline(review("under_review"))).toEqual([
      {
        label: "等待审核结果",
        value: "当前无需操作",
        detail: "状态变化后可从账户与身份入口继续",
        tone: "driver",
      },
    ]);
  });

  it("补充资料只表达用户需要处理的当前信息", () => {
    const material = vehicleReviewMaterialCopy({
      ...review("needs_material"),
      syntheticAttachmentId: "synthetic-insurance-secret",
      requestedMaterialCodes: ["insurance_expiration_document"],
      decisionCode: "request_material",
    });

    expect(material).toEqual({
      title: "更新保险有效期",
      description: "请补充仍在有效期内的保险材料和到期日。",
    });
    expect(JSON.stringify(material)).not.toMatch(
      /synthetic|insurance_expiration_document|request_material/i,
    );
  });

  it("按审核请求定向展示多项待补材料", () => {
    const materials = vehicleReviewMaterialRequirements({
      ...review("needs_material"),
      requestedMaterialCodes: [
        "driver_license_document",
        "vehicle_registration_document",
        "insurance_expiration_document",
      ],
    });

    expect(materials.map((material) => material.code)).toEqual([
      "driver_license",
      "vehicle_registration",
      "insurance_proof",
    ]);
    expect(materials.find((material) => material.code === "insurance_proof")?.needsInsuranceDate).toBe(true);
  });
});

function review(status: VehicleReviewStatus): VehicleReviewView {
  return {
    applicationId: "vehicle-application-7",
    accountId: "synthetic-account-7",
    status,
    version: 2,
    ownerIdentityAvailable: status === "approved",
    maxPassengerCount: 1,
    vehicleType: "中大型轿车 · 示例 A",
    insuranceExpiresOn: "2027-08-31",
    requestedMaterialCodes: [],
    timeline: [],
    synthetic: true,
  };
}
