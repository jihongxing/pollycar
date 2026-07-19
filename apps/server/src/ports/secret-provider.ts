export interface SecretProvider {
  read(name: string): Promise<string | undefined>;
}
