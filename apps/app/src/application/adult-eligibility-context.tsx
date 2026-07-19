import type { AdultEligibilityVerificationView } from "@pollycar/contracts";
import { createContext, type PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { HttpAdultEligibilityClient } from "../infrastructure/http-adult-eligibility-client";
import { resolveApiBaseUrl } from "../infrastructure/api-base-url";
import { useAccountSession } from "./account-session-context";
import { SyntheticIdentityVerificationSdkAdapter } from "../features/adult-eligibility/identity-verification-sdk-adapter";

type Value = Readonly<{
  verification?: AdultEligibilityVerificationView;
  loading: boolean;
  error?: string;
  refresh(): Promise<void>;
  authorize(): Promise<void>;
  startAutomaticVerification(): Promise<void>;
  refreshProviderResult(): Promise<void>;
  submitAppeal(reason: string): Promise<void>;
}>;

const AdultEligibilityContext = createContext<Value | undefined>(undefined);

export function AdultEligibilityProvider({ children }: PropsWithChildren) {
  const { authenticated } = useAccountSession();
  const [client] = useState(() => new HttpAdultEligibilityClient(resolveApiBaseUrl()));
  const [identitySdk] = useState(() => new SyntheticIdentityVerificationSdkAdapter());
  const [verification, setVerification] = useState<AdultEligibilityVerificationView>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  const refresh = useCallback(async () => {
    if (!authenticated) {
      setVerification(undefined);
      return;
    }
    setLoading(true);
    setError(undefined);
    try {
      setVerification(await client.get());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "SERVICE_UNAVAILABLE");
      throw caught;
    } finally {
      setLoading(false);
    }
  }, [authenticated, client]);

  useEffect(() => {
    if (authenticated) void refresh().catch(() => undefined);
    else setVerification(undefined);
  }, [authenticated, refresh]);

  const update = async (operation: () => Promise<AdultEligibilityVerificationView>) => {
    setLoading(true);
    setError(undefined);
    try {
      setVerification(await operation());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "SERVICE_UNAVAILABLE");
      throw caught;
    } finally {
      setLoading(false);
    }
  };

  const value = useMemo<Value>(() => ({
    ...(verification ? { verification } : {}),
    ...(error ? { error } : {}),
    loading,
    refresh,
    authorize: async () => {
      if (!verification) throw new Error("ADULT_ELIGIBILITY_VERIFICATION_NOT_FOUND");
      await update(() => client.authorize({
        expectedVersion: verification.version,
        privacyNoticeVersion: "2026-07",
        identityProcessingAuthorized: true,
        biometricProcessingAuthorized: true,
        thirdPartyProcessingAuthorized: true,
      }));
    },
    startAutomaticVerification: async () => {
      if (!verification) throw new Error("ADULT_ELIGIBILITY_VERIFICATION_NOT_FOUND");
      setLoading(true);
      setError(undefined);
      try {
        const session = await client.createSdkSession({
          expectedVersion: verification.version,
          syntheticScenario: "passed",
        });
        await identitySdk.launch(session);
        setVerification(await client.refreshProviderResult(verification.version + 1));
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "SERVICE_UNAVAILABLE");
        throw caught;
      } finally {
        setLoading(false);
      }
    },
    refreshProviderResult: async () => {
      if (!verification) throw new Error("ADULT_ELIGIBILITY_VERIFICATION_NOT_FOUND");
      await update(() => client.refreshProviderResult(verification.version));
    },
    submitAppeal: async (reason) => {
      if (!verification) throw new Error("ADULT_ELIGIBILITY_VERIFICATION_NOT_FOUND");
      await update(() => client.submitAppeal({ expectedVersion: verification.version, reason }));
    },
  }), [client, error, identitySdk, loading, refresh, verification]);

  return <AdultEligibilityContext.Provider value={value}>{children}</AdultEligibilityContext.Provider>;
}

export function useAdultEligibility() {
  const context = useContext(AdultEligibilityContext);
  if (!context) throw new Error("useAdultEligibility 必须在 AdultEligibilityProvider 内使用");
  return context;
}
