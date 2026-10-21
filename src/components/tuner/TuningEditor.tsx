"use client";

import { useId, useState } from "react";
import { useT } from "@/lib/i18n/useT";
import { NOTE_NAMES, displayNote, octaveOf, pitchClass } from "@/lib/music/notes";
import type { Tuning } from "@/lib/music/tunings";

const OCTAVES = [1, 2, 3, 4, 5];

interface TuningEditorProps {
  initial: Tuning;
  onSave: (tuning: { name: string; strings: number[] }) => void;
  onCancel: () => void;
}

/** Name + note/octave for every string (lowest string first, shown as string 6 → 1). */
export function TuningEditor({ initial, onSave, onCancel }: TuningEditorProps) {
  const t = useT();
  const id = useId();
  const [name, setName] = useState(initial.custom ? initial.name : "");
  const [strings, setStrings] = useState(initial.strings);

  const update = (index: number, pc: number, octave: number) =>
    setStrings((prev) => prev.map((m, i) => (i === index ? (octave + 1) * 12 + pc : m)));

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ name: name.trim() || t("tunings.namePlaceholder"), strings });
      }}
    >
      <label className="block">
        <span className="mb-1 block text-sm font-medium">{t("tunings.name")}</span>
        <input
          className="input w-full"
          value={name}
          maxLength={32}
          placeholder={t("tunings.namePlaceholder")}
          onChange={(e) => setName(e.target.value)}
        />
      </label>

      <ul className="space-y-2">
        {strings.map((midi, i) => {
          const pc = pitchClass(midi);
          const octave = octaveOf(midi);
          const label = t("tunings.stringN", { n: strings.length - i });
          return (
            <li key={i} className="flex items-center gap-2">
              <span className="w-20 shrink-0 text-sm font-medium" id={`${id}-s${i}`}>
                {label}
              </span>
              <select
                className="select min-w-0 flex-1"
                aria-label={`${label} – ${t("tunings.note")}`}
                value={pc}
                onChange={(e) => update(i, Number(e.target.value), octave)}
              >
                {NOTE_NAMES.map((n, p) => (
                  <option key={n} value={p}>
                    {displayNote(n)}
                  </option>
                ))}
              </select>
              <select
                className="select w-24"
                aria-label={`${label} – ${t("tunings.octave")}`}
                value={octave}
                onChange={(e) => update(i, pc, Number(e.target.value))}
              >
                {OCTAVES.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </li>
          );
        })}
      </ul>

      <div className="flex justify-end gap-2 pt-1">
        <button type="button" className="btn min-h-11 btn-ghost" onClick={onCancel}>
          {t("tunings.cancel")}
        </button>
        <button type="submit" className="btn min-h-11 btn-primary">
          {t("tunings.save")}
        </button>
      </div>
    </form>
  );
}
