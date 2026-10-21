import { spawnSync } from "node:child_process";
import { createSerwistRoute } from "@serwist/turbopack";

// Versions the precached pages: a new deploy (commit) refreshes them.
const revision =
  process.env.VERCEL_GIT_COMMIT_SHA ||
  spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf-8" }).stdout?.trim() ||
  crypto.randomUUID();

/** Every route of the app is precached so the whole app works offline after first visit. */
const APP_ROUTES = ["/", "/chords", "/finder", "/settings"];

export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } = createSerwistRoute(
  {
    swSrc: "src/app/sw.ts",
    additionalPrecacheEntries: APP_ROUTES.map((url) => ({ url, revision })),
    useNativeEsbuild: true,
  },
);
