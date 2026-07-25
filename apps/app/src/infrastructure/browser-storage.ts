const localMemoryStorage = new Map<string, string>();
const sessionMemoryStorage = new Map<string, string>();

function getBrowserStorage(): Storage | undefined {
  if (typeof window === "undefined") return undefined;

  try {
    const storage = window.localStorage;
    return typeof storage?.getItem === "function" ? storage : undefined;
  } catch {
    return undefined;
  }
}

function getBrowserSessionStorage(): Storage | undefined {
  if (typeof window === "undefined") return undefined;

  try {
    const storage = window.sessionStorage;
    return typeof storage?.getItem === "function" ? storage : undefined;
  } catch {
    return undefined;
  }
}

export function readBrowserStorage(key: string): string | undefined {
  try {
    return getBrowserStorage()?.getItem(key) ?? localMemoryStorage.get(key);
  } catch {
    return localMemoryStorage.get(key);
  }
}

export function writeBrowserStorage(key: string, value: string): void {
  localMemoryStorage.set(key, value);
  try {
    getBrowserStorage()?.setItem(key, value);
  } catch {}
}

export function removeBrowserStorage(key: string): void {
  localMemoryStorage.delete(key);
  try {
    getBrowserStorage()?.removeItem(key);
  } catch {}
}

export function readBrowserSessionStorage(key: string): string | undefined {
  try {
    return getBrowserSessionStorage()?.getItem(key) ?? sessionMemoryStorage.get(key);
  } catch {
    return sessionMemoryStorage.get(key);
  }
}

export function writeBrowserSessionStorage(key: string, value: string): void {
  sessionMemoryStorage.set(key, value);
  try {
    getBrowserSessionStorage()?.setItem(key, value);
  } catch {}
}

export function removeBrowserSessionStorage(key: string): void {
  sessionMemoryStorage.delete(key);
  try {
    getBrowserSessionStorage()?.removeItem(key);
  } catch {}
}
