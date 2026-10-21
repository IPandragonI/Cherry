import { centsBetween } from "@/lib/music/notes";

/** How long the last reading stays on screen once the note is no longer heard. */
export const HOLD_MS = 4000;
/** Changes smaller than this (cents) are not shown: the gauge stays still. */
export const DEADBAND_CENTS = 1;

/**
 * What the gauge shows, from the analyser's readings: the last value is held for a few
 * seconds after the note stops being heard (time to read it, or to reach for the peg),
 * and sub-cent movements are ignored so a steady note gives a perfectly still gauge.
 */
export class ReadingHold {
  private shown: number | null = null;
  private heardAt = 0;

  constructor(
    private readonly holdMs = HOLD_MS,
    private readonly deadbandCents = DEADBAND_CENTS,
  ) {}

  update(frequency: number | null, now: number): number | null {
    if (frequency !== null) {
      this.heardAt = now;
      if (
        this.shown === null ||
        Math.abs(centsBetween(frequency, this.shown)) >= this.deadbandCents
      ) {
        this.shown = frequency;
      }
    } else if (this.shown !== null && now - this.heardAt > this.holdMs) {
      this.shown = null;
    }
    return this.shown;
  }

  reset(): void {
    this.shown = null;
  }
}
