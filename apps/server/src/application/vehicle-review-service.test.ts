import { describe, expect, it } from "vitest";

import { createInternalSandbox } from "../sandbox.js";

describe("车辆审核应用服务", () => {
  it("完成草稿、提交、补充和批准并记录任务审计", async () => {
    const times = [
      "2026-07-11T01:00:00.000Z",
      "2026-07-11T01:10:00.000Z",
      "2026-07-11T01:20:00.000Z",
      "2026-07-11T01:30:00.000Z",
    ];
    let index = 0;
    const sandbox = createInternalSandbox(() => new Date(times[index++] ?? times.at(-1)!));
    const draft = await sandbox.vehicleReviews.saveDraft({
      accountId: "synthetic-account-7",
      applicationId: "vehicle-application-7",
      vehicleType: "synthetic-sedan-a",
      maxPassengerCount: 1,
      insuranceExpiresOn: "2027-08-31",
      syntheticAttachmentId: "synthetic-insurance-a",
      expectedVersion: 0,
      idempotencyKey: "draft-1",
    });
    const submitted = await sandbox.vehicleReviews.submit({
      accountId: draft.accountId,
      applicationId: draft.applicationId,
      expectedVersion: draft.version,
      idempotencyKey: "submit-1",
    });
    const requested = await sandbox.vehicleReviews.requestMaterial({
      reviewerId: "synthetic-reviewer",
      applicationId: draft.applicationId,
      materialCodes: ["insurance_expiry"],
      expectedVersion: submitted.version,
      idempotencyKey: "request-1",
    });
    const resubmitted = await sandbox.vehicleReviews.resubmitMaterial({
      accountId: draft.accountId,
      applicationId: draft.applicationId,
      insuranceExpiresOn: "2027-12-31",
      syntheticAttachmentId: "synthetic-insurance-b",
      expectedVersion: requested.version,
      idempotencyKey: "resubmit-1",
    });
    const approved = await sandbox.vehicleReviews.approve({
      reviewerId: "synthetic-reviewer",
      applicationId: draft.applicationId,
      expectedVersion: resubmitted.version,
      idempotencyKey: "approve-1",
    });

    expect(approved).toMatchObject({
      status: "approved",
      ownerIdentityAvailable: true,
      maxPassengerCount: 1,
      version: 5,
    });
    expect(await sandbox.tasks.list()).toHaveLength(1);
    expect(await sandbox.audit.query("vehicle_review", draft.applicationId)).toHaveLength(5);
    expect(approved.timeline.map((item) => item.code)).toEqual([
      "submitted",
      "material_requested",
      "material_resubmitted",
      "approved",
    ]);
  });

  it("拒绝旧版本并保持提交幂等", async () => {
    const sandbox = createInternalSandbox();
    const draft = await sandbox.vehicleReviews.saveDraft({
      accountId: "synthetic-account-7",
      applicationId: "vehicle-application-7",
      vehicleType: "synthetic-sedan-a",
      maxPassengerCount: 2,
      insuranceExpiresOn: "2027-08-31",
      syntheticAttachmentId: "synthetic-insurance-a",
      expectedVersion: 0,
      idempotencyKey: "draft-1",
    });
    const command = {
      accountId: draft.accountId,
      applicationId: draft.applicationId,
      expectedVersion: draft.version,
      idempotencyKey: "submit-1",
    };
    const submitted = await sandbox.vehicleReviews.submit(command);
    await expect(sandbox.vehicleReviews.submit(command)).resolves.toEqual(submitted);
    await expect(
      sandbox.vehicleReviews.requestMaterial({
        reviewerId: "synthetic-reviewer",
        applicationId: draft.applicationId,
        materialCodes: ["insurance_expiry"],
        expectedVersion: 1,
        idempotencyKey: "request-old",
      }),
    ).rejects.toThrow("STORAGE_CONCURRENT_MODIFICATION");
  });

  it("支持拒绝、升级与独立复核，并禁止自我复核", async () => {
    const sandbox = createInternalSandbox();
    const createSubmitted = async (id: string) => {
      const draft = await sandbox.vehicleReviews.saveDraft({
        accountId: "synthetic-account-7",
        applicationId: id,
        vehicleType: "synthetic-sedan-a",
        maxPassengerCount: 3,
        insuranceExpiresOn: "2027-08-31",
        syntheticAttachmentId: "synthetic-insurance-a",
        expectedVersion: 0,
        idempotencyKey: `${id}-draft`,
      });
      return sandbox.vehicleReviews.submit({
        accountId: draft.accountId,
        applicationId: id,
        expectedVersion: draft.version,
        idempotencyKey: `${id}-submit`,
      });
    };
    const submittedForReject = await createSubmitted("reject-application");
    const rejected = await sandbox.vehicleReviews.reject({
      reviewerId: "reviewer-a",
      applicationId: submittedForReject.applicationId,
      reasonCode: "vehicle_age_exceeded",
      userMessage: { title: "车辆暂不符合准入条件", body: "车辆年限超出当前客观准入范围。" },
      expectedVersion: submittedForReject.version,
      idempotencyKey: "reject-1",
    });
    await expect(
      sandbox.vehicleReviews.reconsider({
        seniorReviewerId: "reviewer-a",
        originalReviewerId: "reviewer-a",
        applicationId: rejected.applicationId,
        outcome: "overturn",
        reasonCode: "review_confirmed",
        expectedVersion: rejected.version,
        idempotencyKey: "reconsider-self",
      }),
    ).rejects.toThrow("ADMIN_SELF_RECONSIDERATION_FORBIDDEN");
    await expect(
      sandbox.vehicleReviews.reconsider({
        seniorReviewerId: "senior-reviewer",
        originalReviewerId: "reviewer-a",
        applicationId: rejected.applicationId,
        outcome: "overturn",
        reasonCode: "review_confirmed",
        expectedVersion: rejected.version,
        idempotencyKey: "reconsider-1",
      }),
    ).resolves.toMatchObject({ status: "approved", ownerIdentityAvailable: true });

    const submittedForEscalation = await createSubmitted("escalate-application");
    await expect(
      sandbox.vehicleReviews.escalate({
        reviewerId: "reviewer-b",
        applicationId: submittedForEscalation.applicationId,
        escalationType: "suspected_forgery",
        reasonCode: "suspected_forgery",
        expectedVersion: submittedForEscalation.version,
        idempotencyKey: "escalate-1",
      }),
    ).resolves.toMatchObject({ status: "suspended", escalationType: "suspected_forgery" });
  });
});
