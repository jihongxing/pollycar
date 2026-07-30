import { createHash, randomUUID } from "node:crypto";
import type {
  AccountIdentityMode,
  CreateInternalAccountSessionResponse,
  InternalAccountSessionView,
} from "@pollycar/contracts";
import type { Repository, Transaction } from "../ports/storage.js";

export type AccountSessionRecord = Readonly<{
  sessionId: string;
  tokenDigest: string;
  accountId: string;
  activeIdentity: AccountIdentityMode;
  availableIdentities: readonly AccountIdentityMode[];
  adultEligibilityState: string;
  businessAccessAllowed: boolean;
  issuedAt: string;
  expiresAt: string;
  revokedAt?: string;
  processedKeys: readonly string[];
  synthetic: true;
}>;

type AccountAccess = Readonly<{
  adultEligibilityState: string;
  businessAccessAllowed: boolean;
  driverAvailable: boolean;
}>;

type AccountSessionSecurityPolicy = Readonly<{
  accountSessionTtlSeconds: number;
}>;

export class AccountSessionService {
  public constructor(
    private readonly repository: Repository<AccountSessionRecord>,
    private readonly transaction: Transaction,
    private readonly resolveAccess: (accountId: string) => Promise<AccountAccess>,
    private readonly now: () => Date,
    private readonly onSessionBoundary: (
      accountId: string,
      reason: "session_created" | "logout" | "identity_switch",
    ) => Promise<void> = async () => {},
    private readonly securityPolicy: AccountSessionSecurityPolicy = {
      accountSessionTtlSeconds: 30 * 60,
    },
  ) {}

  public async create(accountId: string): Promise<CreateInternalAccountSessionResponse> {
    const access = await this.resolveAccess(accountId);
    const issuedAt = this.now();
    const sessionId = `session-${randomUUID()}`;
    const token = `synthetic-session-${randomUUID()}`;
    const availableIdentities: AccountIdentityMode[] = access.driverAvailable
      ? ["passenger", "driver"]
      : ["passenger"];
    const record: AccountSessionRecord = {
      sessionId,
      tokenDigest: createHash("sha256").update(token).digest("hex"),
      accountId,
      activeIdentity: "passenger",
      availableIdentities,
      adultEligibilityState: access.adultEligibilityState,
      businessAccessAllowed: access.businessAccessAllowed,
      issuedAt: issuedAt.toISOString(),
      expiresAt: new Date(
        issuedAt.getTime() +
          this.securityPolicy.accountSessionTtlSeconds * 1000,
      ).toISOString(),
      processedKeys: [],
      synthetic: true,
    };
    await this.repository.put(sessionId, record, 0);
    await this.onSessionBoundary(accountId, "session_created");
    return { token, session: this.toView(record) };
  }

  public async authenticate(token: string): Promise<InternalAccountSessionView | undefined> {
    const tokenDigest = createHash("sha256").update(token).digest("hex");
    const stored = (await this.repository.list()).find(({ value }) => value.tokenDigest === tokenDigest);
    if (!stored) return undefined;
    const access = await this.resolveAccess(stored.value.accountId);
    return this.toView({
      ...stored.value,
      availableIdentities: access.driverAvailable ? ["passenger", "driver"] : ["passenger"],
      adultEligibilityState: access.adultEligibilityState,
      businessAccessAllowed: access.businessAccessAllowed,
    });
  }

  public async switchIdentity(
    token: string,
    requestedIdentity: AccountIdentityMode,
    idempotencyKey: string,
  ): Promise<InternalAccountSessionView> {
    return this.transaction.run(async () => {
      const stored = await this.requireActive(token);
      if (stored.value.processedKeys.includes(idempotencyKey)) return this.toView(stored.value);
      if (!stored.value.availableIdentities.includes(requestedIdentity)) {
        throw new Error("SESSION_IDENTITY_NOT_AVAILABLE");
      }
      const access = await this.resolveAccess(stored.value.accountId);
      if (!access.businessAccessAllowed) throw new Error("ADULT_ELIGIBILITY_REQUIRED");
      if (requestedIdentity === "driver" && !access.driverAvailable) {
        throw new Error("SESSION_IDENTITY_NOT_AVAILABLE");
      }
      const next: AccountSessionRecord = {
        ...stored.value,
        activeIdentity: requestedIdentity,
        adultEligibilityState: access.adultEligibilityState,
        businessAccessAllowed: access.businessAccessAllowed,
        processedKeys: [...stored.value.processedKeys, idempotencyKey],
      };
      const saved = await this.repository.put(
        next.sessionId,
        next,
        stored.version,
      );
      if (
        stored.value.activeIdentity === "driver" &&
        requestedIdentity !== "driver"
      ) {
        await this.onSessionBoundary(stored.value.accountId, "identity_switch");
      }
      return this.toView(saved.value);
    });
  }

  public async revoke(token: string, idempotencyKey: string): Promise<InternalAccountSessionView> {
    return this.transaction.run(async () => {
      const stored = await this.require(token);
      if (stored.value.revokedAt || stored.value.processedKeys.includes(idempotencyKey)) {
        return this.toView(stored.value);
      }
      const next: AccountSessionRecord = {
        ...stored.value,
        revokedAt: this.now().toISOString(),
        processedKeys: [...stored.value.processedKeys, idempotencyKey],
      };
      const saved = await this.repository.put(
        next.sessionId,
        next,
        stored.version,
      );
      await this.onSessionBoundary(stored.value.accountId, "logout");
      return this.toView(saved.value);
    });
  }

  private async requireActive(token: string) {
    const stored = await this.require(token);
    if (stored.value.revokedAt) throw new Error("SESSION_REVOKED");
    if (this.now().getTime() >= new Date(stored.value.expiresAt).getTime()) {
      throw new Error("SESSION_EXPIRED");
    }
    return stored;
  }

  private async require(token: string) {
    const tokenDigest = createHash("sha256").update(token).digest("hex");
    const stored = (await this.repository.list()).find(({ value }) => value.tokenDigest === tokenDigest);
    if (!stored) throw new Error("AUTHENTICATION_REQUIRED");
    return stored;
  }

  private toView(record: AccountSessionRecord): InternalAccountSessionView {
    const state =
      record.revokedAt
        ? "revoked"
        : this.now().getTime() >= new Date(record.expiresAt).getTime()
          ? "expired"
          : "active";
    return {
      sessionId: record.sessionId,
      accountId: record.accountId,
      activeIdentity: record.activeIdentity,
      availableIdentities: record.availableIdentities,
      adultEligibilityState: record.adultEligibilityState,
      businessAccessAllowed: record.businessAccessAllowed,
      issuedAt: record.issuedAt,
      expiresAt: record.expiresAt,
      ...(record.revokedAt ? { revokedAt: record.revokedAt } : {}),
      state,
      productionEnabled: false,
      synthetic: true,
    };
  }
}
