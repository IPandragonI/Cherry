"use client";

import { useEffect, useState } from "react";
import { tunerEngine } from "@/lib/audio/engine";
import { useT } from "@/lib/i18n/useT";
import { MAX_CALIBRATION, calibrationFromReadings } from "@/lib/music/calibration";
import { useSettings } from "@/store/settings";

/** How long a steady reference must be heard (after the first reading). */
const LISTEN_MS = 4000;
/** Give up if no reference is heard at all within this time. */
const TIMEOUT_MS = 12000;

type Phase = "idle" | "listening" | "done" | "failed";

function format(cents: number): string {
  const r = Math.round(cents * 10) / 10;
  return `${r > 0 ? "+" : r < 0 ? "−" : "±"}${Math.abs(r).toFixed(1)}`;
}

/**
 * Fine calibration against a trusted reference (a hardware tuner's A440 tone, a tuning
 * fork): the app listens to the A and stores the correction that makes it read 0 cents,
 * which removes device-level offsets (microphone, clock). Also adjustable by hand.
 */
export function Calibration() {
  const t = useT();
  const calibration = useSettings((s) => s.calibration);
  const set = useSettings((s) => s.set);
  const [phase, setPhase] = useState<Phase>("idle");

  useEffect(() => {
    if (phase !== "listening") return;
    const readings: number[] = [];
    let firstAt = 0;
    const started = performance.now();
    void tunerEngine.start();
    const unsubscribe = tunerEngine.subscribe(() => {
      const { frequency } = tunerEngine.getSnapshot();
      if (frequency === null) return;
      firstAt ||= performance.now();
      readings.push(frequency);
    });
    const timer = setInterval(() => {
      const now = performance.now();
      if (firstAt && now - firstAt >= LISTEN_MS) {
        const correction = calibrationFromReadings(readings);
        if (correction === null) {
          setPhase("failed");
        } else {
          set({ calibration: correction });
          setPhase("done");
        }
      } else if (!firstAt && now - started > TIMEOUT_MS) {
        setPhase("failed");
      }
    }, 200);
    return () => {
      clearInterval(timer);
      unsubscribe();
      tunerEngine.stop();
    };
  }, [phase, set]);

  const nudge = (delta: number) =>
    set({
      calibration:
        Math.round(
          Math.max(-MAX_CALIBRATION, Math.min(MAX_CALIBRATION, calibration + delta)) * 10,
        ) / 10,
    });

  return (
    <section className="rounded-box bg-base-200 px-4 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-medium">{t("calibration.title")}</h2>
        <span
          className={`font-display text-2xl font-semibold tabular-nums ${
            calibration === 0 ? "text-primary" : "text-warning"
          }`}
        >
          {format(calibration)} c
        </span>
      </div>
      <p className="mt-1 text-xs text-base-content/75">{t("calibration.help")}</p>

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          className="btn btn-circle size-11 bg-base-100 btn-ghost"
          aria-label={`${t("calibration.title")} −0,5 c`}
          disabled={phase === "listening" || calibration <= -MAX_CALIBRATION}
          onClick={() => nudge(-0.5)}
        >
          −
        </button>
        <button
          type="button"
          className="btn min-h-11 flex-1 rounded-full btn-primary"
          disabled={phase === "listening"}
          onClick={() => setPhase("listening")}
        >
          {t(phase === "listening" ? "calibration.listening" : "calibration.start")}
        </button>
        <button
          type="button"
          className="btn btn-circle size-11 bg-base-100 btn-ghost"
          aria-label={`${t("calibration.title")} +0,5 c`}
          disabled={phase === "listening" || calibration >= MAX_CALIBRATION}
          onClick={() => nudge(0.5)}
        >
          +
        </button>
      </div>

      <div className="mt-2 flex min-h-11 items-center justify-between gap-2" aria-live="polite">
        <p className={`text-sm ${phase === "failed" ? "text-error" : "text-base-content/75"}`}>
          {phase === "done" && t("calibration.done", { cents: format(calibration) })}
          {phase === "failed" && t("calibration.failed")}
        </p>
        {calibration !== 0 && phase !== "listening" && (
          <button
            type="button"
            className="btn min-h-11 shrink-0 btn-link px-0 btn-sm"
            onClick={() => {
              set({ calibration: 0 });
              setPhase("idle");
            }}
          >
            {t("common.reset")}
          </button>
        )}
      </div>
    </section>
  );
}
