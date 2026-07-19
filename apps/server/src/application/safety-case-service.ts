import type {
  AdminSafetyCaseDetail,
  AdminSafetyCaseSummary,
  SafetyCaseView,
  SafetyDashboard,
  TemporaryChatView,
} from "@pollycar/contracts";
import type { AuditLog } from "../ports/audit.js";
import type { Repository, Transaction } from "../ports/storage.js";
import type { SyntheticTripRecord } from "./synthetic-trip-service.js";

export type ChatRecord = Readonly<{
  tripId: string;
  state: "closed" | "open" | "frozen";
  messages: TemporaryChatView["messages"];
  expiresAt?: string;
  processedKeys: readonly string[];
  synthetic: true;
}>;

export type SafetyCaseRecord = Omit<SafetyCaseView, "version"> &
  Readonly<{ processedKeys: readonly string[] }>;

export class SafetyCaseService {
  public constructor(
    private readonly trips: Repository<SyntheticTripRecord>,
    private readonly chats: Repository<ChatRecord>,
    private readonly cases: Repository<SafetyCaseRecord>,
    private readonly transaction: Transaction,
    private readonly audit: AuditLog,
    private readonly now: () => Date,
    private readonly applyCommunicationEvidenceHold: (
      actorId: string,
      tripId: string,
      correlationId: string,
    ) => Promise<void> = async () => {},
  ) {}

  public async listForSafetyOfficer(): Promise<readonly AdminSafetyCaseSummary[]> {
    return (await this.cases.list())
      .filter((stored) => ["open_frozen", "appealing"].includes(stored.value.state))
      .map((stored) => this.toAdminSummary(stored.value));
  }

  public async getForSafetyOfficer(caseId: string): Promise<AdminSafetyCaseDetail> {
    const tripId = caseId.replace(/^safety-/, "");
    const stored = await this.cases.get(tripId);
    if (!stored || stored.value.caseId !== caseId) throw new Error("SAFETY_CASE_NOT_FOUND");
    return this.toAdminDetail(stored.value, stored.version);
  }

  public async resolveForSafetyOfficer(
    caseId: string,
    expectedVersion: number,
    outcome: "restore_access" | "uphold_freeze",
    idempotencyKey: string,
  ): Promise<AdminSafetyCaseDetail> {
    const tripId = caseId.replace(/^safety-/, "");
    await this.resolve(tripId, expectedVersion, outcome, idempotencyKey);
    return this.getForSafetyOfficer(caseId);
  }

  public async dashboard(accountId: string, tripId: string): Promise<SafetyDashboard> {
    const trip = await this.requireParticipant(accountId, tripId);
    const chat = await this.chats.get(tripId);
    const safetyCase = await this.cases.get(tripId);
    return {
      chat: this.toChat(chat?.value ?? this.createChat(trip)),
      ...(safetyCase ? { safetyCase: this.toCase(safetyCase.value, safetyCase.version) } : {}),
      realChatEnabled: false,
      realEvidenceEnabled: false,
    };
  }

  public async sendMessage(
    accountId: string,
    tripId: string,
    body: string,
    idempotencyKey: string,
  ): Promise<SafetyDashboard> {
    if (!body.startsWith("合成消息：")) throw new Error("REAL_DATA_FORBIDDEN");
    await this.transaction.run(async () => {
      const trip = await this.requireParticipant(accountId, tripId);
      if (!["accepted", "in_progress"].includes(trip.state)) throw new Error("CHAT_NOT_OPEN");
      const stored = await this.chats.get(tripId);
      const current = stored?.value ?? this.createChat(trip);
      if (current.state === "frozen") throw new Error("CHAT_FROZEN");
      if (current.processedKeys.includes(idempotencyKey)) return;
      const next: ChatRecord = {
        ...current,
        state: "open",
        messages: [
          ...current.messages,
          {
            messageId: `synthetic-message-${current.messages.length + 1}`,
            senderAccountId: accountId,
            body,
            sentAt: this.now().toISOString(),
            synthetic: true,
          },
        ],
        processedKeys: [...current.processedKeys, idempotencyKey],
      };
      await this.chats.put(tripId, next, stored?.version ?? 0);
      await this.appendAudit(accountId, tripId, "temporary_chat_message_sent", idempotencyKey);
    });
    return this.dashboard(accountId, tripId);
  }

  public async report(
    accountId: string,
    tripId: string,
    reasonCode: SafetyCaseView["reasonCode"],
    idempotencyKey: string,
  ): Promise<SafetyDashboard> {
    await this.transaction.run(async () => {
      const tripStored = await this.trips.get(tripId);
      if (!tripStored) throw new Error("TRIP_NOT_FOUND");
      const trip = tripStored.value;
      if (trip.passengerAccountId !== accountId && trip.driverAccountId !== accountId) {
        throw new Error("TRIP_FORBIDDEN");
      }
      const existing = await this.cases.get(tripId);
      if (existing?.value.processedKeys.includes(idempotencyKey)) return;
      if (existing) throw new Error("SAFETY_CASE_ALREADY_OPEN");
      const reportedAccountId =
        trip.passengerAccountId === accountId ? trip.driverAccountId : trip.passengerAccountId;
      if (!reportedAccountId) throw new Error("TRIP_INVALID_STATE");
      const createdAt = this.now().toISOString();
      await this.cases.put(
        tripId,
        {
          caseId: `safety-${tripId}`,
          tripId,
          reporterAccountId: accountId,
          reportedAccountId,
          reasonCode,
          state: "open_frozen",
          createdAt,
          processedKeys: [idempotencyKey],
          synthetic: true,
        },
        0,
      );
      const chat = await this.chats.get(tripId);
      await this.chats.put(
        tripId,
        { ...(chat?.value ?? this.createChat(trip)), state: "frozen" },
        chat?.version ?? 0,
      );
      await this.trips.put(
        tripId,
        { ...trip, state: "safety_frozen" },
        tripStored.version,
      );
      await this.appendAudit(accountId, tripId, "safety_report_frozen", idempotencyKey);
      await this.applyCommunicationEvidenceHold(accountId, tripId, idempotencyKey);
    });
    return this.dashboard(accountId, tripId);
  }

  public async appeal(
    accountId: string,
    caseId: string,
    expectedVersion: number,
    idempotencyKey: string,
  ): Promise<SafetyCaseView> {
    const tripId = caseId.replace(/^safety-/, "");
    return this.updateCase(tripId, expectedVersion, idempotencyKey, (current) => {
      if (current.reportedAccountId !== accountId) throw new Error("SAFETY_APPEAL_FORBIDDEN");
      if (current.state !== "open_frozen") throw new Error("SAFETY_INVALID_STATE");
      return { ...current, state: "appealing", appealReasonCode: "context_missing" };
    }, accountId, "safety_appeal_submitted");
  }

  public async resolve(
    tripId: string,
    expectedVersion: number,
    outcome: "restore_access" | "uphold_freeze",
    idempotencyKey: string,
  ): Promise<SafetyCaseView> {
    return this.transaction.run(async () => {
      const view = await this.updateCase(
        tripId,
        expectedVersion,
        idempotencyKey,
        (current) => {
          if (current.state !== "appealing") throw new Error("SAFETY_INVALID_STATE");
          return {
            ...current,
            state: outcome === "restore_access" ? "restored" : "upheld",
            resolutionCode: outcome,
            resolvedAt: this.now().toISOString(),
          };
        },
        "synthetic-safety-001",
        "safety_appeal_resolved",
      );
      if (outcome === "restore_access") {
        const trip = await this.trips.get(tripId);
        const chat = await this.chats.get(tripId);
        if (trip) await this.trips.put(tripId, { ...trip.value, state: "in_progress" }, trip.version);
        if (chat) await this.chats.put(tripId, { ...chat.value, state: "open" }, chat.version);
      }
      return view;
    });
  }

  private async updateCase(
    tripId: string,
    expectedVersion: number,
    idempotencyKey: string,
    update: (current: SafetyCaseRecord) => SafetyCaseRecord,
    actorId: string,
    action: string,
  ) {
    const stored = await this.cases.get(tripId);
    if (!stored) throw new Error("SAFETY_CASE_NOT_FOUND");
    if (stored.value.processedKeys.includes(idempotencyKey)) return this.toCase(stored.value, stored.version);
    if (stored.version !== expectedVersion) throw new Error("STORAGE_CONCURRENT_MODIFICATION");
    const next = update(stored.value);
    const saved = await this.cases.put(
      tripId,
      { ...next, processedKeys: [...next.processedKeys, idempotencyKey] },
      expectedVersion,
    );
    await this.appendAudit(actorId, tripId, action, idempotencyKey);
    return this.toCase(saved.value, saved.version);
  }

  private async requireParticipant(accountId: string, tripId: string) {
    const trip = await this.trips.get(tripId);
    if (!trip) throw new Error("TRIP_NOT_FOUND");
    if (trip.value.passengerAccountId !== accountId && trip.value.driverAccountId !== accountId) {
      throw new Error("TRIP_FORBIDDEN");
    }
    return trip.value;
  }

  private createChat(trip: SyntheticTripRecord): ChatRecord {
    return {
      tripId: trip.tripId,
      state: ["accepted", "in_progress"].includes(trip.state) ? "open" : "closed",
      messages: [],
      ...(trip.acceptedAt
        ? { expiresAt: new Date(new Date(trip.acceptedAt).getTime() + 24 * 60 * 60 * 1000).toISOString() }
        : {}),
      processedKeys: [],
      synthetic: true,
    };
  }

  private toChat(record: ChatRecord): TemporaryChatView {
    return {
      tripId: record.tripId,
      state: record.state,
      messages: record.messages,
      ...(record.expiresAt ? { expiresAt: record.expiresAt } : {}),
      synthetic: true,
    };
  }

  private toCase(record: SafetyCaseRecord, version: number): SafetyCaseView {
    const { processedKeys: _, ...view } = record;
    return { ...view, version };
  }

  private toAdminSummary(record: SafetyCaseRecord): AdminSafetyCaseSummary {
    return {
      caseId: record.caseId,
      tripId: record.tripId,
      state: record.state,
      reasonCode: record.reasonCode,
      createdAt: record.createdAt,
      hasAppeal: record.state === "appealing",
      synthetic: true,
    };
  }

  private toAdminDetail(record: SafetyCaseRecord, version: number): AdminSafetyCaseDetail {
    return {
      ...this.toAdminSummary(record),
      reporterAccountReference: maskAccount(record.reporterAccountId),
      reportedAccountReference: maskAccount(record.reportedAccountId),
      ...(record.appealReasonCode ? { appealReasonCode: record.appealReasonCode } : {}),
      version,
      disclosure: {
        chatBodyAvailable: false,
        rawEvidenceAvailable: false,
      },
    };
  }

  private appendAudit(actorId: string, tripId: string, action: string, correlationId: string) {
    return this.audit.append({
      id: `audit-safety-${tripId}-${action}-${correlationId}`,
      occurredAt: this.now().toISOString(),
      actorId,
      action,
      subjectType: "safety_case",
      subjectId: tripId,
      outcome: "succeeded",
      reasonCode: action,
      correlationId,
      synthetic: true,
    });
  }
}

function maskAccount(accountId: string): string {
  return `合成账户 · ${accountId.slice(-4)}`;
}
