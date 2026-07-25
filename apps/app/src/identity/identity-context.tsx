import {
  createContext,
  type PropsWithChildren,
  useContext,
  useMemo,
  useState,
} from "react";
import { useAccountSession } from "../application/account-session-context";
import {
  readBrowserStorage,
  removeBrowserStorage,
  writeBrowserStorage,
} from "../infrastructure/browser-storage";
import { clearIdentityScopedJourneyState } from "../navigation/journey-continuity";

export type UserIdentity = "passenger" | "owner";

type IdentityContextValue = {
  activeIdentity: UserIdentity;
  setActiveIdentity: (identity: UserIdentity) => Promise<void>;
  ownerApproved: boolean;
  approveOwner: () => void;
};

const IdentityContext = createContext<IdentityContextValue | undefined>(undefined);

export function IdentityProvider({ children }: PropsWithChildren) {
  const { session, switchIdentity } = useAccountSession();
  const [activeIdentity, setActiveIdentityState] = useState<UserIdentity>(() => {
    return readBrowserStorage(identityStorageKey) === "owner" ? "owner" : "passenger";
  });
  const [ownerApproved, setOwnerApproved] = useState(false);
  const setActiveIdentity = async (identity: UserIdentity) => {
    await switchIdentity(identity === "owner" ? "driver" : "passenger");
    clearIdentityScopedJourneyState();
    setActiveIdentityState(identity);
    writeBrowserStorage(identityStorageKey, identity);
  };
  const serverIdentity = session?.activeIdentity === "driver" ? "owner" : "passenger";
  const resolvedIdentity = session ? serverIdentity : activeIdentity;
  const value = useMemo(
    () => ({
      activeIdentity: resolvedIdentity,
      setActiveIdentity,
      ownerApproved: ownerApproved || session?.availableIdentities.includes("driver") === true,
      approveOwner: () => setOwnerApproved(true),
    }),
    [ownerApproved, resolvedIdentity, session],
  );

  return <IdentityContext.Provider value={value}>{children}</IdentityContext.Provider>;
}

const identityStorageKey = "pollycar.preference.identity";

export function clearStoredIdentityPreference(): void {
  removeBrowserStorage(identityStorageKey);
}

export function useIdentity() {
  const context = useContext(IdentityContext);
  if (!context) {
    throw new Error("useIdentity 必须在 IdentityProvider 内使用");
  }
  return context;
}
