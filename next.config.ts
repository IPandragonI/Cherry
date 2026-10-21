import type { NextConfig } from "next";
import { buildSync } from "esbuild";
import { withSerwist } from "@serwist/turbopack";

// Bundle the pitch-detection AudioWorklet (plus the shared, unit-tested pitch code it
// imports) into the single classic script `audioWorklet.addModule()` loads. Doing it here
// means it is always fresh, however Next is started (`pnpm dev`, `next dev` from an IDE,
// `next build` on Vercel…). It takes a few tens of milliseconds.
buildSync({
  entryPoints: ["src/lib/audio/pitch-worklet.ts"],
  outfile: "public/worklets/pitch-processor.js",
  bundle: true,
  format: "iife",
  target: "es2020",
  minify: true,
  logLevel: "warning",
});

const nextConfig: NextConfig = {
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
