import { createLocalSandboxLaunchManifest } from "@pollycar/configuration";

process.stdout.write(
  JSON.stringify(createLocalSandboxLaunchManifest(process.env)),
);
