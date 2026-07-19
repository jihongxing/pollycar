import { createCipheriv, createHmac, randomBytes, randomUUID } from "node:crypto";
import type {
  AccountState,
  PhoneAuthenticationResult,
  PhoneCodeChallengeView,
  RefreshPhoneSessionRequest,
  RequestPhoneCodeRequest,
  VerifyPhoneCodeRequest,
} from "@pollycar/contracts";
import type { AuditLog } from "../ports/audit.js";
import type { SmsDelivery } from "../ports/sms-delivery.js";
import type { Repository, Transaction } from "../ports/storage.js";
import type { AccountSessionService } from "./account-session-service.js";

export type PhoneAccountRecord = Readonly<{
  accountId: string;
  phoneDigest: string;
  phoneCiphertext: string;
  state: AccountState;
  securityVersion: number;
  createdAt: string;
  updatedAt: string;
  processedKeys: readonly string[];
  synthetic: true;
}>;

export type PhoneChallengeRecord = Readonly<{
  challengeId: string;
  phoneDigest: string;
  maskedPhoneNumber: string;
  codeDigest: string;
  deviceId: string;
  state: "pending" | "consumed" | "expired" | "locked" | "superseded" | "delivery_unknown";
  attempts: number;
  maximumAttempts: number;
  sentAt: string;
  expiresAt: string;
  resendAvailableAt: string;
  providerReference?: string;
  processedKeys: readonly string[];
  synthetic: true;
}>;

export type DeviceRecord = Readonly<{
  deviceId: string;
  accountId?: string;
  trusted: boolean;
  failedChallenges: number;
  lastSeenAt: string;
  synthetic: true;
}>;

export type RefreshSessionRecord = Readonly<{
  refreshSessionId: string;
  refreshTokenDigest: string;
  accountId: string;
  deviceId: string;
  securityVersion: number;
  issuedAt: string;
  expiresAt: string;
  revokedAt?: string;
  replacedBy?: string;
  processedKeys: readonly string[];
  synthetic: true;
}>;

export class PhoneAuthenticationService {
  public constructor(
    private readonly accounts: Repository<PhoneAccountRecord>,
    private readonly challenges: Repository<PhoneChallengeRecord>,
    private readonly devices: Repository<DeviceRecord>,
    private readonly refreshSessions: Repository<RefreshSessionRecord>,
    private readonly sessions: AccountSessionService,
    private readonly sms: SmsDelivery,
    private readonly transaction: Transaction,
    private readonly audit: AuditLog,
    private readonly now: () => Date,
    private readonly secret = "synthetic-phone-auth-secret",
  ) {}

  public async requestCode(input: RequestPhoneCodeRequest): Promise<PhoneCodeChallengeView> {
    if (!input.consentAccepted) throw new Error("PHONE_AUTH_CONSENT_REQUIRED");
    const phone = normalizePhone(input.phoneNumber);
    assertSyntheticPhone(phone);
    const digest = this.digest(phone);
    const existing = (await this.challenges.list()).filter(({ value }) => value.phoneDigest === digest);
    const now = this.now();
    const recent = existing.filter(({ value }) =>
      value.state !== "consumed" &&
      now.getTime() - new Date(value.sentAt).getTime() < 60 * 60 * 1000
    );
    if (recent.some(({ value }) => now < new Date(value.resendAvailableAt))) throw new Error("PHONE_CODE_RATE_LIMITED");
    if (recent.length >= 5) throw new Error("PHONE_CODE_RATE_LIMITED");
    await Promise.all(existing.filter(({ value }) => value.state === "pending").map(({ value, version }) =>
      this.challenges.put(value.challengeId, { ...value, state: "superseded" }, version)));
    const challengeId = `phone-challenge-${randomUUID()}`;
    const code = "246810";
    const delivery = await this.sms.sendVerificationCode({
      maskedPhoneNumber: maskPhone(phone),
      code,
      idempotencyKey: input.idempotencyKey,
    });
    const record: PhoneChallengeRecord = {
      challengeId,
      phoneDigest: digest,
      maskedPhoneNumber: maskPhone(phone),
      codeDigest: this.digest(`${challengeId}:${code}`),
      deviceId: input.deviceId,
      state: delivery.state === "unknown" ? "delivery_unknown" : "pending",
      attempts: 0,
      maximumAttempts: 5,
      sentAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 5 * 60 * 1000).toISOString(),
      resendAvailableAt: new Date(now.getTime() + 60 * 1000).toISOString(),
      providerReference: delivery.providerReference,
      processedKeys: [input.idempotencyKey],
      synthetic: true,
    };
    await this.challenges.put(challengeId, record, 0);
    await this.devices.put(input.deviceId, {
      deviceId: input.deviceId,
      trusted: false,
      failedChallenges: 0,
      lastSeenAt: now.toISOString(),
      synthetic: true,
    }, (await this.devices.get(input.deviceId))?.version ?? 0);
    if (delivery.state === "unknown") throw new Error("PHONE_CODE_DELIVERY_UNKNOWN");
    return toChallengeView(record);
  }

  public async verify(input: VerifyPhoneCodeRequest): Promise<PhoneAuthenticationResult> {
    return this.transaction.run(async () => {
      const stored = await this.challenges.get(input.challengeId);
      if (!stored) throw new Error("PHONE_CODE_INVALID");
      const challenge = stored.value;
      if (challenge.deviceId !== input.deviceId) throw new Error("PHONE_CODE_INVALID");
      if (challenge.state === "consumed") throw new Error("PHONE_CODE_REPLAYED");
      if (challenge.state !== "pending") throw new Error("PHONE_CODE_INVALID");
      if (this.now() >= new Date(challenge.expiresAt)) {
        await this.challenges.put(challenge.challengeId, { ...challenge, state: "expired" }, stored.version);
        throw new Error("PHONE_CODE_EXPIRED");
      }
      if (challenge.codeDigest !== this.digest(`${challenge.challengeId}:${input.code}`)) {
        const attempts = challenge.attempts + 1;
        await this.challenges.put(challenge.challengeId, {
          ...challenge,
          attempts,
          state: attempts >= challenge.maximumAttempts ? "locked" : "pending",
        }, stored.version);
        throw new Error(attempts >= challenge.maximumAttempts ? "PHONE_CODE_LOCKED" : "PHONE_CODE_INVALID");
      }
      await this.challenges.put(challenge.challengeId, {
        ...challenge,
        state: "consumed",
        processedKeys: [...challenge.processedKeys, input.idempotencyKey],
      }, stored.version);
      const accountKey = `phone-${challenge.phoneDigest}`;
      let accountStored = await this.accounts.get(accountKey);
      const isNewAccount = !accountStored;
      if (!accountStored) {
        const accountId = `account-${randomUUID()}`;
        try {
          accountStored = await this.accounts.put(accountKey, {
            accountId,
            phoneDigest: challenge.phoneDigest,
            phoneCiphertext: this.encryptSyntheticPhone(challenge.maskedPhoneNumber),
            state: "pending_adult_eligibility",
            securityVersion: 1,
            createdAt: this.now().toISOString(),
            updatedAt: this.now().toISOString(),
            processedKeys: [input.idempotencyKey],
            synthetic: true,
          }, 0);
        } catch (error) {
          if (!(error instanceof Error) || error.message !== "STORAGE_CONCURRENT_MODIFICATION") throw error;
          accountStored = await this.accounts.get(accountKey);
          if (!accountStored) throw error;
        }
      }
      const account = accountStored.value;
      const internal = await this.sessions.create(account.accountId);
      const refreshToken = `synthetic-refresh-${randomUUID()}`;
      const refreshSessionId = `refresh-${randomUUID()}`;
      const refreshExpiresAt = new Date(this.now().getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
      await this.refreshSessions.put(refreshSessionId, {
        refreshSessionId,
        refreshTokenDigest: this.digest(refreshToken),
        accountId: account.accountId,
        deviceId: input.deviceId,
        securityVersion: account.securityVersion,
        issuedAt: this.now().toISOString(),
        expiresAt: refreshExpiresAt,
        processedKeys: [input.idempotencyKey],
        synthetic: true,
      }, 0);
      const deviceStored = await this.devices.get(input.deviceId);
      await this.devices.put(input.deviceId, {
        deviceId: input.deviceId,
        accountId: account.accountId,
        trusted: true,
        failedChallenges: 0,
        lastSeenAt: this.now().toISOString(),
        synthetic: true,
      }, deviceStored?.version ?? 0);
      return {
        accessToken: internal.token,
        refreshToken,
        accessTokenExpiresAt: internal.session.expiresAt,
        refreshTokenExpiresAt: refreshExpiresAt,
        account: {
          accountId: account.accountId,
          state: account.state,
          isNewAccount,
          adultEligibilityState: internal.session.adultEligibilityState,
          businessAccessAllowed: internal.session.businessAccessAllowed,
          nextStep: internal.session.businessAccessAllowed ? "ride_home" : "adult_eligibility",
          synthetic: true,
        },
        session: internal.session,
      };
    });
  }

  public async refresh(input: RefreshPhoneSessionRequest): Promise<PhoneAuthenticationResult> {
    const digest = this.digest(input.refreshToken);
    const stored = (await this.refreshSessions.list()).find(({ value }) => value.refreshTokenDigest === digest);
    if (!stored || stored.value.revokedAt || stored.value.replacedBy) throw new Error("REFRESH_TOKEN_REPLAYED");
    if (stored.value.deviceId !== input.deviceId) throw new Error("REFRESH_TOKEN_REPLAYED");
    if (this.now() >= new Date(stored.value.expiresAt)) throw new Error("REFRESH_SESSION_EXPIRED");
    const account = (await this.accounts.list()).find(({ value }) => value.accountId === stored.value.accountId);
    if (!account || account.value.securityVersion !== stored.value.securityVersion) throw new Error("REFRESH_TOKEN_REPLAYED");
    const internal = await this.sessions.create(account.value.accountId);
    const nextToken = `synthetic-refresh-${randomUUID()}`;
    const nextId = `refresh-${randomUUID()}`;
    await this.refreshSessions.put(stored.value.refreshSessionId, { ...stored.value, replacedBy: nextId }, stored.version);
    await this.refreshSessions.put(nextId, { ...stored.value, refreshSessionId: nextId, refreshTokenDigest: this.digest(nextToken), issuedAt: this.now().toISOString(), processedKeys: [input.idempotencyKey] }, 0);
    return {
      accessToken: internal.token,
      refreshToken: nextToken,
      accessTokenExpiresAt: internal.session.expiresAt,
      refreshTokenExpiresAt: stored.value.expiresAt,
      account: {
        accountId: account.value.accountId,
        state: account.value.state,
        isNewAccount: false,
        adultEligibilityState: internal.session.adultEligibilityState,
        businessAccessAllowed: internal.session.businessAccessAllowed,
        nextStep: internal.session.businessAccessAllowed ? "ride_home" : "adult_eligibility",
        synthetic: true,
      },
      session: internal.session,
    };
  }

  public async revokeDevice(accountId: string, deviceId: string): Promise<void> {
    const sessions = (await this.refreshSessions.list()).filter(({ value }) => value.accountId === accountId && value.deviceId === deviceId && !value.revokedAt);
    await Promise.all(sessions.map(({ value, version }) => this.refreshSessions.put(value.refreshSessionId, { ...value, revokedAt: this.now().toISOString() }, version)));
  }

  private digest(value: string): string {
    return createHmac("sha256", this.secret).update(value).digest("hex");
  }

  private encryptSyntheticPhone(maskedPhoneNumber: string): string {
    const key = createHmac("sha256", this.secret).update("phone-encryption").digest();
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const ciphertext = Buffer.concat([cipher.update(maskedPhoneNumber, "utf8"), cipher.final()]);
    return `synthetic:v1:${iv.toString("base64url")}:${cipher.getAuthTag().toString("base64url")}:${ciphertext.toString("base64url")}`;
  }
}

function normalizePhone(value: string): string {
  const compact = value.replace(/\s+/g, "");
  const normalized = compact.startsWith("+86") ? compact.slice(3) : compact;
  if (!/^1\d{10}$/.test(normalized)) throw new Error("PHONE_NUMBER_INVALID");
  return normalized;
}

function assertSyntheticPhone(value: string): void {
  if (!["18800000007", "18800000008", "18800000009"].includes(value)) {
    throw new Error("REAL_PHONE_DATA_FORBIDDEN");
  }
}

function maskPhone(value: string): string {
  return `${value.slice(0, 3)}****${value.slice(-4)}`;
}

function toChallengeView(record: PhoneChallengeRecord): PhoneCodeChallengeView {
  return {
    challengeId: record.challengeId,
    maskedPhoneNumber: record.maskedPhoneNumber,
    state: record.state,
    expiresAt: record.expiresAt,
    resendAvailableAt: record.resendAvailableAt,
    attemptsRemaining: record.maximumAttempts - record.attempts,
    synthetic: true,
  };
}
