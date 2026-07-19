import type {
  FreeFlexTrialView,
  SyntheticTripDashboard,
  VehicleReviewView,
} from "@pollycar/contracts";
import { describe, expect, it } from "vitest";

import { buildSyntheticNotificationCenter } from "./notification-center";

describe("合成通知与任务中心", () => {
  it("从审核、资格和行程状态生成稳定待办", () => {
    const center = buildSyntheticNotificationCenter({
      review: { ...review, status: "needs_material" },
      trial: { ...trial, state: "awaiting_confirmation" },
      trips: {
        ...trips,
        passengerTrip: {
          tripId: "trip-1",
          passengerAccountId: "synthetic-account-7",
          state: "pending_payment",
          version: 1,
          originLabel: "起点",
          destinationLabel: "终点",
          passengerCount: 1,
          payment: { amountMinor: 0, currency: "CNY", realPayment: false, state: "pending_payment" },
          createdAt: "2026-07-12T00:00:00.000Z",
          recovery: { state: "none" },
          synthetic: true,
        },
      },
    });

    expect(center.pendingTaskCount).toBe(3);
    expect(center.realPushEnabled).toBe(false);
    expect(center.items.map((item) => item.target)).toEqual([
      "review-needs-material",
      "eligibility-settings",
      "trip-payment",
    ]);
  });

  it("安全冻结任务始终排在普通状态通知之前", () => {
    const center = buildSyntheticNotificationCenter({
      review: { ...review, status: "approved" },
      trial: { ...trial, state: "active" },
      trips,
      safety: {
        realChatEnabled: false,
        realEvidenceEnabled: false,
        safetyCase: {
          caseId: "case-1",
          tripId: "trip-1",
          reporterAccountId: "synthetic-passenger-8",
          reportedAccountId: "synthetic-account-7",
          reasonCode: "unsafe_behavior",
          state: "open_frozen",
          version: 1,
          createdAt: "2026-07-12T00:00:00.000Z",
          synthetic: true,
        },
      },
    });

    expect(center.items[0]?.domain).toBe("safety");
    expect(center.items[0]?.priority).toBe("urgent");
    expect(center.pendingTaskCount).toBe(1);
  });

  it("车辆审核通知不泄漏内部状态和合成实现语言", () => {
    const states = [
      "draft",
      "under_review",
      "needs_material",
      "approved",
      "suspended",
      "appealing",
      "revoked",
      "expired",
    ] as const;

    for (const status of states) {
      const center = buildSyntheticNotificationCenter({
        review: {
          ...review,
          status,
          syntheticAttachmentId: "synthetic-insurance-secret",
          requestedMaterialCodes: ["insurance_expiration_document"],
        },
        trial: { ...trial, state: "active" },
        trips,
      });
      const notification = center.items.find((item) => item.domain === "review");
      const visibleCopy = `${notification?.title ?? ""} ${notification?.body ?? ""}`;

      expect(visibleCopy).not.toMatch(
        /synthetic|under_review|needs_material|appealing|suspended|revoked|expired|合成/i,
      );
    }
  });

  it("参与资格通知使用统一产品语言", () => {
    for (const state of [
      "invited",
      "under_review",
      "awaiting_confirmation",
      "active",
      "rejected",
      "expired",
    ] as const) {
      const center = buildSyntheticNotificationCenter({
        review: { ...review, status: "approved" },
        trial: { ...trial, state },
        trips,
      });
      const notification = center.items.find((item) => item.domain === "eligibility");
      const visibleCopy = `${notification?.title ?? ""} ${notification?.body ?? ""}`;

      expect(visibleCopy).not.toMatch(
        /under_review|awaiting_confirmation|batch_0|synthetic|合成|内部审核|沙箱/i,
      );
    }
  });

  it("行程通知不暴露合成、沙箱或内部状态", () => {
    const center = buildSyntheticNotificationCenter({
      review: { ...review, status: "approved" },
      trial: { ...trial, state: "active" },
      trips: {
        ...trips,
        availableDriverTrips: [
          {
            tripId: "trip-offer",
            passengerAccountId: "synthetic-passenger-8",
            state: "paid_pending_match",
            version: 1,
            originLabel: "起点",
            destinationLabel: "终点",
            passengerCount: 1,
            payment: {
              amountMinor: 0,
              currency: "CNY",
              realPayment: false,
              state: "paid_pending_match",
            },
            createdAt: "2026-07-18T00:00:00.000Z",
            recovery: { state: "none" },
            synthetic: true,
          },
        ],
      },
    });

    const visibleCopy = center.items
      .filter((item) => item.domain === "trip")
      .map((item) => `${item.title} ${item.body}`)
      .join(" ");
    expect(visibleCopy).not.toMatch(/synthetic|合成|沙箱|内部状态|paid_pending_match|in_progress/i);
  });

  it("预约创建、车主保留和准备状态生成明确通知", () => {
    const scheduledTrip = {
      tripId: "trip-scheduled",
      passengerAccountId: "synthetic-passenger-8",
      state: "scheduled" as const,
      version: 2,
      originLabel: "人民广场",
      destinationLabel: "虹桥",
      passengerCount: 1 as const,
      timing: {
        mode: "scheduled" as const,
        timezone: "Asia/Shanghai",
        selectionSource: "quick_slot" as const,
        requestedPickupStartsAt: "2026-07-13T07:00:00.000Z",
        requestedPickupEndsAt: "2026-07-13T07:10:00.000Z",
      },
      scheduleNotices: [
        {
          kind: "two_hours" as const,
          dueAt: "2026-07-13T05:00:00.000Z",
          delivered: true,
        },
      ],
      payment: {
        amountMinor: 0 as const,
        currency: "CNY" as const,
        realPayment: false as const,
        state: "paid_pending_match" as const,
      },
      createdAt: "2026-07-12T00:00:00.000Z",
      recovery: { state: "none" as const },
      synthetic: true as const,
    };
    const center = buildSyntheticNotificationCenter({
      review: { ...review, status: "approved" },
      trial: { ...trial, state: "active" },
      trips: {
        ...trips,
        passengerTrip: scheduledTrip,
        reservedDriverTrips: [
          {
            ...scheduledTrip,
            state: "reserved",
            driverAccountId: "synthetic-account-7",
          },
        ],
      },
    });

    expect(center.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ title: "预约将在两小时后开始" }),
      expect.objectContaining({ title: "已接受未来预约" }),
    ]));
  });
});

const review: VehicleReviewView = {
  applicationId: "vehicle-application-7",
  accountId: "synthetic-account-7",
  status: "draft",
  version: 0,
      ownerIdentityAvailable: false,
      maxPassengerCount: 1,
  requestedMaterialCodes: [],
  timeline: [],
  synthetic: true,
};

const trial: FreeFlexTrialView = {
  eligibilityId: "free-flex-synthetic-account-7",
  accountId: "synthetic-account-7",
  batchId: "batch_0",
  state: "invited",
  version: 0,
  qualificationFeeMinor: 0,
  paidPathEnabled: false,
  realInvitation: false,
  activationDaysInLookback: 0,
  maximumActivationDays: 60,
  quota: { hours24: 4, days7: 12, days30: 18 },
  synthetic: true,
};

const trips: SyntheticTripDashboard = {
  availableDriverTrips: [],
  productionEnabled: false,
  realPayment: false,
  shanghaiPilot: false,
};
