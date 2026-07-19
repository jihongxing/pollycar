export interface Identity {
  readonly subjectId: string;
  readonly roles: readonly string[];
  readonly realNameVerified: boolean;
  readonly synthetic: boolean;
}

export interface IdentityProvider {
  authenticate(token: string): Promise<Identity | undefined>;
}
