import { median } from "@/lib/pitch/tracker";
import { centsBetween } from "./notes";

/** Limits of the calibration correction (cents). */
export const MAX_CALIBRATION = 20;

/**
 * Correction (cents, to add to every reading) from readings taken while a trusted
 * reference A is played — a hardware tuner's tone or a tuning fork, at A4 = 440 Hz, in any
 * octave. Returns null when the readings are too few, not an A, or not steady enough.
 */
export function calibrationFromReadings(frequencies: number[]): number | null {
  if (frequencies.length < 20) return null;
  // Offset of each reading from the nearest A (110, 220, 440, 880 Hz…).
  const offsets = frequencies.map((f) => {
    const cents = centsBetween(f, 440);
    return cents - 1200 * Math.round(cents / 1200);
  });
  const center = median(offsets);
  if (Math.abs(center) > MAX_CALIBRATION) return null;
  const steady = offsets.filter((c) => Math.abs(c - center) <= 3).length / offsets.length;
  if (steady < 0.8) return null;
  return Math.round(-center * 10) / 10;
}

/** A reading with the calibration correction applied. */
export function calibrate(frequency: number, correctionCents: number): number {
  return frequency * 2 ** (correctionCents / 1200);
}
