import type { SafetyDashboard } from "@pollycar/contracts";
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { HttpSafetyCaseClient } from "../infrastructure/http-safety-case-client";
import { resolveApiBaseUrl } from "../infrastructure/api-base-url";
import { executeWriteWithReconciliation } from "./unknown-result-recovery";

type SafetyCaseContextValue = Readonly<{
  dashboard?: SafetyDashboard;
  activeTripId?: string;
  loading: boolean;
  error?: string;
  load(tripId: string): Promise<void>;
  sendMessage(tripId: string, body: string): Promise<void>;
  report(tripId: string): Promise<void>;
  appeal(): Promise<void>;
}>;

const SafetyCaseContext = createContext<SafetyCaseContextValue | undefined>(undefined);

export function SafetyCaseProvider({ children }: PropsWithChildren) {
  const [client] = useState(
    () =>
      new HttpSafetyCaseClient(resolveApiBaseUrl()),
  );
  const [dashboard, setDashboard] = useState<SafetyDashboard>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [activeTripId, setActiveTripId] = useState<string | undefined>(() => {
    if (typeof window === "undefined") return undefined;
    return window.sessionStorage.getItem("pollycar.safety.active-trip") ?? undefined;
  });
  const activeTripIdRef = useRef(activeTripId);
  const latestRequestIdRef = useRef(0);
  const activateTrip = useCallback((tripId: string) => {
    activeTripIdRef.current = tripId;
    setActiveTripId(tripId);
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem("pollycar.safety.active-trip", tripId);
    }
  }, []);
  const commitDashboard = useCallback((tripId: string, requestId: number, next: SafetyDashboard) => {
    if (requestId !== latestRequestIdRef.current || activeTripIdRef.current !== tripId) return;
    setDashboard(next);
  }, []);
  const load = useCallback(
    async (tripId: string) => {
      const requestId = ++latestRequestIdRef.current;
      activateTrip(tripId);
      setLoading(true);
      setError(undefined);
      try {
        commitDashboard(tripId, requestId, await client.getDashboard(tripId));
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "SERVICE_UNAVAILABLE");
        throw loadError;
      } finally {
        setLoading(false);
      }
    },
    [activateTrip, client, commitDashboard],
  );
  const sendMessage = useCallback(
    async (tripId: string, body: string) => {
      const requestId = ++latestRequestIdRef.current;
      activateTrip(tripId);
      await executeWriteWithReconciliation(
        async () => commitDashboard(
          tripId,
          requestId,
          await client.sendMessage(tripId, body),
        ),
        () => load(tripId),
      );
    },
    [activateTrip, client, commitDashboard, load],
  );
  const report = useCallback(
    async (tripId: string) => {
      const requestId = ++latestRequestIdRef.current;
      activateTrip(tripId);
      await executeWriteWithReconciliation(
        async () => commitDashboard(tripId, requestId, await client.report(tripId, "unsafe_behavior")),
        () => load(tripId),
      );
    },
    [activateTrip, client, commitDashboard, load],
  );
  const appeal = useCallback(async () => {
    const safetyCase = dashboard?.safetyCase;
    if (!safetyCase) return;
    const requestId = ++latestRequestIdRef.current;
    activateTrip(safetyCase.tripId);
    await executeWriteWithReconciliation(
      async () => {
        await client.appeal(safetyCase.caseId, safetyCase.version);
        commitDashboard(
          safetyCase.tripId,
          requestId,
          await client.getDashboard(safetyCase.tripId),
        );
      },
      () => load(safetyCase.tripId),
    );
  }, [activateTrip, client, commitDashboard, dashboard?.safetyCase, load]);
  const value = useMemo<SafetyCaseContextValue>(
    () => ({
      dashboard,
      ...(activeTripId ? { activeTripId } : {}),
      loading,
      ...(error ? { error } : {}),
      load,
      sendMessage,
      report,
      appeal,
    }),
    [activeTripId, appeal, dashboard, error, load, loading, report, sendMessage],
  );
  return <SafetyCaseContext.Provider value={value}>{children}</SafetyCaseContext.Provider>;
}

export function useSafetyCase() {
  const value = useContext(SafetyCaseContext);
  if (!value) throw new Error("useSafetyCase 必须在 SafetyCaseProvider 内使用");
  return value;
}
