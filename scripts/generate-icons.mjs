// Renders the app icon (SVG) to the PNG sizes required by the web app manifest and iOS.
import { mkdirSync, writeFileSync } from "node:fs";
import sharp from "sharp";

/** Two cherries hanging from a sage stem, on a cherry-red tile. `inset` shrinks the art. */
function icon({ inset = 1, rounded = true } = {}) {
  const art = `
    <g transform="translate(256 256) scale(${inset}) translate(-256 -256)">
      <path d="M262 112c-14 54-56 106-104 150M262 112c10 60 42 108 92 136" fill="none"
        stroke="#b0c4b1" stroke-width="18" stroke-linecap="round"/>
      <path d="M262 112c34-30 84-34 118-14-30 28-78 34-118 14Z" fill="#b0c4b1"/>
      <circle cx="166" cy="322" r="86" fill="#f7e1d7"/>
      <circle cx="354" cy="316" r="86" fill="#edafb8"/>
      <circle cx="136" cy="292" r="20" fill="#ffffff" opacity=".75"/>
      <circle cx="324" cy="286" r="20" fill="#ffffff" opacity=".6"/>
    </g>`;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
    <rect width="512" height="512" rx="${rounded ? 112 : 0}" fill="#a8384c"/>${art}</svg>`);
}

mkdirSync("public/icons", { recursive: true });
const jobs = [
  ["icon-192.png", 192, icon()],
  ["icon-512.png", 512, icon()],
  // Maskable: full-bleed tile, art kept inside the 80% safe zone.
  ["maskable-512.png", 512, icon({ inset: 0.78, rounded: false })],
  ["apple-touch-icon.png", 180, icon({ inset: 0.9, rounded: false })],
];
for (const [name, size, svg] of jobs) {
  await sharp(svg).resize(size, size).png().toFile(`public/icons/${name}`);
}
writeFileSync("public/icons/icon.svg", icon());
console.log("icons written to public/icons");
