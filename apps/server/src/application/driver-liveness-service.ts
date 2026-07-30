import {
  createHash,
  createHmac,
  randomBytes,
  randomInt,
  randomUUID,
} from "node:crypto";
import type {
  DriverLivenessAction,
  DriverLivenessActionId,
  DriverLivenessChallenge,
  DriverLivenessResult,
  DriverLivenessResultCategory,
} from "@pollycar/contracts";
import type { AuditLog } from "../ports/audit.js";
import type { DriverLivenessProvider } from "../ports/driver-liveness-provider.js";
import type { Repository, Transaction } from "../ports/storage.js";

const policyVersion = "driver-liveness-v1";

const supportedActions: ReadonlyArray<
  Readonly<{ actionId: DriverLivenessActionId; instruction: string }>
> = [
  { actionId: "turn_head_left", instruction: "请缓慢向左转头" },
  { actionId: "turn_head_right", instruction: "请缓慢向右转头" },
  { actionId: "open_mouth", instruction: "请张开嘴巴" },
];

export type DriverLivenessBinding = Readonly<{
  accountId: string;
  deviceId: string;
  accountSessionId: string;
}>;

export type DriverLivenessChallengeRecord = Readonly<{
  challengeId: string;
  accountId: string;
  deviceDigest: string;
  accountSessionDigest: string;
  state: DriverLivenessChallenge["state"];
  policyVersion: string;
  actions: readonly DriverLivenessAction[];
  createdAt: string;
  expiresAt: string;
  resultCategory?: DriverLivenessResultCategory;
  providerRequestDigest?: string;
  authorizationIssuedAt?: string;
  authorizationExpiresAt?: string;
  processedKeys: readonly string[];
  synthetic: true;
}>;

export type DriverLivenessAuthorizationRecord = Readonly<{
  tokenDigest: string;
  challengeId: string;
  accountId: string;
  deviceDigest: string;
  accountSessionDigest: string;
  policyVersion: string;
  issuedAt: string;
  expiresAt: string;
  consumedAt?: string;
  consumedByIdempotencyKey?: string;
  synthetic: true;
}>;

type DriverLivenessSecurityPolicy = Readonly<{
  driverLivenessChallengeTtlSeconds: number;
  driverLivenessAuthorizationTtlSeconds: number;
}>;

export class DriverLivenessService {
  public constructor(
    private readonly challenges: Repository<DriverLivenessChallengeRecord>,
    private readonly authorizations: Repository<DriverLivenessAuthorizationRecord>,
    private readonly transaction: Transaction,
    private readonly audit: AuditLog,
    private readonly provider: DriverLivenessProvider,
    private readonly now: () => Date,
    private readonly authorizationSecret: string = randomBytes(32).toString("hex"),
    private readonly selectActions: () => readonly DriverLivenessActionId[] =
      selectRandomActions,
    private readonly securityPolicy: DriverLivenessSecurityPolicy = {
      driverLivenessChallengeTtlSeconds: 5 * 60,
      driverLivenessAuthorizationTtlSeconds: 5 * 60,
    },
  ) {}

  public createChallenge(
    binding: DriverLivenessBinding,
    idempotencyKey: string,
  ): Promise<DriverLivenessChallenge> {
    return this.transaction.run(async () => {
      const bindingDigests = this.bindingDigests(binding);
      const existing = (await this.challenges.list()).find(
        ({ value }) =>
          value.accountId === binding.accountId &&
          value.deviceDigest === bindingDigests.deviceDigest &&
          value.accountSessionDigest === bindingDigests.accountSessionDigest &&
          value.processedKeys.includes(idempotencyKey),
      );
      if (existing) return this.challengeView(await this.expireIfNeeded(existing.value, existing.version));

      await this.cancelOpenChallenges(binding, "challenge_replaced");
      const createdAt = this.now();
      const challengeId = `synthetic-liveness-${randomUUID()}`;
      const actions = this.selectActions().map((actionId, index) => ({
        actionId,
        sequence: index + 1,
        instruction:
          supportedActions.find((candidate) => candidate.actionId === actionId)
            ?.instruction ?? "请按屏幕提示完成动作",
        timeoutSeconds: 12,
      }));
      if (actions.length < 1 || actions.length > 3) {
        throw new Error("INTERNAL_UNEXPECTED_ERROR");
      }
      const record: DriverLivenessChallengeRecord = {
        challengeId,
        accountId: binding.accountId,
        ...bindingDigests,
        state: "created",
        policyVersion,
        actions,
        createdAt: createdAt.toISOString(),
        expiresAt: new Date(
          createdAt.getTime() +
            this.securityPolicy.driverLivenessChallengeTtlSeconds * 1000,
        ).toISOString(),
        processedKeys: [idempotencyKey],
        synthetic: true,
      };
      await this.challenges.put(challengeId, record, 0);
      await this.appendAudit(
        binding.accountId,
        "driver_liveness_challenge_created",
        challengeId,
        "created",
        idempotencyKey,
      );
      return this.challengeView(record);
    });
  }

  public async getChallenge(
    binding: DriverLivenessBinding,
    challengeId: string,
  ): Promise<DriverLivenessChallenge> {
    const stored = await this.requireChallenge(binding, challengeId);
    return this.challengeView(await this.expireIfNeeded(stored.value, stored.version));
  }

  public completeSynthetic(
    binding: DriverLivenessBinding,
    challengeId: string,
    scenario: DriverLivenessResultCategory,
    idempotencyKey: string,
  ): Promise<DriverLivenessResult> {
    return this.transaction.run(async () => {
      const stored = await this.requireChallenge(binding, challengeId);
      return this.completeChallenge(stored, scenario, idempotencyKey);
    });
  }

  public receiveProviderResult(
    challengeId: string,
    status: "passed" | "failed" | "pending" | "unknown",
    providerSessionReference: string,
    idempotencyKey: string,
  ): Promise<DriverLivenessResult> {
    const scenario: DriverLivenessResultCategory =
      status === "passed"
        ? "passed"
        : status === "unknown" || status === "pending"
          ? "result_unknown"
          : "action_mismatch";
    if (providerSessionReference.length < 8 || providerSessionReference.length > 256) {
      throw new Error("VALIDATION_FAILED");
    }
    return this.transaction.run(async () => {
      const stored = await this.challenges.get(challengeId);
      if (!stored) throw new Error("DRIVER_LIVENESS_CHALLENGE_NOT_FOUND");
      return this.completeChallenge(
        stored,
        scenario,
        `${idempotencyKey}:${digest(providerSessionReference)}`,
      );
    });
  }

  public consumeAuthorization(
    binding: DriverLivenessBinding,
    token: string | undefined,
    idempotencyKey: string,
  ): Promise<void> {
    return this.transaction.run(async () => {
      if (!token) {
        await this.appendAudit(
          binding.accountId,
          "driver_online_denied_liveness_required",
          binding.accountId,
          "missing_authorization",
          idempotencyKey,
          "denied",
        );
        throw new Error("DRIVER_LIVENESS_REQUIRED");
      }
      const tokenDigest = digest(token);
      const stored = await this.authorizations.get(tokenDigest);
      if (!stored) throw new Error("DRIVER_LIVENESS_AUTHORIZATION_MISMATCH");
      const authorization = stored.value;
      const expected = this.bindingDigests(binding);
      if (
        authorization.accountId !== binding.accountId ||
        authorization.deviceDigest !== expected.deviceDigest ||
        authorization.accountSessionDigest !== expected.accountSessionDigest
      ) {
        throw new Error("DRIVER_LIVENESS_AUTHORIZATION_MISMATCH");
      }
      if (authorization.consumedAt) {
        if (authorization.consumedByIdempotencyKey === idempotencyKey) return;
        throw new Error("DRIVER_LIVENESS_AUTHORIZATION_REPLAYED");
      }
      if (new Date(authorization.expiresAt).getTime() <= this.now().getTime()) {
        throw new Error("DRIVER_LIVENESS_AUTHORIZATION_EXPIRED");
      }
      const next: DriverLivenessAuthorizationRecord = {
        ...authorization,
        consumedAt: this.now().toISOString(),
        consumedByIdempotencyKey: idempotencyKey,
      };
      try {
        await this.authorizations.put(tokenDigest, next, stored.version);
      } catch (error) {
        if (
          error instanceof Error &&
          error.message === "STORAGE_CONCURRENT_MODIFICATION"
        ) {
          throw new Error("DRIVER_LIVENESS_AUTHORIZATION_REPLAYED");
        }
        throw error;
      }
      await this.appendAudit(
        binding.accountId,
        "driver_liveness_authorization_consumed",
        authorization.challengeId,
        "consumed",
        idempotencyKey,
      );
    });
  }

  public async revokeOpenAuthorizations(
    accountId: string,
    reason: string,
    correlationId: string,
  ): Promise<void> {
    const records = await this.authorizations.list();
    await Promise.all(
      records
        .filter(
          ({ value }) =>
            value.accountId === accountId &&
            !value.consumedAt &&
            new Date(value.expiresAt).getTime() > this.now().getTime(),
        )
        .map(async ({ value, version }) => {
          await this.authorizations.put(
            value.tokenDigest,
            {
              ...value,
              consumedAt: this.now().toISOString(),
              consumedByIdempotencyKey: `revoked:${reason}`,
            },
            version,
          );
          await this.appendAudit(
            accountId,
            "driver_liveness_authorization_revoked",
            value.challengeId,
            reason,
            correlationId,
          );
        }),
    );
  }

  private async completeChallenge(
    stored: Readonly<{
      value: DriverLivenessChallengeRecord;
      version: number;
    }>,
    scenario: DriverLivenessResultCategory,
    idempotencyKey: string,
  ): Promise<DriverLivenessResult> {
    const current = await this.expireIfNeeded(stored.value, stored.version);
    const currentVersion =
      current === stored.value ? stored.version : stored.version + 1;
    if (current.state === "expired") {
      throw new Error("DRIVER_LIVENESS_CHALLENGE_EXPIRED");
    }
    if (current.processedKeys.includes(idempotencyKey)) {
      return this.resultOrFailure(current);
    }
    if (!["created", "in_progress"].includes(current.state)) {
      throw new Error("DRIVER_LIVENESS_CHALLENGE_EXPIRED");
    }
    if (current.state === "created") {
      await this.appendAudit(
        current.accountId,
        "driver_liveness_challenge_started",
        current.challengeId,
        "in_progress",
        idempotencyKey,
      );
    }
    const resultCategory = await this.provider.evaluateSynthetic(scenario);
    const completedAt = this.now();
    const state =
      resultCategory === "passed"
        ? "passed"
        : resultCategory === "result_unknown" ||
            resultCategory === "provider_timeout"
          ? "result_unknown"
          : "failed";
    const next: DriverLivenessChallengeRecord = {
      ...current,
      state,
      resultCategory,
      providerRequestDigest: digest(
        `${current.challengeId}:${resultCategory}:${completedAt.toISOString()}`,
      ),
      ...(state === "passed"
        ? {
            authorizationIssuedAt: completedAt.toISOString(),
            authorizationExpiresAt: new Date(
              completedAt.getTime() +
                this.securityPolicy.driverLivenessAuthorizationTtlSeconds *
                  1000,
            ).toISOString(),
          }
        : {}),
      processedKeys: [...current.processedKeys, idempotencyKey],
    };
    const saved = await this.challenges.put(
      current.challengeId,
      next,
      currentVersion,
    );
    await this.appendAudit(
      current.accountId,
      "driver_liveness_result_recorded",
      current.challengeId,
      resultCategory,
      idempotencyKey,
    );
    if (state === "passed") {
      await this.issueAuthorization(saved.value, idempotencyKey);
    }
    return this.resultOrFailure(saved.value);
  }

  private resultOrFailure(
    record: DriverLivenessChallengeRecord,
  ): DriverLivenessResult {
    if (record.state === "result_unknown") {
      throw new Error(
        record.resultCategory === "provider_timeout"
          ? "DRIVER_LIVENESS_PROVIDER_TIMEOUT"
          : "DRIVER_LIVENESS_RESULT_UNKNOWN",
      );
    }
    if (record.resultCategory === "provider_unavailable") {
      throw new Error("DRIVER_LIVENESS_PROVIDER_UNAVAILABLE");
    }
    return this.resultView(record);
  }

  private async issueAuthorization(
    challenge: DriverLivenessChallengeRecord,
    correlationId: string,
  ): Promise<void> {
    const token = this.authorizationToken(challenge);
    const tokenDigest = digest(token);
    const existing = await this.authorizations.get(tokenDigest);
    if (!existing) {
      const issuedAt = challenge.authorizationIssuedAt!;
      await this.authorizations.put(
        tokenDigest,
        {
          tokenDigest,
          challengeId: challenge.challengeId,
          accountId: challenge.accountId,
          deviceDigest: challenge.deviceDigest,
          accountSessionDigest: challenge.accountSessionDigest,
          policyVersion: challenge.policyVersion,
          issuedAt,
          expiresAt: challenge.authorizationExpiresAt!,
          synthetic: true,
        },
        0,
      );
    }
    await this.appendAudit(
      challenge.accountId,
      "driver_liveness_authorization_issued",
      challenge.challengeId,
      "issued",
      correlationId,
    );
  }

  private resultView(
    record: DriverLivenessChallengeRecord,
  ): DriverLivenessResult {
    const authorizationIssued = record.state === "passed";
    return {
      challenge: this.challengeView(record),
      authorizationIssued,
      ...(authorizationIssued
        ? {
            livenessAuthorizationToken: this.authorizationToken(record),
            authorizationExpiresAt: record.authorizationExpiresAt,
          }
        : {}),
      productionEnabled: false,
      synthetic: true,
    };
  }

  private challengeView(
    record: DriverLivenessChallengeRecord,
  ): DriverLivenessChallenge {
    return {
      challengeId: record.challengeId,
      state: record.state,
      policyVersion: record.policyVersion,
      actions: record.actions,
      createdAt: record.createdAt,
      expiresAt: record.expiresAt,
      ...(record.resultCategory
        ? { resultCategory: record.resultCategory }
        : {}),
      realBiometricDataEnabled: false,
      productionEnabled: false,
      synthetic: true,
    };
  }

  private async requireChallenge(
    binding: DriverLivenessBinding,
    challengeId: string,
  ) {
    const stored = await this.challenges.get(challengeId);
    if (!stored) throw new Error("DRIVER_LIVENESS_CHALLENGE_NOT_FOUND");
    const expected = this.bindingDigests(binding);
    if (
      stored.value.accountId !== binding.accountId ||
      stored.value.deviceDigest !== expected.deviceDigest ||
      stored.value.accountSessionDigest !== expected.accountSessionDigest
    ) {
      throw new Error("DRIVER_LIVENESS_CHALLENGE_NOT_FOUND");
    }
    return stored;
  }

  private async expireIfNeeded(
    record: DriverLivenessChallengeRecord,
    version: number,
  ): Promise<DriverLivenessChallengeRecord> {
    if (
      !["created", "in_progress"].includes(record.state) ||
      new Date(record.expiresAt).getTime() > this.now().getTime()
    ) {
      return record;
    }
    const expired = { ...record, state: "expired" as const };
    await this.challenges.put(record.challengeId, expired, version);
    return expired;
  }

  private async cancelOpenChallenges(
    binding: DriverLivenessBinding,
    reason: string,
  ): Promise<void> {
    const expected = this.bindingDigests(binding);
    const records = await this.challenges.list();
    await Promise.all(
      records
        .filter(
          ({ value }) =>
            value.accountId === binding.accountId &&
            value.deviceDigest === expected.deviceDigest &&
            value.accountSessionDigest === expected.accountSessionDigest &&
            ["created", "in_progress"].includes(value.state),
        )
        .map(async ({ value, version }) => {
          await this.challenges.put(
            value.challengeId,
            { ...value, state: "cancelled" },
            version,
          );
          await this.appendAudit(
            binding.accountId,
            "driver_liveness_authorization_revoked",
            value.challengeId,
            reason,
            `replace:${value.challengeId}`,
          );
        }),
    );
  }

  private bindingDigests(binding: DriverLivenessBinding) {
    return {
      deviceDigest: digest(binding.deviceId),
      accountSessionDigest: digest(binding.accountSessionId),
    };
  }

  private authorizationToken(record: DriverLivenessChallengeRecord): string {
    if (!record.authorizationIssuedAt) {
      throw new Error("DRIVER_LIVENESS_REQUIRED");
    }
    const signature = createHmac("sha256", this.authorizationSecret)
      .update(
        [
          record.challengeId,
          record.accountId,
          record.deviceDigest,
          record.accountSessionDigest,
          record.policyVersion,
          record.authorizationIssuedAt,
        ].join(":"),
      )
      .digest("base64url");
    return `synthetic-liveness-auth.${record.challengeId}.${signature}`;
  }

  private appendAudit(
    actorId: string,
    action: string,
    subjectId: string,
    reasonCode: string,
    correlationId: string,
    outcome: "succeeded" | "denied" = "succeeded",
  ) {
    return this.audit.append({
      id: `audit-liveness-${randomUUID()}`,
      occurredAt: this.now().toISOString(),
      actorId,
      action,
      subjectType: "driver_liveness",
      subjectId,
      outcome,
      reasonCode,
      correlationId,
      synthetic: true,
    });
  }
}

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function selectRandomActions(): readonly DriverLivenessActionId[] {
  const pool = [...supportedActions.map(({ actionId }) => actionId)];
  const count = randomInt(1, pool.length + 1);
  const selected: DriverLivenessActionId[] = [];
  while (selected.length < count) {
    const index = randomInt(0, pool.length);
    selected.push(pool.splice(index, 1)[0]!);
  }
  return selected;
}
