import type { AdultEligibilitySdkSession } from "@pollycar/contracts";

export interface IdentityVerificationSdkAdapter {
  launch(session: AdultEligibilitySdkSession): Promise<void>;
}

export class SyntheticIdentityVerificationSdkAdapter implements IdentityVerificationSdkAdapter {
  public async launch(session: AdultEligibilitySdkSession): Promise<void> {
    if (session.sdkMode !== "synthetic") {
      throw new Error("EXTERNAL_IDENTITY_PROVIDER_DISABLED");
    }
    if (
      session.realIdentityDataEnabled ||
      session.realBiometricDataEnabled ||
      session.externalIdentityProviderEnabled
    ) {
      throw new Error("EXTERNAL_IDENTITY_PROVIDER_DISABLED");
    }
  }
}
