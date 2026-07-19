import type {
  AccountIdentityMode,
  CreateInternalAccountSessionResponse,
  InternalAccountSessionView,
} from "@pollycar/contracts";
import { setSessionToken } from "./session-credentials";

export class HttpAccountSessionClient {
  public constructor(
    private readonly baseUrl: string,
    private readonly fetcher: typeof fetch = globalThis.fetch.bind(globalThis),
  ) {}

  public async create(): Promise<CreateInternalAccountSessionResponse> {
    const response = await this.fetcher(`${this.baseUrl}/v1/internal-sandbox/app/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId: "synthetic-account-7" }),
    });
    const result = await read<CreateInternalAccountSessionResponse>(response);
    setSessionToken(result.token);
    return result;
  }

  public async current(token: string): Promise<InternalAccountSessionView> {
    return read(await this.fetcher(`${this.baseUrl}/v1/internal-sandbox/app/sessions/current`, {
      headers: { Authorization: `Session ${token}` },
    }));
  }

  public async switchIdentity(
    token: string,
    activeIdentity: AccountIdentityMode,
  ): Promise<InternalAccountSessionView> {
    return read(await this.fetcher(`${this.baseUrl}/v1/internal-sandbox/app/sessions/current/identity`, {
      method: "POST",
      headers: {
        Authorization: `Session ${token}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `identity-${activeIdentity}-${Date.now()}`,
      },
      body: JSON.stringify({ activeIdentity }),
    }));
  }

  public async revoke(token: string): Promise<InternalAccountSessionView> {
    const result = await read<InternalAccountSessionView>(
      await this.fetcher(`${this.baseUrl}/v1/internal-sandbox/app/sessions/current/revoke`, {
        method: "POST",
        headers: {
          Authorization: `Session ${token}`,
          "Idempotency-Key": `revoke-${Date.now()}`,
        },
      }),
    );
    setSessionToken(undefined);
    return result;
  }
}

async function read<TResult>(response: Response): Promise<TResult> {
  const body = await response.json();
  if (!response.ok) {
    const code = (body as { error?: { code?: string } }).error?.code;
    throw new Error(code ?? "SERVICE_UNAVAILABLE");
  }
  return body as TResult;
}
