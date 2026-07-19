import type { Identity, IdentityProvider } from "../ports/identity.js";

export class SyntheticIdentityProvider implements IdentityProvider {
  public constructor(private readonly identities: Readonly<Record<string, Identity>>) {}

  public async authenticate(token: string): Promise<Identity | undefined> {
    const identity = this.identities[token];
    return identity?.synthetic ? identity : undefined;
  }
}
