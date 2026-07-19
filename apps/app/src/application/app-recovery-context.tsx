import type {
  AppRecoverySnapshot,
  AppRecoveryTrigger,
} from "@pollycar/contracts";
import {
  AppState,
  type AppStateStatus,
} from "react-native";
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useFreeFlexTrial } from "./free-flex-trial-context";
import { useAccountSession } from "./account-session-context";
import { useAdultEligibility } from "./adult-eligibility-context";
import { useSafetyCase } from "./safety-case-context";
import { useSyntheticTrip } from "./synthetic-trip-context";
import { useVehicleReview } from "./vehicle-review-context";

type AppRecoveryContextValue = Readonly<{
  snapshot: AppRecoverySnapshot;
  synchronize(trigger?: AppRecoveryTrigger): Promise<void>;
}>;

const AppRecoveryContext = createContext<AppRecoveryContextValue | undefined>(undefined);

export function AppRecoveryProvider({ children }: PropsWithChildren) {
  const { sessionExpired } = useAccountSession();
  const { error: eligibilityError } = useAdultEligibility();
  const { refresh: refreshVehicle } = useVehicleReview();
  const { refresh: refreshTrial } = useFreeFlexTrial();
  const { refresh: refreshTrips } = useSyntheticTrip();
  const { activeTripId, load: loadSafety } = useSafetyCase();
  const syncingRef = useRef(false);
  const [snapshot, setSnapshot] = useState<AppRecoverySnapshot>(() => ({
    state: isOnline() ? "idle" : "offline",
    automaticWriteReplay: false,
    synthetic: true,
  }));

  const synchronize = useCallback(async (trigger: AppRecoveryTrigger = "manual") => {
    if (!isOnline()) {
      setSnapshot({
        state: "offline",
        trigger,
        automaticWriteReplay: false,
        synthetic: true,
      });
      return;
    }
    if (sessionExpired || eligibilityError === "AUTHENTICATION_REQUIRED") {
      setSnapshot({
        state: "session_expired",
        trigger,
        automaticWriteReplay: false,
        synthetic: true,
      });
      return;
    }
    if (syncingRef.current) return;
    syncingRef.current = true;
    setSnapshot((current) => ({ ...current, state: "syncing", trigger }));
    const results = await Promise.allSettled([
      refreshVehicle(),
      refreshTrial(),
      refreshTrips(),
      ...(activeTripId ? [loadSafety(activeTripId)] : []),
    ]);
    const errors = results
      .filter((result): result is PromiseRejectedResult => result.status === "rejected")
      .map((result) => result.reason);
    const hasExpiredSession = errors.some(
      (error) => error instanceof Error && error.message === "AUTHENTICATION_REQUIRED",
    );
    setSnapshot({
      state: hasExpiredSession ? "session_expired" : errors.length > 0 ? "failed" : "synced",
      trigger,
      ...(errors.length === 0 ? { lastSyncedAt: new Date().toISOString() } : {}),
      automaticWriteReplay: false,
      synthetic: true,
    });
    syncingRef.current = false;
  }, [
    activeTripId,
    eligibilityError,
    loadSafety,
    refreshTrial,
    refreshTrips,
    refreshVehicle,
    sessionExpired,
  ]);

  useEffect(() => {
    void synchronize("startup");
  }, [synchronize]);

  useEffect(() => {
    let previousState: AppStateStatus = AppState.currentState;
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (previousState !== "active" && nextState === "active") {
        void synchronize("foreground");
      }
      previousState = nextState;
    });
    return () => subscription.remove();
  }, [synchronize]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handleOffline = () =>
      setSnapshot({
        state: "offline",
        automaticWriteReplay: false,
        synthetic: true,
      });
    const handleOnline = () => void synchronize("reconnected");
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, [synchronize]);

  const value = useMemo<AppRecoveryContextValue>(
    () => ({ snapshot, synchronize }),
    [snapshot, synchronize],
  );
  return <AppRecoveryContext.Provider value={value}>{children}</AppRecoveryContext.Provider>;
}

export function useAppRecovery() {
  const value = useContext(AppRecoveryContext);
  if (!value) throw new Error("AppRecoveryProvider 缺失");
  return value;
}

function isOnline(): boolean {
  return typeof navigator === "undefined" || navigator.onLine;
}
