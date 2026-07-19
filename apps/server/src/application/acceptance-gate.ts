export interface AcceptanceGate {
  run<TResult>(keys: readonly string[], operation: () => Promise<TResult>): Promise<TResult>;
}

export class KeyedAcceptanceGate implements AcceptanceGate {
  private readonly tails = new Map<string, Promise<void>>();

  public async run<TResult>(
    keys: readonly string[],
    operation: () => Promise<TResult>,
  ): Promise<TResult> {
    const releases: Array<() => void> = [];
    for (const key of [...new Set(keys)].sort()) {
      releases.push(await this.acquire(key));
    }
    try {
      return await operation();
    } finally {
      for (const release of releases.reverse()) release();
    }
  }

  private async acquire(key: string): Promise<() => void> {
    const previous = this.tails.get(key) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    const tail = previous.then(() => current);
    this.tails.set(key, tail);
    await previous;
    return () => {
      release();
      void tail.finally(() => {
        if (this.tails.get(key) === tail) this.tails.delete(key);
      });
    };
  }
}

