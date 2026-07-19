import type {
  PhoneAuthenticationResult,
  PhoneCodeChallengeView,
  RefreshPhoneSessionRequest,
  RequestPhoneCodeRequest,
  VerifyPhoneCodeRequest,
} from "@pollycar/contracts";

export class HttpPhoneAuthenticationClient {
  public constructor(
    private readonly baseUrl: string,
    private readonly fetcher: typeof fetch = globalThis.fetch.bind(globalThis),
  ) {}

  public requestCode(input: RequestPhoneCodeRequest): Promise<PhoneCodeChallengeView> {
    return this.post("/v1/auth/phone/code", input);
  }

  public verify(input: VerifyPhoneCodeRequest): Promise<PhoneAuthenticationResult> {
    return this.post("/v1/auth/phone/verify", input);
  }

  public refresh(input: RefreshPhoneSessionRequest): Promise<PhoneAuthenticationResult> {
    return this.post("/v1/auth/session/refresh", input);
  }

  private async post<TResult>(path: string, body: unknown): Promise<TResult> {
    let response: Response;
    try {
      response = await this.fetcher(`${this.baseUrl}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch {
      throw new Error("SERVICE_UNAVAILABLE");
    }
    const payload = await response.json();
    if (!response.ok) {
      throw new Error((payload as { error?: { code?: string } }).error?.code ?? "SERVICE_UNAVAILABLE");
    }
    return payload as TResult;
  }
}
