/** The frequency band the analysis listens in, from the notes it is meant to hear. */
export interface AnalysisRange {
  /** Lowest fundamental searched for, Hz. */
  minFrequency: number;
  /** Highest fundamental searched for, Hz. */
  maxFrequency: number;
  /** High-pass filter corner (rumble, handling noise), Hz. */
  highpassHz: number;
}

/** A guitar in any common tuning, down to a drop C (and chromatic use in that band). */
export const DEFAULT_RANGE: AnalysisRange = {
  minFrequency: 55,
  maxFrequency: 1200,
  highpassHz: 50,
};

/** Lowest note the analysis can follow (a 5-string bass's low B is 30.9 Hz). */
export const MIN_DETECTABLE_HZ = 30;
/**
 * Above this, fewer than three partials fit under the spectral search limit (1.6 kHz), so
 * a reading needs a very clean signal; the tuning editor warns about such notes.
 */
export const RELIABLE_MAX_HZ = 530;

/**
 * Band for a set of target frequencies: the guitar band, widened downwards for lower notes
 * (basses, 8-strings) with room for a string tuned well flat, and upwards for higher ones.
 */
export function rangeFor(frequencies: number[]): AnalysisRange {
  if (frequencies.length === 0) return DEFAULT_RANGE;
  const lowest = Math.min(...frequencies);
  const highest = Math.max(...frequencies);
  const minFrequency = Math.max(
    MIN_DETECTABLE_HZ * 0.9,
    Math.min(DEFAULT_RANGE.minFrequency, lowest * 0.8),
  );
  return {
    minFrequency: Math.round(minFrequency),
    maxFrequency: Math.round(Math.max(DEFAULT_RANGE.maxFrequency, highest * 1.25)),
    // Below the guitar band, keep a bass's fundamental: the corner moves well under it.
    highpassHz:
      minFrequency < DEFAULT_RANGE.minFrequency
        ? Math.round(minFrequency * 0.7)
        : DEFAULT_RANGE.highpassHz,
  };
}
