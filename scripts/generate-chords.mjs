// Regenerates the static chord dataset (src/lib/music/chords.json) from the movable
// shape templates in src/lib/music/chordShapes.ts.
import { writeFileSync } from "node:fs";
import { build } from "esbuild";

const { outputFiles } = await build({
  entryPoints: ["src/lib/music/chordShapes.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  write: false,
});
const mod = await import(
  `data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString("base64")}`
);
const library = mod.generateChordLibrary();
writeFileSync("src/lib/music/chords.json", JSON.stringify(library));
const voicings = library.reduce((n, c) => n + c.voicings.length, 0);
console.log(`chords.json: ${library.length} chords, ${voicings} voicings`);
