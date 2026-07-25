import type {
  AccountIdentityMode,
  InternalAccountSessionView,
  PhoneAuthenticationResult,
  PhoneCodeChallengeView,
} from "@pollycar/contracts";
import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { HttpAccountSessionClient } from "../infrastructure/http-account-session-client";
import { resolveApiBaseUrl } from "../infrastructure/api-base-url";
import { HttpPhoneAuthenticationClient } from "../infrastructure/http-phone-authentication-client";
import {
  readBrowserStorage,
  removeBrowserStorage,
  writeBrowserStorage,
} from "../infrastructure/browser-storage";
import {
  setSessionToken,
  subscribeToSessionAuthenticationFailure,
} from "../infrastructure/session-credentials";

type AccountSessionContextValue = Readonly<{
  session?: InternalAccountSessionView;
  loading: boolean;
  authenticated: boolean;
  sessionExpired: boolean;
  requestPhoneCode(phoneNumber: string, consentAccepted: boolean): Promise<PhoneCodeChallengeView>;
  verifyPhoneCode(challengeId: string, code: string): Promise<PhoneAuthenticationResult>;
  switchIdentity(identity: AccountIdentityMode): Promise<void>;
  reconnect(): Promise<void>;
  revoke(): Promise<void>;
}>;

const REFRESH_TOKEN_KEY = "rego.authentication.refresh-token";
const DEVICE_ID_KEY = "rego.authentication.device-id";
const AccountSessionContext = createContext<AccountSessionContextValue | undefined>(undefined);

export function AccountSessionProvider({ children }: PropsWithChildren) {
  const [sessionClient] = useState(() => new HttpAccountSessionClient(resolveApiBaseUrl()));
  const [phoneClient] = useState(() => new HttpPhoneAuthenticationClient(resolveApiBaseUrl()));
  const [token, setToken] = useState<string>();
  const [session, setSession] = useState<InternalAccountSessionView>();
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);
  const deviceId = useMemo(resolveDeviceId, []);

  const acceptAuthentication = (result: PhoneAuthenticationResult) => {
    setToken(result.accessToken);
    setSessionToken(result.accessToken);
    setSession(result.session);
    setSessionExpired(false);
    writeStoredValue(REFRESH_TOKEN_KEY, result.refreshToken);
  };

  const reconnect = async () => {
    const refreshToken = readStoredValue(REFRESH_TOKEN_KEY);
    if (!refreshToken) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      acceptAuthentication(await phoneClient.refresh({
        refreshToken,
        deviceId,
        idempotencyKey: `refresh-${Date.now()}`,
      }));
    } catch {
      writeStoredValue(REFRESH_TOKEN_KEY, undefined);
      setSessionToken(undefined);
      setToken(undefined);
      setSession(undefined);
      setSessionExpired(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reconnect();
    return () => setSessionToken(undefined);
  }, []);
  useEffect(
    () => subscribeToSessionAuthenticationFailure(() => setSessionExpired(true)),
    [],
  );

  const value = useMemo<AccountSessionContextValue>(() => ({
    ...(session ? { session } : {}),
    loading,
    authenticated: Boolean(session && token),
    sessionExpired,
    requestPhoneCode: (phoneNumber, consentAccepted) => phoneClient.requestCode({
      phoneNumber,
      consentAccepted,
      deviceId,
      idempotencyKey: `phone-code-${Date.now()}`,
    }),
    verifyPhoneCode: async (challengeId, code) => {
      const result = await phoneClient.verify({
        challengeId,
        code,
        deviceId,
        idempotencyKey: `phone-verify-${Date.now()}`,
      });
      acceptAuthentication(result);
      return result;
    },
    reconnect,
    switchIdentity: async (identity) => {
      if (!token) throw new Error("AUTHENTICATION_REQUIRED");
      setSession(await sessionClient.switchIdentity(token, identity));
    },
    revoke: async () => {
      if (token) await sessionClient.revoke(token);
      writeStoredValue(REFRESH_TOKEN_KEY, undefined);
      setSessionToken(undefined);
      setToken(undefined);
      setSession(undefined);
      setSessionExpired(false);
    },
  }), [deviceId, loading, phoneClient, session, sessionClient, sessionExpired, token]);
  return <AccountSessionContext.Provider value={value}>{children}</AccountSessionContext.Provider>;
}

export function useAccountSession() {
  const context = useContext(AccountSessionContext);
  if (!context) throw new Error("useAccountSession 必须在 AccountSessionProvider 内使用");
  return context;
}

function resolveDeviceId(): string {
  const existing = readStoredValue(DEVICE_ID_KEY);
  if (existing) return existing;
  const created = `app-device-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  writeStoredValue(DEVICE_ID_KEY, created);
  return created;
}

function readStoredValue(key: string): string | undefined {
  return readBrowserStorage(key);
}

function writeStoredValue(key: string, value: string | undefined): void {
  if (value === undefined) removeBrowserStorage(key);
  else writeBrowserStorage(key, value);
}
