"use client";

import { useLocale, useNumberFormat, useT } from "@/lib/i18n/useT";
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
  const locale = useLocale();
  const hz = useNumberFormat(1);
  const inTune = status === "inTune";
  const shownFrequency = frequency ?? targetFrequency;
  const noteLabel = locale === "fr" ? solfege : note && `${displayNote(note)}${octave}`;

  return (
    <div className="flex items-center gap-4 pl-6" aria-live="polite" aria-atomic="true">
      <p
        className={`flex min-w-[76px] items-baseline font-display text-[64px] leading-none font-semibold transition-colors duration-300 ${
          inTune ? "text-success" : "text-primary"
        }`}
      >
        {note ? displayNote(note) : "–"}
        {octave !== null && <sub className="ml-0.5 text-xl font-medium">{octave}</sub>}
      </p>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-base-content/85 tabular-nums">
          {noteLabel ?? "–"} · {shownFrequency ? `${hz(shownFrequency)} Hz` : "– Hz"}
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
