import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { HeadstockId } from "@/components/tuner/headstocks";
import { DEFAULT_A4, MAX_A4, MIN_A4 } from "@/lib/music/notes";

export type ThemePref = "system" | "light" | "dark";
export type LocalePref = "auto" | "fr" | "en";
export type NeckSkin = "maple" | "rosewood" | "ebony";
export type TunerMode = "auto" | "manual";

export const NECK_SKINS: NeckSkin[] = ["maple", "rosewood", "ebony"];

/** Also read by the pre-hydration theme script in the root layout. */
export const SETTINGS_STORAGE_KEY = "cherry-settings";

export interface Settings {
  theme: ThemePref;
  locale: LocalePref;
  a4: number;
  skin: NeckSkin;
  headstock: HeadstockId;
  tuningId: string;
  mode: TunerMode;
  /** String index (0 = lowest) used in manual mode and by the demo. */
  selectedString: number;
  refTone: boolean;
  haptics: boolean;
  demo: boolean;
}

interface SettingsActions {
  set: (patch: Partial<Settings>) => void;
  setA4: (a4: number) => void;
  /** Tapping a string pill switches to manual mode on that string. */
  selectString: (index: number) => void;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: "system",
  locale: "auto",
  a4: DEFAULT_A4,
  skin: "maple",
  headstock: "jazz",
  tuningId: "standard",
  mode: "auto",
  selectedString: 0,
  refTone: true,
  haptics: true,
  demo: false,
};

export const useSettings = create<Settings & SettingsActions>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      set: (patch) => set(patch),
      setA4: (a4) => set({ a4: Math.round(Math.min(MAX_A4, Math.max(MIN_A4, a4))) }),
      selectString: (index) => set({ selectedString: index, mode: "manual" }),
    }),
    {
      name: SETTINGS_STORAGE_KEY,
      version: 1,
      // Rehydrated after mount by <StoreHydration /> so SSR and first render match.
      skipHydration: true,
      partialize: (s): Settings => ({
        theme: s.theme,
        locale: s.locale,
        a4: s.a4,
        skin: s.skin,
        headstock: s.headstock,
        tuningId: s.tuningId,
        mode: s.mode,
        selectedString: s.selectedString,
        refTone: s.refTone,
        haptics: s.haptics,
        demo: s.demo,
      }),
    },
  ),
);
