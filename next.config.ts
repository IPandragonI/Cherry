import type { NextConfig } from "next";
import { execSync } from "node:child_process";
import { buildSync } from "esbuild";
import pkg from "./package.json" with { type: "json" };
import { withSerwist } from "@serwist/turbopack";

// Bundle the audio thread (AudioWorklet: forwards samples) and the analysis worker (the
// pitch detection, with the shared, unit-tested code it imports) into the classic scripts
// `audioWorklet.addModule()` and `new Worker()` load. Doing it here keeps them fresh however
// Next is started (`pnpm dev`, `next dev` from an IDE, `next build` on Vercel…).
for (const [entry, out] of [
  ["src/lib/audio/pitch-worklet.ts", "public/worklets/pitch-processor.js"],
  ["src/lib/audio/pitch-worker.ts", "public/worklets/pitch-worker.js"],
]) {
  buildSync({
    entryPoints: [entry],
    outfile: out,
    bundle: true,
    format: "iife",
    target: "es2020",
    minify: true,
    logLevel: "warning",
  });
}

function commit(): string {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA;
  if (sha) return sha.slice(0, 7);
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf-8" }).trim();
  } catch {
    return "local";
  }
}

const nextConfig: NextConfig = {
  // Shown on the credits page.
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version,
    NEXT_PUBLIC_BUILD_COMMIT: commit(),
    NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default withSerwist(nextConfig);
