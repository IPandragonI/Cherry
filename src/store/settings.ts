import { create } from "zustand";
import { persist } from "zustand/middleware";
import { HEADSTOCK_IDS, type HeadstockId } from "@/components/tuner/headstocks";
import { DEFAULT_A4, MAX_A4, MIN_A4 } from "@/lib/music/notes";

export type ThemePref = "system" | "light" | "dark";
export type LocalePref = "auto" | "fr" | "en";
export type NeckSkin = "maple" | "rosewood" | "ebony";
/** Auto: the closest string; manual: the chosen string; chromatic: the closest note. */
export type TunerMode = "auto" | "manual" | "chromatic";
/** Note names: letters (C D E), solfège (Do Ré Mi), or follow the interface language. */
export type NotationPref = "auto" | "letters" | "solfege";
/** Gauge: a marker gliding over a scale, or a strobe band drifting at the deviation's speed. */
export type GaugeStyle = "needle" | "strobe";
export type MetronomeSoundPref = "click" | "mechanical" | "beep" | "woodblock" | "rimshot" | "kick";

export const MIN_BPM = 30;
export const MAX_BPM = 250;
export const MIN_INPUT_GAIN = 0.25;
export const MAX_INPUT_GAIN = 8;

export const NECK_SKINS: NeckSkin[] = ["maple", "rosewood", "ebony"];
export const TUNER_MODES: TunerMode[] = ["auto", "manual", "chromatic"];

/** Also read by the pre-hydration theme script in the root layout. */
export const SETTINGS_STORAGE_KEY = "cherry-settings";

export interface Settings {
  theme: ThemePref;
  locale: LocalePref;
  /** Reference pitch, Hz, to a tenth. */
  a4: number;
  skin: NeckSkin;
  headstock: HeadstockId;
  tuningId: string;
  mode: TunerMode;
  /** String index (0 = lowest) used in manual mode and by the demo. */
  selectedString: number;
  refTone: boolean;
  haptics: boolean;
  /** A soft chime each time a string reaches in tune. */
  tuneChime: boolean;
  demo: boolean;
  notation: NotationPref;
  /** Mirrors the headstock and the string indicators for left-handed players. */
  leftHanded: boolean;
  /** Show the deviation to the cent, with a strict in-tune window (else a relaxed scale). */
  precise: boolean;
  gaugeStyle: GaugeStyle;
  /** Microphone to listen to ("" = the system default). */
  inputDeviceId: string;
  /** Input gain (sensitivity) applied before the analysis. */
  inputGain: number;
  /** The microphone explanation was shown (before the browser's permission prompt). */
  micIntroSeen: boolean;
  bpm: number;
  /** Beats per bar (the first one is accented). */
  beatsPerBar: number;
  metronomeSound: MetronomeSoundPref;
}

interface SettingsActions {
  set: (patch: Partial<Settings>) => void;
  setA4: (a4: number) => void;
  setBpm: (bpm: number) => void;
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
  tuneChime: true,
  demo: false,
  notation: "letters",
  leftHanded: false,
  precise: false,
  gaugeStyle: "needle",
  inputDeviceId: "",
  inputGain: 1,
  micIntroSeen: false,
  bpm: 90,
  beatsPerBar: 4,
  metronomeSound: "click",
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const roundA4 = (a4: number) => Math.round(clamp(a4, MIN_A4, MAX_A4) * 10) / 10;

/**
 * Saved settings as they come out of storage (an older version, another tab, a hand-edited
 * value): anything of the wrong type or out of range falls back on its default, so a bad
 * value can never break the tuner (e.g. a NaN reference pitch).
 */
export function sanitizeSettings(saved: unknown): Settings {
  const s = (saved && typeof saved === "object" ? saved : {}) as Record<string, unknown>;
  const d = DEFAULT_SETTINGS;
  const oneOf = <T>(value: unknown, options: readonly T[], fallback: T): T =>
    options.includes(value as T) ? (value as T) : fallback;
  const bool = (value: unknown, fallback: boolean) =>
    typeof value === "boolean" ? value : fallback;
  const num = (value: unknown, fallback: number, min: number, max: number) =>
    typeof value === "number" && Number.isFinite(value) ? clamp(value, min, max) : fallback;
  const str = (value: unknown, fallback: string) => (typeof value === "string" ? value : fallback);
  return {
    theme: oneOf(s.theme, ["system", "light", "dark"] as const, d.theme),
    locale: oneOf(s.locale, ["auto", "fr", "en"] as const, d.locale),
    a4: roundA4(num(s.a4, d.a4, MIN_A4, MAX_A4)),
    skin: oneOf(s.skin, NECK_SKINS, d.skin),
    headstock: oneOf(s.headstock, HEADSTOCK_IDS, d.headstock),
    tuningId: str(s.tuningId, d.tuningId) || d.tuningId,
    mode: oneOf(s.mode, TUNER_MODES, d.mode),
    selectedString: Math.round(num(s.selectedString, d.selectedString, 0, 11)),
    refTone: bool(s.refTone, d.refTone),
    haptics: bool(s.haptics, d.haptics),
    tuneChime: bool(s.tuneChime, d.tuneChime),
    demo: bool(s.demo, d.demo),
    notation: oneOf(s.notation, ["auto", "letters", "solfege"] as const, d.notation),
    leftHanded: bool(s.leftHanded, d.leftHanded),
    precise: bool(s.precise, d.precise),
    gaugeStyle: oneOf(s.gaugeStyle, ["needle", "strobe"] as const, d.gaugeStyle),
    inputDeviceId: str(s.inputDeviceId, d.inputDeviceId),
    inputGain: num(s.inputGain, d.inputGain, MIN_INPUT_GAIN, MAX_INPUT_GAIN),
    micIntroSeen: bool(s.micIntroSeen, d.micIntroSeen),
    bpm: Math.round(num(s.bpm, d.bpm, MIN_BPM, MAX_BPM)),
    beatsPerBar: Math.round(num(s.beatsPerBar, d.beatsPerBar, 1, 12)),
    metronomeSound: oneOf(
      s.metronomeSound,
      ["click", "mechanical", "beep", "woodblock", "rimshot", "kick"] as const,
      d.metronomeSound,
    ),
  };
}

export const useSettings = create<Settings & SettingsActions>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      set: (patch) => set(patch),
      setA4: (a4) => set({ a4: roundA4(a4) }),
      setBpm: (bpm) => set({ bpm: Math.round(clamp(bpm, MIN_BPM, MAX_BPM)) }),
      selectString: (index) => set({ selectedString: index, mode: "manual" }),
    }),
    {
      name: SETTINGS_STORAGE_KEY,
      version: 4,
      // v2: letters became the default notation. "auto" was the old default, never an
      // explicit choice, so it moves to letters; an explicit "solfege" is kept.
      // v3: the calibration setting was removed; a stored correction must not linger.
      // v4: new settings; their defaults come from sanitizeSettings.
      migrate: (persisted, version) => {
        const state = persisted as Partial<Settings>;
        if (version < 2 && (state.notation === undefined || state.notation === "auto")) {
          state.notation = "letters";
        }
        if (version < 3) delete (state as { calibration?: number }).calibration;
        return state as Settings & SettingsActions;
      },
      merge: (persisted, current) => ({ ...current, ...sanitizeSettings(persisted) }),
      // Rehydrated after mount by <StoreHydration /> so SSR and first render match.
      skipHydration: true,
      partialize: (s): Settings => sanitizeSettings(s),
    },
  ),
);
