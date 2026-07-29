import {
  readBrowserSessionStorage,
  removeBrowserSessionStorage,
  writeBrowserSessionStorage,
} from "./browser-storage";

export interface SecureCredentialStore {
  get(key: string): Promise<string | undefined>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}

export const secureCredentialStore: SecureCredentialStore = {
  async get(key) {
    if (!isNativeRuntime()) return readBrowserSessionStorage(key);
    const value = await (await loadNativeSecureStore()).getItemAsync(key);
    return value ?? undefined;
  },
  async set(key, value) {
    if (!isNativeRuntime()) {
      writeBrowserSessionStorage(key, value);
      return;
    }
    const secureStore = await loadNativeSecureStore();
    await secureStore.setItemAsync(key, value, {
      keychainAccessible: secureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  },
  async delete(key) {
    if (!isNativeRuntime()) {
      removeBrowserSessionStorage(key);
      return;
    }
    await (await loadNativeSecureStore()).deleteItemAsync(key);
  },
};

function isNativeRuntime(): boolean {
  return globalThis.navigator?.product === "ReactNative";
}

async function loadNativeSecureStore() {
  return import("expo-secure-store");
}
