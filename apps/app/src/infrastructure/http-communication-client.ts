import type {
  ApiErrorResponse,
  MessageCenterClient,
  MessageCenterView,
  SendTripChatMessageCommand,
  TripChatClient,
  TripChatView,
} from "@pollycar/contracts";

export class HttpCommunicationClient implements TripChatClient, MessageCenterClient {
  public constructor(
    private readonly baseUrl: string,
    private readonly authorization: () => string,
    private readonly fetcher: typeof fetch = globalThis.fetch.bind(globalThis),
  ) {}

  public getByTrip(tripId: string): Promise<TripChatView> {
    return this.request(`/v1/internal-sandbox/app/synthetic-trips/${encodeURIComponent(tripId)}/chat`);
  }

  public send(command: SendTripChatMessageCommand): Promise<TripChatView> {
    return this.write(
      `/v1/internal-sandbox/app/synthetic-trips/${encodeURIComponent(command.tripId)}/chat/messages`,
      command.idempotencyKey,
      { body: command.body },
    );
  }

  public requestContentDeletion(tripId: string, idempotencyKey: string): Promise<TripChatView> {
    return this.write(
      `/v1/internal-sandbox/app/synthetic-trips/${encodeURIComponent(tripId)}/chat/content-deletion`,
      idempotencyKey,
      {},
    );
  }

  public getCenter(): Promise<MessageCenterView> {
    return this.request("/v1/internal-sandbox/app/messages");
  }

  public markRead(itemId: string, idempotencyKey: string): Promise<MessageCenterView> {
    return this.write(
      `/v1/internal-sandbox/app/messages/${encodeURIComponent(itemId)}/read`,
      idempotencyKey,
      {},
    );
  }

  public markAllRead(idempotencyKey: string): Promise<MessageCenterView> {
    return this.write("/v1/internal-sandbox/app/messages/read-all", idempotencyKey, {});
  }

  private request<T>(path: string): Promise<T> {
    return this.execute(path, { method: "GET" });
  }

  private write<T>(path: string, idempotencyKey: string, body: unknown): Promise<T> {
    return this.execute(path, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
      body: JSON.stringify(body),
    });
  }

  private async execute<T>(path: string, init: RequestInit): Promise<T> {
    const response = await this.fetcher(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: this.authorization(),
        "X-Correlation-Id": crypto.randomUUID(),
        ...init.headers,
      },
    });
    const body: unknown = await response.json();
    if (!response.ok) {
      const error = body as ApiErrorResponse;
      throw new Error(error.error?.code ?? "COMMUNICATION_REQUEST_FAILED");
    }
    return body as T;
  }
}
