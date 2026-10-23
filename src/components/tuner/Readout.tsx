"use client";

import { useNotation, useNumberFormat, useT } from "@/lib/i18n/useT";
import type { TunerState } from "@/lib/audio/useTuner";
import { displayNote } from "@/lib/music/notes";

type ReadoutProps = Pick<
  TunerState,
  "note" | "octave" | "solfege" | "frequency" | "targetFrequency" | "status"
>;

export function Readout({
  note,
  octave,
  solfege,
  frequency,
  targetFrequency,
  status,
}: ReadoutProps) {
  const t = useT();
  const notation = useNotation();
  const hz = useNumberFormat(1);
  const inTune = status === "inTune";
  const shownFrequency = frequency ?? targetFrequency;
  const letter = note && displayNote(note);
  // Big name in the chosen notation; the other convention (with octave) as a reminder.
  const main = notation === "solfege" ? solfege : letter;
  const other = notation === "solfege" ? letter && `${letter}${octave}` : solfege;

  const statusText = inTune
    ? t("tuner.inTune")
    : t(status === "noSignal" ? "tuner.noSignal" : `tuner.${status}`);

  return (
    <div className="flex items-center gap-4 pl-6">
      {/* Announced to screen readers: the note and what to do, only when they change. The
          frequency below changes with every reading and would be read out non-stop. */}
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {status === "noSignal" ? statusText : `${main ?? ""} ${statusText}`}
      </p>
      <p
        className={`flex min-w-[76px] items-baseline font-display leading-none font-semibold ${
          main && main.length > 2 ? "text-[52px]" : "text-[64px]"
        } transition-colors duration-300 ${inTune ? "text-success" : "text-primary"}`}
      >
        {main ?? "–"}
        {octave !== null && <sub className="ml-0.5 text-xl font-medium">{octave}</sub>}
      </p>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-base-content/85 tabular-nums">
          {other ?? "–"} · {shownFrequency ? `${hz(shownFrequency)} Hz` : "– Hz"}
        </p>
        {/* Fixed two-line height: switching messages never moves the pills below. */}
        <div className="mt-1 h-[2.6rem]">
          {inTune ? (
            <span className="mt-0.5 badge gap-1 font-semibold badge-success">
              <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden="true">
                <path
                  d="m3.5 8.5 3 3 6-7"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {t("tuner.inTune")}
            </span>
          ) : (
            <p className="line-clamp-2 text-[15px] leading-tight font-medium">
              {t(status === "noSignal" ? "tuner.noSignal" : `tuner.${status}`)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
