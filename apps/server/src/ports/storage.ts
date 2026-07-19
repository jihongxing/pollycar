export interface StoredRecord<TValue> {
  readonly key: string;
  readonly value: TValue;
  readonly version: number;
}

export interface Repository<TValue> {
  get(key: string): Promise<StoredRecord<TValue> | undefined>;
  put(key: string, value: TValue, expectedVersion: number): Promise<StoredRecord<TValue>>;
  list(): Promise<readonly StoredRecord<TValue>[]>;
}

export interface Transaction {
  run<TResult>(operation: () => Promise<TResult>): Promise<TResult>;
}
