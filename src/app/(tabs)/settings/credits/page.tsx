import type { Metadata } from "next";
import { CreditsScreen } from "@/components/settings/CreditsScreen";

export const metadata: Metadata = { title: "Crédits" };

export default function CreditsPage() {
  return <CreditsScreen />;
}
