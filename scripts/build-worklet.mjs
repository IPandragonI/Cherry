// Manual rebuild of the AudioWorklet (next.config.ts also does this on every start).
// Bundles the pitch-detection AudioWorklet (and the shared, unit-tested pitch code it
// imports) into a single classic script that `audioWorklet.addModule()` can load.
import { build } from "esbuild";

for (const [entry, outfile] of [
  ["src/lib/audio/pitch-worklet.ts", "public/worklets/pitch-processor.js"],
  ["src/lib/audio/pitch-worker.ts", "public/worklets/pitch-worker.js"],
]) {
  await build({
    entryPoints: [entry],
    outfile,
    bundle: true,
    format: "iife",
    target: "es2020",
    minify: true,
    logLevel: "info",
  });
}
