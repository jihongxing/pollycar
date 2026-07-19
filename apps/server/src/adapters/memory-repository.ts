import type { Repository, StoredRecord, Transaction } from "../ports/storage.js";

export class MemoryRepository<TValue> implements Repository<TValue> {
  private readonly records = new Map<string, StoredRecord<TValue>>();

  public async get(key: string): Promise<StoredRecord<TValue> | undefined> {
    return this.records.get(key);
  }

  public async put(key: string, value: TValue, expectedVersion: number): Promise<StoredRecord<TValue>> {
    const current = this.records.get(key);
    if ((current?.version ?? 0) !== expectedVersion) {
      throw new Error("STORAGE_CONCURRENT_MODIFICATION");
    }
    const next = Object.freeze({ key, value, version: expectedVersion + 1 });
    this.records.set(key, next);
    return next;
  }

  public async list(): Promise<readonly StoredRecord<TValue>[]> {
    return [...this.records.values()];
  }
}

export class MemoryTransaction implements Transaction {
  public async run<TResult>(operation: () => Promise<TResult>): Promise<TResult> {
    return operation();
  }
}
