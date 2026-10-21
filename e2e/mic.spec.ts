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
  await expect(page.locator("[data-mic-status]")).toHaveAttribute("data-mic-status", "running");
  await expect(page.getByText(/110,6 Hz/)).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("meter")).toHaveAttribute("aria-valuetext", /\+9 cents/);
});
