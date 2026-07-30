let sessionToken: string | undefined;
let currentDeviceId = "app-device-synthetic-default";
const authenticationFailureListeners = new Set<() => void>();

export function setSessionToken(token: string | undefined): void {
  sessionToken = token;
}

export function authorizationHeader(): string {
  return sessionToken ? `Session ${sessionToken}` : "Sandbox synthetic-account-7";
}

export function setCurrentDeviceId(deviceId: string): void {
  currentDeviceId = deviceId;
}

export function deviceIdHeader(): string {
  return currentDeviceId;
}

export function reportSessionAuthenticationFailure(errorCode: string): void {
  if (errorCode !== "AUTHENTICATION_REQUIRED") return;
  authenticationFailureListeners.forEach((listener) => listener());
}

export function subscribeToSessionAuthenticationFailure(listener: () => void): () => void {
  authenticationFailureListeners.add(listener);
  return () => authenticationFailureListeners.delete(listener);
}
