import type { Metadata } from "next";
import { ChordLibrary } from "@/components/chords/ChordLibrary";

export const metadata: Metadata = { title: "Accords" };

export default function ChordsPage() {
  return <ChordLibrary />;
}
