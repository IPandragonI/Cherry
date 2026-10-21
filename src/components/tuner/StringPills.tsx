"use client";

import { useLocale, useT } from "@/lib/i18n/useT";
import { displayNote, noteName, solfegeName } from "@/lib/music/notes";
import { stringLabels } from "@/lib/music/tunings";

interface StringPillsProps {
  strings: number[];
  selected: number | null;
  inTune: boolean;
  onSelect: (index: number) => void;
}

export function StringPills({ strings, selected, inTune, onSelect }: StringPillsProps) {
  const t = useT();
  const locale = useLocale();
  const labels = stringLabels(strings);
  const spoken = (midi: number) =>
    locale === "fr" ? solfegeName(midi) : displayNote(noteName(midi));

  return (
    <div
      role="group"
      aria-label={t("tuner.modeLabel")}
      className="flex justify-center gap-1.5 px-4"
    >
      {strings.map((midi, i) => {
        const active = i === selected;
        const vars = { n: strings.length - i, note: spoken(midi) };
        return (
          <button
            key={i}
            type="button"
            onClick={() => onSelect(i)}
            aria-pressed={active}
            aria-label={t(active ? "tuner.stringSelected" : "tuner.string", vars)}
            className={`h-11 w-[50px] rounded-full text-lg font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
              active
                ? inTune
                  ? "bg-success text-success-content"
                  : "bg-primary text-primary-content"
                : "bg-base-200 text-base-content hover:bg-base-300"
            }`}
          >
            {labels[i]}
          </button>
        );
      })}
    </div>
  );
}
