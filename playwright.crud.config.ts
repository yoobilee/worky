import { defineConfig, devices } from "@playwright/test";

import baseConfig from "./playwright.config";

export default defineConfig({
  ...baseConfig,
  testIgnore: undefined,
  testMatch: "**/calendar-crud.spec.ts",
  timeout: 120_000,
  reporter: "line",
  use: {
    ...baseConfig.use,
    trace: "off",
    screenshot: "off",
    video: "off",
  },
  projects: [
    {
      name: "calendar-crud",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
