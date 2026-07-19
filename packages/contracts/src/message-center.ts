export type MessageCenterCategory = "trip_chat" | "trip_service" | "vehicle_review" | "eligibility" | "safety";

export type MessageCenterTarget =
  | Readonly<{ kind: "trip_chat"; tripId: string }>
  | Readonly<{ kind: "trip"; tripId: string }>
  | Readonly<{ kind: "vehicle_review"; reviewId?: string }>
  | Readonly<{ kind: "eligibility" }>
  | Readonly<{ kind: "safety_case"; caseId: string }>;

export type MessageCenterItem = Readonly<{
  itemId: string;
  category: MessageCenterCategory;
  title: string;
  body: string;
  occurredAt: string;
  readAt?: string;
  pinned: boolean;
  target: MessageCenterTarget;
  synthetic: true;
}>;

export type MessageCenterView = Readonly<{
  items: readonly MessageCenterItem[];
  unreadCount: number;
  realPushEnabled: false;
  externalNotificationProviderEnabled: false;
  synthetic: true;
}>;

export interface MessageCenterClient {
  getCenter(): Promise<MessageCenterView>;
  markRead(itemId: string, idempotencyKey: string): Promise<MessageCenterView>;
  markAllRead(idempotencyKey: string): Promise<MessageCenterView>;
}
