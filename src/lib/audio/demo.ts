import { create } from "zustand";

interface DemoState {
  /** Simulated deviation of the played string, in cents. */
  cents: number;
  sweep: boolean;
  setCents: (cents: number) => void;
  setSweep: (sweep: boolean) => void;
}

/** Simulated input for developing and screenshotting the tuner without a microphone. */
export const useDemo = create<DemoState>()((set) => ({
  cents: 6,
  sweep: false,
  setCents: (cents) => set({ cents }),
  setSweep: (sweep) => set({ sweep }),
}));

/** A damped swing that settles in tune, then restarts: like someone turning a peg. */
export function sweepCents(seconds: number): number {
  const t = seconds % 7;
  return 45 * Math.exp(-t / 1.6) * Math.cos((2 * Math.PI * t) / 2.4);
}
