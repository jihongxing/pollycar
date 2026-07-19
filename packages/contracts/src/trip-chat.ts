import type { TripPartyPublicProfile } from "./trip-party-profile.js";

export type TripChatState = "scheduled" | "open" | "frozen" | "expired" | "closed";

export type TripChatMessageDeliveryState = "sent" | "failed" | "unknown";

export type TripChatMessage = Readonly<{
  messageId: string;
  senderAccountId: string;
  body: string;
  sentAt: string;
  deliveryState: TripChatMessageDeliveryState;
  synthetic: true;
}>;

export type TripChatView = Readonly<{
  conversationId: string;
  tripId: string;
  state: TripChatState;
  participants: readonly TripPartyPublicProfile[];
  messages: readonly TripChatMessage[];
  quickReplies: readonly string[];
  openedAt?: string;
  expiresAt?: string;
  closedAt?: string;
  retention: Readonly<{
    contentDeleteAfter?: string;
    evidenceHold: boolean;
    deletionState: "not_due" | "eligible" | "blocked_by_hold" | "deleted";
    summaryRetained: true;
  }>;
  realChatEnabled: false;
  externalChatProviderEnabled: false;
  synthetic: true;
}>;

export type SendTripChatMessageCommand = Readonly<{
  tripId: string;
  body: string;
  idempotencyKey: string;
}>;

export interface TripChatClient {
  getByTrip(tripId: string): Promise<TripChatView>;
  send(command: SendTripChatMessageCommand): Promise<TripChatView>;
  requestContentDeletion(tripId: string, idempotencyKey: string): Promise<TripChatView>;
}
