import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";

import type { PassengerCount } from "@pollycar/contracts";

import {
  AppText,
  PrimaryButton,
} from "../../components/ui";
import { AppIcon } from "../../components/app-icon";
import {
  AppV2EmptyState,
  AppV2MetricStrip,
  AppV2SegmentedTabs,
  AppV2StageHeader,
  AppV2StatusPanel,
  AppV2SummaryList,
  AppV2Timeline,
  AppV2UtilityActions,
} from "../../components/app-v2-components";
import {
  MapSurface,
  MobilityBottomSheet,
  MobilityFloatingAction,
  MobilityPage,
  MobilityScene,
  MobilityTopActions,
} from "../../components/mobility";
import { useAppTheme } from "../../theme/theme-context";
import {
  readDriverHistoryFilter,
  rememberDriverHistoryFilter,
} from "../../navigation/journey-continuity";
import {
  canAcceptDriverTrip,
  filterDriverOrders,
  formatSyntheticAmount,
  resolveDriverAvailability,
  sceneLabel,
  type DriverEligibility,
  type DriverOrderDetail,
  type DriverOrderFilter,
  type DriverTripCard,
} from "./driver-model";
import {
  DriverOrderSummary,
  RiderIdentity,
  SlideToConfirm,
  SummaryLine,
} from "./driver-components";
import {
  initialSlideConfirmationState,
  resetIncompleteSlide,
  updateSlideConfirmation,
} from "./slide-confirm-model";

type Navigate = (route: string) => void;

export function DriverHomeScreen({
  requestedOnline,
  eligibility,
  maxPassengerCount,
  orders,
  onToggleOnline,
  navigate,
}: {
  requestedOnline: boolean;
  eligibility: DriverEligibility;
  maxPassengerCount: PassengerCount;
  orders: readonly DriverOrderDetail[];
  onToggleOnline: () => void;
  navigate: Navigate;
}) {
  const [pendingAvailability, setPendingAvailability] = useState<"online" | "offline">();
  const transitionTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => {
    if (transitionTimer.current) clearTimeout(transitionTimer.current);
  }, []);
  const availability = resolveDriverAvailability(
    requestedOnline,
    eligibility,
    orders.some((order) => ["accepted", "in_progress", "safety_frozen"].includes(order.state)),
  );
  const displayedAvailability =
    pendingAvailability === "online"
      ? "going-online"
      : pendingAvailability === "offline"
        ? "going-offline"
        : availability;
  const today = new Date().toISOString().slice(0, 10);
  const completedToday = orders.filter(
    (order) => order.createdAt.startsWith(today) && order.state === "completed",
  );
  const online = displayedAvailability === "online";
  const goingOnline = displayedAvailability === "going-online";
  const goingOffline = displayedAvailability === "going-offline";
  const stageTitle =
    displayedAvailability === "blocked"
      ? "暂不可上线"
      : goingOnline
        ? "正在上线"
        : goingOffline
          ? "正在结束上线"
          : online
            ? "已上线"
            : displayedAvailability === "busy"
              ? "正在履约"
              : "准备接单";
  const toggleAvailability = () => {
    const next = online ? "offline" : "online";
    setPendingAvailability(next);
    transitionTimer.current = setTimeout(() => {
      void Promise.resolve(onToggleOnline()).finally(() => setPendingAvailability(undefined));
    }, next === "online" ? 900 : 0);
  };
  return (
    <MobilityScene
      mode="driver"
      accessibilityLabel="车主离线工作台"
      bottomInset={70}
      map={
        <MapSurface
          variant="stage"
          scene="home"
          tone="driver"
          statusLabel={
            displayedAvailability === "blocked"
              ? "暂不可上线"
              : goingOnline
                ? "正在上线"
                : goingOffline
                  ? "正在结束上线"
              : online
                ? "已上线 · 接收行程中"
                : displayedAvailability === "busy"
                  ? "履约中"
                  : "当前离线"
          }
        />
      }
      topActions={
        <MobilityTopActions
          leading={
            <MobilityFloatingAction
              label="打开账户与身份设置"
              icon="account"
              tone="driver"
              onPress={() => navigate("account")}
            />
          }
        />
      }
      sheet={
        <MobilityBottomSheet
          tone="driver"
          size="standard"
          actions={
            <>
              <PrimaryButton
                label={
                  goingOnline
                    ? "正在上线"
                    : goingOffline
                      ? "正在结束上线"
                      : online
                        ? "结束接单"
                        : "开始接单"
                }
                variant="owner"
                disabled={
                  goingOnline ||
                  goingOffline ||
                  displayedAvailability === "blocked" ||
                  displayedAvailability === "busy"
                }
                onPress={toggleAvailability}
              />
              {online ? (
                <PrimaryButton
                  label="查看附近订单"
                  variant="secondary"
                  onPress={() => navigate("driver-orders")}
                />
              ) : null}
            </>
          }
        >
          <AppV2StageHeader
            eyebrow="车主工作模式"
            title={stageTitle}
            description={
              displayedAvailability === "blocked"
                ? "完成车辆审核并解除限制后才能上线。"
                : goingOnline
                  ? "正在确认车辆与当前位置。"
                  : goingOffline
                    ? "正在结束接收行程。"
                    : online
                      ? "你已上线，可以浏览附近订单。"
                      : displayedAvailability === "busy"
                        ? "当前行程完成后可继续浏览附近订单。"
                        : "上线后浏览附近订单，每一单都由你决定。"
            }
            tone="driver"
          />
          <AppV2SummaryList
            items={[
              { label: "今日行程", value: `${completedToday.length}`, emphasized: true },
              { label: "单次最多乘客", value: `${maxPassengerCount} 人` },
              {
                label: "当前状态",
                value:
                    displayedAvailability === "blocked"
                      ? "需处理"
                      : goingOnline
                        ? "连接中"
                        : goingOffline
                          ? "结束中"
                      : online
                        ? "接收行程中"
                        : displayedAvailability === "busy"
                          ? "履约中"
                          : "可上线",
              },
            ]}
          />
          <View style={styles.modeSummary}>
            <AppText size="caption" tone="secondary">接单方式</AppText>
            <AppText weight="bold">逐单自主选择</AppText>
          </View>
          <AppV2UtilityActions
            tone="driver"
            actions={[
              {
                label: "我的订单",
                icon: "orders",
                onPress: () => navigate("driver-history"),
              },
              {
                label: "资金中心",
                icon: "wallet",
                onPress: () => navigate("driver-wallet"),
              },
            ]}
          />
          {availability === "blocked" ? (
            <AppV2StatusPanel
              tone="safety"
              title="暂不可上线"
              description="请在账户中查看车辆审核或当前限制。"
            />
          ) : null}
          <AppText size="caption" tone="secondary">
            暂不接单不会自动接受其他订单。
          </AppText>
        </MobilityBottomSheet>
      }
    />
  );
}

export function NearbyDriverOrdersScreen({
  availability,
  maxPassengerCount,
  trips,
  onAccept,
  onSkip,
  navigate,
}: {
  availability: "offline" | "online" | "busy" | "blocked";
  maxPassengerCount: PassengerCount;
  trips: readonly DriverTripCard[];
  onAccept: (tripId: string) => Promise<void> | void;
  onSkip: (tripId: string) => void;
  navigate: Navigate;
}) {
  const { theme } = useAppTheme();
  const eligibleTrips = trips.filter((trip) => trip.passengerCount <= maxPassengerCount);
  const effectiveAvailability =
    availability === "offline" && eligibleTrips.length > 0 ? "online" : availability;
  const [skippedTripIds, setSkippedTripIds] = useState<readonly string[]>([]);
  const [acceptingTripId, setAcceptingTripId] = useState<string>();
  const visibleTrips = useMemo(
    () => eligibleTrips.filter((trip) => !skippedTripIds.includes(trip.id)),
    [eligibleTrips, skippedTripIds],
  );
  const trip = visibleTrips[0];
  const skip = () => {
    if (!trip || acceptingTripId) return;
    setSkippedTripIds((current) => [...current, trip.id]);
    onSkip(trip.id);
  };
  const accept = () => {
    if (!trip || acceptingTripId) return;
    setAcceptingTripId(trip.id);
    void Promise.resolve(onAccept(trip.id)).finally(() => setAcceptingTripId(undefined));
  };
  return (
    <MobilityScene
      mode="driver"
      accessibilityLabel="附近订单判断"
      sheetHeight="78%"
      map={
        <MapSurface
          variant="stage"
          scene="home"
          statusLabel={effectiveAvailability === "online" ? "接单中" : "当前未上线"}
        >
          <DriverMapMarkers count={Math.min(visibleTrips.length, 3)} />
        </MapSurface>
      }
      topActions={
        <MobilityTopActions
          leading={
            <MobilityFloatingAction
              label="返回车主工作台"
              icon="back"
              onPress={() => navigate("driver-home")}
            />
          }
          trailing={
            <MobilityFloatingAction
              label="查看我的订单"
              icon="orders"
              tone="driver"
              onPress={() => navigate("driver-history")}
            />
          }
        />
      }
      sheet={
        <MobilityBottomSheet
          tone="driver"
          size="expanded"
          actions={
            trip && effectiveAvailability === "online" ? (
              <View style={styles.actions}>
                <View style={styles.flex}>
                  <PrimaryButton
                    label="暂不接单"
                    variant="secondary"
                    disabled={Boolean(acceptingTripId)}
                    onPress={skip}
                  />
                </View>
                <View style={styles.flex}>
                  <PrimaryButton
                    label="接受行程"
                    variant="owner"
                    loading={acceptingTripId === trip.id}
                    loadingLabel="正在接受"
                    disabled={
                      Boolean(acceptingTripId) ||
                      !canAcceptDriverTrip(effectiveAvailability, trip, maxPassengerCount)
                    }
                    onPress={accept}
                  />
                </View>
              </View>
            ) : (
              <PrimaryButton
                label="返回车主工作台"
                variant="secondary"
                onPress={() => navigate("driver-home")}
              />
            )
          }
        >
          <AppV2StageHeader
            eyebrow="车主 · 自主接单"
            title="附近订单"
            description="逐单查看路线、人数和时间，再决定是否接受。"
            tone="driver"
          />
          {effectiveAvailability !== "online" ? (
            <AppV2StatusPanel
              title="当前未处于可接单状态"
              description="返回车主工作台上线后，再浏览附近订单。"
              tone="driver"
            />
          ) : !trip ? (
            <AppV2StatusPanel
              title={eligibleTrips.length === 0 ? "暂时没有合适订单" : "已看完当前订单"}
              description={
                eligibleTrips.length === 0
                  ? "新订单出现后会显示在这里。"
                  : "稍后可返回查看新订单。"
              }
              tone="driver"
            />
          ) : (
            <>
              {trip.timing?.mode === "scheduled" ? (
                <View>
                  <AppText size="title2" weight="bold">
                    {formatDriverPickupSlot(
                      trip.timing.requestedPickupStartsAt!,
                      trip.timing.requestedPickupEndsAt!,
                    )}
                  </AppText>
                  <AppText tone="secondary">预约行程 · 是否接受由你决定</AppText>
                </View>
              ) : null}
              <View style={styles.orderPosition}>
                <View>
                  <AppText size="caption" tone="secondary">
                    当前第 1 个 · 共 {visibleTrips.length} 个可看
                  </AppText>
                  <AppText size="title2" weight="bold">
                    距乘车人约 {trip.estimatedPickupDistanceKm?.toFixed(1) ?? "1.2"} 公里
                  </AppText>
                </View>
                <View style={[styles.passengerCount, { backgroundColor: theme.colors.surfaceMuted }]}>
                  <AppText tone="owner" weight="bold">{trip.passengerCount} 人</AppText>
                </View>
              </View>
              <RiderIdentity rider={trip.rider} />
              <DriverRouteCard trip={trip} />
              <AppV2MetricStrip
                tone="driver"
                items={[
                  {
                    label: "接驾距离",
                    value: `${trip.estimatedPickupDistanceKm?.toFixed(1) ?? "1.2"} km`,
                    icon: "location",
                  },
                  {
                    label: "预计时长",
                    value: `${trip.estimatedDurationMinutes ?? 32} 分钟`,
                    icon: "clock",
                  },
                  {
                    label: "行程场景",
                    value: trip.scene ? sceneLabel(trip.scene) ?? "其他" : "即时",
                    icon: "route",
                  },
                ]}
              />
            </>
          )}
        </MobilityBottomSheet>
      }
    />
  );
}

export function DriverPickupScreen({
  trip,
  onArrivedPickup,
  navigate,
}: {
  trip: DriverTripCard;
  onArrivedPickup: () => Promise<void> | void;
  navigate: Navigate;
}) {
  const { theme } = useAppTheme();
  const [submitting, setSubmitting] = useState(false);
  const confirmArrival = () => {
    if (submitting) return;
    setSubmitting(true);
    void Promise.resolve(onArrivedPickup()).finally(() => setSubmitting(false));
  };
  return (
    <MobilityScene
      mode="driver"
      accessibilityLabel="车主前往上车点"
      sheetHeight="48%"
      map={
        <MapSurface
          variant="stage"
          scene="pickup"
          originLabel={trip.pickupLabel}
          statusLabel="前方 300 米右转"
        />
      }
      topActions={
        <MobilityTopActions
          leading={
            <MobilityFloatingAction
              label="返回附近订单"
              icon="back"
              onPress={() => navigate("driver-orders")}
            />
          }
          trailing={
            <MobilityFloatingAction
              label="打开安全中心"
              icon="safety"
              tone="driver"
              onPress={() => navigate("safety-center")}
            />
          }
        />
      }
      sheet={
        <MobilityBottomSheet
          tone="driver"
          size="expanded"
          actions={
            <PrimaryButton
              label="已到达上车点"
              variant="owner"
              loading={submitting}
              loadingLabel="正在确认"
              onPress={confirmArrival}
            />
          }
        >
          <AppV2StageHeader
            eyebrow="接驾 · 前往上车点"
            title="预计 5 分钟到达"
            description="请按导航前往约定位置，到达后再通知乘车人。"
            tone="driver"
          />
          <View style={styles.arrivalRow}>
            <View style={styles.flex}>
              <AppText size="caption" tone="secondary">上车点</AppText>
              <AppText size="title2" weight="bold">{trip.pickupLabel}</AppText>
            </View>
            <View style={[styles.passengerCount, { backgroundColor: theme.colors.surfaceMuted }]}>
              <AppText tone="owner" weight="bold">{trip.passengerCount} 人</AppText>
            </View>
          </View>
          <RiderIdentity rider={trip.rider} compact />
          <AppV2UtilityActions
            tone="driver"
            actions={[
              {
                label: "发消息",
                icon: "messages",
                onPress: () => navigate("trip-chat"),
              },
              {
                label: "联系乘车人",
                icon: "phone",
                onPress: () => navigate("trip-chat"),
              },
            ]}
          />
        </MobilityBottomSheet>
      }
    />
  );
}

export function DriverWaitingPickupScreen({
  trip,
  onPassengerBoarded,
  onPassengerMissing,
  navigate,
}: {
  trip: DriverTripCard;
  onPassengerBoarded: (pickupCode: string) => Promise<void> | void;
  onPassengerMissing: () => void;
  navigate: Navigate;
}) {
  const { theme } = useAppTheme();
  const [pickupCode, setPickupCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const confirmBoarding = () => {
    if (pickupCode.length !== 4 || submitting) return;
    setSubmitting(true);
    void Promise.resolve(onPassengerBoarded(pickupCode)).finally(() => setSubmitting(false));
  };
  return (
    <MobilityPage
      title="等待上车"
      tone="driver"
      accessibilityLabel="等待乘车人上车"
      onBack={() => navigate("driver-pickup")}
      hero={
        <View style={styles.pageHero}>
          <AppV2StageHeader
            eyebrow="接驾 · 已到达"
            title="等待乘车人上车"
            description="核对乘车人和四位确认码后，再开始本次行程。"
            tone="driver"
          />
        </View>
      }
      actions={
        <>
          <PrimaryButton
            label="确认乘车人已上车"
            variant="owner"
            loading={submitting}
            loadingLabel="正在确认"
            disabled={pickupCode.length !== 4 || submitting}
            onPress={confirmBoarding}
          />
          <PrimaryButton label="乘车人未出现" variant="text" onPress={onPassengerMissing} />
        </>
      }
    >
      <RiderIdentity rider={trip.rider} />
      <AppV2SummaryList
        items={[
          { label: "上车点", value: trip.pickupLabel },
          { label: "乘车人数", value: `${trip.passengerCount} 人`, emphasized: true },
        ]}
      />
      <View
        style={[
          styles.confirmCodeCard,
          { borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
        ]}
      >
        <View style={styles.confirmCodeHeading}>
          <View style={[styles.confirmCodeIcon, { backgroundColor: `${theme.colors.owner}14` }]}>
            <AppIcon name="safety" size={20} color={theme.colors.owner} />
          </View>
          <View style={styles.flex}>
            <AppText size="title2" weight="bold">输入上车确认码</AppText>
            <AppText size="small" tone="secondary">请让乘车人出示 App 中的四位数字。</AppText>
          </View>
        </View>
        <TextInput
          accessibilityLabel="上车确认码"
          value={pickupCode}
          maxLength={4}
          keyboardType="number-pad"
          onChangeText={(value) => setPickupCode(value.replace(/\D/g, "").slice(0, 4))}
          placeholder="四位数字"
          placeholderTextColor={theme.colors.textSecondary}
          style={[
            styles.confirmCodeInput,
            {
              borderColor: theme.colors.border,
              backgroundColor: theme.colors.surfaceMuted,
              color: theme.colors.text,
            },
          ]}
        />
      </View>
      <AppV2UtilityActions
        tone="driver"
        actions={[
          { label: "发消息", icon: "messages", onPress: () => navigate("trip-chat") },
          { label: "联系乘车人", icon: "phone", onPress: () => navigate("trip-chat") },
        ]}
      />
    </MobilityPage>
  );
}

export function DriverInTripScreen({
  trip,
  onComplete,
  navigate,
}: {
  trip: DriverTripCard;
  onComplete: () => Promise<void> | void;
  navigate: Navigate;
}) {
  const { theme } = useAppTheme();
  const [slide, setSlide] = useState(initialSlideConfirmationState);
  const [submitting, setSubmitting] = useState(false);
  return (
    <MobilityScene
      mode="driver"
      accessibilityLabel="车主履约进行中"
      sheetHeight="52%"
      map={
        <MapSurface
          variant="stage"
          scene="active"
          destinationLabel={trip.destinationLabel}
          statusLabel="继续直行 6.8 公里"
          style={{ backgroundColor: theme.colors.deepSurface }}
        />
      }
      topActions={
        <MobilityTopActions
          leading={
            <MobilityFloatingAction
              label="查看行程信息"
              icon="route"
              tone="driver"
              onPress={() => navigate("driver-order-detail")}
            />
          }
          trailing={
            <MobilityFloatingAction
              label="打开安全中心"
              icon="safety"
              tone="driver"
              onPress={() => navigate("safety-center")}
            />
          }
        />
      }
      sheet={
        <MobilityBottomSheet
          tone="driver"
          size="expanded"
          actions={
            <View style={{ gap: theme.spacing.sm }}>
              <SlideToConfirm
                progress={slide.progress}
                disabled={submitting}
                onProgress={(progress) => {
                  const next = updateSlideConfirmation(slide, progress);
                  setSlide(next);
                }}
                onConfirm={() => {
                  if (submitting || slide.confirmed) return;
                  const next = updateSlideConfirmation(slide, 1);
                  setSlide(next);
                  if (!next.confirmed) return;
                  setSubmitting(true);
                  void Promise.resolve(onComplete()).finally(() => setSubmitting(false));
                }}
              />
              {!slide.confirmed && slide.progress > 0 ? (
                <PrimaryButton
                  label="重新滑动"
                  variant="text"
                  onPress={() => setSlide(resetIncompleteSlide(slide))}
                />
              ) : null}
            </View>
          }
        >
          <AppV2StageHeader
            eyebrow="履约中 · 安全送达"
            title="行程进行中"
            description="预计还需 18 分钟，抵达目的地后再确认完成。"
            tone="driver"
          />
          <View style={styles.arrivalRow}>
            <View style={styles.flex}>
              <AppText size="caption" tone="secondary">目的地</AppText>
              <AppText size="title2" weight="bold">{trip.destinationLabel}</AppText>
            </View>
            <AppText tone="owner" weight="bold">{trip.passengerCount} 人</AppText>
          </View>
          <AppV2UtilityActions
            tone="driver"
            actions={[
              { label: "发消息", icon: "messages", onPress: () => navigate("trip-chat") },
              { label: "安全中心", icon: "safety", onPress: () => navigate("safety-center") },
            ]}
          />
        </MobilityBottomSheet>
      }
    />
  );
}

export function DriverTripCompletedScreen({
  order,
  onContinue,
  onExitDriverMode,
}: {
  order: DriverOrderDetail;
  onContinue: () => void;
  onExitDriverMode: () => void;
}) {
  return (
    <MobilityPage
      title="订单完成"
      tone="driver"
      accessibilityLabel="车主订单完成"
      hero={
        <View style={styles.completionHero}>
          <View style={styles.completionMark}>
            <AppIcon name="destination" size={28} color="#FFFFFF" />
          </View>
          <AppV2StageHeader
            eyebrow="履约结果"
            title="行程已完成"
            description="乘车人已到达目的地，本次行程记录已更新。"
            tone="driver"
          />
        </View>
      }
      actions={
        <>
          <PrimaryButton label="继续接单" variant="owner" onPress={onContinue} />
          <PrimaryButton label="结束车主工作模式" variant="text" onPress={onExitDriverMode} />
        </>
      }
    >
      <AppV2MetricStrip
        tone="driver"
        items={[
          {
            label: "行程时间",
            value: `${order.estimatedDurationMinutes ?? 32} 分钟`,
            icon: "clock",
          },
          { label: "乘车人数", value: `${order.passengerCount} 人`, icon: "account" },
          {
            label: "预计所得",
            value: formatSyntheticAmount(order.syntheticAmountCents),
            icon: "wallet",
          },
        ]}
      />
      <AppV2Timeline
        items={[
          {
            label: "上车点",
            value: order.pickupLabel,
            detail: order.startedAt ? formatOrderDate(order.startedAt) : "乘车人已上车",
            tone: "driver",
          },
          {
            label: "目的地",
            value: order.destinationLabel,
            detail: order.completedAt ? formatOrderDate(order.completedAt) : "本次行程已完成",
            tone: "driver",
          },
        ]}
      />
      <AppV2StatusPanel
        title="费用记录已更新"
        description="当前体验不会发起真实结算，费用信息仅用于核对本次行程。"
        tone="driver"
      />
    </MobilityPage>
  );
}

export function DriverOrderHistoryScreen({
  orders,
  onOpenOrder,
  navigate,
}: {
  orders: readonly DriverOrderDetail[];
  onOpenOrder: (orderId: string) => void;
  navigate: Navigate;
}) {
  const { theme } = useAppTheme();
  const [filter, setFilter] = useState<DriverOrderFilter>(
    readDriverHistoryFilter,
  );
  const visibleOrders = filterDriverOrders(orders, filter);
  const filters: readonly [DriverOrderFilter, string][] = [
    ["all", "全部"],
    ["active", "进行中"],
    ["completed", "已完成"],
    ["cancelled", "已取消"],
  ];
  return (
    <MobilityPage
      title="我的订单"
      tone="driver"
      accessibilityLabel="车主订单历史"
      onBack={() => navigate("driver-home")}
      trailing={
        <MobilityFloatingAction
          label="打开资金中心"
          icon="wallet"
          tone="driver"
          onPress={() => navigate("driver-wallet")}
        />
      }
    >
      <AppV2StageHeader
        eyebrow="车主 · 行程记录"
        title="我的订单"
        description="查看进行中、已完成和已取消的行程。"
        tone="driver"
      />
      <AppV2SegmentedTabs
        tone="driver"
        items={filters.map(([value, label]) => ({ value, label }))}
        selected={filter}
        onSelect={(nextFilter) => {
          setFilter(nextFilter);
          rememberDriverHistoryFilter(nextFilter);
        }}
      />
      {visibleOrders.length === 0 ? (
        <AppV2EmptyState
          icon="orders"
          title="当前没有订单"
          description="符合当前筛选条件的行程记录会显示在这里。"
          tone="driver"
        />
      ) : (
        visibleOrders.map((order) => (
          <Pressable
            key={order.id}
            accessibilityRole="button"
            accessibilityLabel={`查看订单，${order.pickupLabel}到${order.destinationLabel}`}
            onPress={() => onOpenOrder(order.id)}
            style={({ pressed }) => [
              styles.historyCard,
              {
                borderColor: theme.colors.border,
                backgroundColor: pressed ? theme.colors.surfaceMuted : theme.colors.surface,
              },
            ]}
          >
            <View style={styles.rowBetween}>
              <AppText size="caption" tone="secondary">
                {formatOrderDate(order.createdAt)}
              </AppText>
              <View
                style={[
                  styles.orderStateBadge,
                  {
                    backgroundColor:
                      order.state === "cancelled"
                        ? `${theme.colors.danger}12`
                        : order.state === "completed"
                          ? `${theme.colors.owner}14`
                          : theme.colors.surfaceMuted,
                  },
                ]}
              >
                <AppText
                  size="caption"
                  tone={
                    order.state === "cancelled"
                      ? "danger"
                      : order.state === "completed"
                        ? "owner"
                        : "primary"
                  }
                  weight="bold"
                >
                  {driverOrderStateLabel(order.state)}
                </AppText>
              </View>
            </View>
            <DriverRouteCard trip={order} />
            <View style={styles.rowBetween}>
              <View>
                <AppText size="caption" tone="secondary">本次费用记录</AppText>
                <AppText size="title2" weight="bold">
                  {formatSyntheticAmount(order.syntheticAmountCents)}
                </AppText>
              </View>
              <View style={styles.inlineLink}>
                <AppText tone="owner" weight="bold">查看详情</AppText>
                <AppIcon name="chevron-right" size={16} color={theme.colors.owner} />
              </View>
            </View>
          </Pressable>
        ))
      )}
    </MobilityPage>
  );
}

export function DriverOrderDetailScreen({
  order,
  navigate,
}: {
  order: DriverOrderDetail;
  navigate: Navigate;
}) {
  const timeline = [
    {
      label: "订单创建",
      value: formatOrderDate(order.createdAt),
      detail: `${order.passengerCount} 人乘车`,
      tone: "driver" as const,
    },
    ...(order.acceptedAt
      ? [{
          label: "接受行程",
          value: formatOrderDate(order.acceptedAt),
          detail: "车主已确认履约",
          tone: "driver" as const,
        }]
      : []),
    ...(order.startedAt
      ? [{
          label: "开始行程",
          value: formatOrderDate(order.startedAt),
          detail: "乘车人已确认上车",
          tone: "driver" as const,
        }]
      : []),
    ...(order.completedAt
      ? [{
          label: "完成行程",
          value: formatOrderDate(order.completedAt),
          detail: "本次行程记录已更新",
          tone: "driver" as const,
        }]
      : []),
  ];
  return (
    <MobilityPage
      title="订单详情"
      tone="driver"
      accessibilityLabel="车主订单详情"
      onBack={() => navigate("driver-history")}
    >
      <AppV2StageHeader
        eyebrow={driverOrderStateLabel(order.state)}
        title={`${order.pickupLabel} → ${order.destinationLabel}`}
        description="核对本次行程的乘车人、时间和费用记录。"
        tone="driver"
      />
      <DriverRouteCard trip={order} />
      <AppV2MetricStrip
        tone="driver"
        items={[
          {
            label: "乘车人数",
            value: `${order.passengerCount} 人`,
            icon: "account",
          },
          {
            label: "行程时间",
            value: `${order.estimatedDurationMinutes ?? 32} 分钟`,
            icon: "clock",
          },
          {
            label: "费用记录",
            value: formatSyntheticAmount(order.syntheticAmountCents),
            icon: "wallet",
          },
        ]}
      />
      <AppV2SummaryList
        items={[
          { label: "乘车人", value: order.rider.displayName },
          { label: "当前状态", value: driverOrderStateLabel(order.state), emphasized: true },
        ]}
      />
      <AppV2Timeline items={timeline} />
      {order.cancellationSummary ? (
        <AppV2StatusPanel
          title="行程已取消"
          description={order.cancellationSummary}
          tone="neutral"
        />
      ) : null}
      {order.safetySummary ? (
        <AppV2StatusPanel
          title="需要关注安全记录"
          description={order.safetySummary}
          tone="safety"
        />
      ) : null}
      <AppV2StatusPanel
        title="费用信息仅供核对"
        description="当前体验不会发起真实结算或提现。"
        tone="driver"
      />
    </MobilityPage>
  );
}

export function DriverOrderDetailEmptyScreen({
  navigate,
}: {
  navigate: Navigate;
}) {
  return (
    <MobilityPage
      title="订单详情"
      tone="driver"
      accessibilityLabel="车主订单详情"
      onBack={() => navigate("driver-history")}
    >
      <AppV2StageHeader
        eyebrow="车主 · 行程记录"
        title="暂时无法查看订单"
        description="这条订单记录可能已更新，请返回订单列表重新选择。"
        tone="driver"
      />
      <AppV2EmptyState
        icon="orders"
        title="没有可显示的订单"
        description="返回我的订单后，选择一条行程即可查看详情。"
        tone="driver"
      />
      <PrimaryButton
        label="返回我的订单"
        variant="owner"
        onPress={() => navigate("driver-history")}
      />
    </MobilityPage>
  );
}

function DriverMapMarkers({ count }: { count: number }) {
  const { theme } = useAppTheme();
  return (
    <>
      {Array.from({ length: count }, (_, index) => (
        <View
          key={`driver-order-marker-${index}`}
          accessibilityLabel={`附近订单 ${index + 1}`}
          style={[
            styles.mapMarker,
            {
              top: `${30 + index * 17}%`,
              left: `${24 + index * 23}%`,
              borderColor: theme.colors.floatingSurface,
              backgroundColor: theme.colors.owner,
            },
          ]}
        >
          <AppText size="caption" tone="inverse" weight="bold">{index + 1}</AppText>
        </View>
      ))}
    </>
  );
}

function DriverRouteCard({ trip }: { trip: DriverTripCard }) {
  const { theme } = useAppTheme();
  return (
    <View
      style={[
        styles.routeCard,
        { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceMuted },
      ]}
    >
      <View style={styles.routeRow}>
        <AppIcon name="pickup" size={20} />
        <View style={styles.flex}>
          <AppText size="caption" tone="secondary">
            约 {trip.estimatedPickupDistanceKm ? Math.max(3, Math.round(trip.estimatedPickupDistanceKm * 4)) : 5} 分钟到达
          </AppText>
          <AppText weight="bold">{trip.pickupLabel}</AppText>
        </View>
      </View>
      <View style={[styles.routeConnector, { backgroundColor: theme.colors.border }]} />
      <View style={styles.routeRow}>
        <AppIcon name="destination" size={20} />
        <View style={styles.flex}>
          <AppText size="caption" tone="secondary">
            预计行程 {trip.estimatedDurationMinutes ?? 28} 分钟
          </AppText>
          <AppText weight="bold">{trip.destinationLabel}</AppText>
        </View>
      </View>
    </View>
  );
}

function formatOrderDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

function formatDriverPickupSlot(startsAt: string, endsAt: string): string {
  const date = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "numeric",
    day: "numeric",
    weekday: "short",
  }).format(new Date(startsAt));
  const formatTime = (value: string) =>
    new Intl.DateTimeFormat("zh-CN", {
      timeZone: "Asia/Shanghai",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(new Date(value));
  return `${date} ${formatTime(startsAt)}–${formatTime(endsAt)}`;
}

function driverOrderStateLabel(state: DriverOrderDetail["state"]): string {
  const labels: Record<DriverOrderDetail["state"], string> = {
    pending_payment: "待支付前置",
    paid_pending_match: "待接单",
    scheduled: "预约待接单",
    reserved: "预约已接受",
    preparing: "准备履约",
    accepted: "接驾中",
    driver_en_route: "前往上车点",
    driver_arrived: "等待乘车人上车",
    in_progress: "进行中",
    safety_frozen: "安全冻结",
    completed: "已完成",
    unfulfilled: "预约未履约",
    cancelled: "已取消",
  };
  return labels[state];
}

const styles = StyleSheet.create({
  code: { letterSpacing: 8, textAlign: "center" },
  flex: { flex: 1 },
  actions: { flexDirection: "row", gap: 12 },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  inlineLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statsGrid: {
    flexDirection: "row",
    gap: 8,
  },
  modeSummary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  statItem: {
    flex: 1,
    gap: 4,
    borderRadius: 12,
    padding: 12,
  },
  orderPosition: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  passengerCount: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  mapMarker: {
    position: "absolute",
    zIndex: 3,
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderRadius: 999,
  },
  routeCard: {
    gap: 8,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  routeRow: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  routeConnector: {
    width: 2,
    height: 18,
    marginLeft: 9,
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tag: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  pageHero: {
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  confirmCodeCard: {
    gap: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    padding: 16,
  },
  confirmCodeHeading: {
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  confirmCodeIcon: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
  },
  confirmCodeInput: {
    minHeight: 60,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    fontSize: 24,
    letterSpacing: 8,
    textAlign: "center",
  },
  completionHero: {
    gap: 16,
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  completionMark: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    backgroundColor: "#4B72B5",
  },
  arrivalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  actionGrid: {
    flexDirection: "row",
    gap: 12,
  },
  actionButton: {
    minHeight: 56,
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  statusHero: {
    minHeight: 188,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: 24,
  },
  heroIcon: {
    width: 58,
    height: 58,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
  },
  historyCard: {
    gap: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    padding: 16,
  },
  orderStateBadge: {
    minHeight: 30,
    justifyContent: "center",
    borderRadius: 999,
    paddingHorizontal: 10,
  },
  filters: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  filter: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
});
