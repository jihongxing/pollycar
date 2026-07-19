import type { SecretProvider } from "../ports/secret-provider.js";

export class EnvironmentSecretProvider implements SecretProvider {
  public async read(name: string): Promise<string | undefined> {
    return process.env[name];
  }
}
