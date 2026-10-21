import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Fret } from "@/lib/music/recognize";

/** A fingering saved from the chord finder. */
export interface SavedShape {
  id: string;
  name: string;
  frets: Fret[];
  tuningId: string;
}

interface FavoritesState {
  chordIds: string[];
  shapes: SavedShape[];
  toggleChord: (id: string) => void;
  saveShape: (shape: Omit<SavedShape, "id">) => void;
  removeShape: (id: string) => void;
}

export const useFavorites = create<FavoritesState>()(
  persist(
    (set) => ({
      chordIds: [],
      shapes: [],
      toggleChord: (id) =>
        set(({ chordIds }) => ({
          chordIds: chordIds.includes(id) ? chordIds.filter((c) => c !== id) : [...chordIds, id],
        })),
      saveShape: (shape) =>
        set(({ shapes }) => {
          const key = `${shape.tuningId}:${shape.frets.join(",")}`;
          if (shapes.some((s) => `${s.tuningId}:${s.frets.join(",")}` === key)) return {};
          return { shapes: [...shapes, { ...shape, id: crypto.randomUUID() }] };
        }),
      removeShape: (id) => set(({ shapes }) => ({ shapes: shapes.filter((s) => s.id !== id) })),
    }),
    {
      name: "cherry-favorites",
      version: 1,
      skipHydration: true,
      partialize: ({ chordIds, shapes }) => ({ chordIds, shapes }),
    },
  ),
);
