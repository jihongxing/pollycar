import type { IncomingMessage } from "node:http";
import { randomUUID } from "node:crypto";

export type RequestContext = Readonly<{
  correlationId: string;
  reviewerId: string;
  synthetic: true;
}>;

export type AppRequestContext = Readonly<{
  correlationId: string;
  accountId: string;
  accountSessionId: string;
  activeIdentity: "passenger" | "driver";
  synthetic: true;
}>;

export type SafetyRequestContext = Readonly<{
  correlationId: string;
  safetyOfficerId: "synthetic-safety-001";
  synthetic: true;
}>;

export function createRequestContext(request: IncomingMessage): RequestContext {
  const authorization = request.headers.authorization;
  if (authorization !== "Sandbox synthetic-reviewer-001") {
    throw new Error("AUTHENTICATION_REQUIRED");
  }
  return {
    correlationId: correlationId(request),
    reviewerId: "synthetic-reviewer-001",
    synthetic: true,
  };
}

export async function createAppRequestContext(
  request: IncomingMessage,
  authenticateSession?: (token: string) => Promise<Readonly<{
    sessionId: string;
    accountId: string;
    activeIdentity: "passenger" | "driver";
    businessAccessAllowed: boolean;
    state: "active" | "expired" | "revoked";
  }> | undefined>,
  options: Readonly<{ requireBusinessAccess?: boolean }> = {},
): Promise<AppRequestContext> {
  const authorization = request.headers.authorization;
  const verifiedAccountId = request.headers["x-verified-account-id"];
  if (
    authorization === "Sandbox verified-app-session" &&
    typeof verifiedAccountId === "string" &&
    verifiedAccountId.length > 0 &&
    verifiedAccountId.length <= 128
  ) {
    return {
      correlationId: correlationId(request),
      accountId: verifiedAccountId,
      accountSessionId:
        typeof request.headers["x-verified-session-id"] === "string"
          ? request.headers["x-verified-session-id"]
          : `verified-session-${verifiedAccountId}`,
      activeIdentity:
        request.headers["x-verified-active-identity"] === "driver"
          ? "driver"
          : "passenger",
      synthetic: true,
    };
  }
  if (authorization?.startsWith("Session ") && authenticateSession) {
    const session = await authenticateSession(authorization.slice("Session ".length));
    if (!session) throw new Error("AUTHENTICATION_REQUIRED");
    if (session.state === "expired") throw new Error("SESSION_EXPIRED");
    if (session.state === "revoked") throw new Error("SESSION_REVOKED");
    if (options.requireBusinessAccess !== false && !session.businessAccessAllowed) {
      throw new Error("ADULT_ELIGIBILITY_REQUIRED");
    }
    return {
      correlationId: correlationId(request),
      accountId: session.accountId,
      accountSessionId: session.sessionId,
      activeIdentity: session.activeIdentity,
      synthetic: true,
    };
  }
  if (
    authorization !== "Sandbox synthetic-account-7" &&
    authorization !== "Sandbox synthetic-passenger-8" &&
    authorization !== "Sandbox synthetic-unverified-9"
  ) {
    throw new Error("AUTHENTICATION_REQUIRED");
  }
  const correlationHeader = request.headers["x-correlation-id"];
  return {
    correlationId: correlationId(request),
    accountId:
      authorization === "Sandbox synthetic-passenger-8"
        ? "synthetic-passenger-8"
        : authorization === "Sandbox synthetic-unverified-9"
          ? "synthetic-unverified-9"
        : "synthetic-account-7",
    accountSessionId:
      authorization === "Sandbox synthetic-passenger-8"
        ? "legacy-session-synthetic-passenger-8"
        : authorization === "Sandbox synthetic-unverified-9"
          ? "legacy-session-synthetic-unverified-9"
          : "legacy-session-synthetic-account-7",
    activeIdentity:
      request.headers["x-verified-active-identity"] === "passenger"
        ? "passenger"
        : authorization === "Sandbox synthetic-account-7"
          ? "driver"
          : "passenger",
    synthetic: true,
  };
}

function correlationId(request: IncomingMessage): string {
  const correlationHeader = request.headers["x-correlation-id"];
  return typeof correlationHeader === "string" && correlationHeader.length <= 128
    ? correlationHeader
    : randomUUID();
}

export function createSafetyRequestContext(request: IncomingMessage): SafetyRequestContext {
  if (request.headers.authorization !== "Sandbox synthetic-safety-001") {
    throw new Error("AUTHENTICATION_REQUIRED");
  }
  const correlationHeader = request.headers["x-correlation-id"];
  return {
    correlationId:
      typeof correlationHeader === "string" && correlationHeader.length <= 128
        ? correlationHeader
        : randomUUID(),
    safetyOfficerId: "synthetic-safety-001",
    synthetic: true,
  };
}
