export type AdminWorkforceIdentityResult = Readonly<{
  state: "verified" | "pending" | "unknown" | "rejected";
  providerSubjectReference?: string;
  providerRequestReference: string;
}>;

export interface AdminWorkforceIdentityProvider {
  readonly providerId: string;
  readonly realAccountsEnabled: boolean;
  beginAuthorization(input: Readonly<{
    loginAttemptId: string;
    redirectUri: string;
    stateDigest: string;
    nonceDigest: string;
  }>): Promise<Readonly<{
    authorizationUrl: string;
    providerRequestReference: string;
  }>>;
  exchangeCallback(input: Readonly<{
    providerRequestReference: string;
    authorizationCode: string;
    stateDigest: string;
  }>): Promise<AdminWorkforceIdentityResult>;
  refreshResult(
    providerRequestReference: string,
  ): Promise<AdminWorkforceIdentityResult>;
  revokeSession(providerSubjectReference: string): Promise<void>;
}
