"use client";

import { useSyncExternalStore } from "react";
import { useSettings } from "./settings";

const subscribe = (onChange: () => void) => useSettings.persist.onFinishHydration(onChange);

/** True once the persisted settings have been loaded (always false during SSR). */
export function useSettingsHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => useSettings.persist.hasHydrated(),
    () => false,
  );
}
