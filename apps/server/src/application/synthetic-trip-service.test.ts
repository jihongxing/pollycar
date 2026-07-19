import { describe, expect, it } from "vitest";
import { MemoryAuditLog } from "../adapters/memory-audit.js";
import { MemoryRepository, MemoryTransaction } from "../adapters/memory-repository.js";
import { SyntheticTripService, type SyntheticTripRecord } from "./synthetic-trip-service.js";
import {
  GoodwillCancellationService,
  type GoodwillCancellationRecord,
} from "./goodwill-cancellation-service.js";

describe("合成行程服务", () => {
  it("按创建时间倒序返回乘车人的完整行程记录", async () => {
    const repository = new MemoryRepository<SyntheticTripRecord>();
    const service = createService(repository);
    await service.create("synthetic-passenger-8", {
      tripId: "trip-history-older",
      originLabel: "静安寺",
      destinationLabel: "人民广场",
      idempotencyKey: "trip-history-older-create",
    });
    await service.create("synthetic-passenger-8", {
      tripId: "trip-history-newer",
      originLabel: "人民广场",
      destinationLabel: "虹桥",
      idempotencyKey: "trip-history-newer-create",
    });

    const dashboard = await service.dashboard("synthetic-passenger-8");

    expect(dashboard.passengerTrips?.map((trip) => trip.tripId)).toEqual([
      "trip-history-newer",
      "trip-history-older",
    ]);
    expect(dashboard.passengerTrip?.tripId).toBe("trip-history-newer");
  });

  it("预约支付后进入预约池，车主接受后形成未来保留而不占当前行程", async () => {
    const repository = new MemoryRepository<SyntheticTripRecord>();
    const service = createService(repository);
    const created = await service.create("synthetic-passenger-8", {
      tripId: "trip-scheduled",
      originLabel: "人民广场",
      destinationLabel: "虹桥",
      timing: {
        mode: "scheduled",
        timezone: "Asia/Shanghai",
        selectionSource: "quick_slot",
        requestedPickupStartsAt: "2026-07-11T13:00:00.000Z",
        requestedPickupEndsAt: "2026-07-11T13:10:00.000Z",
      },
      estimatedDurationMinutes: 45,
      idempotencyKey: "trip-scheduled-create",
    });
    const paid = await service.payZeroMoney(
      "synthetic-passenger-8",
      created.tripId,
      created.version,
      "trip-scheduled-pay",
    );
    expect(paid.state).toBe("scheduled");
    const available = (await service.dashboard("synthetic-account-7")).availableDriverTrips[0]!;
    expect(available.state).toBe("scheduled");
    const reserved = await service.accept(
      "synthetic-account-7",
      paid.tripId,
      available.version,
      "trip-scheduled-accept",
    );
    expect(reserved.state).toBe("reserved");
    const driverDashboard = await service.dashboard("synthetic-account-7");
    expect(driverDashboard.activeDriverTrip).toBeUndefined();
    expect(driverDashboard.reservedDriverTrips).toMatchObject([
      { tripId: "trip-scheduled", state: "reserved" },
    ]);
    await expect(
      service.start(
        "synthetic-account-7",
        reserved.tripId,
        reserved.version,
        "trip-scheduled-start-too-early",
      ),
    ).rejects.toThrow("TRIP_SCHEDULE_NOT_READY");
  });

  it("阻止同一车主接受时间占用重叠的预约", async () => {
    const repository = new MemoryRepository<SyntheticTripRecord>();
    const service = createService(repository);
    const first = await createScheduledTrip(
      service,
      "trip-schedule-conflict-1",
      "2026-07-11T13:00:00.000Z",
    );
    await service.accept(
      "synthetic-account-7",
      first.tripId,
      first.version,
      "trip-schedule-conflict-1-accept",
    );
    const second = await createScheduledTrip(
      service,
      "trip-schedule-conflict-2",
      "2026-07-11T13:30:00.000Z",
    );
    await expect(
      service.accept(
        "synthetic-account-7",
        second.tripId,
        second.version,
        "trip-schedule-conflict-2-accept",
      ),
    ).rejects.toThrow("TRIP_SCHEDULE_CONFLICT");
  });

  it("乘车人可完整修改未接单预约且幂等重放不重复写入", async () => {
    const repository = new MemoryRepository<SyntheticTripRecord>();
    const service = createService(repository);
    const scheduled = await createScheduledTrip(
      service,
      "trip-reschedule",
      "2026-07-11T13:00:00.000Z",
    );
    const revision = {
      originLabel: "静安寺",
      destinationLabel: "浦东机场",
      passengerCount: 3 as const,
      scene: "airport" as const,
      timing: {
        mode: "scheduled" as const,
        timezone: "Asia/Shanghai",
        selectionSource: "calendar_slot" as const,
        requestedPickupStartsAt: "2026-07-11T14:00:00.000Z",
        requestedPickupEndsAt: "2026-07-11T14:10:00.000Z",
      },
      estimatedDurationMinutes: 70,
    };

    const revised = await service.reschedule(
      "synthetic-passenger-8",
      scheduled.tripId,
      scheduled.version,
      "trip-reschedule-update",
      revision,
    );
    const replayed = await service.reschedule(
      "synthetic-passenger-8",
      scheduled.tripId,
      scheduled.version,
      "trip-reschedule-update",
      revision,
    );

    expect(revised).toMatchObject({
      state: "scheduled",
      originLabel: "静安寺",
      destinationLabel: "浦东机场",
      passengerCount: 3,
      scene: "airport",
      timing: {
        requestedPickupStartsAt: "2026-07-11T14:00:00.000Z",
      },
      estimatedDurationMinutes: 70,
    });
    expect(replayed.version).toBe(revised.version);
  });

  it("已被车主接受的预约禁止静默修改且非乘车人不能修改", async () => {
    const repository = new MemoryRepository<SyntheticTripRecord>();
    const service = createService(repository);
    const scheduled = await createScheduledTrip(
      service,
      "trip-reschedule-forbidden",
      "2026-07-11T13:00:00.000Z",
    );
    const timing = {
      mode: "scheduled" as const,
      timezone: "Asia/Shanghai",
      selectionSource: "calendar_slot" as const,
      requestedPickupStartsAt: "2026-07-11T14:00:00.000Z",
      requestedPickupEndsAt: "2026-07-11T14:10:00.000Z",
    };
    await expect(
      service.reschedule(
        "synthetic-account-7",
        scheduled.tripId,
        scheduled.version,
        "trip-reschedule-other",
        { timing },
      ),
    ).rejects.toThrow("TRIP_FORBIDDEN");
    const reserved = await service.accept(
      "synthetic-account-7",
      scheduled.tripId,
      scheduled.version,
      "trip-reschedule-accept",
    );
    await expect(
      service.reschedule(
        "synthetic-passenger-8",
        reserved.tripId,
        reserved.version,
        "trip-reschedule-after-accept",
        { timing },
      ),
    ).rejects.toThrow("TRIP_INVALID_STATE");
  });

  it("预约进入三十分钟准备状态，未接单超过时间段后标记未履约", async () => {
    const repository = new MemoryRepository<SyntheticTripRecord>();
    let now = new Date("2026-07-11T12:00:00.000Z");
    const service = createService(repository, () => now);
    const reservedTrip = await createScheduledTrip(
      service,
      "trip-prepare",
      "2026-07-11T13:00:00.000Z",
    );
    await service.accept(
      "synthetic-account-7",
      reservedTrip.tripId,
      reservedTrip.version,
      "trip-prepare-accept",
    );
    now = new Date("2026-07-11T12:31:00.000Z");
    expect((await service.dashboard("synthetic-account-7")).activeDriverTrip?.state).toBe(
      "preparing",
    );

    const unfulfilledTrip = await createScheduledTrip(
      service,
      "trip-unfulfilled",
      "2026-07-11T14:00:00.000Z",
    );
    now = new Date("2026-07-11T14:11:00.000Z");
    await service.dashboard("synthetic-passenger-8");
    expect((await repository.get(unfulfilledTrip.tripId))?.value.state).toBe("unfulfilled");
  });

  it("车主取消已接受预约后重新开放匹配且幂等重放安全", async () => {
    const repository = new MemoryRepository<SyntheticTripRecord>();
    let now = new Date("2026-07-11T12:00:00.000Z");
    const service = createService(repository, () => now);
    const scheduled = await createScheduledTrip(
      service,
      "trip-driver-release",
      "2026-07-11T15:00:00.000Z",
    );
    const reserved = await service.accept(
      "synthetic-account-7",
      scheduled.tripId,
      scheduled.version,
      "trip-driver-release-accept",
    );
    now = new Date("2026-07-11T12:04:00.000Z");
    const released = await service.cancel(
      "synthetic-account-7",
      reserved.tripId,
      reserved.version,
      "trip-driver-release-cancel",
      "plans_changed",
    );
    const replayed = await service.cancel(
      "synthetic-account-7",
      released.tripId,
      reserved.version,
      "trip-driver-release-cancel",
      "plans_changed",
    );

    expect(released).toMatchObject({
      state: "scheduled",
      recovery: { state: "driver_acceptance_released" },
    });
    expect(released.driverAccountId).toBeUndefined();
    expect(replayed.version).toBe(released.version);
    expect((await service.dashboard("synthetic-account-9")).availableDriverTrips).toMatchObject([
      { tripId: "trip-driver-release", state: "scheduled" },
    ]);
  });

  it("预约接受超过三分钟后按两小时边界记录零金额取消责任", async () => {
    let now = new Date("2026-07-11T12:00:00.000Z");
    const earlyRepository = new MemoryRepository<SyntheticTripRecord>();
    const earlyService = createService(
      earlyRepository,
      () => now,
      3,
      undefined,
      createGoodwillService(() => now),
    );
    const earlyScheduled = await createScheduledTrip(
      earlyService,
      "trip-cancel-more-than-two-hours",
      "2026-07-11T15:00:00.000Z",
    );
    const earlyReserved = await earlyService.accept(
      "synthetic-account-7",
      earlyScheduled.tripId,
      earlyScheduled.version,
      "trip-cancel-more-than-two-hours-accept",
    );
    now = new Date("2026-07-11T12:04:00.000Z");
    const earlyCancelled = await earlyService.cancel(
      "synthetic-passenger-8",
      earlyReserved.tripId,
      earlyReserved.version,
      "trip-cancel-more-than-two-hours-cancel",
      "plans_changed",
    );
    expect(earlyCancelled.cancellation).toMatchObject({
      realFeeAmountMinor: 0,
      responsibility: "passenger",
      nonFinancialRemedy: "goodwill_cancellation",
      goodwill: { state: "consumed" },
    });

    now = new Date("2026-07-11T12:00:00.000Z");
    const lateRepository = new MemoryRepository<SyntheticTripRecord>();
    const lateService = createService(
      lateRepository,
      () => now,
      3,
      undefined,
      createGoodwillService(() => now),
    );
    const lateScheduled = await createScheduledTrip(
      lateService,
      "trip-cancel-less-than-two-hours",
      "2026-07-11T13:00:00.000Z",
    );
    const lateReserved = await lateService.accept(
      "synthetic-account-7",
      lateScheduled.tripId,
      lateScheduled.version,
      "trip-cancel-less-than-two-hours-accept",
    );
    now = new Date("2026-07-11T12:04:00.000Z");
    const lateCancelled = await lateService.cancel(
      "synthetic-passenger-8",
      lateReserved.tripId,
      lateReserved.version,
      "trip-cancel-less-than-two-hours-cancel",
      "driver_or_vehicle_concern",
    );
    expect(lateCancelled.cancellation).toMatchObject({
      realFeeAmountMinor: 0,
      responsibility: "driver",
      nonFinancialRemedy: "priority_rematch",
    });
    expect(lateCancelled.cancellation?.goodwill).toBeUndefined();
  });

  it("只向容量足够的车主展示订单并在接受时再次校验", async () => {
    const repository = new MemoryRepository<SyntheticTripRecord>();
    const passengerService = createService(repository, undefined, 3);
    const created = await passengerService.create("synthetic-passenger-8", {
      tripId: "trip-capacity",
      originLabel: "静安寺",
      destinationLabel: "徐家汇",
      passengerCount: 3,
      scene: "commute",
      idempotencyKey: "trip-capacity-create",
    });
    const paid = await passengerService.payZeroMoney(
      "synthetic-passenger-8",
      created.tripId,
      created.version,
      "trip-capacity-pay",
    );
    const limitedDriverService = createService(repository, undefined, 2);
    await expect(limitedDriverService.dashboard("synthetic-account-7")).resolves.toMatchObject({
      availableDriverTrips: [],
    });
    await expect(
      limitedDriverService.accept(
        "synthetic-account-7",
        paid.tripId,
        paid.version,
        "trip-capacity-accept",
      ),
    ).rejects.toThrow("TRIP_PASSENGER_CAPACITY_EXCEEDED");
  });

  it("支付前置后完成接单与履约", async () => {
    const repository = new MemoryRepository<SyntheticTripRecord>();
    const service = createService(repository);
    const created = await service.create("synthetic-passenger-8", {
      tripId: "trip-1",
      originLabel: "静安寺",
      destinationLabel: "徐家汇",
      idempotencyKey: "trip-create-1",
    });
    await expect(service.accept("synthetic-account-7", "trip-1", created.version, "accept-before-pay"))
      .rejects.toThrow("TRIP_PAYMENT_REQUIRED");
    const paid = await service.payZeroMoney(
      "synthetic-passenger-8",
      "trip-1",
      created.version,
      "trip-pay-1",
    );
    const accepted = await service.accept(
      "synthetic-account-7",
      "trip-1",
      paid.version,
      "trip-accept-1",
    );
    const started = await service.start(
      "synthetic-account-7",
      "trip-1",
      accepted.version,
      "trip-start-1",
    );
    const completed = await service.complete(
      "synthetic-account-7",
      "trip-1",
      started.version,
      "trip-complete-1",
    );
    expect(completed).toMatchObject({
      state: "completed",
      quotaPolicy: "flex",
      payment: { amountMinor: 0, realPayment: false, state: "closed" },
    });
  });

  it("禁止车主接受自己的行程", async () => {
    const repository = new MemoryRepository<SyntheticTripRecord>();
    const service = createService(repository);
    const created = await service.create("synthetic-account-7", {
      tripId: "trip-self",
      originLabel: "人民广场",
      destinationLabel: "虹桥",
      idempotencyKey: "trip-create-self",
    });
    const paid = await service.payZeroMoney(
      "synthetic-account-7",
      "trip-self",
      created.version,
      "trip-pay-self",
    );
    await expect(
      service.accept("synthetic-account-7", "trip-self", paid.version, "trip-accept-self"),
    ).rejects.toThrow("TRIP_SELF_ACCEPT_FORBIDDEN");
  });

  it("乘客可在履约开始前取消并关闭零金额支付", async () => {
    const repository = new MemoryRepository<SyntheticTripRecord>();
    const service = createService(repository);
    const created = await service.create("synthetic-passenger-8", {
      tripId: "trip-cancel",
      originLabel: "人民广场",
      destinationLabel: "虹桥",
      idempotencyKey: "trip-create-cancel",
    });
    const paid = await service.payZeroMoney(
      "synthetic-passenger-8",
      "trip-cancel",
      created.version,
      "trip-pay-cancel",
    );
    const cancelled = await service.cancel(
      "synthetic-passenger-8",
      "trip-cancel",
      paid.version,
      "trip-cancel-passenger",
    );
    expect(cancelled).toMatchObject({
      state: "cancelled",
      closureReason: "passenger_cancelled",
      payment: { amountMinor: 0, state: "closed" },
    });
  });

  it("待支付和待匹配超时后自动关闭", async () => {
    const repository = new MemoryRepository<SyntheticTripRecord>();
    let now = new Date("2026-07-11T12:00:00.000Z");
    const service = createService(repository, () => now);
    const pending = await service.create("synthetic-passenger-8", {
      tripId: "trip-payment-timeout",
      originLabel: "人民广场",
      destinationLabel: "虹桥",
      idempotencyKey: "trip-create-payment-timeout",
    });
    now = new Date("2026-07-11T12:16:00.000Z");
    const paymentTimeout = await service.reconcileTimeout(
      "synthetic-passenger-8",
      pending.tripId,
      pending.version,
      "trip-payment-timeout-reconcile",
    );
    expect(paymentTimeout).toMatchObject({ state: "cancelled", closureReason: "payment_timeout" });

    now = new Date("2026-07-11T13:00:00.000Z");
    const matching = await service.create("synthetic-passenger-8", {
      tripId: "trip-matching-timeout",
      originLabel: "人民广场",
      destinationLabel: "虹桥",
      idempotencyKey: "trip-create-matching-timeout",
    });
    const paid = await service.payZeroMoney(
      "synthetic-passenger-8",
      matching.tripId,
      matching.version,
      "trip-pay-matching-timeout",
    );
    now = new Date("2026-07-11T13:31:00.000Z");
    const matchingTimeout = await service.reconcileTimeout(
      "synthetic-passenger-8",
      paid.tripId,
      paid.version,
      "trip-matching-timeout-reconcile",
    );
    expect(matchingTimeout).toMatchObject({ state: "cancelled", closureReason: "matching_timeout" });
  });

  it("接受后超时释放车主并允许重新匹配", async () => {
    const repository = new MemoryRepository<SyntheticTripRecord>();
    const released: string[] = [];
    let now = new Date("2026-07-11T12:00:00.000Z");
    const service = createService(repository, () => now, 3, async (accountId) => {
      released.push(accountId);
    });
    const created = await service.create("synthetic-passenger-8", {
      tripId: "trip-accept-timeout",
      originLabel: "人民广场",
      destinationLabel: "虹桥",
      idempotencyKey: "trip-create-accept-timeout",
    });
    const paid = await service.payZeroMoney(
      "synthetic-passenger-8",
      created.tripId,
      created.version,
      "trip-pay-accept-timeout",
    );
    const accepted = await service.accept(
      "synthetic-account-7",
      paid.tripId,
      paid.version,
      "trip-accept-timeout",
    );
    now = new Date("2026-07-11T12:16:00.000Z");
    const recovered = await service.reconcileTimeout(
      "synthetic-account-7",
      accepted.tripId,
      accepted.version,
      "trip-accept-timeout-reconcile",
    );
    expect(recovered).toMatchObject({
      state: "paid_pending_match",
      recovery: { state: "driver_acceptance_released" },
    });
    expect(recovered.driverAccountId).toBeUndefined();
    expect(released).toEqual(["synthetic-account-7"]);
  });

  it("乘客取消已接受行程时释放车主占用", async () => {
    const repository = new MemoryRepository<SyntheticTripRecord>();
    const released: string[] = [];
    const service = createService(repository, undefined, 3, async (accountId) => {
      released.push(accountId);
    });
    const created = await service.create("synthetic-passenger-8", {
      tripId: "trip-cancel-release",
      originLabel: "人民广场",
      destinationLabel: "虹桥",
      idempotencyKey: "trip-cancel-release-create",
    });
    const paid = await service.payZeroMoney(
      "synthetic-passenger-8",
      created.tripId,
      created.version,
      "trip-cancel-release-pay",
    );
    const accepted = await service.accept(
      "synthetic-account-7",
      paid.tripId,
      paid.version,
      "trip-cancel-release-accept",
    );

    await service.cancel(
      "synthetic-passenger-8",
      accepted.tripId,
      accepted.version,
      "trip-cancel-release-cancel",
    );

    expect(released).toEqual(["synthetic-account-7"]);
  });

  it("超过三分钟取消必须提交原因", async () => {
    const repository = new MemoryRepository<SyntheticTripRecord>();
    let now = new Date("2026-07-11T12:00:00.000Z");
    const service = createService(repository, () => now);
    const accepted = await createAcceptedTrip(service, "trip-late-reason");
    now = new Date("2026-07-11T12:03:01.000Z");

    await expect(
      service.cancel(
        "synthetic-passenger-8",
        accepted.tripId,
        accepted.version,
        "trip-late-reason-cancel",
      ),
    ).rejects.toThrow("TRIP_CANCELLATION_REASON_REQUIRED");
  });

  it.each([
    ["driver_or_vehicle_concern", "driver", "priority_rematch"],
    ["plans_changed", "passenger", "driver_quota_exemption"],
    ["pickup_incorrect", "shared", "priority_rematch"],
    ["other", "manual_review", "manual_review"],
  ] as const)("超过三分钟根据原因判定责任和非资金处置：%s", async (reason, responsibility, remedy) => {
    const repository = new MemoryRepository<SyntheticTripRecord>();
    let now = new Date("2026-07-11T12:00:00.000Z");
    const service = createService(repository, () => now);
    const accepted = await createAcceptedTrip(service, `trip-late-${reason}`);
    now = new Date("2026-07-11T12:03:01.000Z");

    const cancelled = await service.cancel(
      "synthetic-passenger-8",
      accepted.tripId,
      accepted.version,
      `trip-late-${reason}-cancel`,
      reason,
    );

    expect(cancelled).toMatchObject({
      state: "cancelled",
      cancellation: {
        reason,
        withinFreeWindow: false,
        responsibility,
        nonFinancialRemedy: remedy,
        realFeeAmountMinor: 0,
        automaticallyDetermined: true,
      },
      recovery: {
        state: "cancellation_confirmed",
        source: "state_reconciliation",
      },
    });
  });

  it("三分钟内取消原因仍为选填并记录自由窗口", async () => {
    const repository = new MemoryRepository<SyntheticTripRecord>();
    const service = createService(repository);
    const accepted = await createAcceptedTrip(service, "trip-free-window");

    const cancelled = await service.cancel(
      "synthetic-passenger-8",
      accepted.tripId,
      accepted.version,
      "trip-free-window-cancel",
    );

    expect(cancelled.cancellation).toMatchObject({
      withinFreeWindow: true,
      responsibility: "passenger",
      nonFinancialRemedy: "none",
    });
  });

  it("重复取消返回原结果且不重复释放车主", async () => {
    const repository = new MemoryRepository<SyntheticTripRecord>();
    const released: string[] = [];
    const service = createService(repository, undefined, 3, async (accountId) => {
      released.push(accountId);
    });
    const accepted = await createAcceptedTrip(service, "trip-cancel-idempotent");

    const first = await service.cancel(
      "synthetic-passenger-8",
      accepted.tripId,
      accepted.version,
      "trip-cancel-idempotent-key",
    );
    const replay = await service.cancel(
      "synthetic-passenger-8",
      accepted.tripId,
      first.version,
      "trip-cancel-idempotent-key",
    );

    expect(replay).toEqual(first);
    expect(released).toEqual(["synthetic-account-7"]);
  });

  it("乘车人计划变化使用善意取消额度", async () => {
    const repository = new MemoryRepository<SyntheticTripRecord>();
    let now = new Date("2026-07-11T12:00:00.000Z");
    const goodwill = createGoodwillService(() => now);
    const service = createService(repository, () => now, 3, undefined, goodwill);
    const accepted = await createAcceptedTrip(service, "trip-passenger-goodwill");
    now = new Date("2026-07-11T12:03:01.000Z");

    const cancelled = await service.cancel(
      "synthetic-passenger-8",
      accepted.tripId,
      accepted.version,
      "trip-passenger-goodwill-cancel",
      "plans_changed",
    );

    expect(cancelled).toMatchObject({
      closureReason: "passenger_cancelled",
      cancellation: {
        responsibility: "passenger",
        nonFinancialRemedy: "goodwill_cancellation",
        goodwill: { actor: "passenger", state: "consumed" },
      },
    });
  });

  it("车主到达前可使用 1/2/3 善意取消并触发乘车人重新匹配", async () => {
    const repository = new MemoryRepository<SyntheticTripRecord>();
    const goodwill = createGoodwillService();
    const service = createService(repository, undefined, 3, undefined, goodwill);
    const accepted = await createAcceptedTrip(service, "trip-driver-goodwill");

    const cancelled = await service.cancel(
      "synthetic-account-7",
      accepted.tripId,
      accepted.version,
      "trip-driver-goodwill-cancel",
      "plans_changed",
    );

    expect(cancelled).toMatchObject({
      closureReason: "driver_cancelled",
      cancellation: {
        cancelledBy: "driver",
        responsibility: "driver",
        nonFinancialRemedy: "goodwill_cancellation",
        goodwill: { actor: "driver", state: "consumed" },
      },
    });
  });

  it("善意额度用尽后仍允许取消并回退普通责任处置", async () => {
    const repository = new MemoryRepository<SyntheticTripRecord>();
    let now = new Date("2026-07-11T12:00:00.000Z");
    const goodwill = createGoodwillService(() => now);
    const firstService = createService(repository, () => now, 3, undefined, goodwill);
    const firstAccepted = await createAcceptedTrip(firstService, "trip-goodwill-limit-first");
    now = new Date("2026-07-11T12:03:01.000Z");
    await firstService.cancel(
      "synthetic-passenger-8",
      firstAccepted.tripId,
      firstAccepted.version,
      "trip-goodwill-limit-first-cancel",
      "plans_changed",
    );

    now = new Date("2026-07-11T13:00:00.000Z");
    const secondAccepted = await createAcceptedTrip(firstService, "trip-goodwill-limit-second");
    now = new Date("2026-07-11T13:03:01.000Z");
    const cancelled = await firstService.cancel(
      "synthetic-passenger-8",
      secondAccepted.tripId,
      secondAccepted.version,
      "trip-goodwill-limit-second-cancel",
      "plans_changed",
    );

    expect(cancelled.cancellation).toMatchObject({
      responsibility: "passenger",
      nonFinancialRemedy: "driver_quota_exemption",
    });
    expect(cancelled.cancellation?.goodwill).toBeUndefined();
  });

  it("非参与者即使复用幂等键也不能读取或恢复行程", async () => {
    const repository = new MemoryRepository<SyntheticTripRecord>();
    let now = new Date("2026-07-11T12:00:00.000Z");
    const service = createService(repository, () => now);
    const created = await service.create("synthetic-passenger-8", {
      tripId: "trip-auth-timeout",
      originLabel: "人民广场",
      destinationLabel: "虹桥",
      idempotencyKey: "trip-auth-timeout-create",
    });
    now = new Date("2026-07-11T12:16:00.000Z");
    const reconciled = await service.reconcileTimeout(
      "synthetic-passenger-8",
      created.tripId,
      created.version,
      "trip-auth-timeout-reconcile",
    );
    await expect(
      service.reconcileTimeout(
        "unrelated-account",
        reconciled.tripId,
        reconciled.version,
        "trip-auth-timeout-reconcile",
      ),
    ).rejects.toThrow("TRIP_FORBIDDEN");
  });

  it("其他车主不能复用接单幂等键读取已接行程", async () => {
    const repository = new MemoryRepository<SyntheticTripRecord>();
    const service = createService(repository);
    const created = await service.create("synthetic-passenger-8", {
      tripId: "trip-accept-idempotency",
      originLabel: "人民广场",
      destinationLabel: "虹桥",
      idempotencyKey: "trip-accept-idempotency-create",
    });
    const paid = await service.payZeroMoney(
      "synthetic-passenger-8",
      created.tripId,
      created.version,
      "trip-accept-idempotency-pay",
    );
    const accepted = await service.accept(
      "synthetic-account-7",
      paid.tripId,
      paid.version,
      "shared-accept-key",
    );

    await expect(
      service.accept(
        "other-driver",
        accepted.tripId,
        accepted.version,
        "shared-accept-key",
      ),
    ).rejects.toThrow("TRIP_FORBIDDEN");
  });
});

function createService(
  repository: MemoryRepository<SyntheticTripRecord>,
  now: () => Date = () => new Date("2026-07-11T12:00:00.000Z"),
  maxPassengerCount: 1 | 2 | 3 = 3,
  releaseDriver: (accountId: string, idempotencyKey: string) => Promise<void> = async () => {},
  goodwillCancellations?: GoodwillCancellationService,
) {
  return new SyntheticTripService(
    repository,
    new MemoryTransaction(),
    new MemoryAuditLog(),
    async () => ({ quotaPolicy: "flex", maxPassengerCount }),
    now,
    releaseDriver,
    () => false,
    goodwillCancellations,
  );
}

function createGoodwillService(now: () => Date = () => new Date("2026-07-11T12:00:00.000Z")) {
  return new GoodwillCancellationService(
    new MemoryRepository<GoodwillCancellationRecord>(),
    new MemoryTransaction(),
    now,
  );
}

async function createAcceptedTrip(
  service: SyntheticTripService,
  tripId: string,
) {
  const created = await service.create("synthetic-passenger-8", {
    tripId,
    originLabel: "人民广场",
    destinationLabel: "虹桥",
    idempotencyKey: `${tripId}-create`,
  });
  const paid = await service.payZeroMoney(
    "synthetic-passenger-8",
    tripId,
    created.version,
    `${tripId}-pay`,
  );
  return service.accept(
    "synthetic-account-7",
    tripId,
    paid.version,
    `${tripId}-accept`,
  );
}

async function createScheduledTrip(
  service: SyntheticTripService,
  tripId: string,
  startsAt: string,
) {
  const endsAt = new Date(new Date(startsAt).getTime() + 10 * 60 * 1000).toISOString();
  const created = await service.create("synthetic-passenger-8", {
    tripId,
    originLabel: "人民广场",
    destinationLabel: "虹桥",
    timing: {
      mode: "scheduled",
      timezone: "Asia/Shanghai",
      selectionSource: "calendar_slot",
      requestedPickupStartsAt: startsAt,
      requestedPickupEndsAt: endsAt,
    },
    estimatedDurationMinutes: 45,
    idempotencyKey: `${tripId}-create`,
  });
  return service.payZeroMoney(
    "synthetic-passenger-8",
    tripId,
    created.version,
    `${tripId}-pay`,
  );
}
