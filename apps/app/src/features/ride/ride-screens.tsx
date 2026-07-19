import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, TextInput, View } from "react-native";
import type {
  PassengerCount,
  PickupTimeSlot,
  SyntheticTripScene,
  SyntheticTripView,
  TripBookingAvailability,
  TripCancellationEligibility,
  TripCancellationReason,
  TripTiming,
} from "@pollycar/contracts";

import { useSyntheticTrip } from "../../application/synthetic-trip-context";
import { useTrustProfile } from "../../application/trust-profile-context";
import { useMobility } from "../../application/mobility-context";
import {
  CountdownAction,
  MapSurface,
  MobilityBottomSheet,
  MobilityFloatingAction,
  MobilityPage,
  MobilityScene,
  MobilityTopActions,
  RatingControl,
  RouteSummaryCard,
} from "../../components/mobility";
import { AppIcon, type AppIconName } from "../../components/app-icon";
import {
  AppV2ChoiceChip,
  AppV2DriverArrivalCard,
  AppV2EmptyState,
  AppV2FieldFrame,
  AppV2MetricStrip,
  AppV2PlaceRow,
  AppV2PickupCode,
  AppV2SectionHeader,
  AppV2SegmentedTabs,
  AppV2StageHeader,
  AppV2StatusPanel,
  AppV2SummaryList,
  AppV2Timeline,
  AppV2WaitingState,
} from "../../components/app-v2-components";
import {
  AppText,
  PrimaryButton,
  ScreenScroll,
  SectionCard,
  StatusBanner,
  StatusSummary,
} from "../../components/ui";
import { useAppTheme } from "../../theme/theme-context";
import {
  readPassengerHistoryFilter,
  rememberPassengerHistoryFilter,
} from "../../navigation/journey-continuity";
import {
  cancellationRemainingSeconds,
  canConfirmRide,
  createRideDraft,
  createRideDraftFromTrip,
  deriveDriverPresentation,
  formatTripDuration,
  formatPickupSlot,
  pickupSlotDateKey,
  pickupSlotDateLabel,
  pickupSlotTimeLabel,
  selectDestination,
  suggestedPlaces,
  toRidePlace,
  updatePassengerCount,
  updateScene,
  updateTripTiming,
  timingFromSlot,
  vehicleLocationFreshnessLabel,
  type RideDraft,
  type RidePlace,
} from "./ride-model";
import { BrowserLocationAdapter, type LocationResolution } from "./location-adapter";
import {
  loadPlacePreferences,
  rememberRecentPlace,
  saveNamedPlace,
  type SavedPlaceKind,
} from "./place-storage";
import { clearRideDraft, loadRideDraft, saveRideDraft } from "./ride-draft-storage";
import { HttpMapLocationClient } from "../../infrastructure/http-map-location-client";
import { resolveApiBaseUrl } from "../../infrastructure/api-base-url";

export type RideNavigate = (route: string) => void;

export function RideHomeScreen({
  navigate,
  onOpenIdentity,
}: {
  navigate: RideNavigate;
  onOpenIdentity?: () => void;
}) {
  const { theme } = useAppTheme();
  return (
    <MobilityScene
      mode="passenger"
      accessibilityLabel="叫车首页"
      bottomInset={70}
      map={<MapSurface variant="stage" scene="home" tone="passenger" />}
      topActions={
        <MobilityTopActions
          leading={
            <MobilityFloatingAction
              label="打开账户与身份设置"
              icon="account"
              tone="passenger"
              onPress={onOpenIdentity ?? (() => navigate("account"))}
            />
          }
          trailing={
            <MobilityFloatingAction
              label="调整上车点"
              icon="location"
              tone="passenger"
              onPress={() => navigate("ride-search")}
            />
          }
        />
      }
      sheet={
        <MobilityBottomSheet tone="passenger" size="standard">
          <AppV2StageHeader
            title="上午好，准备去哪里？"
            tone="passenger"
          />
          <DestinationAction onPress={() => navigate("ride-search")} />
          <MobilityInfoRow
            icon="pickup"
            label="上车点"
            value="人民广场 · 城市规划馆"
            actionLabel="修改"
            onPress={() => navigate("ride-search")}
          />
          <AppText size="caption" tone="secondary" weight="bold">快捷地点</AppText>
          <View style={{ flexDirection: "row", gap: theme.spacing.sm }}>
            {suggestedPlaces.slice(0, 2).map((place, index) => (
              <QuickPlaceAction
                key={place.id}
                icon={index === 0 ? "home" : "orders"}
                label={place.label}
                onPress={() => navigate("ride-confirmation")}
              />
            ))}
          </View>
          <AppText size="caption" tone="secondary">
            地图、位置与时间保持在同一场景中。
          </AppText>
        </MobilityBottomSheet>
      }
    />
  );
}

function DestinationAction({ onPress }: { onPress: () => void }) {
  const { theme } = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="你要去哪里？"
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 58,
        flexDirection: "row",
        alignItems: "center",
        gap: theme.spacing.sm,
        borderRadius: theme.radius.large,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: theme.colors.border,
        paddingHorizontal: theme.spacing.md,
        backgroundColor: pressed ? theme.colors.surfaceMuted : theme.colors.surface,
      })}
    >
      <AppIcon name="search" color={theme.colors.passenger} />
      <AppText style={{ flex: 1 }} weight="bold">你要去哪里？</AppText>
      <AppIcon name="chevron-right" size={18} color={theme.colors.textSecondary} />
    </Pressable>
  );
}

function QuickPlaceAction({
  icon,
  label,
  onPress,
}: {
  icon: AppIconName;
  label: string;
  onPress: () => void;
}) {
  const { theme } = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        minHeight: 48,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: theme.spacing.xs,
        borderRadius: theme.radius.medium,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: theme.colors.border,
        backgroundColor: pressed ? theme.colors.surfaceMuted : theme.colors.surface,
      })}
    >
      <AppIcon name={icon} size={19} color={theme.colors.passenger} />
      <AppText weight="bold">{label}</AppText>
    </Pressable>
  );
}

function MobilityInfoRow({
  icon,
  label,
  value,
  actionLabel,
  onPress,
}: {
  icon: AppIconName;
  label: string;
  value: string;
  actionLabel?: string;
  onPress?: () => void;
}) {
  const { theme } = useAppTheme();
  return (
    <View
      style={{
        minHeight: 58,
        flexDirection: "row",
        alignItems: "center",
        gap: theme.spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
        paddingVertical: theme.spacing.xs,
      }}
    >
      <AppIcon name={icon} size={20} color={theme.colors.passenger} />
      <View style={{ flex: 1 }}>
        <AppText size="caption" tone="secondary">{label}</AppText>
        <AppText weight="bold">{value}</AppText>
      </View>
      {actionLabel && onPress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          onPress={onPress}
          style={{ minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" }}
        >
          <AppText weight="bold">{actionLabel}</AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

export function PlaceSearchScreen({
  navigate,
  onSelect,
}: {
  navigate: RideNavigate;
  onSelect?: (place: RidePlace) => void;
}) {
  const { theme } = useAppTheme();
  const [query, setQuery] = useState("");
  const [origin, setOrigin] = useState<RidePlace>(createRideDraft().origin);
  const [manualOrigin, setManualOrigin] = useState("");
  const [preferences, setPreferences] = useState(loadPlacePreferences);
  const [locationState, setLocationState] = useState<LocationResolution["state"]>();
  const [locating, setLocating] = useState(false);
  const [remoteResults, setRemoteResults] = useState<readonly RidePlace[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string>();
  const [mapClient] = useState(() => new HttpMapLocationClient(resolveApiBaseUrl()));
  const places = useMemo(
    () => [
      ...(preferences.saved.home ? [preferences.saved.home] : []),
      ...(preferences.saved.work ? [preferences.saved.work] : []),
      ...preferences.recent,
      ...suggestedPlaces.filter(
        (place) =>
          place.kind !== "home" &&
          place.kind !== "work" &&
          !preferences.recent.some((recent) => recent.id === place.id),
      ),
    ],
    [preferences],
  );
  const results = query.trim().length >= 2 ? remoteResults : places;
  useEffect(() => {
    const normalized = query.trim();
    if (normalized.length < 2) {
      setRemoteResults([]);
      setSearchError(undefined);
      return;
    }
    const timer = setTimeout(() => {
      setSearching(true);
      setSearchError(undefined);
      void mapClient.searchPlaces(normalized)
        .then((result) => setRemoteResults(result.places.map(toRidePlace)))
        .catch((error: Error) => {
          setRemoteResults([]);
          setSearchError(error.message);
        })
        .finally(() => setSearching(false));
    }, 350);
    return () => clearTimeout(timer);
  }, [mapClient, query]);
  const useDeviceLocation = async () => {
    setLocating(true);
    const resolution = await new BrowserLocationAdapter().resolveCurrentPlace();
    setLocationState(resolution.state);
    if (resolution.state === "resolved") {
      if (resolution.place.location) {
        try {
          const resolved = await mapClient.reverseGeocode(resolution.place.location);
          setOrigin({ ...toRidePlace(resolved), kind: "current" });
        } catch {
          setOrigin(resolution.place);
        }
      } else {
        setOrigin(resolution.place);
      }
    }
    setLocating(false);
  };
  const applyManualOrigin = () => {
    const value = manualOrigin.trim();
    if (!value) return;
    setOrigin({
      id: `manual-${value.toLocaleLowerCase().replace(/\s+/g, "-")}`,
      label: value,
      address: value,
      kind: "search",
      synthetic: false,
    });
  };
  const savePlace = (kind: SavedPlaceKind, place: RidePlace) =>
    setPreferences(saveNamedPlace(kind, place));
  const selectMapPoint = async () => {
    setSearching(true);
    setSearchError(undefined);
    try {
      const place = await mapClient.reverseGeocode({
        latitude: 31.2184,
        longitude: 121.4692,
        coordinateSystem: "gcj02",
      });
      const selected = toRidePlace(place);
      setPreferences(rememberRecentPlace(selected));
      onSelect?.(selected);
      navigate("ride-confirmation");
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : "MAP_PROVIDER_UNAVAILABLE");
    } finally {
      setSearching(false);
    }
  };
  return (
    <MobilityPage
      title="选择目的地"
      accessibilityLabel="目的地搜索"
      onBack={() => navigate("ride-home")}
    >
      <View style={{ gap: theme.spacing.sm }}>
        <AppV2SectionHeader title="上车点" />
        <SearchLocationField
          icon="pickup"
          label="当前上车点"
          value={`${origin.label} · ${origin.address}`}
        />
        <AppV2FieldFrame icon="location" label="手动输入上车点">
          <TextInput
            accessibilityLabel="手动输入上车点"
            value={manualOrigin}
            onChangeText={setManualOrigin}
            placeholder="输入道路、建筑或地点"
            placeholderTextColor={theme.colors.textSecondary}
            style={[rideV2Styles.fieldInput, { color: theme.colors.text }]}
          />
        </AppV2FieldFrame>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm }}>
          <PrimaryButton
            label="使用手动上车点"
            variant="secondary"
            disabled={!manualOrigin.trim()}
            onPress={applyManualOrigin}
          />
          <PrimaryButton
            label={locating ? "正在定位" : "使用设备位置"}
            variant="secondary"
            disabled={locating}
            onPress={() => void useDeviceLocation()}
          />
          <PrimaryButton
            label="在地图上选点"
            variant="secondary"
            disabled={searching}
            onPress={() => void selectMapPoint()}
          />
        </View>
      </View>
      <View style={{ gap: theme.spacing.sm }}>
        <AppV2SectionHeader title="目的地" detail={query ? "搜索结果会随输入更新" : undefined} />
        {locationState && locationState !== "resolved" ? (
          <AppV2StatusPanel
            tone="safety"
            title={locationStateTitle(locationState)}
            description={locationStateDescription(locationState)}
          />
        ) : null}
        <AppV2FieldFrame
          icon="search"
          label="搜索目的地"
          trailing={query ? <PrimaryButton label="清空" variant="text" onPress={() => setQuery("")} /> : undefined}
        >
          <TextInput
            accessibilityLabel="搜索目的地"
            value={query}
            onChangeText={setQuery}
            placeholder="输入目的地"
            placeholderTextColor={theme.colors.textSecondary}
            style={[rideV2Styles.fieldInput, { color: theme.colors.text }]}
          />
        </AppV2FieldFrame>
        {searching ? <AppV2StatusPanel title="正在搜索地点" description="请稍候，正在获取匹配地点。" /> : null}
        {searchError ? (
          <AppV2StatusPanel
            tone="safety"
            title="地点搜索暂不可用"
            description="可以使用常用或最近地点，也可以继续手动输入上车点。"
          />
        ) : null}
      </View>
      <View style={{ gap: theme.spacing.sm }}>
        <AppV2SectionHeader title={query ? "搜索结果" : "家、公司和最近地点"} />
        {results.length ? results.map((place, index) => (
          <PlaceResultRow
            key={place.id}
            place={place}
            icon={place.kind === "home" ? "home" : place.kind === "work" ? "orders" : index < 2 ? "clock" : "location"}
            onPress={() => {
              setPreferences(rememberRecentPlace(place));
              onSelect?.(place);
              navigate("ride-confirmation");
            }}
            onSaveHome={() => savePlace("home", place)}
            onSaveWork={() => savePlace("work", place)}
          />
        )) : (
          <AppV2EmptyState
            icon="search"
            title="没有找到地点"
            description="请更换关键词或清空搜索。"
            action={query ? { label: "清空搜索", onPress: () => setQuery("") } : undefined}
            tone="passenger"
          />
        )}
      </View>
    </MobilityPage>
  );
}

function SearchLocationField({
  icon,
  label,
  value,
}: {
  icon: AppIconName;
  label: string;
  value: string;
}) {
  return (
    <AppV2FieldFrame icon={icon} label={label}>
      <AppText weight="bold">{value}</AppText>
    </AppV2FieldFrame>
  );
}

function PlaceResultRow({
  place,
  icon,
  onPress,
  onSaveHome,
  onSaveWork,
}: {
  place: RidePlace;
  icon: AppIconName;
  onPress: () => void;
  onSaveHome: () => void;
  onSaveWork: () => void;
}) {
  return (
    <AppV2PlaceRow
      icon={icon}
      title={place.label}
      description={place.address}
      onPress={onPress}
      footer={
        <>
          <PrimaryButton label="设为家" variant="text" onPress={onSaveHome} />
          <PrimaryButton label="设为公司" variant="text" onPress={onSaveWork} />
        </>
      }
    />
  );
}

function locationStateTitle(state: Exclude<LocationResolution["state"], "resolved">): string {
  return {
    permission_denied: "位置权限未授权",
    unavailable: "定位暂不可用",
    timeout: "定位超时",
    offline: "当前处于离线状态",
  }[state];
}

function locationStateDescription(state: Exclude<LocationResolution["state"], "resolved">): string {
  return {
    permission_denied: "可在系统设置中授权位置，或继续手动输入上车点。",
    unavailable: "当前设备无法提供位置，可继续手动输入上车点。",
    timeout: "未在规定时间内取得位置，请重试或手动输入。",
    offline: "恢复网络后可再次定位；当前可以使用已保存地点。",
  }[state];
}

export function TripConfirmationScreen({
  navigate,
  initialDraft,
}: {
  navigate: RideNavigate;
  initialDraft?: RideDraft;
}) {
  const {
    createTrip,
    payTrip,
    rescheduleTrip,
    dashboard,
    bookingAvailability,
    refreshBookingAvailability,
  } = useSyntheticTrip();
  const { theme } = useAppTheme();
  const scheduledTrip =
    dashboard.passengerTrip?.state === "scheduled" ? dashboard.passengerTrip : undefined;
  const [draft, setDraft] = useState<RideDraft>(
    initialDraft ??
      (scheduledTrip
        ? createRideDraftFromTrip(scheduledTrip)
        : loadRideDraft() ?? selectDestination(createRideDraft(), suggestedPlaces[2]!)),
  );
  const [initializedTripId, setInitializedTripId] = useState(scheduledTrip?.tripId);
  const [submitting, setSubmitting] = useState(false);
  const [route, setRoute] = useState<import("@pollycar/contracts").PlannedRoute>();
  const [routeUnavailable, setRouteUnavailable] = useState(false);
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  const [timingExpired, setTimingExpired] = useState(false);
  const [mapClient] = useState(() => new HttpMapLocationClient(resolveApiBaseUrl()));
  useEffect(() => {
    if (initialDraft || !scheduledTrip || initializedTripId === scheduledTrip.tripId) return;
    setDraft(createRideDraftFromTrip(scheduledTrip));
    setInitializedTripId(scheduledTrip.tripId);
  }, [initialDraft, initializedTripId, scheduledTrip]);
  useEffect(() => {
    saveRideDraft(draft);
  }, [draft]);
  useEffect(() => {
    if (!bookingAvailability || draft.timing.mode !== "scheduled") return;
    const remainsAvailable = bookingAvailability.availableSlots.some(
      (slot) =>
        slot.available &&
        slot.startsAt === draft.timing.requestedPickupStartsAt &&
        slot.endsAt === draft.timing.requestedPickupEndsAt,
    );
    if (remainsAvailable) {
      setTimingExpired(false);
      return;
    }
    setDraft(
      updateTripTiming(draft, {
        mode: "immediate",
        timezone: bookingAvailability.timezone,
        selectionSource: "immediate",
      }),
    );
    setTimingExpired(true);
  }, [bookingAvailability, draft]);
  useEffect(() => {
    if (!draft.origin.location || !draft.destination?.location) return;
    setRouteUnavailable(false);
    void mapClient.planDrivingRoute({
      origin: draft.origin.location,
      destination: draft.destination.location,
      strategy: "fastest",
      includeTraffic: false,
    }).then(setRoute).catch(() => {
      setRoute(undefined);
      setRouteUnavailable(true);
    });
  }, [draft.destination?.location, draft.origin.location, mapClient]);
  const scenes: readonly [SyntheticTripScene, string][] = [
    ["commute", "通勤"],
    ["airport", "机场／车站"],
    ["medical", "就医"],
    ["other", "其他"],
  ];

  const submit = async () => {
    if (!canConfirmRide(draft) || submitting) return;
    setSubmitting(true);
    try {
      if (scheduledTrip) {
        await rescheduleTrip({
          originLabel: draft.origin.address,
          destinationLabel: draft.destination!.address,
          passengerCount: draft.passengerCount,
          scene: draft.scene ?? null,
          timing: draft.timing,
          ...(route
            ? { estimatedDurationMinutes: Math.max(1, Math.round(route.durationSeconds / 60)) }
            : {}),
        });
      } else {
        const createdTrip = await createTrip(
          draft.origin.address,
          draft.destination!.address,
          draft.passengerCount,
          draft.scene,
          draft.timing,
          route ? Math.max(1, Math.round(route.durationSeconds / 60)) : undefined,
        );
        if (createdTrip?.state === "pending_payment") await payTrip(createdTrip);
      }
      clearRideDraft();
      navigate("ride-matching");
    } finally {
      setSubmitting(false);
    }
  };
  const timingPresentation = formatPickupSlot(
    draft.timing,
    bookingAvailability ? new Date(bookingAvailability.serverNow) : new Date(),
  );

  return (
    <>
      <MobilityScene
        mode="passenger"
        accessibilityLabel="确认行程"
        sheetHeight="76%"
        map={
          <MapSurface
            variant="stage"
            scene="route"
            tone="passenger"
            originLabel={draft.origin.address}
            destinationLabel={draft.destination?.address}
            statusLabel="路线预览"
          />
        }
        topActions={
          <MobilityTopActions
            leading={
              <MobilityFloatingAction
                label="返回选择目的地"
                icon="back"
                onPress={() => navigate("ride-search")}
              />
            }
          />
        }
        sheet={
          <MobilityBottomSheet
            tone="passenger"
            size="expanded"
            actions={
              <>
                <PrimaryButton
                  label={scheduledTrip ? "保存预约修改" : timingPresentation.action}
                  loading={submitting}
                  loadingLabel={scheduledTrip ? "正在保存" : "正在确认"}
                  disabled={!canConfirmRide(draft)}
                  onPress={() => void submit()}
                />
                <PrimaryButton label="修改目的地" variant="text" onPress={() => navigate("ride-search")} />
              </>
            }
          >
            <AppV2StageHeader
              eyebrow="行程确认"
              title="确认行程"
              description="确认地点、时间与乘车人数"
              tone="passenger"
            />
            <RouteSummaryCard
              originLabel={draft.origin.address}
              destinationLabel={draft.destination?.address ?? "请选择目的地"}
              passengerCount={draft.passengerCount}
              durationLabel={route ? `约 ${Math.max(1, Math.round(route.durationSeconds / 60))} 分钟` : undefined}
              distanceLabel={route ? `约 ${(route.distanceMeters / 1000).toFixed(1)} 公里` : undefined}
            />
            {scheduledTrip ? (
              <AppV2StatusPanel
                title="修改未接单预约"
                description="保存后会重新校验时间、路线、人数和车主匹配条件。"
              />
            ) : null}
            {timingExpired ? (
              <AppV2StatusPanel
                tone="safety"
                title="原预约时间已失效"
                description="已保留上车点、目的地、人数和场景，请重新选择希望上车时间。"
              />
            ) : null}
            <View style={{ gap: theme.spacing.sm }}>
              <AppV2SectionHeader title="地点" detail="可在确认前修改" />
              <AppV2FieldFrame icon="pickup" label="上车点">
                <TextInput
                  accessibilityLabel="上车点"
                  value={draft.origin.address}
                  onChangeText={(address) =>
                    setDraft({ ...draft, origin: { ...draft.origin, address } })
                  }
                  placeholder="请输入上车点"
                  placeholderTextColor={theme.colors.textSecondary}
                  style={[rideV2Styles.fieldInput, { color: theme.colors.text }]}
                />
              </AppV2FieldFrame>
              <AppV2FieldFrame icon="location" label="目的地">
                <TextInput
                  accessibilityLabel="目的地"
                  value={draft.destination?.address ?? ""}
                  onChangeText={(address) =>
                    setDraft({
                      ...draft,
                      destination: {
                        ...(draft.destination ?? {
                          id: "manual-destination",
                          label: "目的地",
                          kind: "search" as const,
                          synthetic: true,
                        }),
                        address,
                      },
                    })
                  }
                  placeholder="请输入目的地"
                  placeholderTextColor={theme.colors.textSecondary}
                  style={[rideV2Styles.fieldInput, { color: theme.colors.text }]}
                />
              </AppV2FieldFrame>
            </View>
            {routeUnavailable ? (
              <AppV2StatusPanel
                tone="safety"
                title="路线预览暂不可用"
                description="不会伪造距离或预计时间；仍可返回修改地点后重试。"
              />
            ) : null}
            <View style={{ gap: theme.spacing.md }}>
              <AppV2SectionHeader title="希望上车时间" />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`希望上车时间，${timingPresentation.summary}`}
                onPress={() => {
                  setTimePickerOpen(true);
                  void refreshBookingAvailability().catch(() => undefined);
                }}
                style={{
                  minHeight: 52,
                  justifyContent: "center",
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                  borderRadius: theme.radius.medium,
                  paddingHorizontal: theme.spacing.md,
                  backgroundColor: theme.colors.surface,
                }}
              >
                <AppText weight="bold">{timingPresentation.summary}</AppText>
                <AppText size="caption" tone="secondary">点击选择其他时间</AppText>
              </Pressable>
              <AppV2SectionHeader title="乘车人数" detail="必选 · 最多 3 人" />
              <View style={{ flexDirection: "row", gap: theme.spacing.sm }}>
                {([1, 2, 3] as const).map((count) => (
                  <ChoiceButton
                    key={count}
                    label={`${count} 人`}
                    selected={draft.passengerCount === count}
                    onPress={() => setDraft(updatePassengerCount(draft, count as PassengerCount))}
                  />
                ))}
              </View>
              <AppV2SectionHeader title="乘车场景" detail="可选" />
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm }}>
                {scenes.map(([scene, label]) => (
                  <ChoiceButton
                    key={scene}
                    label={label}
                    selected={draft.scene === scene}
                    onPress={() => setDraft(updateScene(draft, draft.scene === scene ? undefined : scene))}
                  />
                ))}
              </View>
            </View>
            <AppV2StatusPanel
              title="本次费用 ¥0"
              description="确认后不会产生扣款。"
            />
          </MobilityBottomSheet>
        }
      />
      <PickupTimePicker
        visible={timePickerOpen}
        availability={bookingAvailability}
        selectedTiming={draft.timing}
        onClose={() => setTimePickerOpen(false)}
        onRetry={() => void refreshBookingAvailability()}
        onSelect={(timing) => {
          setDraft(updateTripTiming(draft, timing));
          setTimePickerOpen(false);
        }}
      />
    </>
  );
}

export function TripMatchingScreen({ navigate }: { navigate: RideNavigate }) {
  const {
    dashboard,
    bookingAvailability,
    cancelTrip,
    reconcileTripTimeout,
    refresh,
    refreshBookingAvailability,
    rescheduleTrip,
  } = useSyntheticTrip();
  const trip = dashboard.passengerTrip;
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  if (!trip) return <MissingTripScreen navigate={navigate} />;
  if (trip.state === "unfulfilled") {
    return (
      <MobilityPage
        title="预约结果"
        accessibilityLabel="预约未能完成匹配"
        onBack={() => navigate("ride-home")}
        actions={
          <>
            <PrimaryButton label="重新选择时间" onPress={() => navigate("ride-confirmation")} />
            <PrimaryButton label="返回首页" variant="text" onPress={() => navigate("ride-home")} />
          </>
        }
      >
        <AppV2EmptyState
          icon="route"
          title="预约未能完成匹配"
          description="该时间段内没有车主接受预约，你可以重新选择时间或返回首页。"
          action={{ label: "重新选择时间", onPress: () => navigate("ride-confirmation") }}
          tone="passenger"
        />
      </MobilityPage>
    );
  }
  const deliveredNotice = [...(trip.scheduleNotices ?? [])]
    .filter((notice) => notice.delivered)
    .sort((left, right) => Date.parse(right.dueAt) - Date.parse(left.dueAt))[0];

  return (
    <>
      <MobilityScene
        mode="passenger"
        accessibilityLabel="等待车主接单"
        map={
          <MapSurface
            variant="stage"
            scene="home"
            tone="passenger"
            originLabel={trip.originLabel}
            statusLabel="等待附近车主响应"
          />
        }
        topActions={
          <MobilityTopActions
            leading={
              <MobilityFloatingAction
                label="返回行程确认"
                icon="back"
                onPress={() => navigate("ride-confirmation")}
              />
            }
            trailing={
              <MobilityFloatingAction
                label="刷新接单状态"
                icon="route"
                tone="passenger"
                onPress={() => void refresh()}
              />
            }
          />
        }
        sheet={
          <MobilityBottomSheet
            tone="passenger"
            size="standard"
            actions={
              ["accepted", "reserved", "preparing"].includes(trip.state) ? (
                <PrimaryButton label="查看接驾信息" onPress={() => navigate("ride-pickup")} />
              ) : (
                <>
                  {trip.state === "scheduled" && trip.timing ? (
                    <PrimaryButton
                      label="修改预约信息"
                      variant="secondary"
                      onPress={() => navigate("ride-confirmation")}
                    />
                  ) : null}
                  <PrimaryButton label="刷新接单状态" onPress={() => void refresh()} />
                  <PrimaryButton
                    label="取消本次呼叫"
                    variant="text"
                    onPress={() => navigate("ride-cancel")}
                  />
                  <PrimaryButton
                    label="匹配超时恢复"
                    variant="text"
                    onPress={() => void reconcileTripTimeout(trip)}
                  />
                </>
              )
            }
          >
            <AppV2WaitingState
              title={
                trip.state === "reserved" || trip.state === "preparing"
                  ? "车主已接受预约"
                  : trip.timing?.mode === "scheduled"
                    ? "正在等待车主接受预约"
                    : "正在等待附近车主"
              }
              description={
                trip.timing?.mode === "scheduled"
                  ? `${formatPickupSlot(trip.timing).summary}；平台不会强制车主接单。`
                  : "平台展示订单，由符合条件的车主自主决定是否接单。"
              }
            />
            <RouteSummaryCard
              originLabel={trip.originLabel}
              destinationLabel={trip.destinationLabel}
              passengerCount={trip.passengerCount}
            />
            {trip.timing?.mode === "scheduled" && deliveredNotice ? (
              <AppV2StatusPanel
                title={scheduleNoticeTitle(deliveredNotice.kind)}
                description={`${formatPickupSlot(trip.timing).summary}；请留意预约状态变化。`}
              />
            ) : null}
            <AppText size="caption" tone="secondary">
              取消是否可用以及后续处理会根据当前行程情况显示。
            </AppText>
          </MobilityBottomSheet>
        }
      />
      {trip.timing ? (
        <PickupTimePicker
          visible={timePickerOpen}
          availability={bookingAvailability}
          selectedTiming={trip.timing}
          onClose={() => setTimePickerOpen(false)}
          onRetry={() => void refreshBookingAvailability()}
          onSelect={(timing) => {
            void rescheduleTrip({ timing }).then(() => setTimePickerOpen(false));
          }}
        />
      ) : null}
    </>
  );
}

function PickupTimePicker({
  visible,
  availability,
  selectedTiming,
  onClose,
  onRetry,
  onSelect,
}: {
  visible: boolean;
  availability?: TripBookingAvailability;
  selectedTiming: TripTiming;
  onClose: () => void;
  onRetry: () => void;
  onSelect: (timing: TripTiming) => void;
}) {
  const { theme } = useAppTheme();
  const [showAll, setShowAll] = useState(false);
  const firstDateKey = availability?.availableSlots[0]
    ? pickupSlotDateKey(availability.availableSlots[0].startsAt)
    : undefined;
  const [selectedDateKey, setSelectedDateKey] = useState<string>();
  const activeDateKey = selectedDateKey ?? firstDateKey;
  const dateSlots = availability?.availableSlots.filter(
    (slot) => pickupSlotDateKey(slot.startsAt) === activeDateKey,
  ) ?? [];
  const dateOptions = Array.from(
    new Map(
      (availability?.availableSlots ?? []).map((slot) => [
        pickupSlotDateKey(slot.startsAt),
        slot,
      ]),
    ),
  );
  const now = availability ? new Date(availability.serverNow) : new Date();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <AppText size="title2" weight="bold">取消本次行程？</AppText>
      <View
        style={{
          flex: 1,
          justifyContent: "flex-end",
          backgroundColor: "rgba(0,0,0,0.35)",
        }}
      >
        <View
          style={{
            maxHeight: "90%",
            backgroundColor: theme.colors.background,
            borderTopLeftRadius: theme.radius.large,
            borderTopRightRadius: theme.radius.large,
            paddingTop: theme.spacing.lg,
          }}
        >
          <ScreenScroll>
            <AppText size="title2" weight="bold">选择希望上车时间</AppText>
            <ChoiceButton
              label={`尽快出发 · 当前 ${new Intl.DateTimeFormat("zh-CN", {
                timeZone: "Asia/Shanghai",
                hour: "2-digit",
                minute: "2-digit",
                hourCycle: "h23",
              }).format(now)}`}
              selected={selectedTiming.mode === "immediate"}
              onPress={() =>
                onSelect({
                  mode: "immediate",
                  timezone: availability?.timezone ?? "Asia/Shanghai",
                  selectionSource: "immediate",
                })
              }
            />
            {!availability ? (
              <>
                <StatusBanner
                  tone="warning"
                  title="暂时无法获取预约时间"
                  description="App 不会使用本地时间伪造可预约时段。"
                />
                <PrimaryButton label="重新加载" variant="secondary" onPress={onRetry} />
              </>
            ) : (
              <>
                <AppText size="caption" tone="secondary" weight="bold">快捷预约</AppText>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm }}>
                  {availability.quickSlots.map((slot) => (
                    <TimeSlotButton
                      key={slot.startsAt}
                      slot={slot}
                      selected={selectedTiming.requestedPickupStartsAt === slot.startsAt}
                      onPress={() => onSelect(timingFromSlot(slot, "quick_slot", availability.timezone))}
                    />
                  ))}
                </View>
                <PrimaryButton
                  label={showAll ? "收起全部预约时间" : "查看全部预约时间"}
                  variant="secondary"
                  onPress={() => setShowAll((value) => !value)}
                />
                {showAll ? (
                  <>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm }}>
                      {dateOptions.map(([dateKey, slot]) => (
                        <ChoiceButton
                          key={dateKey}
                          label={pickupSlotDateLabel(slot.startsAt, now)}
                          selected={activeDateKey === dateKey}
                          onPress={() => setSelectedDateKey(dateKey)}
                        />
                      ))}
                    </View>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm }}>
                      {dateSlots.map((slot) => (
                        <TimeSlotButton
                          key={slot.startsAt}
                          slot={slot}
                          selected={selectedTiming.requestedPickupStartsAt === slot.startsAt}
                          onPress={() =>
                            onSelect(timingFromSlot(slot, "calendar_slot", availability.timezone))
                          }
                        />
                      ))}
                    </View>
                  </>
                ) : null}
              </>
            )}
            <PrimaryButton label="关闭" variant="text" onPress={onClose} />
          </ScreenScroll>
        </View>
      </View>
    </Modal>
  );
}

function TimeSlotButton({
  slot,
  selected,
  onPress,
}: {
  slot: PickupTimeSlot;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <ChoiceButton
      label={pickupSlotTimeLabel(slot)}
      selected={selected}
      onPress={onPress}
    />
  );
}

export function DriverPickupScreen({ navigate, nowMs = Date.now() }: { navigate: RideNavigate; nowMs?: number }) {
  const { dashboard } = useSyntheticTrip();
  const trip = dashboard.passengerTrip;
  if (!trip) return <MissingTripScreen navigate={navigate} />;
  const driver = deriveDriverPresentation(trip);
  const remaining = cancellationRemainingSeconds(trip.acceptedAt, nowMs);
  const [mapClient] = useState(() => new HttpMapLocationClient(resolveApiBaseUrl()));
  const [vehicleLocation, setVehicleLocation] = useState<import("@pollycar/contracts").VehicleLocationView>();
  useEffect(() => {
    let active = true;
    const refreshLocation = () => {
      void mapClient.getVehicleLocation(trip.tripId)
        .then((view) => {
          if (active) setVehicleLocation(view);
        })
        .catch(() => {
          if (active) setVehicleLocation(undefined);
        });
    };
    refreshLocation();
    const timer = setInterval(refreshLocation, 10_000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [mapClient, trip.tripId]);
  const fallbackFreshness = vehicleLocationFreshnessLabel(
    trip.acceptedAt ?? trip.createdAt,
    nowMs,
  );
  const locationFreshness = vehicleLocation
    ? {
        state: vehicleLocation.freshness,
        label:
          vehicleLocation.freshness === "fresh"
            ? "车辆位置刚刚更新"
            : vehicleLocation.freshness === "aging"
              ? "车辆位置更新稍有延迟"
              : vehicleLocation.freshness === "stale"
                ? "车辆位置可能已变化"
                : "车辆位置暂不可用",
      }
    : fallbackFreshness;
  const scheduledWaiting =
    trip.timing?.mode === "scheduled" && ["reserved", "preparing"].includes(trip.state);
  return (
    <MobilityScene
      mode="passenger"
      accessibilityLabel="车主接驾"
      sheetHeight="74%"
      map={
        <MapSurface
          variant="stage"
          scene="pickup"
          originLabel={trip.originLabel}
          statusLabel={
            scheduledWaiting
              ? formatPickupSlot(trip.timing!).summary
              : `约 ${driver.etaMinutes} 分钟到达`
          }
        />
      }
      topActions={
        <MobilityTopActions
          leading={
            <MobilityFloatingAction
              label="返回等待接单"
              icon="back"
              onPress={() => navigate("ride-matching")}
            />
          }
          trailing={
            <MobilityFloatingAction
              label="安全与帮助"
              icon="safety"
              tone="danger"
              onPress={() => navigate("safety-chat")}
            />
          }
        />
      }
      sheet={
        <MobilityBottomSheet
          tone="passenger"
          size="expanded"
          actions={
            <>
              <PrimaryButton label="联系车主" onPress={() => navigate("trip-chat")} />
              <PrimaryButton label="取消行程" variant="text" onPress={() => navigate("ride-cancel")} />
            </>
          }
        >
          <AppV2StageHeader
            eyebrow="接驾进行中"
            title={scheduledWaiting ? "车主将在预约时段前往" : "车主正在前往上车点"}
            description={locationFreshness.label}
            tone="passenger"
          />
          {locationFreshness.state === "stale" || locationFreshness.state === "unavailable" ? (
            <AppV2StatusPanel
              tone="passenger"
              title={locationFreshness.state === "stale" ? "车辆位置可能已变化" : "暂时无法获取车辆位置"}
              description="请以车主消息和现场车辆信息为准，位置恢复后将自动显示最新状态。"
            />
          ) : null}
          <AppV2DriverArrivalCard
            name={driver.displayName}
            avatarUrl={driver.avatarUri}
            genderLabel={
              driver.gender === "female"
                ? "女"
                : driver.gender === "male"
                  ? "男"
                  : "未公开"
            }
            ratingLabel={driver.ratingLabel}
            vehicleColor={driver.vehicleColor}
            vehicleModel={driver.vehicleModel}
            plate={driver.plate}
            etaLabel={
              scheduledWaiting
                ? formatPickupSlot(trip.timing!).summary
                : `约 ${driver.etaMinutes} 分钟`
            }
          />
          {scheduledWaiting ? (
            <AppV2StatusPanel
              title={trip.state === "preparing" ? "预约即将开始" : "预约已确认"}
              description="车主将在预约准备时间内前往上车点；平台不会把预约时间表述为准时保证。"
              tone="passenger"
            />
          ) : null}
          <AppV2PickupCode
            code={driver.pickupCode}
            description="请先核对车辆和车牌，再向车主确认。"
          />
          <CountdownAction remainingSeconds={remaining} activeLabel="主动取消剩余" />
          <AppText size="caption" tone="secondary">
            超过三分钟后仍可申请取消；届时需要选择原因，并会显示本次责任处理结果。
          </AppText>
        </MobilityBottomSheet>
      }
    />
  );
}

export function TripCancellationScreen({ navigate }: { navigate: RideNavigate }) {
  const { dashboard, cancelTrip } = useSyntheticTrip();
  const { getCancellationEligibility } = useMobility();
  const { theme } = useAppTheme();
  const trip = dashboard.passengerTrip;
  const [reason, setReason] = useState<TripCancellationReason>();
  const [note, setNote] = useState("");
  const [eligibility, setEligibility] = useState<TripCancellationEligibility>();
  useEffect(() => {
    if (!trip || !["reserved", "preparing", "accepted", "driver_en_route", "driver_arrived"].includes(trip.state)) return;
    void getCancellationEligibility(trip.tripId).then(setEligibility);
  }, [getCancellationEligibility, trip]);
  const reasons = [
    ["plans_changed", "行程计划变化"],
    ["wait_too_long", "等待时间过长"],
    ["driver_or_vehicle_concern", "车辆信息不符"],
    ["other", "其他"],
  ] as const;
  return (
    <MobilityPage
      title="取消行程"
      accessibilityLabel="取消本次行程"
      onBack={() => navigate(trip?.state === "accepted" ? "ride-pickup" : "ride-matching")}
      actions={
        <>
          <PrimaryButton
            label="确认取消行程"
            variant="danger"
            disabled={!trip || (eligibility?.reasonRequired === true && !reason)}
            onPress={() =>
              trip
                ? void cancelTrip({
                    ...(reason ? { reason } : {}),
                    ...(note.trim() ? { note: note.trim() } : {}),
                  }).then(() => navigate("ride-result"))
                : undefined
            }
          />
          <PrimaryButton
            label={trip?.state === "accepted" ? "继续等待车主" : "继续等待响应"}
            variant="secondary"
            onPress={() => navigate(trip?.state === "accepted" ? "ride-pickup" : "ride-matching")}
          />
        </>
      }
    >
      <AppV2StageHeader
        eyebrow={eligibility?.reasonRequired ? "需要说明原因" : "仍在主动取消时间内"}
        title="要取消这次行程吗？"
        description={
          eligibility?.reasonRequired
            ? "已超过三分钟，请选择最符合当前情况的原因。"
            : "三分钟内原因和补充说明均为选填。"
        }
        tone="passenger"
      />
      <View style={{ gap: theme.spacing.sm }}>
        <AppV2SectionHeader
          title="取消原因"
          detail={eligibility?.reasonRequired ? "必选" : "可选"}
        />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm }}>
          {reasons.map(([value, label]) => (
            <ChoiceButton
              key={value}
              label={label}
              selected={reason === value}
              onPress={() => setReason(reason === value ? undefined : value)}
            />
          ))}
        </View>
      </View>
      <View style={{ gap: theme.spacing.sm }}>
        <AppV2SectionHeader title="补充说明" detail="可选，最多 200 字" />
        <TextInput
          accessibilityLabel="取消补充说明"
          value={note}
          maxLength={200}
          multiline
          onChangeText={setNote}
          placeholder="补充说明（选填，最多 200 字）"
          placeholderTextColor={theme.colors.textSecondary}
          style={{
            minHeight: 112,
            borderWidth: 1,
            borderColor: theme.colors.border,
            borderRadius: theme.radius.medium,
            padding: theme.spacing.md,
            color: theme.colors.text,
            backgroundColor: theme.colors.surface,
            textAlignVertical: "top",
          }}
        />
      </View>
      <AppV2StatusPanel
        title="本次费用 ¥0"
        description={
          eligibility?.mode === "responsibility_assessment"
            ? "提交后会根据原因和当前行程阶段显示责任处理结果，不会产生扣款。"
            : "三分钟内可主动取消，确认后不会产生扣款。"
        }
        tone="passenger"
      />
      {eligibility?.goodwill ? (
        <View style={{ gap: theme.spacing.sm }}>
          <AppV2SectionHeader title="善意取消额度" detail="当前使用情况" />
          <AppV2SummaryList
          items={[
            { label: "近 24 小时", value: `${eligibility.goodwill.usage.hours24}/${eligibility.goodwill.limits.hours24}` },
            { label: "近 7 日", value: `${eligibility.goodwill.usage.days7}/${eligibility.goodwill.limits.days7}` },
            { label: "近 30 日", value: `${eligibility.goodwill.usage.days30}/${eligibility.goodwill.limits.days30}` },
          ]}
          />
        </View>
      ) : null}
    </MobilityPage>
  );
}

export function InTripScreen({ navigate }: { navigate: RideNavigate }) {
  const { dashboard, selectPassengerTripForDetail } = useSyntheticTrip();
  const trip = dashboard.passengerTrip;
  if (!trip) return <MissingTripScreen navigate={navigate} />;
  return (
    <MobilityScene
      mode="passenger"
      accessibilityLabel="行程进行中"
      map={
        <MapSurface
          variant="stage"
          scene="active"
          originLabel={trip.originLabel}
          destinationLabel={trip.destinationLabel}
          statusLabel="预计 18 分钟到达"
        />
      }
      topActions={
        <MobilityTopActions
          trailing={
            <MobilityFloatingAction
              label="安全与帮助"
              icon="safety"
              tone="danger"
              onPress={() => navigate("safety-chat")}
            />
          }
        />
      }
      sheet={
        <MobilityBottomSheet
          tone="passenger"
          size="standard"
          actions={
            <>
              <PrimaryButton label="联系车主" onPress={() => navigate("trip-chat")} />
              <PrimaryButton
                label="查看行程详情"
                variant="secondary"
                onPress={() => {
                  selectPassengerTripForDetail(trip.tripId, "current");
                  navigate("ride-detail");
                }}
              />
            </>
          }
        >
          <AppV2StageHeader
            eyebrow="行程进行中"
            title="正在前往目的地"
            description={trip.destinationLabel}
            tone="passenger"
          />
          <RouteSummaryCard
            originLabel={trip.originLabel}
            destinationLabel={trip.destinationLabel}
            passengerCount={trip.passengerCount}
            durationLabel="预计 18 分钟"
          />
          <AppV2MetricStrip
            items={[
              { label: "预计到达", value: "18 分钟", icon: "clock" },
              { label: "乘车人数", value: `${trip.passengerCount} 人`, icon: "people" },
              { label: "本次费用", value: "¥0", icon: "wallet" },
            ]}
          />
          <AppText size="caption" tone="secondary">
            如需联系车主，请使用下方入口；安全与帮助始终可从右上角进入。
          </AppText>
        </MobilityBottomSheet>
      }
    />
  );
}

export function TripCompletionScreen({ navigate }: { navigate: RideNavigate }) {
  const { dashboard, selectPassengerTripForDetail } = useSyntheticTrip();
  const { getRating, submitRating } = useTrustProfile();
  const { theme } = useAppTheme();
  const trip = dashboard.passengerTrip;
  const [rating, setRating] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  useEffect(() => {
    if (!trip) return;
    void getRating(trip.tripId).then((existing) => {
      if (existing) {
        setRating(existing.score);
        setSubmitted(true);
      }
    });
  }, [getRating, trip]);
  if (!trip) return <MissingTripScreen navigate={navigate} />;
  const cancelled = trip.state === "cancelled";
  return (
    <MobilityPage
      title="行程结果"
      accessibilityLabel={cancelled ? "行程已取消" : "行程已完成"}
      hero={<TripResultHero cancelled={cancelled} />}
      actions={
        <>
          <PrimaryButton label="再次叫车" onPress={() => navigate("ride-confirmation")} />
          <PrimaryButton
            label="查看行程详情"
            variant="text"
            onPress={() => {
              selectPassengerTripForDetail(trip.tripId, "result");
              navigate("ride-detail");
            }}
          />
        </>
      }
    >
      <RouteSummaryCard
        originLabel={trip.originLabel}
        destinationLabel={trip.destinationLabel}
        passengerCount={trip.passengerCount}
        durationLabel={formatTripDuration(trip)}
      />
      <AppV2MetricStrip
        items={[
          { label: "行程时间", value: formatTripDuration(trip), icon: "clock" },
          { label: "乘车人数", value: `${trip.passengerCount} 人`, icon: "people" },
          { label: "本次费用", value: "¥0", icon: "wallet" },
        ]}
      />
      {cancelled && trip.cancellation ? (
        <View style={{ gap: theme.spacing.sm }}>
          <AppV2SectionHeader title="取消责任与处置" />
          <AppV2SummaryList
            items={[
              { label: "责任判定", value: cancellationResponsibilityLabel(trip.cancellation.responsibility) },
              { label: "处置结果", value: nonFinancialRemedyLabel(trip.cancellation.nonFinancialRemedy) },
              { label: "本次费用", value: "¥0.00", emphasized: true },
            ]}
          />
        </View>
      ) : null}
      {trip.state === "completed" ? (
        <View
          style={{
            gap: 12,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: theme.colors.border,
            paddingTop: theme.spacing.lg,
          }}
        >
          <AppV2SectionHeader title="这次行程体验如何？" detail="选填" />
          <RatingControl value={rating} onChange={setRating} disabled={submitted} />
          <PrimaryButton
            label={submitted ? "评价已提交" : "提交评价"}
            disabled={rating === 0 || submitted}
            onPress={() => {
              void submitRating({
                tripId: trip.tripId,
                score: rating as 1 | 2 | 3 | 4 | 5,
              }).then(() => setSubmitted(true));
            }}
          />
          <AppText size="caption" tone="secondary">
            每次行程只能评价一次；评价会用于改善体验，不会直接触发自动处罚。
          </AppText>
        </View>
      ) : null}
    </MobilityPage>
  );
}

function TripResultHero({ cancelled }: { cancelled: boolean }) {
  const { theme } = useAppTheme();
  return (
    <View
      style={{
        minHeight: 190,
        alignItems: "center",
        justifyContent: "center",
        gap: theme.spacing.xs,
        padding: theme.spacing.xl,
        backgroundColor: cancelled ? theme.colors.surfaceMuted : theme.colors.deepSurface,
      }}
    >
      <View
        style={{
          width: 58,
          height: 58,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: theme.radius.pill,
          backgroundColor: cancelled ? theme.colors.surface : theme.colors.passenger,
        }}
      >
        <AppIcon
          name={cancelled ? "close" : "destination"}
          size={28}
          color={cancelled ? theme.colors.danger : theme.colors.inverseText}
        />
      </View>
      <AppText size="title1" weight="bold" tone={cancelled ? "primary" : "inverse"}>
        {cancelled ? "行程已取消" : "已到达目的地"}
      </AppText>
      <AppText tone={cancelled ? "secondary" : "inverse"}>
        {cancelled ? "本次不会产生扣款。" : "行程已结束，感谢你与车主共同完成本次出行。"}
      </AppText>
    </View>
  );
}

export function PassengerTripHistoryScreen({ navigate }: { navigate: RideNavigate }) {
  const { dashboard, selectPassengerTripForDetail } = useSyntheticTrip();
  const { theme } = useAppTheme();
  const [filter, setFilter] = useState<PassengerTripFilter>(
    readPassengerHistoryFilter,
  );
  const trips =
    dashboard.passengerTrips ??
    (dashboard.passengerTrip ? [dashboard.passengerTrip] : []);
  const visibleTrips = trips.filter((trip) => passengerTripMatchesFilter(trip, filter));
  return (
    <MobilityPage
      title="我的行程"
      accessibilityLabel="乘客行程记录"
      onBack={() => navigate("account")}
    >
      <AppV2StageHeader
        eyebrow="我的 · 行程记录"
        title="我的行程"
        description="查看进行中、预约和已结束的行程。"
        tone="passenger"
      />
      <AppV2SegmentedTabs
        tone="passenger"
        items={[
          { value: "all", label: "全部" },
          { value: "active", label: "进行中" },
          { value: "completed", label: "已完成" },
          { value: "closed", label: "已取消" },
        ]}
        selected={filter}
        onSelect={(nextFilter) => {
          setFilter(nextFilter);
          rememberPassengerHistoryFilter(nextFilter);
        }}
      />
      {visibleTrips.length === 0 ? (
        <AppV2EmptyState
          icon="route"
          title={trips.length === 0 ? "还没有行程" : "没有符合条件的行程"}
          description={
            trips.length === 0
              ? "发起行程后，进行中和历史记录会显示在这里。"
              : "可以切换其他分类查看行程记录。"
          }
          action={
            trips.length === 0
              ? { label: "发起行程", onPress: () => navigate("ride-home") }
              : undefined
          }
          tone="passenger"
        />
      ) : (
        <View style={{ gap: theme.spacing.sm }}>
          {visibleTrips.map((trip) => (
            <Pressable
              key={trip.tripId}
              accessibilityRole="button"
              accessibilityLabel={`查看行程，${trip.originLabel}到${trip.destinationLabel}，${passengerTripStateLabel(trip.state)}`}
              onPress={() => {
                selectPassengerTripForDetail(trip.tripId, "history");
                navigate("ride-detail");
              }}
              style={({ pressed }) => ({
                gap: theme.spacing.md,
                padding: theme.spacing.lg,
                borderWidth: 1,
                borderColor: theme.colors.border,
                borderRadius: theme.radius.large,
                backgroundColor: pressed
                  ? theme.colors.surfaceMuted
                  : theme.colors.surface,
              })}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: theme.spacing.md,
                }}
              >
                <AppText size="small" tone="secondary">
                  {formatTripHistoryDate(trip)}
                </AppText>
                <AppText
                  size="small"
                  tone={passengerTripTone(trip.state)}
                  weight="bold"
                >
                  {passengerTripStateLabel(trip.state)}
                </AppText>
              </View>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: theme.spacing.md,
                }}
              >
                <View
                  style={{
                    width: 42,
                    height: 42,
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: theme.radius.pill,
                    backgroundColor: `${theme.colors.passenger}18`,
                  }}
                >
                  <AppIcon name="route" size={20} color={theme.colors.passenger} />
                </View>
                <View style={{ flex: 1, gap: theme.spacing.xxs }}>
                  <AppText weight="bold">
                    {trip.destinationLabel}
                  </AppText>
                  <AppText size="small" tone="secondary">
                    {trip.originLabel} → {trip.destinationLabel}
                  </AppText>
                </View>
                <AppIcon
                  name="chevron-right"
                  size={18}
                  color={theme.colors.textSecondary}
                />
              </View>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  gap: theme.spacing.md,
                }}
              >
                <AppText size="caption" tone="secondary">
                  {trip.passengerCount} 人 · {formatTripDuration(trip)}
                </AppText>
                <AppText size="caption" weight="bold">
                  ¥0
                </AppText>
              </View>
            </Pressable>
          ))}
        </View>
      )}
    </MobilityPage>
  );
}

export function TripDetailScreen({ navigate }: { navigate: RideNavigate }) {
  const {
    passengerTripDetailOrigin,
    selectedPassengerTrip: trip,
  } = useSyntheticTrip();
  if (!trip) return <MissingTripScreen navigate={navigate} />;
  const returnScreen =
    passengerTripDetailOrigin === "current"
      ? routeForTrip(trip)
      : passengerTripDetailOrigin === "result"
        ? "trip-result"
        : passengerTripDetailOrigin === "message"
          ? "message-center"
          : "ride-history";
  const tripActive = isPassengerTripActive(trip);
  const timeline = [
    {
      label: "发起行程",
      value: formatTripDateTime(trip.createdAt),
      detail: `${trip.passengerCount} 人乘车`,
    },
    ...(trip.acceptedAt
      ? [{
          label: "车主接受",
          value: formatTripDateTime(trip.acceptedAt),
          detail: trip.driverProfile?.displayName ?? "车主已确认接驾",
        }]
      : []),
    ...(trip.completedAt
      ? [{
          label: "行程结束",
          value: formatTripDateTime(trip.completedAt),
          detail: trip.closureReason ? closureReasonLabel(trip.closureReason) : "已到达目的地",
        }]
      : trip.closureReason
        ? [{
            label: "当前结果",
            value: closureReasonLabel(trip.closureReason),
          }]
        : []),
  ];
  return (
    <MobilityPage
      title="行程详情"
      accessibilityLabel="乘客行程详情"
      onBack={() => navigate(returnScreen)}
      actions={
        tripActive ? (
          <>
            {trip.driverAccountId ? (
              <PrimaryButton label="联系车主" onPress={() => navigate("trip-chat")} />
            ) : null}
            <PrimaryButton
              label="返回当前行程"
              variant={trip.driverAccountId ? "secondary" : "primary"}
              onPress={() => navigate(routeForTrip(trip))}
            />
            <PrimaryButton
              label="返回我的行程"
              variant="text"
              onPress={() => navigate("ride-history")}
            />
          </>
        ) : (
          <>
            <PrimaryButton
              label="再次叫车"
              onPress={() => navigate("ride-confirmation")}
            />
            <PrimaryButton
              label="返回我的行程"
              variant="secondary"
              onPress={() => navigate("ride-history")}
            />
            {trip.driverAccountId ? (
              <PrimaryButton
                label="联系车主"
                variant="text"
                onPress={() => navigate("trip-chat")}
              />
            ) : null}
          </>
        )
      }
    >
      <AppV2StageHeader
        eyebrow={passengerTripStateLabel(trip.state)}
        title={trip.destinationLabel}
        description="本页汇总路线、时间和当前结果。"
        tone="passenger"
      />
      <RouteSummaryCard
        originLabel={trip.originLabel}
        destinationLabel={trip.destinationLabel}
        passengerCount={trip.passengerCount}
        durationLabel={formatTripDuration(trip)}
      />
      <AppV2MetricStrip
        items={[
          { label: "行程时间", value: formatTripDuration(trip), icon: "clock" },
          { label: "乘车人数", value: `${trip.passengerCount} 人`, icon: "people" },
          { label: "本次费用", value: "¥0", icon: "wallet" },
        ]}
      />
      <View style={{ gap: 12 }}>
        <AppV2SectionHeader title="行程时间线" />
        <AppV2Timeline items={timeline} />
      </View>
      {trip.closureReason ? (
        <AppV2StatusPanel
          title="行程结果"
          description={closureReasonLabel(trip.closureReason)}
          tone={trip.state === "cancelled" ? "safety" : "passenger"}
        />
      ) : null}
    </MobilityPage>
  );
}

function MissingTripScreen({ navigate }: { navigate: RideNavigate }) {
  return (
    <ScreenScroll>
      <StatusBanner title="没有找到这次行程" description="可以返回行程列表查看其他记录，或重新发起行程。" />
      <PrimaryButton label="返回我的行程" onPress={() => navigate("ride-history")} />
      <PrimaryButton label="发起行程" variant="text" onPress={() => navigate("ride-home")} />
    </ScreenScroll>
  );
}

function PlaceButton({ place, onPress }: { place: RidePlace; onPress: () => void }) {
  const { theme } = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        paddingVertical: theme.spacing.sm,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <AppText weight="bold">{place.label}</AppText>
      <AppText size="small" tone="secondary">{place.address}</AppText>
    </Pressable>
  );
}

function ChoiceButton({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return <AppV2ChoiceChip label={label} selected={selected} onPress={onPress} />;
}

const rideV2Styles = StyleSheet.create({
  fieldInput: {
    minHeight: 26,
    width: "100%",
    padding: 0,
    fontSize: 15,
    lineHeight: 22,
  },
});

function routeForTrip(trip: SyntheticTripView): string {
  if (["reserved", "preparing", "accepted"].includes(trip.state)) return "ride-pickup";
  if (
    ["driver_en_route", "driver_arrived", "in_progress", "safety_frozen"].includes(
      trip.state,
    )
  ) return "ride-active";
  if (trip.state === "completed" || trip.state === "unfulfilled" || trip.state === "cancelled") return "ride-result";
  return "ride-matching";
}

type PassengerTripFilter = "all" | "active" | "completed" | "closed";

function passengerTripMatchesFilter(
  trip: SyntheticTripView,
  filter: PassengerTripFilter,
): boolean {
  if (filter === "all") return true;
  if (filter === "active") return isPassengerTripActive(trip);
  if (filter === "completed") return trip.state === "completed";
  return trip.state === "cancelled" || trip.state === "unfulfilled";
}

function isPassengerTripActive(trip: SyntheticTripView): boolean {
  return !["completed", "cancelled", "unfulfilled"].includes(trip.state);
}

function passengerTripTone(
  state: SyntheticTripView["state"],
): "primary" | "passenger" | "owner" | "danger" {
  if (state === "completed") return "owner";
  if (state === "cancelled" || state === "unfulfilled") return "danger";
  return "passenger";
}

function formatTripHistoryDate(trip: SyntheticTripView): string {
  const value = trip.completedAt ?? trip.cancelledAt ?? trip.createdAt;
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Asia/Shanghai",
  }).format(new Date(value));
}

function scheduleNoticeTitle(
  kind: NonNullable<SyntheticTripView["scheduleNotices"]>[number]["kind"],
): string {
  if (kind === "accepted") return "车主已接受预约";
  if (kind === "day_before") return "预约将在一天内开始";
  if (kind === "two_hours") return "预约将在两小时内开始";
  if (kind === "thirty_minutes") return "请准备前往上车点";
  if (kind === "unmatched") return "预约仍在等待车主";
  return "预约已创建";
}

function closureReasonLabel(reason: SyntheticTripView["closureReason"]): string {
  if (reason === "passenger_cancelled") return "已由乘车人取消";
  if (reason === "payment_timeout") return "支付前置超时";
  if (reason === "matching_timeout") return "等待车主响应超时";
  return "已关闭";
}

function passengerTripStateLabel(state: SyntheticTripView["state"]): string {
  switch (state) {
    case "pending_payment":
      return "准备行程";
    case "paid_pending_match":
      return "等待车主";
    case "scheduled":
      return "预约等待中";
    case "reserved":
      return "车主已接受预约";
    case "preparing":
      return "预约即将开始";
    case "accepted":
    case "driver_en_route":
      return "车主正在前往";
    case "driver_arrived":
      return "车主已到达";
    case "in_progress":
      return "行程进行中";
    case "completed":
      return "行程已完成";
    case "cancelled":
      return "行程已取消";
    case "safety_frozen":
      return "行程联系已暂停";
    case "unfulfilled":
      return "预约未完成";
  }
}

function formatTripDateTime(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Asia/Shanghai",
  }).format(new Date(value));
}

function cancellationResponsibilityLabel(
  responsibility: NonNullable<SyntheticTripView["cancellation"]>["responsibility"],
): string {
  if (responsibility === "passenger") return "乘车人责任";
  if (responsibility === "driver") return "车主责任";
  if (responsibility === "platform") return "平台责任";
  if (responsibility === "shared") return "双方信息不一致";
  return "等待人工复核";
}

function nonFinancialRemedyLabel(
  remedy: NonNullable<SyntheticTripView["cancellation"]>["nonFinancialRemedy"],
): string {
  if (remedy === "priority_rematch") return "优先重新匹配";
  if (remedy === "driver_quota_exemption") return "本次不计入车主配额影响";
  if (remedy === "goodwill_cancellation") return "已使用一次善意取消额度";
  if (remedy === "manual_review") return "进入人工复核";
  return "无需额外处置";
}
