import type {
  AccountTrustProfile,
  SubmitTripRatingCommand,
  SyntheticAvatarAsset,
  TripRatingView,
} from "@pollycar/contracts";
import { createContext, type PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { HttpTrustProfileClient } from "../infrastructure/http-trust-profile-client";
import { resolveApiBaseUrl } from "../infrastructure/api-base-url";
import { useAdultEligibility } from "./adult-eligibility-context";

type TrustProfileContextValue = Readonly<{
  profile?: AccountTrustProfile;
  loading: boolean;
  refresh(): Promise<void>;
  submitAvatar(asset: SyntheticAvatarAsset): Promise<AccountTrustProfile>;
  getRating(tripId: string): Promise<TripRatingView | undefined>;
  submitRating(command: Omit<SubmitTripRatingCommand, "idempotencyKey">): Promise<TripRatingView>;
}>;

const TrustProfileContext = createContext<TrustProfileContextValue | undefined>(undefined);

export function TrustProfileProvider({ children }: PropsWithChildren) {
  const { verification } = useAdultEligibility();
  const client = useMemo(() => new HttpTrustProfileClient(resolveApiBaseUrl()), []);
  const [profile, setProfile] = useState<AccountTrustProfile>();
  const [loading, setLoading] = useState(false);
  const businessAccessAllowed = verification?.businessAccessAllowed === true;
  const refresh = useCallback(async () => {
    if (!businessAccessAllowed) {
      setProfile(undefined);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setProfile(await client.getProfile());
    } finally {
      setLoading(false);
    }
  }, [businessAccessAllowed, client]);
  useEffect(() => {
    void refresh().catch(() => setLoading(false));
  }, [refresh]);
  const value = useMemo<TrustProfileContextValue>(() => ({
    profile,
    loading,
    refresh,
    submitAvatar: async (asset) => {
      const next = await client.submitAvatar({
        asset,
        idempotencyKey: `avatar-${asset}-${Date.now()}`,
      });
      setProfile(next);
      return next;
    },
    getRating: (tripId) => client.getRating(tripId),
    submitRating: (command) => client.submitRating({
      ...command,
      idempotencyKey: `rating-${command.tripId}-${Date.now()}`,
    }),
  }), [client, loading, profile, refresh]);
  return <TrustProfileContext.Provider value={value}>{children}</TrustProfileContext.Provider>;
}

export function useTrustProfile() {
  const value = useContext(TrustProfileContext);
  if (!value) throw new Error("useTrustProfile 必须在 TrustProfileProvider 内使用");
  return value;
}
