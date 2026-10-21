import { resolve } from "node:path";
import { defineConfig, devices } from "@playwright/test";
import { FAKE_MIC_WAV } from "./e2e/fake-mic";

export default defineConfig({
  testDir: "e2e",
  globalSetup: "./e2e/global-setup.ts",
  // Own port, so a `next dev` left running on :3000 is never reused by mistake.
  use: { baseURL: "http://localhost:3100" },
  projects: [
    {
      name: "mobile",
      testIgnore: /mic\.spec\.ts/,
      use: {
        ...devices["iPhone 13"],
        browserName: "chromium",
        viewport: { width: 390, height: 844 },
      },
    },
    {
      // Desktop Chromium with a fake microphone (stereo, guitar on the right channel).
      name: "desktop-mic",
      testMatch: /mic\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        permissions: ["microphone"],
        launchOptions: {
          args: [
            "--use-fake-ui-for-media-stream",
            "--use-fake-device-for-media-stream",
            `--use-file-for-fake-audio-capture=${resolve(FAKE_MIC_WAV)}`,
          ],
        },
      },
    },
  ],
  webServer: {
    command: "pnpm start -p 3100",
    url: "http://localhost:3100",
    reuseExistingServer: true,
  },
});
