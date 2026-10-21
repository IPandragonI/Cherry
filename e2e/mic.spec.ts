import { statSync } from "node:fs";
import { expect, test } from "@playwright/test";

test("desktop: listens automatically and hears a guitar on the right input channel", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "cherry-settings",
      JSON.stringify({ state: { locale: "fr" }, version: 1 }),
    ),
  );
  await page.goto("/");
  // No start button: the tuner starts listening on its own.
  await expect(page.getByRole("button", { name: /Démarrer/ })).toHaveCount(0);
  // Generous timeouts: the first test also pays for a cold browser and server.
  await expect(page.locator("[data-mic-status]")).toHaveAttribute("data-mic-status", "running", {
    timeout: 20_000,
  });
  await expect(page.getByText(/110,6 Hz/)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("meter")).toHaveAttribute("aria-valuetext", /\+9 cents/);
});

test("mic toggle turns listening off and back on", async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "cherry-settings",
      JSON.stringify({ state: { locale: "fr" }, version: 1 }),
    ),
  );
  await page.goto("/");
  const root = page.locator("[data-mic-status]");
  await expect(root).toHaveAttribute("data-mic-status", "running");

  await page.getByRole("button", { name: "Couper le micro" }).click();
  await expect(root).toHaveAttribute("data-mic-status", "off");
  await expect(page.getByText("Micro coupé")).toBeVisible();

  // Stays off across tab changes until the user turns it back on.
  await page.getByRole("link", { name: "Accords" }).click();
  await page.getByRole("link", { name: "Accordeur" }).click();
  await expect(root).toHaveAttribute("data-mic-status", "off");

  await page.getByRole("button", { name: "Activer le micro" }).click();
  await expect(root).toHaveAttribute("data-mic-status", "running");
  await expect(page.getByText(/110,6 Hz/)).toBeVisible({ timeout: 10_000 });
});

/** Emulates the page being hidden (app switch, tab change) and shown again. */
async function setVisibility(page: import("@playwright/test").Page, state: "hidden" | "visible") {
  await page.evaluate((s) => {
    Object.defineProperty(document, "visibilityState", { value: s, configurable: true });
    Object.defineProperty(document, "hidden", { value: s === "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  }, state);
}

test("listening resumes after the app is hidden and shown again", async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "cherry-settings",
      JSON.stringify({ state: { locale: "fr" }, version: 1 }),
    ),
  );
  await page.goto("/");
  const root = page.locator("[data-mic-status]");
  await expect(page.getByText(/110,6 Hz/)).toBeVisible({ timeout: 10_000 });

  await setVisibility(page, "hidden");
  await expect(root).toHaveAttribute("data-mic-status", "idle"); // microphone released

  await setVisibility(page, "visible");
  await expect(root).toHaveAttribute("data-mic-status", "running");
  await expect(page.getByRole("meter")).toHaveAttribute("aria-valuetext", /\+9 cents/, {
    timeout: 10_000,
  });

  // Twice in a row, the way people actually switch apps.
  await setVisibility(page, "hidden");
  await setVisibility(page, "visible");
  await expect(page.getByRole("meter")).toHaveAttribute("aria-valuetext", /\+9 cents/, {
    timeout: 10_000,
  });
});

test("audio diagnostic reports the device and the offset at A4 = 440 Hz", async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "cherry-settings",
      JSON.stringify({ state: { locale: "fr" }, version: 1 }),
    ),
  );
  await page.goto("/settings");
  await page.getByRole("button", { name: "Tester" }).click();
  await expect(page.getByText("à l'écoute")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/\d{5} Hz/).first()).toBeVisible(); // sample rate
  await expect(page.getByText(/A2 \+9\.\d c/)).toBeVisible({ timeout: 10_000 });
});

test("a non-standard reference pitch is flagged and shifts the reading", async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "cherry-settings",
      JSON.stringify({ state: { locale: "fr", a4: 446 }, version: 1 }),
    ),
  );
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Diapason réglé sur La4 = 446 Hz" })).toBeVisible();
  // +9 cents at 440 Hz is −14.4 cents against A4 = 446 Hz.
  await expect(page.getByRole("meter")).toHaveAttribute("aria-valuetext", /−14 cents/, {
    timeout: 10_000,
  });
});

test("the diagnostic records the raw input as a WAV file", async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "cherry-settings",
      JSON.stringify({ state: { locale: "fr" }, version: 2 }),
    ),
  );
  await page.goto("/settings");
  await page.getByRole("button", { name: "Tester" }).click();
  await expect(page.getByText("à l'écoute")).toBeVisible({ timeout: 10_000 });
  const download = page.waitForEvent("download", { timeout: 15_000 });
  await page.getByRole("button", { name: /Enregistrer 6 s/ }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^cherry-.*\.wav$/);
  const { size } = statSync(await file.path());
  expect(size).toBeGreaterThan(6 * 44100 * 2); // 6 s of 16-bit audio
});
