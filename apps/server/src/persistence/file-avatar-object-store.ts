import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import type { AvatarObject, AvatarObjectStore } from "../ports/avatar-object-store.js";

const extensions = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
} as const;

export class FileAvatarObjectStore implements AvatarObjectStore {
  constructor(private readonly rootDirectory: string) {}

  async put(input: Omit<AvatarObject, "key">): Promise<string> {
    await mkdir(this.rootDirectory, { recursive: true });
    const key = `${crypto.randomUUID()}${extensions[input.contentType]}`;
    await writeFile(join(this.rootDirectory, key), input.bytes, { flag: "wx" });
    return key;
  }

  async get(key: string): Promise<AvatarObject | undefined> {
    if (!isSafeKey(key)) return undefined;
    try {
      const bytes = await readFile(join(this.rootDirectory, key));
      const contentType = contentTypeFor(key);
      return contentType
        ? { key, contentType, bytes }
        : undefined;
    } catch (error) {
      if (isMissing(error)) return undefined;
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    if (!isSafeKey(key)) return;
    try {
      await unlink(join(this.rootDirectory, key));
    } catch (error) {
      if (!isMissing(error)) throw error;
    }
  }
}

function isSafeKey(key: string): boolean {
  return /^[0-9a-f-]{36}\.(jpg|png|webp)$/.test(key);
}

function contentTypeFor(key: string): AvatarObject["contentType"] | undefined {
  const extension = extname(key);
  if (extension === ".jpg") return "image/jpeg";
  if (extension === ".png") return "image/png";
  if (extension === ".webp") return "image/webp";
  return undefined;
}

function isMissing(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}
