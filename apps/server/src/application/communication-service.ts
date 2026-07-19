import type {
  MessageCenterItem,
  MessageCenterView,
  TripChatMessage,
  TripChatState,
  TripChatView,
  TripPartyPublicProfile,
} from "@pollycar/contracts";
import type { AuditLog } from "../ports/audit.js";
import type { ChatTransport, NotificationDelivery } from "../ports/communication-delivery.js";
import type { Repository, Transaction } from "../ports/storage.js";
import type { SafetyCaseRecord } from "./safety-case-service.js";
import type { SyntheticTripRecord } from "./synthetic-trip-service.js";

export type TripChatRecord = Readonly<{
  tripId: string;
  messages: readonly TripChatMessage[];
  processedKeys: readonly string[];
  openedAt?: string;
  closedAt?: string;
  contentDeleteAfter?: string;
  contentDeletedAt?: string;
  evidenceHold: boolean;
  synthetic: true;
}>;

export type MessageCenterRecord = Readonly<{
  accountId: string;
  items: readonly MessageCenterItem[];
  processedKeys: readonly string[];
  synthetic: true;
}>;

const quickReplies = ["我已到上车点", "请稍等一下", "我正在确认车辆", "收到，谢谢"] as const;

export class CommunicationService {
  public constructor(
    private readonly trips: Repository<SyntheticTripRecord>,
    private readonly safetyCases: Repository<SafetyCaseRecord>,
    private readonly chats: Repository<TripChatRecord>,
    private readonly centers: Repository<MessageCenterRecord>,
    private readonly transaction: Transaction,
    private readonly audit: AuditLog,
    private readonly now: () => Date,
    private readonly chatTransport: ChatTransport,
    private readonly notificationDelivery: NotificationDelivery,
  ) {}

  public async getTripChat(accountId: string, tripId: string): Promise<TripChatView> {
    const trip = await this.requireParticipant(accountId, tripId);
    await this.prepareChatRetention(tripId);
    const stored = await this.chats.get(tripId);
    return this.toTripChat(trip, stored?.value);
  }

  public async sendTripChatMessage(
    accountId: string,
    tripId: string,
    body: string,
    idempotencyKey: string,
  ): Promise<TripChatView> {
    const normalizedBody = body.trim();
    if (!normalizedBody || normalizedBody.length > 500) throw new Error("CHAT_MESSAGE_INVALID");
    await this.transaction.run(async () => {
      const trip = await this.requireParticipant(accountId, tripId);
      const state = await this.resolveChatState(trip);
      if (state === "frozen") throw new Error("CHAT_FROZEN");
      if (state !== "open") throw new Error("CHAT_NOT_OPEN");
      const stored = await this.chats.get(tripId);
      const current = stored?.value ?? {
        tripId,
        messages: [],
        processedKeys: [],
        openedAt: this.now().toISOString(),
        evidenceHold: false,
        synthetic: true as const,
      };
      if (current.processedKeys.includes(`${accountId}:${idempotencyKey}`)) return;
      const message: TripChatMessage = {
        messageId: crypto.randomUUID(),
        senderAccountId: accountId,
        body: normalizedBody,
        sentAt: this.now().toISOString(),
        deliveryState: "unknown",
        synthetic: true,
      };
      const deliveryState = await this.chatTransport.deliver(tripId, message);
      const next: TripChatRecord = {
        ...current,
        messages: [
          ...current.messages,
          { ...message, deliveryState },
        ],
        processedKeys: [...current.processedKeys, `${accountId}:${idempotencyKey}`],
      };
      await this.chats.put(tripId, next, stored?.version ?? 0);
      await this.appendAudit(accountId, tripId, "trip_chat_message_sent", idempotencyKey);
    });
    return this.getTripChat(accountId, tripId);
  }

  public async getMessageCenter(accountId: string): Promise<MessageCenterView> {
    const record = await this.getOrCreateCenter(accountId);
    for (const item of record.value.items) {
      await this.notificationDelivery.deliver(accountId, item);
    }
    return this.toMessageCenter(record.value);
  }

  public async prepareChatRetention(tripId: string): Promise<void> {
    const trip = await this.trips.get(tripId);
    if (!trip) throw new Error("TRIP_NOT_FOUND");
    if (!["completed", "cancelled"].includes(trip.value.state)) return;
    const stored = await this.chats.get(tripId);
    if (!stored) return;
    const tripClosedAt = trip.value.completedAt ?? trip.value.cancelledAt ?? this.now().toISOString();
    const contentDeleteAfter = new Date(new Date(tripClosedAt).getTime() + 72 * 60 * 60 * 1000);
    if (contentDeleteAfter <= this.now() && !stored.value.evidenceHold && !stored.value.contentDeletedAt) {
      await this.chats.put(tripId, {
        ...stored.value,
        closedAt: contentDeleteAfter.toISOString(),
        contentDeleteAfter: contentDeleteAfter.toISOString(),
        messages: [],
        contentDeletedAt: this.now().toISOString(),
      }, stored.version);
      await this.appendAudit("lifecycle-worker", tripId, "chat_content_deleted", tripId);
      return;
    }
    if (stored.value.contentDeleteAfter) return;
    await this.chats.put(tripId, {
      ...stored.value,
      closedAt: contentDeleteAfter.toISOString(),
      contentDeleteAfter: contentDeleteAfter.toISOString(),
    }, stored.version);
    await this.appendAudit("lifecycle-worker", tripId, "chat_retention_scheduled", tripId);
  }

  public async markMessageRead(
    accountId: string,
    itemId: string,
    idempotencyKey: string,
  ): Promise<MessageCenterView> {
    await this.updateCenter(accountId, idempotencyKey, (current) => ({
      ...current,
      items: current.items.map((item) =>
        item.itemId === itemId && !item.readAt ? { ...item, readAt: this.now().toISOString() } : item,
      ),
    }));
    return this.getMessageCenter(accountId);
  }

  public async markAllMessagesRead(accountId: string, idempotencyKey: string): Promise<MessageCenterView> {
    await this.updateCenter(accountId, idempotencyKey, (current) => ({
      ...current,
      items: current.items.map((item) => item.readAt ? item : { ...item, readAt: this.now().toISOString() }),
    }));
    return this.getMessageCenter(accountId);
  }

  private async updateCenter(
    accountId: string,
    idempotencyKey: string,
    mutate: (current: MessageCenterRecord) => MessageCenterRecord,
  ) {
    await this.transaction.run(async () => {
      const stored = await this.getOrCreateCenter(accountId);
      const scopedKey = `${accountId}:${idempotencyKey}`;
      if (stored.value.processedKeys.includes(scopedKey)) return;
      const next = mutate({
        ...stored.value,
        processedKeys: [...stored.value.processedKeys, scopedKey],
      });
      await this.centers.put(accountId, next, stored.version);
      await this.appendAudit(accountId, accountId, "message_center_read_updated", idempotencyKey);
    });
  }

  private async getOrCreateCenter(accountId: string) {
    const stored = await this.centers.get(accountId);
    if (stored) return stored;
    return this.centers.put(accountId, this.createCenter(accountId), 0);
  }

  private createCenter(accountId: string): MessageCenterRecord {
    const passenger = accountId === "synthetic-passenger-8";
    const tripId = "synthetic-trip-seed-1";
    return {
      accountId,
      processedKeys: [],
      items: [
        {
          itemId: `${accountId}-trip-chat`,
          category: "trip_chat",
          title: "行程会话",
          body: passenger ? "车主可能会通过行程会话联系你。" : "乘车人可能会通过行程会话联系你。",
          occurredAt: this.now().toISOString(),
          pinned: true,
          target: { kind: "trip_chat", tripId },
          synthetic: true,
        },
        {
          itemId: `${accountId}-trip`,
          category: "trip_service",
          title: "行程状态更新",
          body: passenger ? "可在行程页查看接单与接驾进度。" : "请在车主订单中自主判断是否接单。",
          occurredAt: this.now().toISOString(),
          pinned: false,
          target: { kind: "trip", tripId },
          synthetic: true,
        },
        {
          itemId: `${accountId}-vehicle`,
          category: "vehicle_review",
          title: "车辆资料",
          body: "可前往车辆页面查看审核资料。",
          occurredAt: this.now().toISOString(),
          readAt: this.now().toISOString(),
          pinned: false,
          target: { kind: "vehicle_review" },
          synthetic: true,
        },
      ],
      synthetic: true,
    };
  }

  private async requireParticipant(accountId: string, tripId: string) {
    const stored = await this.trips.get(tripId);
    if (!stored) throw new Error("TRIP_NOT_FOUND");
    if (
      stored.value.passengerAccountId !== accountId &&
      stored.value.driverAccountId !== accountId
    ) {
      throw new Error("TRIP_FORBIDDEN");
    }
    return stored.value;
  }

  private async resolveChatState(trip: SyntheticTripRecord): Promise<TripChatState> {
    const safetyCase = await this.safetyCases.get(trip.tripId);
    if (safetyCase && ["open_frozen", "appealing", "resolved_upheld"].includes(safetyCase.value.state)) {
      return "frozen";
    }
    if (["accepted", "driver_en_route", "driver_arrived", "in_progress"].includes(trip.state)) return "open";
    if (["completed", "cancelled"].includes(trip.state)) {
      const tripClosedAt = trip.completedAt ?? trip.cancelledAt;
      if (tripClosedAt && this.now().getTime() < new Date(tripClosedAt).getTime() + 72 * 60 * 60 * 1000) {
        return "open";
      }
      return "closed";
    }
    if (trip.state === "safety_frozen") return "frozen";
    return "scheduled";
  }

  private async toTripChat(trip: SyntheticTripRecord, record?: TripChatRecord): Promise<TripChatView> {
    const state = await this.resolveChatState(trip);
    const participants: readonly TripPartyPublicProfile[] = [
      trip.passengerProfile ?? {
        accountId: trip.passengerAccountId,
        displayName: "合成乘车人",
        avatarUrl: "https://example.invalid/passenger.png",
        gender: "female",
        genderSource: "verified_identity_document",
        genderDisclosure: "eligible_driver_pre_acceptance",
        synthetic: true,
      },
      trip.driverProfile ?? {
        accountId: trip.driverAccountId ?? "unassigned-driver",
        displayName: "合成车主",
        avatarUrl: "https://example.invalid/driver.png",
        gender: "male",
        genderSource: "verified_identity_document",
        genderDisclosure: "matched_passenger_post_acceptance",
        synthetic: true,
      },
    ];
    return {
      conversationId: `trip-chat-${trip.tripId}`,
      tripId: trip.tripId,
      state,
      participants,
      messages: record?.messages ?? [],
      quickReplies,
      ...(record?.openedAt ? { openedAt: record.openedAt } : {}),
      ...(record?.closedAt ? { closedAt: record.closedAt } : {}),
      retention: {
        ...(record?.contentDeleteAfter ? { contentDeleteAfter: record.contentDeleteAfter } : {}),
        evidenceHold: record?.evidenceHold ?? false,
        deletionState: record?.contentDeletedAt
          ? "deleted"
          : record?.evidenceHold
            ? "blocked_by_hold"
            : record?.contentDeleteAfter && new Date(record.contentDeleteAfter) <= this.now()
              ? "eligible"
              : "not_due",
        summaryRetained: true,
      },
      realChatEnabled: false,
      externalChatProviderEnabled: false,
      synthetic: true,
    };
  }

  private toMessageCenter(record: MessageCenterRecord): MessageCenterView {
    return {
      items: record.items,
      unreadCount: record.items.filter((item) => !item.readAt).length,
      realPushEnabled: false,
      externalNotificationProviderEnabled: false,
      synthetic: true,
    };
  }

  private async appendAudit(actorId: string, resourceId: string, action: string, key: string) {
    await this.audit.append({
      id: crypto.randomUUID(),
      actorId,
      action,
      subjectType: "synthetic_communication",
      subjectId: resourceId,
      occurredAt: this.now().toISOString(),
      outcome: "succeeded",
      reasonCode: "SYNTHETIC_OPERATION",
      correlationId: key,
      synthetic: true,
    });
  }
}
