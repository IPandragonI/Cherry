import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Tuning } from "@/lib/music/tunings";

interface TuningsState {
  custom: Tuning[];
  /** Adds or replaces (by id) a custom tuning. */
  save: (tuning: Tuning) => void;
  remove: (id: string) => void;
}

export const useCustomTunings = create<TuningsState>()(
  persist(
    (set) => ({
      custom: [],
      save: (tuning) =>
        set(({ custom }) => {
          const next = { ...tuning, custom: true };
          const exists = custom.some((t) => t.id === tuning.id);
          return {
            custom: exists ? custom.map((t) => (t.id === tuning.id ? next : t)) : [...custom, next],
          };
        }),
      remove: (id) => set(({ custom }) => ({ custom: custom.filter((t) => t.id !== id) })),
    }),
    {
      name: "cherry-tunings",
      version: 1,
      skipHydration: true,
      partialize: ({ custom }) => ({ custom }),
    },
  ),
);
