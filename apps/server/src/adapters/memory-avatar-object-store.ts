import type { AvatarObject, AvatarObjectStore } from "../ports/avatar-object-store.js";

export class MemoryAvatarObjectStore implements AvatarObjectStore {
  private readonly objects = new Map<string, AvatarObject>();

  async put(input: Omit<AvatarObject, "key">): Promise<string> {
    const key = crypto.randomUUID();
    this.objects.set(key, {
      key,
      contentType: input.contentType,
      bytes: Uint8Array.from(input.bytes),
    });
    return key;
  }

  async get(key: string): Promise<AvatarObject | undefined> {
    const object = this.objects.get(key);
    return object
      ? { ...object, bytes: Uint8Array.from(object.bytes) }
      : undefined;
  }

  async delete(key: string): Promise<void> {
    this.objects.delete(key);
  }
}
