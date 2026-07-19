import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react()],
    server: {
      host: "127.0.0.1",
      port: 4173,
      proxy: {
        "/v1/internal-sandbox": {
          target: env.POLLYCAR_ADMIN_PROXY_TARGET ?? "http://127.0.0.1:4310",
          changeOrigin: false,
        },
      },
    },
    preview: { host: "127.0.0.1", port: 4173 },
    test: {
      environment: "jsdom",
      setupFiles: "./src/testing/setup.ts",
    },
  };
});
