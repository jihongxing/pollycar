import react from "@vitejs/plugin-react";
import {
  getLocalSandboxProfile,
} from "@pollycar/configuration";
import { defineConfig } from "vite";

export default defineConfig(() => {
  const profile = getLocalSandboxProfile(process.env);
  return {
    plugins: [react()],
    server: {
      host: profile.network.host,
      port: profile.network.adminPort,
      proxy: {
        "/v1/internal-sandbox": {
          target: profile.network.apiBaseUrl,
          changeOrigin: false,
        },
      },
    },
    preview: {
      host: profile.network.host,
      port: profile.network.adminPort,
    },
    test: {
      environment: "jsdom",
      setupFiles: "./src/testing/setup.ts",
    },
  };
});
