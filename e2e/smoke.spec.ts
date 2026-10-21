import { expect, test, type Page } from "@playwright/test";

/** Seeds persisted settings before the app boots. */
async function withSettings(page: Page, state: Record<string, unknown>) {
  await page.addInitScript((s) => {
    localStorage.setItem("cherry-settings", JSON.stringify({ state: s, version: 1 }));
  }, state);
}

test("tuner renders in demo mode and reacts to the simulated deviation", async ({ page }) => {
  await withSettings(page, { demo: true, locale: "fr", selectedString: 1, mode: "manual" });
  await page.goto("/");
  await expect(page.getByRole("button", { name: /Corde 5, La, sélectionnée/ })).toBeVisible();
  const slider = page.getByRole("slider", { name: "Écart simulé" });
  await slider.fill("0");
  await expect(page.getByText("Corde accordée")).toBeVisible();
  await slider.fill("-20");
  await expect(page.getByText("Trop bas, serrez la corde")).toBeVisible();
});

test("tab bar navigates between the four tabs", async ({ page }) => {
  await withSettings(page, { locale: "fr" });
  await page.goto("/");
  for (const [label, path] of [
    ["Accords", "/chords"],
    ["Trouveur", "/finder"],
    ["Réglages", "/settings"],
    ["Accordeur", "/"],
  ]) {
    await page.getByRole("link", { name: label }).click();
    await expect(page).toHaveURL(path);
    await expect(page.getByRole("link", { name: label })).toHaveAttribute("aria-current", "page");
  }
});

test("manifest and service worker are served", async ({ request }) => {
  const manifest = await request.get("/manifest.webmanifest");
  expect(manifest.ok()).toBe(true);
  expect((await manifest.json()).icons).toHaveLength(3);
  const sw = await request.get("/serwist/sw.js");
  expect(sw.ok()).toBe(true);
  expect(await sw.text()).toContain("/worklets/pitch-processor.js");
});
