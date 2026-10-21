"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

/** Minimum time the splash stays up after navigation start, so it never just flickers. */
const MIN_VISIBLE_MS = 450;
const FADE_MS = 450;

/**
 * Startup splash: server-rendered so it shows on the very first paint, then fades out
 * once the app has hydrated and fonts are ready. It lives in the root layout, so it only
 * appears when the app starts, not on tab changes.
 */
export function Splash() {
  const [phase, setPhase] = useState<"visible" | "fading" | "gone">("visible");

  useEffect(() => {
    let cancelled = false;
    const minDelay = new Promise((resolve) =>
      setTimeout(resolve, Math.max(0, MIN_VISIBLE_MS - performance.now())),
    );
    void Promise.all([document.fonts?.ready, minDelay]).then(() => {
      if (cancelled) return;
      setPhase("fading");
      // Unmount after the fade (also covers reduced motion, where no transition runs).
      setTimeout(() => !cancelled && setPhase("gone"), FADE_MS + 50);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (phase === "gone") return null;

  return (
    <div className="splash" data-phase={phase} aria-hidden="true">
      <Image
        src="/logo.webp"
        alt=""
        width={160}
        height={160}
        priority
        unoptimized
        className="splash-logo"
      />
      <p className="mt-5 font-display text-3xl font-semibold text-primary">Cherry</p>
    </div>
  );
}
