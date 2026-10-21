import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  use: {
    baseURL: "http://localhost:3000",
    ...devices["iPhone 13"],
    browserName: "chromium",
    viewport: { width: 390, height: 844 },
  },
  webServer: {
    command: "pnpm start",
    url: "http://localhost:3000",
    reuseExistingServer: true,
  },
});
