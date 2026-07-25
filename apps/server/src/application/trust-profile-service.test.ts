import { describe, expect, it } from "vitest";
import { MemoryAuditLog } from "../adapters/memory-audit.js";
import { MemoryRepository } from "../adapters/memory-repository.js";
import { MemoryAvatarObjectStore } from "../adapters/memory-avatar-object-store.js";
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

  it("自定义头像通过技术校验后写入私有对象存储并替换旧对象", async () => {
    const context = setup();
    const first = await context.service.submitCustomAvatar(
      "synthetic-account-7",
      customAvatar("avatar-first"),
    );
    expect(first.avatar).toMatchObject({
      state: "approved",
      source: "custom",
      customUploadEnabled: true,
      realUploadEnabled: false,
    });
    const firstUrl = first.avatar.publicUrl;
    expect(firstUrl).toContain("/v1/internal-sandbox/media/avatars/");

    const second = await context.service.submitCustomAvatar(
      "synthetic-account-7",
      customAvatar("avatar-second"),
    );
    expect(second.avatar.publicUrl).not.toBe(firstUrl);
    const firstKey = decodeURIComponent(
      new URL(firstUrl!, "http://127.0.0.1").pathname.split("/").at(-1)!,
    );
    await expect(context.avatarObjects.get(firstKey)).resolves.toBeUndefined();
  });

  it("自定义头像兼容扩展、有损和无损 WebP", async () => {
    const context = setup();
    for (const [index, bytes] of webpAvatars().entries()) {
      await expect(context.service.submitCustomAvatar(
        `synthetic-webp-${index}`,
        customAvatar(`avatar-webp-${index}`, bytes, "image/webp"),
      )).resolves.toMatchObject({
        avatar: {
          state: "approved",
          source: "custom",
        },
      });
    }
  });

  it("自定义头像拒绝非规范 Base64 和伪造 PNG 头", async () => {
    const context = setup();
    const valid = customAvatar("avatar-invalid-base64");
    await expect(context.service.submitCustomAvatar(
      "synthetic-account-7",
      {
        ...valid,
        contentBase64: `${valid.contentBase64.slice(0, 4)}!${valid.contentBase64.slice(5)}`,
      },
    )).rejects.toThrow("AVATAR_UPLOAD_INVALID");

    const fakePng = Buffer.alloc(32);
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(fakePng, 0);
    fakePng.writeUInt32BE(512, 16);
    fakePng.writeUInt32BE(512, 20);
    await expect(context.service.submitCustomAvatar(
      "synthetic-account-7",
      customAvatar("avatar-fake-png", fakePng),
    )).rejects.toThrow("AVATAR_IMAGE_INVALID");
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
  const avatarObjects = new MemoryAvatarObjectStore();
  return {
    trips,
    avatarObjects,
    service: new TrustProfileService(
      profiles,
      ratings,
      trips,
      new MemoryAuditLog(),
      avatarObjects,
      () => new Date("2026-07-12T12:00:00.000Z"),
    ),
  };
}

function customAvatar(
  idempotencyKey: string,
  bytes = pngAvatar(),
  mimeType: "image/png" | "image/webp" = "image/png",
) {
  return {
    fileName: mimeType === "image/png" ? "avatar.png" : "avatar.webp",
    mimeType,
    byteSize: bytes.length,
    contentBase64: bytes.toString("base64"),
    idempotencyKey,
  };
}

function pngAvatar() {
  const bytes = Buffer.alloc(32);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(bytes, 0);
  Buffer.from("IHDR").copy(bytes, 12);
  bytes.writeUInt32BE(512, 16);
  bytes.writeUInt32BE(512, 20);
  return bytes;
}

function webpAvatars() {
  const extended = Buffer.alloc(30);
  Buffer.from("RIFF").copy(extended, 0);
  Buffer.from("WEBPVP8X").copy(extended, 8);
  extended[24] = 0xff;
  extended[25] = 0x01;
  extended[27] = 0xff;
  extended[28] = 0x01;

  const lossy = Buffer.alloc(30);
  Buffer.from("RIFF").copy(lossy, 0);
  Buffer.from("WEBPVP8 ").copy(lossy, 8);
  Buffer.from([0x9d, 0x01, 0x2a]).copy(lossy, 23);
  lossy.writeUInt16LE(512, 26);
  lossy.writeUInt16LE(512, 28);

  const lossless = Buffer.alloc(25);
  Buffer.from("RIFF").copy(lossless, 0);
  Buffer.from("WEBPVP8L").copy(lossless, 8);
  lossless[20] = 0x2f;
  lossless[21] = 0xff;
  lossless[22] = 0xc1;
  lossless[23] = 0x7f;

  return [extended, lossy, lossless];
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
