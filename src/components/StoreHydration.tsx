"use client";

import { useEffect } from "react";
import { useFavorites } from "@/store/favorites";
import { useSettings } from "@/store/settings";
import { useCustomTunings } from "@/store/tunings";

/**
 * Persisted stores skip automatic hydration so the server render and the first client
 * render agree; they are loaded from localStorage right after mount.
 */
export function StoreHydration() {
  useEffect(() => {
    void useSettings.persist.rehydrate();
    void useCustomTunings.persist.rehydrate();
    void useFavorites.persist.rehydrate();
  }, []);
  return null;
}
