import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import { View } from "react-native";

import { useVehicleReview } from "../application/vehicle-review-context";
import { AppShell, BottomNavigation, IdentitySwitchSheet } from "../components/ui";
import {
  AccountLoginScreen,
  AccountProfileScreen,
  EligibilitySettingsScreen,
  IdentitySettingsScreen,
  PrivacySafetySettingsScreen,
  QuotaSettingsScreen,
  ThemeSettingsScreen,
  VehicleSettingsScreen,
} from "../features/account/account-screens";
import {
  HelpFeedbackScreen,
  NotificationSettingsScreen,
} from "../features/account/common-settings-screens";
import {
  AccountScreen,
  type AppScreen,
  OwnerApplyIntro,
  OwnerProfile,
  OwnerWorkbench,
  PassengerWorkbench,
  ReviewApproved,
  ReviewNeedsMaterial,
  ReviewPending,
  SubmissionReview,
  VehicleForm,
} from "../features/vehicle-review/screens";
import { useIdentity } from "../identity/identity-context";
import { MotionView } from "../motion/motion-view";
import {
  DriverOffersScreen,
  DriverTripScreen,
  TripActiveScreen,
  TripCreateScreen,
  TripMatchingScreen,
  TripPaymentScreen,
  TripRecoveryScreen,
  TripResultScreen,
} from "../features/synthetic-trip/trip-screens";
import {
  SafetyAppealScreen,
  SafetyChatScreen,
  SafetyFrozenScreen,
  SafetyReportScreen,
  SafetyResultScreen,
} from "../features/safety/safety-screens";
import {
  NotificationCenterScreen,
  NotificationDetailScreen,
} from "../features/notifications/notification-center-screen";
import {
  DriverPickupScreen as RideDriverPickupScreen,
  InTripScreen,
  PlaceSearchScreen,
  RideHomeScreen,
  PassengerTripHistoryScreen,
  TripCancellationScreen,
  TripCompletionScreen,
  TripConfirmationScreen,
  TripDetailScreen,
  TripMatchingScreen as RideMatchingScreen,
} from "../features/ride";
import {
  DriverHomeScreen,
  DriverInTripScreen,
  DriverOrderDetailScreen,
  DriverOrderDetailEmptyScreen,
  DriverOrderHistoryScreen,
  DriverPickupScreen as DriverModePickupScreen,
  DriverTripCompletedScreen,
  DriverWaitingPickupScreen,
  NearbyDriverOrdersScreen,
  tripViewToDriverCard,
  type DriverOrderDetail,
} from "../features/driver";
import {
  DriverBankCardScreen,
  DriverWalletScreen,
  DriverWithdrawScreen,
  type DriverWalletView,
} from "../features/wallet";
import { MessageCenterScreen } from "../features/messages";
import { TripChatScreen } from "../features/chat";
import { useSyntheticTrip } from "../application/synthetic-trip-context";
import { useMobility } from "../application/mobility-context";
import { useAppTheme } from "../theme/theme-context";
import { resolveScreenFromReview, routeForScreen } from "./routes";
import type { SyntheticTripState } from "@pollycar/contracts";
import { useAdultEligibility } from "../application/adult-eligibility-context";
import { useAccountSession } from "../application/account-session-context";
import { AdultEligibilityAppealScreen, AdultEligibilityScreen } from "../features/adult-eligibility/adult-eligibility-screens";
import {
  identityRedirectForScreen,
  readDriverOrder,
  rememberDriverOrder,
} from "./journey-continuity";

function normalizeScreen(value: string): AppScreen {
  if (value === "ride-cancel") return "ride-cancellation";
  if (value === "ride-result") return "ride-completion";
  if (value === "safety-center") return "privacy-safety-settings";
  if (value in routeAliases) return routeAliases[value]!;
  return value as AppScreen;
}

const routeAliases: Readonly<Record<string, AppScreen>> = {
  "driver-trip": "driver-active",
};

export function ProductRoute({ screen }: Readonly<{ screen: AppScreen }>) {
  const { theme } = useAppTheme();
  const { activeIdentity, ownerApproved } = useIdentity();
  const { review } = useVehicleReview();
  const { verification, loading: adultEligibilityLoading } = useAdultEligibility();
  const { session, loading: accountSessionLoading } = useAccountSession();
  const [identityOpen, setIdentityOpen] = useState(false);
  const { dashboard, acceptTrip } = useSyntheticTrip();
  const mobility = useMobility();
  const [selectedOrderId, setSelectedOrderId] = useState<string | undefined>(
    readDriverOrder,
  );
  const [activeMobilityTrip, setActiveMobilityTrip] = useState(dashboard.activeDriverTrip);
  const enRouteTripId = useRef<string | undefined>(undefined);
  const navigate = (next: AppScreen) => router.push(routeForScreen(next));
  const navigateLoose = (next: string) => router.push(routeForScreen(normalizeScreen(next)));
  const rider = {
    displayName: "林女士",
    gender: "female" as const,
    genderSource: "verified_identity_document" as const,
    genderDisclosure: "eligible_driver_pre_acceptance" as const,
    rating: 4.8,
    ratingCount: 36,
  };
  const availableTrips =
    mobility.availableTrips.length > 0
      ? mobility.availableTrips
      : dashboard.availableDriverTrips;
  const availableOrders = availableTrips.map((trip) => {
    const passengerProfile = trip.passengerProfile;
    return tripViewToDriverCard(trip, {
      displayName: passengerProfile?.displayName ?? rider.displayName,
      avatarUri: passengerProfile?.avatarUrl,
      gender:
        passengerProfile?.gender === "male" || passengerProfile?.gender === "female"
          ? passengerProfile.gender
          : "undisclosed",
      rating: passengerProfile?.rating?.average ?? rider.rating,
      ratingCount: passengerProfile?.rating?.ratingCount ?? rider.ratingCount,
    });
  });
  const activeTrip = activeMobilityTrip ?? dashboard.activeDriverTrip;
  const activeCard = activeTrip
    ? tripViewToDriverCard(activeTrip, rider)
    : availableOrders[0];
  const knownTrips = [
    ...dashboard.availableDriverTrips,
    ...(dashboard.reservedDriverTrips ?? []),
    ...(dashboard.activeDriverTrip ? [dashboard.activeDriverTrip] : []),
  ];
  const mobilityOrders: DriverOrderDetail[] = mobility.orders.map((order) => {
    const trip = knownTrips.find((candidate) => candidate.tripId === order.tripId);
    const state = resolveDriverPageState(order.state, trip?.state);
    return {
      id: order.orderId,
      state,
      pickupLabel: order.origin.label,
      destinationLabel: order.destination.label,
      passengerCount: order.passengerCount,
      syntheticAmountCents: order.amountMinor,
      createdAt: order.occurredAt,
      rider: trip
        ? {
            displayName: trip.passengerProfile?.displayName ?? rider.displayName,
            avatarUri: trip.passengerProfile?.avatarUrl,
            gender:
              trip.passengerProfile?.gender === "male" || trip.passengerProfile?.gender === "female"
                ? trip.passengerProfile.gender
                : "undisclosed",
            rating: trip.passengerProfile?.rating?.average,
            ratingCount: trip.passengerProfile?.rating?.ratingCount,
          }
        : rider,
      acceptedAt: trip?.acceptedAt,
      startedAt: trip?.startedAt,
      completedAt: trip?.completedAt,
      cancelledAt: trip?.cancelledAt,
      cancellationSummary: trip?.cancellation ? "乘车人主动取消" : undefined,
      safetySummary: trip?.state === "safety_frozen" ? "存在安全冻结" : undefined,
      settlementSummary: "真实结算关闭",
    };
  });
  const mobilityOrderIds = new Set(mobilityOrders.map((order) => order.id));
  const reservedOrders: DriverOrderDetail[] = (dashboard.reservedDriverTrips ?? [])
    .filter((trip) => !mobilityOrderIds.has(trip.tripId))
    .map((trip) => ({
      ...tripViewToDriverCard(trip, {
        displayName: trip.passengerProfile?.displayName ?? rider.displayName,
        avatarUri: trip.passengerProfile?.avatarUrl,
        gender:
          trip.passengerProfile?.gender === "male" || trip.passengerProfile?.gender === "female"
            ? trip.passengerProfile.gender
            : "undisclosed",
        rating: trip.passengerProfile?.rating?.average,
        ratingCount: trip.passengerProfile?.rating?.ratingCount,
      }),
      acceptedAt: trip.acceptedAt,
      settlementSummary: "真实结算关闭",
    }));
  const orders = [...reservedOrders, ...mobilityOrders];
  const selectedOrder = selectedOrderId
    ? orders.find((order) => order.id === selectedOrderId)
    : undefined;
  const wallet: DriverWalletView = {
    productionEnabled: false,
    realPaymentsEnabled: mobility.wallet.realPaymentEnabled,
    realWithdrawalsEnabled: mobility.wallet.realWithdrawalEnabled,
    withdrawableBalance: {
      currency: mobility.wallet.currency,
      amountCents: mobility.wallet.withdrawableAmountMinor,
    },
    pendingSettlement: {
      currency: mobility.wallet.currency,
      amountCents: mobility.wallet.pendingSettlementAmountMinor,
    },
    lifetimeIncome: {
      currency: mobility.wallet.currency,
      amountCents: mobility.wallet.totalIncomeAmountMinor,
    },
    cards: mobility.wallet.bankCards.map((card) => ({
      id: card.cardId,
      bankName: card.bankName,
      lastFour: card.cardNumberMasked.slice(-4),
      holderNameMasked: card.holderNameMasked,
      status: "synthetic_only",
    })),
    entries: mobility.wallet.entries.map((entry) => ({
      id: entry.entryId,
      occurredAt: entry.occurredAt,
      title: entry.type === "synthetic_income" ? "合成收入" : entry.type === "synthetic_settlement" ? "合成结算" : "合成提现",
      amount: { currency: entry.currency, amountCents: entry.amountMinor },
      direction: entry.amountMinor >= 0 ? "credit" : "debit",
      relatedOrderId: entry.orderId,
      status: "synthetic",
    })),
  };

  useEffect(() => {
    const resolved = resolveScreenFromReview(screen, review.status);
    if (resolved !== screen) router.replace(routeForScreen(resolved));
  }, [review.status, screen]);

  const identityRedirect =
    !accountSessionLoading && session
      ? identityRedirectForScreen(screen, activeIdentity)
      : undefined;
  useEffect(() => {
    if (identityRedirect) {
      router.replace(routeForScreen(identityRedirect));
    }
  }, [identityRedirect]);

  useEffect(() => {
    if (activeIdentity === "passenger") setSelectedOrderId(undefined);
  }, [activeIdentity]);

  useEffect(() => {
    if (dashboard.activeDriverTrip?.tripId !== activeMobilityTrip?.tripId) {
      setActiveMobilityTrip(dashboard.activeDriverTrip);
      enRouteTripId.current = undefined;
    }
  }, [activeMobilityTrip?.tripId, dashboard.activeDriverTrip]);

  useEffect(() => {
    const trip = activeTrip;
    if (
      screen !== "driver-pickup" ||
      !trip ||
      trip.state !== "accepted" ||
      enRouteTripId.current === trip.tripId
    ) {
      return;
    }
    enRouteTripId.current = trip.tripId;
    void mobility.markDriverEnRoute(trip).then((updated) => {
      if (updated) setActiveMobilityTrip(updated);
    });
  }, [activeTrip, mobility, screen]);

  const requestedVerificationScreen =
    screen === "adult-eligibility" || screen === "adult-eligibility-appeal";
  const gatedScreen =
    !adultEligibilityLoading &&
    verification?.businessAccessAllowed !== true &&
    !requestedVerificationScreen;
  const content =
    gatedScreen || screen === "adult-eligibility" ? (
      <AdultEligibilityScreen navigate={navigateLoose} />
    ) : screen === "adult-eligibility-appeal" ? (
      <AdultEligibilityAppealScreen navigate={navigateLoose} />
    ) : screen === "ride-home" || screen === "passenger-workbench" ? (
      <RideHomeScreen navigate={navigateLoose} onOpenIdentity={() => setIdentityOpen(true)} />
    ) : screen === "ride-search" ? (
      <PlaceSearchScreen navigate={navigateLoose} />
    ) : screen === "ride-confirmation" || screen === "trip-create" ? (
      <TripConfirmationScreen navigate={navigateLoose} />
    ) : screen === "ride-matching" || screen === "trip-matching" ? (
      <RideMatchingScreen navigate={navigateLoose} />
    ) : screen === "ride-pickup" ? (
      <RideDriverPickupScreen navigate={navigateLoose} />
    ) : screen === "ride-cancellation" ? (
      <TripCancellationScreen navigate={navigateLoose} />
    ) : screen === "ride-active" || screen === "trip-active" ? (
      <InTripScreen navigate={navigateLoose} />
    ) : screen === "ride-completion" || screen === "trip-result" ? (
      <TripCompletionScreen navigate={navigateLoose} />
    ) : screen === "ride-history" ? (
      <PassengerTripHistoryScreen navigate={navigateLoose} />
    ) : screen === "ride-detail" ? (
      <TripDetailScreen navigate={navigateLoose} />
    ) : screen === "driver-home" || screen === "owner-workbench" ? (
      <DriverHomeScreen
        requestedOnline={mobility.availability.state !== "offline"}
        eligibility={{
          vehicleApproved: review.status === "approved",
          qualificationActive: review.status === "approved",
          quotaAvailable: true,
          safetyClear: true,
        }}
        maxPassengerCount={review.maxPassengerCount}
        orders={orders}
        onToggleOnline={() =>
          void mobility.setAvailability(
            "offline",
          )
        }
        onCreateLivenessChallenge={() =>
          mobility.createDriverLivenessChallenge()
        }
        onCompleteLivenessChallenge={(challengeId) =>
          mobility.completeDriverLivenessAndGoOnline(challengeId)
        }
        navigate={navigateLoose}
      />
    ) : screen === "driver-orders" || screen === "driver-offers" ? (
      <NearbyDriverOrdersScreen
        availability={mobility.availability.state}
        maxPassengerCount={review.maxPassengerCount}
        trips={availableOrders}
        onAccept={(tripId) => {
          const trip = availableTrips.find((candidate) => candidate.tripId === tripId);
          if (!trip) return Promise.resolve();
          return acceptTrip(trip)
            .then(() => mobility.refresh())
            .then(() => navigate("driver-pickup"));
        }}
        onSkip={() => undefined}
        navigate={navigateLoose}
      />
    ) : screen === "driver-pickup" && activeCard ? (
      <DriverModePickupScreen
        trip={activeCard}
        onArrivedPickup={() => {
          if (!activeTrip) return Promise.resolve();
          return mobility.markDriverArrived(activeTrip).then((updated) => {
            if (updated) setActiveMobilityTrip(updated);
            navigate("driver-waiting-pickup");
          });
        }}
        navigate={navigateLoose}
      />
    ) : screen === "driver-waiting-pickup" && activeCard ? (
      <DriverWaitingPickupScreen
        trip={activeCard}
        onPassengerBoarded={(enteredCode) => {
          if (!activeTrip) return Promise.resolve();
          return mobility.verifyBoarding(activeTrip, enteredCode).then((updated) => {
            if (updated) {
              setActiveMobilityTrip(updated);
              navigate("driver-active");
            }
          });
        }}
        onPassengerMissing={() => navigate("driver-history")}
        navigate={navigateLoose}
      />
    ) : screen === "driver-active" && activeCard ? (
      <DriverInTripScreen
        trip={activeCard}
        onComplete={() => {
          if (!activeTrip) return Promise.resolve();
          return mobility.completeTrip(activeTrip).then((updated) => {
            if (updated) {
              setActiveMobilityTrip(updated);
              navigate("driver-completion");
            }
          });
        }}
        navigate={navigateLoose}
      />
    ) : screen === "driver-completion" && orders[0] ? (
      <DriverTripCompletedScreen
        order={orders[0]}
        onContinue={() => navigate("driver-orders")}
        onExitDriverMode={() => navigate("ride-home")}
      />
    ) : screen === "driver-history" ? (
      <DriverOrderHistoryScreen
        orders={orders}
        navigate={navigateLoose}
        onOpenOrder={(orderId) => {
          setSelectedOrderId(orderId);
          rememberDriverOrder(orderId);
          void mobility.getOrder(orderId).catch(() => undefined);
          navigate("driver-order-detail");
        }}
      />
    ) : screen === "driver-order-detail" ? (
      selectedOrder ? (
        <DriverOrderDetailScreen
          order={selectedOrder}
          navigate={navigateLoose}
        />
      ) : (
        <DriverOrderDetailEmptyScreen navigate={navigateLoose} />
      )
    ) : screen === "driver-wallet" ? (
      <DriverWalletScreen wallet={wallet} navigate={navigateLoose} />
    ) : screen === "driver-bank-card" ? (
      <DriverBankCardScreen wallet={wallet} navigate={navigateLoose} />
    ) : screen === "driver-withdraw" ? (
      <DriverWithdrawScreen wallet={wallet} navigate={navigateLoose} />
    ) : screen === "trip-chat" ? (
      <TripChatScreen navigate={navigateLoose} />
    ) : screen === "message-center" ? (
      <MessageCenterScreen navigate={navigateLoose} />
    ) : screen === "notifications" ? (
      <NotificationCenterScreen navigate={navigate} />
    ) : screen === "notification-detail" ? (
      <NotificationDetailScreen navigate={navigate} />
    ) : screen === "owner-apply-intro" ? (
      <OwnerApplyIntro navigate={navigate} />
    ) : screen === "owner-profile" ? (
      <OwnerProfile navigate={navigate} />
    ) : screen === "vehicle-form" ? (
      <VehicleForm navigate={navigate} />
    ) : screen === "submission-review" ? (
      <SubmissionReview navigate={navigate} />
    ) : screen === "review-pending" ? (
      <ReviewPending navigate={navigate} />
    ) : screen === "review-needs-material" ? (
      <ReviewNeedsMaterial navigate={navigate} />
    ) : screen === "review-approved" ? (
      <ReviewApproved navigate={navigate} />
    ) : screen === "account" ? (
      <AccountScreen navigate={navigate} />
    ) : screen === "account-profile" ? (
      <AccountProfileScreen navigate={navigate} />
    ) : screen === "account-login" ? (
      <AccountLoginScreen navigate={navigate} />
    ) : screen === "identity-settings" ? (
      <IdentitySettingsScreen navigate={navigate} />
    ) : screen === "vehicle-settings" ? (
      <VehicleSettingsScreen navigate={navigate} />
    ) : screen === "eligibility-settings" ? (
      <EligibilitySettingsScreen navigate={navigate} />
    ) : screen === "quota-settings" ? (
      <QuotaSettingsScreen navigate={navigate} />
    ) : screen === "theme-settings" ? (
      <ThemeSettingsScreen navigate={navigate} />
    ) : screen === "privacy-safety-settings" ? (
      <PrivacySafetySettingsScreen navigate={navigate} />
    ) : screen === "notification-settings" ? (
      <NotificationSettingsScreen navigate={navigate} />
    ) : screen === "help-feedback" ? (
      <HelpFeedbackScreen navigate={navigate} />
    ) : screen === "trip-payment" ? (
      <TripPaymentScreen navigate={navigate} />
    ) : screen === "trip-recovery" ? (
      <TripRecoveryScreen navigate={navigate} />
    ) : screen === "driver-trip" ? (
      <DriverTripScreen navigate={navigate} />
    ) : screen === "safety-chat" ? (
      <SafetyChatScreen navigate={navigate} />
    ) : screen === "safety-report" ? (
      <SafetyReportScreen navigate={navigate} />
    ) : screen === "safety-frozen" ? (
      <SafetyFrozenScreen navigate={navigate} />
    ) : screen === "safety-appeal" ? (
      <SafetyAppealScreen navigate={navigate} />
    ) : (
      <SafetyResultScreen navigate={navigate} />
    );
  const primaryScreen = ["ride-home", "passenger-workbench", "driver-home", "owner-workbench", "account", "message-center", "notifications"].includes(screen);
  const immersivePassengerScreen = [
    "ride-home",
    "passenger-workbench",
    "ride-search",
    "ride-confirmation",
    "trip-create",
    "ride-matching",
    "trip-matching",
    "ride-pickup",
    "ride-cancellation",
    "ride-active",
    "trip-active",
    "ride-completion",
    "trip-result",
    "driver-home",
    "owner-workbench",
    "driver-orders",
    "driver-offers",
    "driver-pickup",
    "driver-waiting-pickup",
    "driver-active",
    "driver-trip",
    "driver-completion",
    "driver-history",
    "driver-order-detail",
    "driver-wallet",
    "driver-bank-card",
    "driver-withdraw",
    "trip-chat",
    "message-center",
    "notifications",
    "account",
  ].includes(screen);

  return (
    <View
      testID="app-shell-root"
      style={{ flex: 1, backgroundColor: theme.colors.background }}
    >
      <StatusBar style={theme.dark ? "light" : "dark"} />
      <AppShell
        immersive={immersivePassengerScreen}
        onOpenIdentity={
          verification?.businessAccessAllowed === true
            ? () => setIdentityOpen(true)
            : undefined
        }
        bottomNavigation={
          primaryScreen ? (
            <BottomNavigation
              active={screen === "account" ? "account" : screen === "message-center" || screen === "notifications" ? "messages" : "home"}
              onNavigate={(destination) =>
                router.replace(
                  routeForScreen(
                    destination === "account"
                      ? "account"
                      : destination === "messages"
                        ? "message-center"
                      : activeIdentity === "owner"
                        ? "driver-home"
                        : "ride-home",
                  ),
                )
              }
            />
          ) : undefined
        }
      >
        <MotionView key={screen} style={{ flex: 1 }}>
          {content}
        </MotionView>
      </AppShell>
      <IdentitySwitchSheet
        visible={identityOpen}
        onClose={() => setIdentityOpen(false)}
        onIdentitySelected={(identity) =>
          router.replace(routeForScreen(identity === "owner" ? "driver-home" : "ride-home"))
        }
        onApplyOwner={() => {
          setIdentityOpen(false);
          router.push(
            routeForScreen(
              ownerApproved || review.ownerIdentityAvailable
                ? "driver-home"
                : review.status === "needs_material"
                  ? "review-needs-material"
                  : review.status === "under_review"
                    ? "review-pending"
                    : "owner-apply-intro",
            ),
          );
        }}
      />
    </View>
  );
}

function resolveDriverPageState(
  orderState: "available" | "accepted" | "in_progress" | "completed" | "cancelled",
  tripState?: string,
): SyntheticTripState {
  if (orderState === "available") return "paid_pending_match";
  if (orderState === "accepted") {
    return tripState === "safety_frozen" ? "safety_frozen" : "accepted";
  }
  return orderState;
}
