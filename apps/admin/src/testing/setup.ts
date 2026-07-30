import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import {
  createAdminPublicConfig,
  serializePublicConfig,
} from "@pollycar/configuration/public";
import { getLocalSandboxProfile } from "@pollycar/configuration";
import { afterEach, beforeEach, vi } from "vitest";

function installTestPublicConfig() {
  const profile = getLocalSandboxProfile();
  vi.stubEnv(
    "VITE_POLLYCAR_PUBLIC_CONFIG",
    serializePublicConfig(
      createAdminPublicConfig({
        profile: "test",
        apiBaseUrl: profile.network.apiBaseUrl,
      }),
    ),
  );
}

installTestPublicConfig();
beforeEach(installTestPublicConfig);

afterEach(() => {
  cleanup();
  localStorage.clear();
  delete document.documentElement.dataset.theme;
  vi.unstubAllEnvs();
});
