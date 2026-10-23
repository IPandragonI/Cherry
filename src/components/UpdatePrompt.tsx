"use client";

import { useEffect, useState } from "react";
import { useSerwist } from "@serwist/turbopack/react";
import { useT } from "@/lib/i18n/useT";

/**
 * A new version was deployed: its service worker waits instead of taking over the open
 * page (the page's code chunks would no longer be cached), and the user chooses when to
 * reload into it.
 */
export function UpdatePrompt() {
  const t = useT();
  const { serwist } = useSerwist();
  const [waiting, setWaiting] = useState(false);

  useEffect(() => {
    if (!serwist) return;
    const onWaiting = () => setWaiting(true);
    serwist.addEventListener("waiting", onWaiting);
    return () => serwist.removeEventListener("waiting", onWaiting);
  }, [serwist]);

  if (!waiting || !serwist) return null;

  const update = () => {
    // Reload once the new worker controls the page.
    serwist.addEventListener("controlling", () => window.location.reload());
    serwist.messageSkipWaiting();
  };

  return (
    <div
      role="status"
      className="fixed inset-x-4 z-40 mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-neutral px-4 py-3 text-sm text-neutral-content shadow-lg"
      style={{ bottom: "calc(96px + env(safe-area-inset-bottom))" }}
    >
      <span className="flex-1">{t("update.available")}</span>
      <button type="button" className="btn min-h-10 btn-primary btn-sm" onClick={update}>
        {t("update.reload")}
      </button>
    </div>
  );
}
