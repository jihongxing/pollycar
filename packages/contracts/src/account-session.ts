export type AccountIdentityMode = "passenger" | "driver";

export type InternalAccountSessionView = Readonly<{
  sessionId: string;
  accountId: string;
  activeIdentity: AccountIdentityMode;
  availableIdentities: readonly AccountIdentityMode[];
  adultEligibilityState: string;
  businessAccessAllowed: boolean;
  issuedAt: string;
  expiresAt: string;
  revokedAt?: string;
  state: "active" | "expired" | "revoked";
  productionEnabled: false;
  synthetic: true;
}>;

export type CreateInternalAccountSessionRequest = Readonly<{
  accountId: "synthetic-account-7" | "synthetic-passenger-8" | "synthetic-unverified-9";
}>;

export type CreateInternalAccountSessionResponse = Readonly<{
  token: string;
  session: InternalAccountSessionView;
}>;
