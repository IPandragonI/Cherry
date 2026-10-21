// Derives every app icon and the splash logo from the source logo at the project root
// (new.png: 1254×1254, guitar pick on a cream rounded tile, no alpha).
import { mkdirSync } from "node:fs";
import sharp from "sharp";

const SOURCE = "new.png";
const TILE = "#fdf5ed"; // the logo's cream tile colour
const MARGIN = 100; // crops away the white corners outside the rounded tile

const meta = await sharp(SOURCE).metadata();
const side = meta.width - MARGIN * 2;
const tile = await sharp(SOURCE)
  .extract({ left: MARGIN, top: MARGIN, width: side, height: side })
  .png()
  .toBuffer();

/** Full-bleed square tile, optionally shrunk onto padding (maskable safe zone). */
async function square(size, scale = 1) {
  const inner = Math.round(size * scale);
  const art = await sharp(tile).resize(inner, inner).toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: TILE } })
    .composite([{ input: art, gravity: "center" }])
    .png();
}

/** Rounded tile with transparent corners, like the original artwork. */
async function rounded(size) {
  const r = Math.round(size * 0.22);
  const mask = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${r}" fill="#fff"/></svg>`,
  );
  return sharp(tile)
    .resize(size, size)
    .composite([{ input: mask, blend: "dest-in" }])
    .png({ compressionLevel: 9 });
}

mkdirSync("public/icons", { recursive: true });
await (await rounded(192)).toFile("public/icons/icon-192.png");
await (await rounded(512)).toFile("public/icons/icon-512.png");
await (await rounded(48)).toFile("public/icons/favicon-48.png");
// Maskable: the OS crops to its own shape, so the pick must sit inside the 80% safe zone.
await (await square(512, 0.72)).toFile("public/icons/maskable-512.png");
// iOS rounds the corners itself and dislikes transparency.
await (await square(180)).toFile("public/icons/apple-touch-icon.png");
// Splash screen logo (2× for a 160 px display size).
await (await rounded(320)).webp({ quality: 90 }).toFile("public/logo.webp");
console.log("icons and splash logo written from", SOURCE);
