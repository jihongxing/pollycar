import type {
  AdminProductSession,
  AdminProductizationClient,
} from "@pollycar/contracts";

export interface AdminSessionVault {
  readRefreshToken(): string | undefined;
  writeRefreshToken(refreshToken: string): void;
  clear(): void;
}

export class MemoryAdminSessionVault implements AdminSessionVault {
  private refreshToken: string | undefined;

  public readRefreshToken(): string | undefined {
    return this.refreshToken;
  }

  public writeRefreshToken(refreshToken: string): void {
    this.refreshToken = refreshToken;
  }

  public clear(): void {
    this.refreshToken = undefined;
  }
}

const refreshRequests = new Map<string, Promise<AdminProductSession>>();

export function restoreAdminSession(
  client: AdminProductizationClient,
  refreshToken: string,
): Promise<AdminProductSession> {
  const existing = refreshRequests.get(refreshToken);
  if (existing) return existing;
  const request = client.refreshSession(refreshToken);
  refreshRequests.set(refreshToken, request);
  void request.finally(() => {
    window.setTimeout(() => refreshRequests.delete(refreshToken), 1_000);
  });
  return request;
}
