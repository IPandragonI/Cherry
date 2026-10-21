"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { create } from "zustand";
import {
  centsBetween,
  clampCents,
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

/** Tolerant on purpose: a guitar string within this reads in tune. */
export const IN_TUNE_CENTS = 8;
/** Once in tune, the string stays "in tune" until it drifts past this (no flicker at ±8). */
export const LEAVE_IN_TUNE_CENTS = 10;
/** Precise mode: in tune within ±3 cents, left beyond ±5. */
export const PRECISE_IN_TUNE_CENTS = 3;
export const PRECISE_LEAVE_IN_TUNE_CENTS = 5;
/** Default (relaxed) display: one unit per 10 cents, like popular tuner apps. */
const RELAXED_CENTS_PER_UNIT = 10;
const SLIGHT_CENTS = 15;

export type TuneStatus =
  "noSignal" | "inTune" | "slightlyFlat" | "flat" | "slightlySharp" | "sharp";

export interface TunerState {
  tuning: Tuning;
  mode: TunerMode;
  demo: boolean;
  mic: MicStatus;
  /** Microphone input level (0 when not listening). */
  level: number;
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

/**
 * Last string heard in auto mode. Kept outside the component so the string pills keep
 * their selection when the user switches tabs and comes back (no reset/flicker).
 */
const useLastDetected = create<{ index: number | null }>()(() => ({ index: null }));

/** `wasInTune` widens the in-tune window (hysteresis) so the state doesn't flicker. */
export function tuneStatus(cents: number | null, wasInTune = false, precise = false): TuneStatus {
  if (cents === null) return "noSignal";
  const window = precise
    ? wasInTune
      ? PRECISE_LEAVE_IN_TUNE_CENTS
      : PRECISE_IN_TUNE_CENTS
    : wasInTune
      ? LEAVE_IN_TUNE_CENTS
      : IN_TUNE_CENTS;
  if (Math.abs(cents) <= window) return "inTune";
  if (cents < 0) return cents >= -SLIGHT_CENTS ? "slightlyFlat" : "flat";
  return cents <= SLIGHT_CENTS ? "slightlySharp" : "sharp";
}

/** Largest number the gauge shows, either way (beyond, it stays at ±100). */
export const MAX_DISPLAY = 100;
/** Relaxed scale: how quickly the marker leaves the centre (smaller = sooner). */
const RELAXED_SPREAD = 1.5;

/**
 * The number shown for a deviation: cents in precise mode, otherwise tenths of the cents
 * (−10 cents shows −1), rounded symmetrically, up to ±100.
 */
export function displayDeviation(cents: number, precise: boolean): number {
  const value = precise ? cents : cents / RELAXED_CENTS_PER_UNIT;
  const rounded = Math.sign(value) * Math.min(MAX_DISPLAY, Math.round(Math.abs(value)));
  return rounded === 0 ? 0 : rounded;
}

/**
 * Where the marker sits on the gauge, on a ±50 scale. Precise mode: the real deviation in
 * cents. Otherwise a smooth logarithmic scale over the whole −100…+100 range, compressed
 * around the centre like popular tuner apps: −1 sits 4 % of the way to the edge, −5
 * (50 cents) 30 %, −20 62 %, −100 at the edge.
 */
export function gaugePosition(cents: number, precise: boolean): number {
  if (precise) return clampCents(cents);
  const units = Math.min(MAX_DISPLAY, Math.abs(cents) / RELAXED_CENTS_PER_UNIT);
  const curve = (u: number) => Math.log1p((u / RELAXED_SPREAD) ** 2);
  return Math.sign(cents) * 50 * (curve(units) / curve(MAX_DISPLAY));
}

/** Single source of truth for the tuner UI: microphone (or demo) input + settings. */
export function useTuner(): TunerState {
  const { tuningId, a4, mode, demo, precise } = useSettings();
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

  // Auto mode keeps pointing at the last detected string between notes (and across tabs).
  const lastDetected = useLastDetected((s) => s.index);
  useEffect(() => {
    if (detected !== null) useLastDetected.setState({ index: detected });
  }, [detected]);

  const remembered = lastDetected !== null && lastDetected < strings.length ? lastDetected : null;
  const targetString = mode === "manual" ? selectedString : (detected ?? remembered);
  const midi = targetString === null ? null : strings[targetString];

  const [wasInTune, setWasInTune] = useState(false);
  const status = tuneStatus(cents, wasInTune, precise);
  if ((status === "inTune") !== wasInTune) setWasInTune(status === "inTune");

  return {
    tuning,
    mode,
    demo,
    mic: engine.status,
    level: engine.level,
    targetString,
    note: midi === null ? null : noteName(midi),
    octave: midi === null ? null : octaveOf(midi),
    solfege: midi === null ? null : solfegeName(midi),
    targetFrequency: midi === null ? null : midiToFrequency(midi, a4),
    frequency,
    cents,
    status,
  };
}
