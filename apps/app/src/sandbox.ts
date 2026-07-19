import { defaultFeatureGates } from "@pollycar/contracts";

export const appSandboxMode = Object.freeze({
  dataMode: "synthetic",
  featureGates: defaultFeatureGates,
});
