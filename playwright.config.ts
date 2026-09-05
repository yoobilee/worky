import { defineConfig, devices } from "@playwright/test";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: "./tests/e2e",
  testIgnore: "**/calendar-crud.spec.ts",
  timeout: 60_000,
  workers: isCI ? 1 : undefined,
  reporter: isCI ? "line" : "html",
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: isCI ? "off" : "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3000",
    url: "http://127.0.0.1:3000/login",
    reuseExistingServer: !isCI,
    timeout: 120_000,
  },
});
