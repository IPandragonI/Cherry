import type { Metadata } from "next";
import { ChordFinder } from "@/components/finder/ChordFinder";

export const metadata: Metadata = { title: "Trouveur" };

export default function FinderPage() {
  return <ChordFinder />;
}
