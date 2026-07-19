import type { ChatTransport, NotificationDelivery } from "../ports/communication-delivery.js";

export class SyntheticChatTransport implements ChatTransport {
  async deliver(): Promise<"sent"> {
    return "sent";
  }
}

export class SyntheticNotificationDelivery implements NotificationDelivery {
  async deliver(): Promise<void> {}
}
