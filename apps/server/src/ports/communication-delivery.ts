import type { MessageCenterItem, TripChatMessage } from "@pollycar/contracts";

export interface ChatTransport {
  deliver(tripId: string, message: TripChatMessage): Promise<"sent" | "failed" | "unknown">;
}

export interface NotificationDelivery {
  deliver(accountId: string, item: MessageCenterItem): Promise<void>;
}
