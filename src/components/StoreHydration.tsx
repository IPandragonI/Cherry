"use client";

import { useEffect } from "react";
import { useFavorites } from "@/store/favorites";
import { SETTINGS_STORAGE_KEY, useSettings } from "@/store/settings";
import { useCustomTunings } from "@/store/tunings";

// (The persist API only exists in the browser: keys are spelled out, not read from it.)
const STORES = [
  { key: SETTINGS_STORAGE_KEY, store: useSettings },
  { key: "cherry-tunings", store: useCustomTunings },
  { key: "cherry-favorites", store: useFavorites },
];

/**
 * Persisted stores skip automatic hydration so the server render and the first client
 * render agree; they are loaded from localStorage right after mount, and again whenever
 * another tab of the app changes them (the settings stay the same in every tab).
 */
export function StoreHydration() {
  useEffect(() => {
    for (const { store } of STORES) void store.persist.rehydrate();
    const onStorage = (event: StorageEvent) => {
      const changed = STORES.find(({ key }) => key === event.key);
      if (changed) void changed.store.persist.rehydrate();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  return null;
}
