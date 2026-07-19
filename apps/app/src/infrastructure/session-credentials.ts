let sessionToken: string | undefined;
const authenticationFailureListeners = new Set<() => void>();

export function setSessionToken(token: string | undefined): void {
  sessionToken = token;
}

export function authorizationHeader(): string {
  return sessionToken ? `Session ${sessionToken}` : "Sandbox synthetic-account-7";
}

export function reportSessionAuthenticationFailure(errorCode: string): void {
  if (errorCode !== "AUTHENTICATION_REQUIRED") return;
  authenticationFailureListeners.forEach((listener) => listener());
}

export function subscribeToSessionAuthenticationFailure(listener: () => void): () => void {
  authenticationFailureListeners.add(listener);
  return () => authenticationFailureListeners.delete(listener);
}
