import type {
  AvailableDriverTripView,
  DriverOrderDetail,
  DriverOrderState,
  DriverOrderSummary,
  DriverWalletView,
  PickupVerification,
  SyntheticTripView,
  TripCancellationEligibility,
  TripCancellationRequest,
} from "@pollycar/contracts";
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  HttpMobilityClient,
  type DriverAvailabilityView,
} from "../infrastructure/http-mobility-client";
import { resolveApiBaseUrl } from "../infrastructure/api-base-url";
import { useAccountSession } from "./account-session-context";
import { useAdultEligibility } from "./adult-eligibility-context";

type MobilityContextValue = Readonly<{
  availability: DriverAvailabilityView;
  availableTrips: readonly AvailableDriverTripView[];
  orders: readonly DriverOrderSummary[];
  wallet: DriverWalletView;
  recoveryNotice?: string;
  refresh(): Promise<void>;
  setAvailability(state: "online" | "offline"): Promise<void>;
  getOrder(orderId: string): Promise<DriverOrderDetail>;
  getCancellationEligibility(tripId: string): Promise<TripCancellationEligibility>;
  cancelAcceptedTrip(
    trip: SyntheticTripView,
    details?: Omit<TripCancellationRequest, "tripId" | "expectedVersion">,
  ): Promise<SyntheticTripView | undefined>;
  getPickupVerification(tripId: string): Promise<PickupVerification>;
  markDriverEnRoute(trip: SyntheticTripView): Promise<SyntheticTripView | undefined>;
  markDriverArrived(trip: SyntheticTripView): Promise<SyntheticTripView | undefined>;
  verifyBoarding(trip: SyntheticTripView, code: string): Promise<SyntheticTripView | undefined>;
  completeTrip(trip: SyntheticTripView): Promise<SyntheticTripView | undefined>;
  listOrders(state?: DriverOrderState): Promise<readonly DriverOrderSummary[]>;
}>;

const MobilityContext = createContext<MobilityContextValue | undefined>(undefined);

export function MobilityProvider({ children }: PropsWithChildren) {
  const { authenticated, session } = useAccountSession();
  const { verification } = useAdultEligibility();
  const [client] = useState(() => new HttpMobilityClient(resolveApiBaseUrl()));
  const [availability, setAvailabilityView] =
    useState<DriverAvailabilityView>(initialAvailability);
  const [availableTrips, setAvailableTrips] = useState<readonly AvailableDriverTripView[]>([]);
  const [orders, setOrders] = useState<readonly DriverOrderSummary[]>([]);
  const [wallet, setWallet] = useState<DriverWalletView>(initialWallet);
  const [recoveryNotice, setRecoveryNotice] = useState<string>();
  const driverAuthenticated =
    authenticated &&
    verification?.businessAccessAllowed === true &&
    session?.activeIdentity === "driver";

  const refresh = useCallback(async () => {
    if (!driverAuthenticated) {
      setAvailabilityView(initialAvailability);
      setAvailableTrips([]);
      setOrders([]);
      setWallet(initialWallet);
      return;
    }
    const [nextAvailability, nextTrips, nextOrders, nextWallet] = await Promise.all([
      client.getDriverAvailability(),
      client.listAvailableTrips(),
      client.listDriverOrders(),
      client.getFinanceOverview(),
    ]);
    setAvailabilityView(nextAvailability);
    setAvailableTrips(nextTrips);
    setOrders(nextOrders);
    setWallet(assertClosedFinance(nextWallet));
  }, [client, driverAuthenticated]);

  const executeWrite = useCallback(
    async <T,>(write: () => Promise<T>): Promise<T | undefined> => {
      setRecoveryNotice(undefined);
      try {
        const result = await write();
        await refresh();
        return result;
      } catch (error) {
        if (error instanceof Error && error.message === "UNKNOWN_RESULT") {
          await refresh();
          setRecoveryNotice("网络中断后已读取服务端最新状态；未自动重放原操作。");
          return undefined;
        }
        throw error;
      }
    },
    [refresh],
  );

  useEffect(() => {
    void refresh().catch(() => undefined);
  }, [refresh]);

  const value = useMemo<MobilityContextValue>(
    () => ({
      availability,
      availableTrips,
      orders,
      wallet,
      ...(recoveryNotice ? { recoveryNotice } : {}),
      refresh,
      setAvailability: async (state) => {
        await executeWrite(() => client.setDriverAvailability(state));
      },
      getOrder: (orderId) => client.getDriverOrder(orderId),
      getCancellationEligibility: (tripId) => client.getCancellationEligibility(tripId),
      cancelAcceptedTrip: (trip, details) =>
        executeWrite(() => client.cancelAcceptedTrip(trip.tripId, trip.version, details)),
      getPickupVerification: (tripId) => client.getPickupVerification(tripId),
      markDriverEnRoute: (trip) =>
        executeWrite(() => client.markDriverEnRoute(trip.tripId, trip.version)),
      markDriverArrived: (trip) =>
        executeWrite(() => client.markDriverArrived(trip.tripId, trip.version)),
      verifyBoarding: (trip, code) =>
        executeWrite(() => client.verifyBoarding(trip.tripId, trip.version, code)),
      completeTrip: (trip) =>
        executeWrite(async () => {
          const intent = await client.createCompletionIntent(trip.tripId, trip.version);
          return client.completeWithIntent(
            trip.tripId,
            trip.version,
            intent.token,
          );
        }),
      listOrders: (state) => client.listDriverOrders(state),
    }),
    [
      availability,
      availableTrips,
      client,
      executeWrite,
      orders,
      recoveryNotice,
      refresh,
      wallet,
    ],
  );

  return <MobilityContext.Provider value={value}>{children}</MobilityContext.Provider>;
}

export function useMobility() {
  const value = useContext(MobilityContext);
  if (!value) throw new Error("useMobility 必须在 MobilityProvider 内使用");
  return value;
}

function assertClosedFinance(wallet: DriverWalletView): DriverWalletView {
  if (
    wallet.realPaymentEnabled ||
    wallet.realSettlementEnabled ||
    wallet.realBankCardBindingEnabled ||
    wallet.realWithdrawalEnabled ||
    !wallet.synthetic
  ) {
    throw new Error("REAL_FINANCIAL_CAPABILITY_MUST_REMAIN_DISABLED");
  }
  return wallet;
}

const initialAvailability: DriverAvailabilityView = {
  accountId: "synthetic-account-7",
  state: "offline",
  returnOnlineAfterTrip: true,
  updatedAt: new Date(0).toISOString(),
  productionEnabled: false,
  synthetic: true,
};

const initialWallet: DriverWalletView = {
  withdrawableAmountMinor: 0,
  pendingSettlementAmountMinor: 0,
  totalIncomeAmountMinor: 0,
  currency: "CNY",
  bankCards: [],
  entries: [],
  withdrawals: [],
  realPaymentEnabled: false,
  realSettlementEnabled: false,
  realBankCardBindingEnabled: false,
  realWithdrawalEnabled: false,
  synthetic: true,
};
