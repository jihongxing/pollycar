import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  randomUUID,
} from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import type {
  AdminAuditEvent,
  ExecutiveDecisionOpinion,
  ExecutiveExportRequest,
} from "@pollycar/contracts";

export interface AdminAuditEventStore {
  list(): readonly AdminAuditEvent[];
  append(event: AdminAuditEvent): void;
}

export class InMemoryAdminAuditEventStore implements AdminAuditEventStore {
  private readonly events: AdminAuditEvent[] = [];

  public list(): readonly AdminAuditEvent[] {
    return Object.freeze([...this.events]);
  }

  public append(event: AdminAuditEvent): void {
    this.events.push(event);
  }
}

export class FileAdminAuditEventStore implements AdminAuditEventStore {
  private readonly events: AdminAuditEvent[];

  public constructor(private readonly filePath: string) {
    this.events = readJsonFile<AdminAuditEvent[]>(filePath, []);
  }

  public list(): readonly AdminAuditEvent[] {
    return Object.freeze([...this.events]);
  }

  public append(event: AdminAuditEvent): void {
    this.events.push(event);
    writeJsonFileAtomically(this.filePath, this.events);
  }
}

export type ExecutiveIdempotencyRecord = Readonly<{
  idempotencyKey: string;
  digest: string;
  actorId: string;
  result: unknown;
}>;

export type ExecutiveGovernanceState = Readonly<{
  opinions: readonly ExecutiveDecisionOpinion[];
  exports: readonly ExecutiveExportRequest[];
  idempotencyRecords: readonly ExecutiveIdempotencyRecord[];
}>;

export interface ExecutiveGovernanceStateStore {
  load(): ExecutiveGovernanceState;
  save(state: ExecutiveGovernanceState): void;
}

const emptyExecutiveGovernanceState: ExecutiveGovernanceState = Object.freeze({
  opinions: Object.freeze([]),
  exports: Object.freeze([]),
  idempotencyRecords: Object.freeze([]),
});

export class InMemoryExecutiveGovernanceStateStore
implements ExecutiveGovernanceStateStore {
  private state = emptyExecutiveGovernanceState;

  public load(): ExecutiveGovernanceState {
    return cloneExecutiveGovernanceState(this.state);
  }

  public save(state: ExecutiveGovernanceState): void {
    this.state = cloneExecutiveGovernanceState(state);
  }
}

export class FileExecutiveGovernanceStateStore
implements ExecutiveGovernanceStateStore {
  public constructor(private readonly filePath: string) {}

  public load(): ExecutiveGovernanceState {
    return cloneExecutiveGovernanceState(
      readJsonFile<ExecutiveGovernanceState>(
        this.filePath,
        emptyExecutiveGovernanceState,
      ),
    );
  }

  public save(state: ExecutiveGovernanceState): void {
    writeJsonFileAtomically(
      this.filePath,
      cloneExecutiveGovernanceState(state),
    );
  }
}

export interface ExecutiveExportArtifactStore {
  write(exportRequestId: string, content: Buffer): void;
  readAndDelete(exportRequestId: string): Buffer;
  delete(exportRequestId: string): void;
  exists(exportRequestId: string): boolean;
}

export class EncryptedMemoryExecutiveExportArtifactStore
implements ExecutiveExportArtifactStore {
  private readonly key = randomBytes(32);
  private readonly artifacts = new Map<string, Buffer>();

  public write(exportRequestId: string, content: Buffer): void {
    const initializationVector = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, initializationVector);
    const ciphertext = Buffer.concat([cipher.update(content), cipher.final()]);
    this.artifacts.set(
      exportRequestId,
      Buffer.concat([
        initializationVector,
        cipher.getAuthTag(),
        ciphertext,
      ]),
    );
  }

  public readAndDelete(exportRequestId: string): Buffer {
    const payload = this.artifacts.get(exportRequestId);
    if (!payload) {
      throw new Error("ADMIN_EXECUTIVE_EXPORT_ARTIFACT_UNAVAILABLE");
    }
    const decipher = createDecipheriv(
      "aes-256-gcm",
      this.key,
      payload.subarray(0, 12),
    );
    decipher.setAuthTag(payload.subarray(12, 28));
    const content = Buffer.concat([
      decipher.update(payload.subarray(28)),
      decipher.final(),
    ]);
    this.artifacts.delete(exportRequestId);
    return content;
  }

  public delete(exportRequestId: string): void {
    this.artifacts.delete(exportRequestId);
  }

  public exists(exportRequestId: string): boolean {
    return this.artifacts.has(exportRequestId);
  }
}

export class EncryptedFileExecutiveExportArtifactStore
implements ExecutiveExportArtifactStore {
  private readonly key: Buffer;

  public constructor(private readonly directory: string) {
    mkdirSync(directory, { recursive: true });
    const keyPath = join(directory, "export-artifact.key");
    if (existsSync(keyPath)) {
      this.key = readFileSync(keyPath);
    } else {
      this.key = randomBytes(32);
      writeFileSync(keyPath, this.key, { flag: "wx", mode: 0o600 });
    }
    if (this.key.length !== 32) {
      throw new Error("ADMIN_EXECUTIVE_EXPORT_KEY_INVALID");
    }
  }

  public write(exportRequestId: string, content: Buffer): void {
    const initializationVector = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, initializationVector);
    const ciphertext = Buffer.concat([cipher.update(content), cipher.final()]);
    const authenticationTag = cipher.getAuthTag();
    const payload = Buffer.concat([
      Buffer.from("PCAE1", "ascii"),
      initializationVector,
      authenticationTag,
      ciphertext,
    ]);
    writeBufferAtomically(this.pathFor(exportRequestId), payload);
  }

  public readAndDelete(exportRequestId: string): Buffer {
    const filePath = this.pathFor(exportRequestId);
    if (!existsSync(filePath)) {
      throw new Error("ADMIN_EXECUTIVE_EXPORT_ARTIFACT_UNAVAILABLE");
    }
    const payload = readFileSync(filePath);
    if (payload.length < 33 || payload.subarray(0, 5).toString("ascii") !== "PCAE1") {
      throw new Error("ADMIN_EXECUTIVE_EXPORT_ARTIFACT_INVALID");
    }
    const initializationVector = payload.subarray(5, 17);
    const authenticationTag = payload.subarray(17, 33);
    const ciphertext = payload.subarray(33);
    const decipher = createDecipheriv(
      "aes-256-gcm",
      this.key,
      initializationVector,
    );
    decipher.setAuthTag(authenticationTag);
    const content = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
    rmSync(filePath);
    return content;
  }

  public delete(exportRequestId: string): void {
    rmSync(this.pathFor(exportRequestId), { force: true });
  }

  public exists(exportRequestId: string): boolean {
    return existsSync(this.pathFor(exportRequestId));
  }

  private pathFor(exportRequestId: string): string {
    if (!/^[0-9a-f-]{36}$/i.test(exportRequestId)) {
      throw new Error("ADMIN_EXECUTIVE_EXPORT_ID_INVALID");
    }
    return join(this.directory, `${exportRequestId}.enc`);
  }
}

function readJsonFile<T>(filePath: string, fallback: T): T {
  if (!existsSync(filePath)) return fallback;
  try {
    return JSON.parse(readFileSync(filePath, "utf8")) as T;
  } catch {
    throw new Error("ADMIN_GOVERNANCE_STATE_CORRUPTED");
  }
}

function writeJsonFileAtomically(filePath: string, value: unknown): void {
  writeBufferAtomically(
    filePath,
    Buffer.from(`${JSON.stringify(value, undefined, 2)}\n`, "utf8"),
  );
}

function writeBufferAtomically(filePath: string, value: Buffer): void {
  mkdirSync(dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${randomUUID()}.tmp`;
  writeFileSync(temporaryPath, value, { flag: "wx", mode: 0o600 });
  renameSync(temporaryPath, filePath);
}

function cloneExecutiveGovernanceState(
  state: ExecutiveGovernanceState,
): ExecutiveGovernanceState {
  return Object.freeze({
    opinions: Object.freeze(
      state.opinions.map((opinion) => Object.freeze({ ...opinion })),
    ),
    exports: Object.freeze(
      state.exports.map((exportRequest) =>
        Object.freeze({
          ...exportRequest,
          fieldSet: Object.freeze([...exportRequest.fieldSet]),
        }),
      ),
    ),
    idempotencyRecords: Object.freeze(
      state.idempotencyRecords.map((record) =>
        Object.freeze({ ...record }),
      ),
    ),
  });
}
