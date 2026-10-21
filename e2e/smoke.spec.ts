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
  await expect(page.getByRole("button", { name: /Corde 5, A, sélectionnée/ })).toBeVisible();
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

test("metronome plays and the visual beat advances", async ({ page }) => {
  await withSettings(page, { locale: "fr", bpm: 200, beatsPerBar: 4 });
  await page.goto("/metronome");
  await page.getByRole("button", { name: "Démarrer" }).click();
  const beats = page.getByRole("img", { name: /Temps \d sur 4/ });
  await expect(beats).toHaveAttribute("aria-label", /Temps [1-4] sur 4/);
  const first = await beats.getAttribute("aria-label");
  await expect(beats).not.toHaveAttribute("aria-label", first!);
  await page.getByRole("button", { name: "Arrêter" }).click();
});

test("left-handed mode mirrors the headstock, labels stay readable", async ({ page }) => {
  await withSettings(page, { locale: "fr", demo: true, leftHanded: true, headstock: "inline" });
  await page.goto("/");
  const lowE = page.getByRole("button", { name: /^Corde 6, E/ });
  const highE = page.getByRole("button", { name: /^Corde 1, E/ });
  await expect(lowE).toBeVisible();
  // Six-in-line keys sit on the bass side: mirrored, they move to the right of the neck.
  const neck = await page.locator("svg.neck[role=group]").boundingBox();
  const peg = await lowE.boundingBox();
  expect(peg!.x).toBeGreaterThan(neck!.x + neck!.width / 2);
  await expect(highE).toHaveText("e");
});

test("credits are reachable from the settings", async ({ page }) => {
  await withSettings(page, { locale: "fr" });
  await page.goto("/settings");
  await page.getByRole("link", { name: "Crédits" }).click();
  await expect(page).toHaveURL("/settings/credits");
  await expect(page.getByRole("link", { name: /Code source/ })).toHaveAttribute(
    "href",
    "https://github.com/IPandragonI/Cherry",
  );
});

test("solfège notation stays available as a setting", async ({ page }) => {
  await withSettings(page, { locale: "fr", demo: true, notation: "solfege", selectedString: 1 });
  await page.goto("/");
  await expect(page.getByRole("button", { name: /Corde 5, La, sélectionnée/ })).toBeVisible();
});
