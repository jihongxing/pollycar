import { describe, expect, it } from "vitest";
import { MemoryAuditLog } from "../adapters/memory-audit.js";
import { MemoryRepository } from "../adapters/memory-repository.js";
import { TrustProfileService, type TripRatingRecord, type TrustProfileRecord } from "./trust-profile-service.js";
import type { SyntheticTripRecord } from "./synthetic-trip-service.js";

describe("TrustProfileService", () => {
  it("头像只有机器审核通过后才返回公开地址", async () => {
    const context = setup();
    const approved = await context.service.submitAvatar("synthetic-account-7", "avatar-city-blue", "avatar-1");
    expect(approved.avatar).toMatchObject({ state: "approved", realUploadEnabled: false });
    expect(approved.avatar.publicUrl).toContain("avatar-city-blue");
    const rejected = await context.service.submitAvatar("synthetic-passenger-8", "avatar-plum", "avatar-2");
    expect(rejected.avatar).toMatchObject({ state: "rejected", rejectionReason: "unsafe_content" });
    expect(rejected.avatar.publicUrl).toBeUndefined();
  });

  it("评分仅允许已完成行程参与者且每人每单一次", async () => {
    const context = setup();
    await context.trips.put("trip-1", completedTrip(), 0);
    const first = await context.service.submitRating("synthetic-passenger-8", {
      tripId: "trip-1",
      score: 5,
      tags: ["safe_driving", "safe_driving"],
      idempotencyKey: "rating-1",
    });
    const repeated = await context.service.submitRating("synthetic-passenger-8", {
      tripId: "trip-1",
      score: 1,
      idempotencyKey: "rating-2",
    });
    expect(repeated).toEqual(first);
    expect(first.tags).toEqual(["safe_driving"]);
    await expect(context.service.submitRating("unknown", {
      tripId: "trip-1",
      score: 3,
      idempotencyKey: "rating-3",
    })).rejects.toThrow("TRIP_FORBIDDEN");
  });

  it("公平性报告只读且明确禁用自动决策", async () => {
    const context = setup();
    await context.trips.put("trip-female", completedTrip(), 0);
    const {
      driverAccountId: _driverAccountId,
      completedAt: _completedAt,
      ...pendingTrip
    } = completedTrip();
    await context.trips.put("trip-male", {
      ...pendingTrip,
      tripId: "trip-male",
      passengerProfile: {
        accountId: "male-passenger",
        displayName: "合成乘车人",
        gender: "male",
        genderSource: "verified_identity_document",
        genderDisclosure: "eligible_driver_pre_acceptance",
        synthetic: true,
      },
      state: "paid_pending_match",
    }, 0);
    await expect(context.service.getFairnessReport()).resolves.toMatchObject({
      dimension: "legal_gender",
      automatedDecisionEnabled: false,
      thresholdPercentagePoints: 10,
      alert: true,
      rows: [
        expect.objectContaining({ group: "female", acceptanceRate: 1 }),
        expect.objectContaining({ group: "male", acceptanceRate: 0 }),
      ],
    });
  });
});

function setup() {
  const profiles = new MemoryRepository<TrustProfileRecord>();
  const ratings = new MemoryRepository<TripRatingRecord>();
  const trips = new MemoryRepository<SyntheticTripRecord>();
  return {
    trips,
    service: new TrustProfileService(profiles, ratings, trips, new MemoryAuditLog(), () => new Date("2026-07-12T12:00:00.000Z")),
  };
}

function completedTrip(): SyntheticTripRecord {
  return {
    tripId: "trip-1",
    passengerAccountId: "synthetic-passenger-8",
    driverAccountId: "synthetic-account-7",
    state: "completed",
    originLabel: "合成起点",
    destinationLabel: "合成终点",
    passengerCount: 1,
    createdAt: "2026-07-12T10:00:00.000Z",
    completedAt: "2026-07-12T11:00:00.000Z",
    processedKeys: [],
    synthetic: true,
  };
}
