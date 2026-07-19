import type {
  PassengerCount,
  SyntheticTripScene,
  TripCancellationEligibility,
} from "@pollycar/contracts";
import { useEffect, useState } from "react";
import { View } from "react-native";

import { useSyntheticTrip } from "../../application/synthetic-trip-context";
import { useMobility } from "../../application/mobility-context";
import {
  AppText,
  PrimaryButton,
  ScreenScroll,
  SectionCard,
  StatusBanner,
  StatusSummary,
  WorkbenchHeader,
} from "../../components/ui";
import {
  ProductActionBar,
  ProductEmptyState,
  ProductStatePanel,
} from "../../components/product-components";
import {
  AppV2EmptyState,
  AppV2StageHeader,
  AppV2StatusPanel,
  AppV2SummaryList,
} from "../../components/app-v2-components";
import { MobilityPage, RouteSummaryCard } from "../../components/mobility";
import { useInteraction } from "../../interaction/interaction-context";
import type { AppScreen } from "../vehicle-review/screens";

type Navigate = (screen: AppScreen) => void;

export function TripCreateScreen({ navigate }: { navigate: Navigate }) {
  const { dashboard, createTrip } = useSyntheticTrip();
  const { actions, runAction } = useInteraction();
  const [passengerCount, setPassengerCount] = useState<PassengerCount>(1);
  const [scene, setScene] = useState<SyntheticTripScene>();
  useEffect(() => {
    if (dashboard.passengerTrip) navigate(passengerTripScreen(dashboard.passengerTrip.state));
  }, [dashboard.passengerTrip, navigate]);
  return (
    <ScreenScroll>
      <WorkbenchHeader
        eyebrow="行程创建"
        title="创建一笔合成行程"
        description="使用固定合成起终点验证完整流程，不读取真实位置。"
      />
      <SectionCard accent="passenger">
        <AppText size="caption" tone="inverse" weight="bold">合成路线</AppText>
        <AppText size="title2" tone="inverse" weight="bold">人民广场 → 虹桥</AppText>
        <AppText tone="inverse">金额固定为 ¥0；真实支付与上海试点保持关闭。</AppText>
      </SectionCard>
      <SectionCard>
        <AppText weight="bold">乘车人数</AppText>
        <AppText size="small" tone="secondary">必选，默认 1 人，最多 3 人。</AppText>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {([1, 2, 3] as const).map((count) => (
            <PrimaryButton
              key={count}
              label={`${count} 人`}
              variant={passengerCount === count ? "primary" : "secondary"}
              onPress={() => setPassengerCount(count)}
            />
          ))}
        </View>
      </SectionCard>
      <SectionCard>
        <AppText weight="bold">乘车场景（可选）</AppText>
        <View style={{ gap: 8 }}>
          {([
            ["commute", "通勤"],
            ["airport", "机场／车站"],
            ["medical", "就医"],
            ["other", "其他"],
          ] as const).map(([value, label]) => (
            <PrimaryButton
              key={value}
              label={label}
              variant={scene === value ? "primary" : "secondary"}
              onPress={() => setScene(scene === value ? undefined : value)}
            />
          ))}
        </View>
      </SectionCard>
      <PrimaryButton
        label="确认创建合成行程"
        loading={actions["trip.create"] === "running"}
        loadingLabel="正在创建"
        onPress={() => void (async () => {
          if (
            await runAction("trip.create", async () => {
              await createTrip(
                "人民广场 · 合成起点",
                "虹桥 · 合成终点",
                passengerCount,
                scene,
              );
            }, {
              successTitle: "合成行程已创建",
            })
          ) {
            navigate("trip-payment");
          }
        })()}
      />
      <PrimaryButton label="返回首页" variant="text" onPress={() => navigate("passenger-workbench")} />
    </ScreenScroll>
  );
}

export function TripPaymentScreen({ navigate }: { navigate: Navigate }) {
  const { dashboard, payTrip, cancelTrip } = useSyntheticTrip();
  const { actions, runAction, confirm } = useInteraction();
  const trip = dashboard.passengerTrip;
  return (
    <ScreenScroll>
      <WorkbenchHeader
        eyebrow="支付前置"
        title="完成 ¥0 支付确认"
        description="支付必须前置，但内部沙箱不会创建真实资金交易。"
      />
      {trip ? (
        <TripSummary trip={trip} />
      ) : (
        <ProductEmptyState
          title="未找到行程"
          description="当前没有可支付的合成行程，请返回重新创建。"
          action={{ label: "返回创建行程", onPress: () => navigate("trip-create") }}
        />
      )}
      <ProductActionBar>
        <PrimaryButton
          label="完成 ¥0 支付前置"
          disabled={!trip || trip.state !== "pending_payment"}
          loading={actions["trip.pay"] === "running"}
          loadingLabel="正在确认"
          onPress={() => void (async () => {
            if (await runAction("trip.pay", payTrip, { successTitle: "支付前置已完成", successMessage: "本次金额为 ¥0。" })) {
              navigate("trip-matching");
            }
          })()}
        />
        <PrimaryButton
          label="取消合成行程"
          variant="danger"
          disabled={!trip || trip.state !== "pending_payment"}
          loading={actions["trip.cancel"] === "running"}
          loadingLabel="正在取消"
          onPress={() => void (async () => {
            if (!await confirm({
              title: "取消合成行程？",
              message: "取消后本次零金额支付状态会关闭。",
              confirmLabel: "确认取消",
              destructive: true,
            })) return;
            if (await runAction("trip.cancel", cancelTrip, { successTitle: "合成行程已取消" })) {
              navigate("trip-result");
            }
          })()}
        />
      </ProductActionBar>
    </ScreenScroll>
  );
}

export function TripMatchingScreen({ navigate }: { navigate: Navigate }) {
  const { dashboard, cancelTrip, refresh } = useSyntheticTrip();
  const { actions, runAction, confirm } = useInteraction();
  const trip = dashboard.passengerTrip;
  useEffect(() => {
    if (trip?.state === "accepted" || trip?.state === "in_progress" || trip?.state === "safety_frozen") {
      navigate("trip-active");
    }
    if (trip?.state === "completed" || trip?.state === "cancelled") navigate("trip-result");
  }, [navigate, trip?.state]);
  return (
    <ScreenScroll>
      <WorkbenchHeader
        eyebrow="匹配等待"
        title="正在等待合成车主"
        description="刷新只读取最新状态，不会重复创建、支付或匹配。"
      />
      {trip ? <TripSummary trip={trip} /> : null}
      <ProductStatePanel title="匹配边界" description="等待 30 分钟后可进入异常恢复；车主自主决定是否接受，真实订单保持关闭。" />
      <PrimaryButton label="刷新匹配状态" variant="secondary" onPress={() => void refresh()} />
      <PrimaryButton label="处理超时与异常" variant="secondary" onPress={() => navigate("trip-recovery")} />
      <PrimaryButton
        label="取消合成行程"
        variant="danger"
        loading={actions["trip.cancel"] === "running"}
        loadingLabel="正在取消"
        onPress={() => void (async () => {
          if (!await confirm({
            title: "取消合成行程？",
            message: "取消后当前匹配或接单关系会结束。",
            confirmLabel: "确认取消",
            destructive: true,
          })) return;
          if (await runAction("trip.cancel", cancelTrip, { successTitle: "合成行程已取消" })) {
            navigate("trip-result");
          }
        })()}
      />
    </ScreenScroll>
  );
}

export function TripActiveScreen({ navigate }: { navigate: Navigate }) {
  const { dashboard, refresh } = useSyntheticTrip();
  const trip = dashboard.passengerTrip;
  useEffect(() => {
    if (trip?.state === "completed" || trip?.state === "cancelled") navigate("trip-result");
  }, [navigate, trip?.state]);
  return (
    <ScreenScroll>
      <WorkbenchHeader
        eyebrow="行程进行中"
        title={trip?.state === "safety_frozen" ? "行程已进入安全冻结" : "车主已接单"}
        description="本页只展示乘客侧履约状态；聊天与安全流程将在独立页面处理。"
      />
      {trip ? <TripSummary trip={trip} /> : null}
      <PrimaryButton label="刷新行程状态" variant="secondary" onPress={() => void refresh()} />
      <PrimaryButton label="处理异常恢复" variant="secondary" onPress={() => navigate("trip-recovery")} />
      <PrimaryButton label="返回首页" variant="text" onPress={() => navigate("passenger-workbench")} />
    </ScreenScroll>
  );
}

export function TripResultScreen({ navigate }: { navigate: Navigate }) {
  const { dashboard } = useSyntheticTrip();
  const trip = dashboard.passengerTrip;
  return (
    <ScreenScroll>
      <WorkbenchHeader
        eyebrow="行程结果"
        title={trip?.state === "completed" ? "合成行程已完成" : "合成行程已关闭"}
        description="结果页只呈现最终状态、关闭原因和恢复记录。"
      />
      {trip ? <TripSummary trip={trip} /> : null}
      {trip?.closureReason ? (
        <StatusBanner title="关闭原因" description={closureLabels[trip.closureReason]} />
      ) : null}
      <PrimaryButton label="返回首页" onPress={() => navigate("passenger-workbench")} />
    </ScreenScroll>
  );
}

export function TripRecoveryScreen({ navigate }: { navigate: Navigate }) {
  const { dashboard, recoveryNotice, reconcileTripTimeout } = useSyntheticTrip();
  const { actions, runAction } = useInteraction();
  const trip = dashboard.passengerTrip ?? dashboard.activeDriverTrip;
  const recoveryEligibility = trip ? getRecoveryEligibility(trip, Date.now()) : undefined;
  return (
    <MobilityPage
      title="行程恢复"
      accessibilityLabel="核对行程最新状态"
      onBack={() => navigate(trip?.driverAccountId ? "driver-trip" : passengerTripScreen(trip?.state))}
      tone={trip?.driverAccountId ? "driver" : "passenger"}
      actions={
        <>
          <PrimaryButton
            label="核对最新状态"
            disabled={!trip || !recoveryEligibility?.available}
            loading={actions["sandbox.trip-timeout"] === "running"}
            loadingLabel="正在核对"
            onPress={() => trip && void runAction(
              "sandbox.trip-timeout",
              () => reconcileTripTimeout(trip),
              { successTitle: "已核对最新行程状态" },
            )}
          />
          <PrimaryButton
            label="返回当前行程"
            variant="secondary"
            onPress={() => navigate(trip?.driverAccountId ? "driver-trip" : passengerTripScreen(trip?.state))}
          />
        </>
      }
    >
      {trip ? (
        <>
          <AppV2StageHeader
            eyebrow="状态核对"
            title="确认这次行程的最新结果"
            description="适用于等待时间过长，或上次操作结果暂时不明确的情况。"
            tone={trip.driverAccountId ? "driver" : "passenger"}
          />
          <RouteSummaryCard
            originLabel={trip.originLabel}
            destinationLabel={trip.destinationLabel}
            passengerCount={trip.passengerCount}
          />
          <AppV2SummaryList
            items={[
              { label: "当前进度", value: recoveryTripStateLabel(trip.state) },
              { label: "恢复情况", value: recoveryStateLabel(trip.recovery.state) },
              { label: "本次费用", value: "¥0", emphasized: true },
            ]}
          />
          {recoveryNotice ? (
            <AppV2StatusPanel
              title="已读取最新状态"
              description="请按照当前页面显示的行程状态继续；系统不会重复提交上一次操作。"
              tone={trip.driverAccountId ? "driver" : "passenger"}
            />
          ) : recoveryEligibility?.available ? (
            <AppV2StatusPanel
              title="可以核对最新状态"
              description="核对后会读取当前结果，并根据最新行程状态提供下一步。"
              tone={trip.driverAccountId ? "driver" : "passenger"}
            />
          ) : (
            <AppV2StatusPanel
              title="尚未到可核对时间"
              description={recoveryEligibility?.description ?? "当前行程不需要额外恢复。"}
            />
          )}
        </>
      ) : (
        <AppV2EmptyState
          icon="route"
          title="当前没有需要恢复的行程"
          description="返回首页后，可以查看当前行程或重新发起一次行程。"
          action={{ label: "返回首页", onPress: () => navigate("passenger-workbench") }}
          tone="passenger"
        />
      )}
    </MobilityPage>
  );
}

export function DriverOffersScreen({ navigate }: { navigate: Navigate }) {
  const { dashboard, acceptTrip, refresh } = useSyntheticTrip();
  const { actions, runAction } = useInteraction();
  const trip = dashboard.availableDriverTrips[0];
  useEffect(() => {
    if (dashboard.activeDriverTrip) navigate("driver-trip");
  }, [dashboard.activeDriverTrip, navigate]);
  return (
    <ScreenScroll>
      <WorkbenchHeader
        eyebrow="待接行程"
        title={trip ? "有一笔合成行程可选择" : "暂无待接合成行程"}
        description="平台只展示符合车辆人数、资格和配额条件的订单，由你逐单自主决定。"
        tone="owner"
      />
      {trip ? (
        <TripSummary trip={trip} />
      ) : (
        <ProductEmptyState
          title="暂无待接任务"
          description="刷新后查看最新合成待接列表；平台不会强制派单或自动接单。"
        />
      )}
      <PrimaryButton
        label="接受合成行程"
        variant="owner"
        disabled={!trip}
        loading={actions["trip.accept"] === "running"}
        loadingLabel="正在接受"
        onPress={() => trip && void (async () => {
          if (await runAction("trip.accept", () => acceptTrip(trip), { successTitle: "已接受合成行程" })) {
            navigate("driver-trip");
          }
        })()}
      />
      <PrimaryButton
        label="暂不接单"
        variant="secondary"
        onPress={() => navigate("owner-workbench")}
      />
      <PrimaryButton label="刷新待接行程" variant="secondary" onPress={() => void refresh()} />
    </ScreenScroll>
  );
}

export function DriverTripScreen({ navigate }: { navigate: Navigate }) {
  const { dashboard, startTrip, completeTrip, cancelDriverTrip, refresh } = useSyntheticTrip();
  const { getCancellationEligibility } = useMobility();
  const { actions, runAction, confirm } = useInteraction();
  const trip = dashboard.activeDriverTrip;
  const [cancellationEligibility, setCancellationEligibility] = useState<TripCancellationEligibility>();
  useEffect(() => {
    if (!trip || !["accepted", "driver_en_route"].includes(trip.state)) return;
    void getCancellationEligibility(trip.tripId).then(setCancellationEligibility);
  }, [getCancellationEligibility, trip]);
  return (
    <ScreenScroll>
      <WorkbenchHeader
        eyebrow="车主履约"
        title={trip?.state === "in_progress" ? "合成行程进行中" : trip ? "准备开始合成行程" : "暂无进行中任务"}
        description="开始与完成操作保持串行；真实位置、导航和资金结算均未接入。"
        tone="owner"
      />
      {trip ? <TripSummary trip={trip} /> : null}
      {trip?.state === "accepted" ? (
        <PrimaryButton
          label="开始合成行程"
          variant="owner"
          loading={actions["trip.start"] === "running"}
          loadingLabel="正在开始"
          onPress={() => void runAction("trip.start", startTrip, { successTitle: "合成行程已开始" })}
        />
      ) : null}
      {trip && ["accepted", "driver_en_route"].includes(trip.state) ? (
        <>
          {cancellationEligibility?.goodwill ? (
            <StatusSummary
              title="善意取消额度"
              items={[
                { label: "近 24 小时", value: `${cancellationEligibility.goodwill.usage.hours24}/${cancellationEligibility.goodwill.limits.hours24}` },
                { label: "近 7 日", value: `${cancellationEligibility.goodwill.usage.days7}/${cancellationEligibility.goodwill.limits.days7}` },
                { label: "近 30 日", value: `${cancellationEligibility.goodwill.usage.days30}/${cancellationEligibility.goodwill.limits.days30}` },
              ]}
            />
          ) : null}
          <PrimaryButton
            label="因临时情况取消"
            variant="danger"
            loading={actions["trip.driver-cancel"] === "running"}
            loadingLabel="正在取消"
            onPress={() => void (async () => {
              if (!await confirm({
                title: "确认取消本次接驾？",
                message: "符合条件时将使用一次善意取消额度，并为乘车人优先重新匹配。",
                confirmLabel: "确认取消",
                destructive: true,
              })) return;
              if (await runAction(
                "trip.driver-cancel",
                () => cancelDriverTrip({ reason: "plans_changed" }),
                { successTitle: "已取消本次接驾" },
              )) {
                navigate("driver-home");
              }
            })()}
          />
        </>
      ) : null}
      {trip?.state === "in_progress" ? (
        <PrimaryButton
          label="完成合成行程"
          variant="owner"
          loading={actions["trip.complete"] === "running"}
          loadingLabel="正在完成"
          onPress={() => void (async () => {
            if (await runAction("trip.complete", completeTrip, { successTitle: "合成行程已完成" })) {
              navigate("trip-result");
            }
          })()}
        />
      ) : null}
      {trip?.state === "accepted" || trip?.state === "in_progress" ? (
        <PrimaryButton
          label="打开临时对话"
          variant="secondary"
          onPress={() => navigate("safety-chat")}
        />
      ) : null}
      <PrimaryButton label="刷新履约状态" variant="secondary" onPress={() => void refresh()} />
      <PrimaryButton label="处理超时与异常" variant="secondary" onPress={() => navigate("trip-recovery")} />
      <PrimaryButton label="返回车主工作台" variant="text" onPress={() => navigate("owner-workbench")} />
    </ScreenScroll>
  );
}

function TripSummary({ trip }: { trip: {
  originLabel: string;
  destinationLabel: string;
  passengerCount: PassengerCount;
  state: string;
  payment: { amountMinor: number; realPayment: boolean };
  recovery: { state: string };
} }) {
  return (
    <SectionCard>
      <AppText size="caption" tone="secondary" weight="bold">当前合成行程</AppText>
      <AppText size="title2" weight="bold">{trip.originLabel} → {trip.destinationLabel}</AppText>
      <View>
        <AppText tone="secondary">状态：{tripStateLabels[trip.state] ?? trip.state}</AppText>
        <AppText tone="secondary">乘车人数：{trip.passengerCount} 人</AppText>
        <AppText tone="secondary">支付金额：¥{trip.payment.amountMinor / 100} · 真实支付：关闭</AppText>
        <AppText tone="secondary">恢复状态：{trip.recovery.state}</AppText>
      </View>
    </SectionCard>
  );
}

function passengerTripScreen(state?: string): AppScreen {
  if (state === "pending_payment") return "trip-payment";
  if (state === "paid_pending_match") return "trip-matching";
  if (state === "accepted" || state === "in_progress" || state === "safety_frozen") return "trip-active";
  if (state === "completed" || state === "cancelled") return "trip-result";
  return "trip-create";
}

function recoveryTripStateLabel(state: string): string {
  return {
    pending_payment: "等待确认",
    paid_pending_match: "等待车主",
    scheduled: "预约等待中",
    reserved: "车主已接受预约",
    preparing: "预约即将开始",
    accepted: "车主已接单",
    driver_en_route: "车主正在前往",
    driver_arrived: "车主已到达",
    in_progress: "行程进行中",
    completed: "行程已完成",
    cancelled: "行程已取消",
    safety_frozen: "行程联系已暂停",
    unfulfilled: "预约未完成",
  }[state] ?? "正在核对";
}

function recoveryStateLabel(state: string): string {
  return {
    none: "无需额外处理",
    timeout_reconciled: "已核对等待结果",
    unknown_result_reconciled: "已确认最新结果",
    driver_acceptance_released: "已恢复等待其他车主",
  }[state] ?? "可核对最新状态";
}

function getRecoveryEligibility(
  trip: {
    state: string;
    createdAt: string;
    acceptedAt?: string;
    timing?: { requestedPickupEndsAt?: string };
  },
  nowMs: number,
): { available: boolean; description: string } {
  if (trip.state === "scheduled") {
    const endsAtMs = Date.parse(trip.timing?.requestedPickupEndsAt ?? trip.createdAt);
    if (Number.isFinite(endsAtMs) && nowMs > endsAtMs) {
      return { available: true, description: "预约等待时间已经结束，可以核对最终结果。" };
    }
    return { available: false, description: "预约时间结束后，如果仍没有结果，可以在这里核对。" };
  }
  const timeoutMinutes =
    trip.state === "pending_payment"
      ? 15
      : ["accepted", "reserved", "preparing"].includes(trip.state)
        ? 15
        : trip.state === "paid_pending_match"
          ? 30
          : undefined;
  if (!timeoutMinutes) {
    return { available: false, description: "当前行程状态不需要额外恢复。" };
  }
  const startedAtMs = Date.parse(trip.acceptedAt ?? trip.createdAt);
  const remainingMs = startedAtMs + timeoutMinutes * 60_000 - nowMs;
  if (remainingMs <= 0) {
    return { available: true, description: "等待时间已经超过预期，可以核对最新结果。" };
  }
  const remainingMinutes = Math.max(1, Math.ceil(remainingMs / 60_000));
  return {
    available: false,
    description: `如果 ${remainingMinutes} 分钟后仍没有结果，可以返回这里核对最新状态。`,
  };
}

const tripStateLabels: Readonly<Record<string, string>> = {
  pending_payment: "待零金额支付",
  paid_pending_match: "已支付待匹配",
  accepted: "车主已接单",
  in_progress: "履约进行中",
  safety_frozen: "安全冻结",
  completed: "已完成",
  cancelled: "已取消",
};

const closureLabels = {
  passenger_cancelled: "乘客主动取消",
  driver_cancelled: "车主主动取消",
  payment_timeout: "支付前置超时关闭",
  matching_timeout: "匹配等待超时关闭",
} as const;
