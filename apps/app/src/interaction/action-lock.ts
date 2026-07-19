export type ActionLock = Readonly<{
  isRunning(key: string): boolean;
  run(key: string, action: () => Promise<void>): Promise<boolean>;
}>;

export function createActionLock(): ActionLock {
  const running = new Set<string>();
  return {
    isRunning: (key) => running.has(key),
    run: async (key, action) => {
      if (running.has(key)) return false;
      running.add(key);
      try {
        await action();
        return true;
      } finally {
        running.delete(key);
      }
    },
  };
}
