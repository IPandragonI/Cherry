import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    // One manifest serves both languages: the name is the brand, the description bilingual.
    name: "Cherry",
    short_name: "Cherry",
    description:
      "Accordeur, accords et métronome, hors ligne · Tuner, chords and metronome, offline.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fdf5ed",
    theme_color: "#fcf6f2",
    categories: ["music", "utilities"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
