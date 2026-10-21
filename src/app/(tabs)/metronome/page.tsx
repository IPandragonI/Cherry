import type { Metadata } from "next";
import { MetronomeScreen } from "@/components/metronome/MetronomeScreen";

export const metadata: Metadata = { title: "Métronome" };

export default function MetronomePage() {
  return <MetronomeScreen />;
}
