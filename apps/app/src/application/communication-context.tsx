import type { MessageCenterTarget, MessageCenterView, TripChatView } from "@pollycar/contracts";
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { AppScreen } from "../features/vehicle-review/screens";
import { resolveApiBaseUrl } from "../infrastructure/api-base-url";
import { HttpCommunicationClient } from "../infrastructure/http-communication-client";
import { useIdentity } from "../identity/identity-context";
import { useAccountSession } from "./account-session-context";
import { authorizationHeader } from "../infrastructure/session-credentials";

type CommunicationContextValue = Readonly<{
  chat?: TripChatView;
  center?: MessageCenterView;
  loading: boolean;
  error?: string;
  loadChat(tripId: string): Promise<void>;
  sendMessage(tripId: string, body: string): Promise<void>;
  loadCenter(): Promise<void>;
  markRead(itemId: string): Promise<void>;
  markAllRead(): Promise<void>;
  requestChatDeletion(tripId: string): Promise<void>;
  resolveTarget(target: MessageCenterTarget): AppScreen;
  currentAccountId: string;
}>;

const CommunicationContext = createContext<CommunicationContextValue | undefined>(undefined);

export function CommunicationProvider({ children }: PropsWithChildren) {
  const { activeIdentity } = useIdentity();
  const { session } = useAccountSession();
  const currentAccountId = session?.accountId ?? "";
  const client = useMemo(
    () => new HttpCommunicationClient(
      resolveApiBaseUrl(),
      authorizationHeader,
    ),
    [activeIdentity, session?.accountId],
  );
  const [chat, setChat] = useState<TripChatView>();
  const [center, setCenter] = useState<MessageCenterView>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const identityScope = `${currentAccountId}:${activeIdentity}`;
  const identityScopeRef = useRef(identityScope);
  const execute = useCallback(async (operation: () => Promise<void>) => {
    setLoading(true);
    setError(undefined);
    try {
      await operation();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "COMMUNICATION_REQUEST_FAILED");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    identityScopeRef.current = identityScope;
    setChat(undefined);
    setCenter(undefined);
    setLoading(false);
    setError(undefined);
  }, [identityScope]);
  const loadChat = useCallback(
    (tripId: string) =>
      execute(async () => {
        const nextChat = await client.getByTrip(tripId);
        if (identityScopeRef.current === identityScope) setChat(nextChat);
      }),
    [client, execute, identityScope],
  );
  const sendMessage = useCallback(
    (tripId: string, body: string) =>
      execute(async () => {
        const nextChat = await client.send({
          tripId,
          body,
          idempotencyKey: crypto.randomUUID(),
        });
        if (identityScopeRef.current === identityScope) setChat(nextChat);
      }),
    [client, execute, identityScope],
  );
  const loadCenter = useCallback(
    () =>
      execute(async () => {
        const nextCenter = await client.getCenter();
        if (identityScopeRef.current === identityScope) setCenter(nextCenter);
      }),
    [client, execute, identityScope],
  );
  const markRead = useCallback(
    (itemId: string) =>
      execute(async () => {
        const nextCenter = await client.markRead(itemId, crypto.randomUUID());
        if (identityScopeRef.current === identityScope) setCenter(nextCenter);
      }),
    [client, execute, identityScope],
  );
  const markAllRead = useCallback(
    () =>
      execute(async () => {
        const nextCenter = await client.markAllRead(crypto.randomUUID());
        if (identityScopeRef.current === identityScope) setCenter(nextCenter);
      }),
    [client, execute, identityScope],
  );
  const requestChatDeletion = useCallback(
    (tripId: string) =>
      execute(async () => {
        const nextChat = await client.requestContentDeletion(
          tripId,
          crypto.randomUUID(),
        );
        if (identityScopeRef.current === identityScope) setChat(nextChat);
      }),
    [client, execute, identityScope],
  );
  const value = useMemo<CommunicationContextValue>(() => ({
    ...(chat ? { chat } : {}),
    ...(center ? { center } : {}),
    loading,
    ...(error ? { error } : {}),
    loadChat,
    sendMessage,
    loadCenter,
    markRead,
    markAllRead,
    requestChatDeletion,
    resolveTarget,
    currentAccountId,
  }), [center, chat, currentAccountId, error, loadCenter, loadChat, loading, markAllRead, markRead, requestChatDeletion, sendMessage]);
  return <CommunicationContext.Provider value={value}>{children}</CommunicationContext.Provider>;
}

export function useCommunication() {
  const value = useContext(CommunicationContext);
  if (!value) throw new Error("useCommunication 必须在 CommunicationProvider 内使用");
  return value;
}

export function resolveTarget(target: MessageCenterTarget): AppScreen {
  if (target.kind === "trip_chat") return "trip-chat";
  if (target.kind === "trip") return "ride-detail";
  if (target.kind === "vehicle_review") return "vehicle-settings";
  if (target.kind === "eligibility") return "eligibility-settings";
  return "safety-result";
}
