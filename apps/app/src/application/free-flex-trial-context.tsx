import type { FreeFlexTrialView } from "@pollycar/contracts";
import { createContext, type PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { HttpFreeFlexTrialClient } from "../infrastructure/http-free-flex-trial-client";
import { resolveApiBaseUrl } from "../infrastructure/api-base-url";
import { executeWriteWithReconciliation } from "./unknown-result-recovery";
import { useAdultEligibility } from "./adult-eligibility-context";

type FreeFlexTrialContextValue = Readonly<{
  trial: FreeFlexTrialView;
  submit(): Promise<void>;
  confirm(): Promise<void>;
  refresh(): Promise<void>;
}>;

const FreeFlexTrialContext = createContext<FreeFlexTrialContextValue | undefined>(undefined);

export function FreeFlexTrialProvider({ children }: PropsWithChildren) {
  const { verification } = useAdultEligibility();
  const [client] = useState(
    () =>
      new HttpFreeFlexTrialClient(resolveApiBaseUrl()),
  );
  const [trial, setTrial] = useState<FreeFlexTrialView>(initialTrial);
  const businessAccessAllowed = verification?.businessAccessAllowed === true;
  const refresh = useCallback(async () => {
    if (!businessAccessAllowed) {
      setTrial(initialTrial);
      return;
    }
    setTrial(await client.get());
  }, [businessAccessAllowed, client]);
  useEffect(() => {
    void refresh().catch(() => undefined);
  }, [refresh]);
  const value = useMemo<FreeFlexTrialContextValue>(
    () => ({
      trial,
      submit: async () => executeWriteWithReconciliation(
        async () => setTrial(await client.submit(trial.version, `free-flex-submit-${trial.version + 1}`)),
        refresh,
      ),
      confirm: async () => executeWriteWithReconciliation(
        async () => setTrial(await client.confirm(trial.version, `free-flex-confirm-${trial.version + 1}`)),
        refresh,
      ),
      refresh,
    }),
    [client, refresh, trial],
  );
  return <FreeFlexTrialContext.Provider value={value}>{children}</FreeFlexTrialContext.Provider>;
}

export function useFreeFlexTrial() {
  const value = useContext(FreeFlexTrialContext);
  if (!value) throw new Error("useFreeFlexTrial 必须在 FreeFlexTrialProvider 内使用");
  return value;
}

const initialTrial: FreeFlexTrialView = {
  eligibilityId: "free-flex-synthetic-account-7",
  accountId: "synthetic-account-7",
  batchId: "batch_0",
  state: "invited",
  version: 0,
  qualificationFeeMinor: 0,
  paidPathEnabled: false,
  realInvitation: false,
  activationDaysInLookback: 0,
  maximumActivationDays: 60,
  quota: { hours24: 4, days7: 12, days30: 18 },
  synthetic: true,
};
