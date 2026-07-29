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
  writeBrowserStorage,
} from "../infrastructure/browser-storage";
import { secureCredentialStore } from "../infrastructure/secure-credential-store";
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
  const [deviceId] = useState(resolveDeviceId);

  const acceptAuthentication = async (result: PhoneAuthenticationResult) => {
    setToken(result.accessToken);
    setSessionToken(result.accessToken);
    setSession(result.session);
    setSessionExpired(false);
    await secureCredentialStore.set(REFRESH_TOKEN_KEY, result.refreshToken);
  };

  const reconnect = async () => {
    const refreshToken = await secureCredentialStore.get(REFRESH_TOKEN_KEY);
    if (!refreshToken) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      await acceptAuthentication(await phoneClient.refresh({
        refreshToken,
        deviceId,
        idempotencyKey: `refresh-${Date.now()}`,
      }));
    } catch {
      await secureCredentialStore.delete(REFRESH_TOKEN_KEY);
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
      await acceptAuthentication(result);
      return result;
    },
    reconnect,
    switchIdentity: async (identity) => {
      if (!token) throw new Error("AUTHENTICATION_REQUIRED");
      setSession(await sessionClient.switchIdentity(token, identity));
    },
    revoke: async () => {
      if (token) await sessionClient.revoke(token);
      await secureCredentialStore.delete(REFRESH_TOKEN_KEY);
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
  const existing = readBrowserStorage(DEVICE_ID_KEY);
  if (existing) return existing;
  const created = `app-device-${crypto.randomUUID()}`;
  writeBrowserStorage(DEVICE_ID_KEY, created);
  return created;
}
