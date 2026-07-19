import type {
  PassengerCount,
  AvailableDriverTripView,
  SyntheticTripDashboard,
  SyntheticTripScene,
  SyntheticTripRevision,
  SyntheticTripView,
  TripBookingAvailability,
  TripCancellationRequest,
  TripTiming,
} from "@pollycar/contracts";
import { createContext, type PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { HttpSyntheticTripClient } from "../infrastructure/http-synthetic-trip-client";
import { resolveApiBaseUrl } from "../infrastructure/api-base-url";
import {
  clearIdentityScopedJourneyState,
  readPassengerTripDetail,
  rememberPassengerTripDetail,
} from "../navigation/journey-continuity";
import { useAccountSession } from "./account-session-context";
import { useAdultEligibility } from "./adult-eligibility-context";

export type PassengerTripDetailOrigin = "history" | "current" | "result" | "message";

type SyntheticTripContextValue = Readonly<{
  dashboard: SyntheticTripDashboard;
  selectedPassengerTrip?: SyntheticTripView;
  passengerTripDetailOrigin: PassengerTripDetailOrigin;
  bookingAvailability?: TripBookingAvailability;
  recoveryNotice?: string;
  createTrip(
    originLabel: string,
    destinationLabel: string,
    passengerCount: PassengerCount,
    scene?: SyntheticTripScene,
    timing?: TripTiming,
    estimatedDurationMinutes?: number,
  ): Promise<SyntheticTripView | undefined>;
  payTrip(trip?: SyntheticTripView): Promise<void>;
  rescheduleTrip(revision: SyntheticTripRevision): Promise<void>;
  acceptTrip(trip: SyntheticTripView | AvailableDriverTripView): Promise<void>;
  startTrip(): Promise<void>;
  completeTrip(): Promise<void>;
  cancelTrip(details?: Omit<TripCancellationRequest, "tripId" | "expectedVersion">): Promise<void>;
  cancelDriverTrip(details: Omit<TripCancellationRequest, "tripId" | "expectedVersion">): Promise<void>;
  reconcileTripTimeout(trip: SyntheticTripView): Promise<void>;
  selectPassengerTripForDetail(
    tripId: string,
    origin: PassengerTripDetailOrigin,
  ): void;
  refresh(): Promise<void>;
  refreshBookingAvailability(): Promise<void>;
}>;

const SyntheticTripContext = createContext<SyntheticTripContextValue | undefined>(undefined);

export function SyntheticTripProvider({ children }: PropsWithChildren) {
  const { authenticated, session } = useAccountSession();
  const { verification } = useAdultEligibility();
  const initialPassengerTripDetail = readPassengerTripDetail();
  const [client] = useState(
    () =>
      new HttpSyntheticTripClient(resolveApiBaseUrl()),
  );
  const [dashboard, setDashboard] = useState<SyntheticTripDashboard>(initialDashboard);
  const [selectedPassengerTripId, setSelectedPassengerTripId] = useState<string | undefined>(
    initialPassengerTripDetail?.tripId,
  );
  const [passengerTripDetailOrigin, setPassengerTripDetailOrigin] =
    useState<PassengerTripDetailOrigin>(
      initialPassengerTripDetail?.origin ?? "history",
    );
  const [bookingAvailability, setBookingAvailability] = useState<TripBookingAvailability>();
  const [recoveryNotice, setRecoveryNotice] = useState<string>();
  const businessAccessAllowed =
    authenticated && verification?.businessAccessAllowed === true;
  const refresh = useCallback(async () => {
    if (!businessAccessAllowed) {
      setDashboard(initialDashboard);
      return;
    }
    setDashboard(await client.getDashboard());
  }, [businessAccessAllowed, client]);
  const refreshBookingAvailability = useCallback(
    async () => {
      if (!businessAccessAllowed || session?.activeIdentity !== "passenger") {
        setBookingAvailability(undefined);
        return;
      }
      setBookingAvailability(await client.getBookingAvailability());
    },
    [businessAccessAllowed, client, session?.activeIdentity],
  );
  const executeWrite = async <T,>(write: () => Promise<T>): Promise<T | undefined> => {
    setRecoveryNotice(undefined);
    try {
      const result = await write();
      await refresh();
      return result;
    } catch (error) {
      if (error instanceof Error && error.message === "UNKNOWN_RESULT") {
        await refresh();
        setRecoveryNotice("写入结果未知时已读取服务端最终状态；取消和超时操作不会自动重放。");
        return;
      }
      throw error;
    }
  };
  useEffect(() => {
    void refresh().catch(() => undefined);
    void refreshBookingAvailability().catch(() => undefined);
  }, [refresh, refreshBookingAvailability]);
  useEffect(() => {
    if (session?.activeIdentity === "driver") {
      setSelectedPassengerTripId(undefined);
      setPassengerTripDetailOrigin("history");
      clearIdentityScopedJourneyState();
    }
  }, [session?.activeIdentity]);
  const value = useMemo<SyntheticTripContextValue>(
    () => {
      const passengerTrips =
        dashboard.passengerTrips ??
        (dashboard.passengerTrip ? [dashboard.passengerTrip] : []);
      const selectedPassengerTrip = selectedPassengerTripId
        ? passengerTrips.find((trip) => trip.tripId === selectedPassengerTripId)
        : dashboard.passengerTrip;
      return {
      dashboard,
      ...(selectedPassengerTrip ? { selectedPassengerTrip } : {}),
      passengerTripDetailOrigin,
      ...(bookingAvailability ? { bookingAvailability } : {}),
      ...(recoveryNotice ? { recoveryNotice } : {}),
      createTrip: async (
        originLabel,
        destinationLabel,
        passengerCount,
        scene,
        timing,
        estimatedDurationMinutes,
      ) => {
        return executeWrite(() =>
          client.create(
            originLabel,
            destinationLabel,
            passengerCount,
            scene,
            timing,
            estimatedDurationMinutes,
          ),
        );
      },
      payTrip: async (createdTrip) => {
        const trip = createdTrip ?? dashboard.passengerTrip;
        if (!trip) return;
        await executeWrite(() => client.pay(trip.tripId, trip.version));
      },
      rescheduleTrip: async (revision) => {
        const trip = dashboard.passengerTrip;
        if (!trip) return;
        await executeWrite(() => client.reschedule(trip.tripId, trip.version, revision));
      },
      acceptTrip: async (trip) => {
        await executeWrite(() =>
          client.accept(
            trip.tripId,
            trip.version,
            "dispatchOfferId" in trip ? trip.dispatchOfferId : undefined,
          ),
        );
      },
      startTrip: async () => {
        const trip = dashboard.activeDriverTrip;
        if (!trip) return;
        await executeWrite(() => client.start(trip.tripId, trip.version));
      },
      completeTrip: async () => {
        const trip = dashboard.activeDriverTrip;
        if (!trip) return;
        await executeWrite(() => client.complete(trip.tripId, trip.version));
      },
      cancelTrip: async (details) => {
        const trip = dashboard.passengerTrip;
        if (!trip) return;
        await executeWrite(() => client.cancel(trip.tripId, trip.version, details));
      },
      cancelDriverTrip: async (details) => {
        const trip = dashboard.activeDriverTrip;
        if (!trip) return;
        await executeWrite(() => client.cancel(trip.tripId, trip.version, details));
      },
      reconcileTripTimeout: async (trip) => {
        await executeWrite(() => client.reconcileTimeout(trip.tripId, trip.version));
      },
      selectPassengerTripForDetail: (tripId, origin) => {
        setSelectedPassengerTripId(tripId);
        setPassengerTripDetailOrigin(origin);
        rememberPassengerTripDetail(tripId, origin);
      },
      refresh,
      refreshBookingAvailability,
    };
    },
    [
      bookingAvailability,
      client,
      dashboard,
      passengerTripDetailOrigin,
      recoveryNotice,
      refresh,
      refreshBookingAvailability,
      selectedPassengerTripId,
    ],
  );
  return <SyntheticTripContext.Provider value={value}>{children}</SyntheticTripContext.Provider>;
}

export function useSyntheticTrip() {
  const value = useContext(SyntheticTripContext);
  if (!value) throw new Error("useSyntheticTrip 必须在 SyntheticTripProvider 内使用");
  return value;
}

const initialDashboard: SyntheticTripDashboard = {
  availableDriverTrips: [],
  reservedDriverTrips: [],
  productionEnabled: false,
  realPayment: false,
  shanghaiPilot: false,
};
