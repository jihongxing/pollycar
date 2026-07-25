export type AvatarObject = Readonly<{
  key: string;
  contentType: "image/jpeg" | "image/png" | "image/webp";
  bytes: Uint8Array;
}>;

export interface AvatarObjectStore {
  put(input: Omit<AvatarObject, "key">): Promise<string>;
  get(key: string): Promise<AvatarObject | undefined>;
  delete(key: string): Promise<void>;
}
