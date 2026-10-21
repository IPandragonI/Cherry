"use client";

import { useState, useSyncExternalStore } from "react";
import {
  centsBetween,
  midiToFrequency,
  noteName,
  octaveOf,
  solfegeName,
  type NoteName,
} from "@/lib/music/notes";
import { closestString, findTuning, type Tuning } from "@/lib/music/tunings";
import { useSettings, type TunerMode } from "@/store/settings";
import { useCustomTunings } from "@/store/tunings";
import { useDemo } from "./demo";
import { tunerEngine, type MicStatus } from "./engine";

export const IN_TUNE_CENTS = 3;
const SLIGHT_CENTS = 15;

export type TuneStatus =
  "noSignal" | "inTune" | "slightlyFlat" | "flat" | "slightlySharp" | "sharp";

export interface TunerState {
  tuning: Tuning;
  mode: TunerMode;
  demo: boolean;
  mic: MicStatus;
  /** Index of the string being tuned (0 = lowest), null before anything was heard in auto. */
  targetString: number | null;
  /** Target string's note. */
  note: NoteName | null;
  octave: number | null;
  solfege: string | null;
  targetFrequency: number | null;
  /** Detected frequency in Hz. */
  frequency: number | null;
  /** Deviation from the target string, unclamped. */
  cents: number | null;
  status: TuneStatus;
}

export function tuneStatus(cents: number | null): TuneStatus {
  if (cents === null) return "noSignal";
  if (Math.abs(cents) <= IN_TUNE_CENTS) return "inTune";
  if (cents < 0) return cents >= -SLIGHT_CENTS ? "slightlyFlat" : "flat";
  return cents <= SLIGHT_CENTS ? "slightlySharp" : "sharp";
}

/** Single source of truth for the tuner UI: microphone (or demo) input + settings. */
export function useTuner(): TunerState {
  const { tuningId, a4, mode, demo } = useSettings();
  const selected = useSettings((s) => s.selectedString);
  const custom = useCustomTunings((s) => s.custom);
  const demoCents = useDemo((s) => s.cents);
  const engine = useSyncExternalStore(
    tunerEngine.subscribe,
    tunerEngine.getSnapshot,
    tunerEngine.getServerSnapshot,
  );

  const tuning = findTuning(tuningId, custom);
  const strings = tuning.strings;
  const selectedString = Math.min(selected, strings.length - 1);

  const frequency = demo
    ? midiToFrequency(strings[selectedString], a4) * 2 ** (demoCents / 1200)
    : engine.frequency;

  let detected: number | null = null;
  let cents: number | null = null;
  if (frequency !== null) {
    if (mode === "manual") {
      detected = selectedString;
      cents = centsBetween(frequency, midiToFrequency(strings[selectedString], a4));
    } else {
      const match = closestString(frequency, strings, a4);
      detected = match.index;
      cents = match.cents;
    }
  }

  // Auto mode keeps pointing at the last detected string between notes.
  const [lastDetected, setLastDetected] = useState<number | null>(null);
  if (detected !== null && detected !== lastDetected) setLastDetected(detected);

  const remembered = lastDetected !== null && lastDetected < strings.length ? lastDetected : null;
  const targetString = mode === "manual" ? selectedString : (detected ?? remembered);
  const midi = targetString === null ? null : strings[targetString];

  return {
    tuning,
    mode,
    demo,
    mic: engine.status,
    targetString,
    note: midi === null ? null : noteName(midi),
    octave: midi === null ? null : octaveOf(midi),
    solfege: midi === null ? null : solfegeName(midi),
    targetFrequency: midi === null ? null : midiToFrequency(midi, a4),
    frequency,
    cents,
    status: tuneStatus(cents),
  };
}
