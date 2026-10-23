"use client";

import { useId, useState } from "react";
import { useT } from "@/lib/i18n/useT";
import { NOTE_NAMES, displayNote, midiToFrequency, octaveOf, pitchClass } from "@/lib/music/notes";
import { INSTRUMENTS, MAX_OFFSET_CENTS, type Instrument, type Tuning } from "@/lib/music/tunings";
import { MIN_DETECTABLE_HZ, RELIABLE_MAX_HZ } from "@/lib/pitch/range";
import { useSettings } from "@/store/settings";

/** B0 (a 5-string bass) is the lowest note the tuner hears; octave 0 is offered for it. */
const OCTAVES = [0, 1, 2, 3, 4, 5];
const MIN_STRINGS = 3;
const MAX_STRINGS = 8;

export interface EditedTuning {
  name: string;
  strings: number[];
  offsets?: number[];
  instrument: Instrument;
}

interface TuningEditorProps {
  initial: Tuning;
  onSave: (tuning: EditedTuning) => void;
  onCancel: () => void;
}

/**
 * Name, instrument, number of strings, and note/octave plus an optional offset in cents for
 * every string (lowest string first, shown as string N → 1). Notes the tuner cannot hear
 * are flagged: too low blocks saving, high ones only read with a clean signal.
 */
export function TuningEditor({ initial, onSave, onCancel }: TuningEditorProps) {
  const t = useT();
  const id = useId();
  const a4 = useSettings((s) => s.a4);
  const [name, setName] = useState(initial.custom ? initial.name : "");
  const [instrument, setInstrument] = useState<Instrument>(initial.instrument ?? "guitar");
  const [strings, setStrings] = useState(initial.strings);
  const [offsets, setOffsets] = useState(() =>
    initial.strings.map((_, i) => initial.offsets?.[i] ?? 0),
  );

  const update = (index: number, pc: number, octave: number) =>
    setStrings((prev) => prev.map((m, i) => (i === index ? (octave + 1) * 12 + pc : m)));

  const resize = (count: number) => {
    // New strings go on top, a fourth above the previous one, like most tunings.
    setStrings((prev) => {
      if (count <= prev.length) return prev.slice(0, count);
      const top = prev[prev.length - 1];
      return [...prev, ...Array.from({ length: count - prev.length }, (_, i) => top + 5 * (i + 1))];
    });
    setOffsets((prev) =>
      count <= prev.length
        ? prev.slice(0, count)
        : [...prev, ...Array<number>(count - prev.length).fill(0)],
    );
  };

  const frequency = (i: number) => midiToFrequency(strings[i], a4) * 2 ** (offsets[i] / 1200);
  const tooLow = strings.map((_, i) => frequency(i) < MIN_DETECTABLE_HZ);
  const high = strings.map((_, i) => frequency(i) > RELIABLE_MAX_HZ);
  const invalid = tooLow.some(Boolean);

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (invalid) return;
        onSave({
          name: name.trim() || t("tunings.namePlaceholder"),
          strings,
          offsets: offsets.some((o) => o !== 0) ? offsets : undefined,
          instrument,
        });
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

      <div className="flex gap-2">
        <label className="block flex-1">
          <span className="mb-1 block text-sm font-medium">{t("tunings.instrument")}</span>
          <select
            className="select w-full"
            value={instrument}
            onChange={(e) => setInstrument(e.target.value as Instrument)}
          >
            {INSTRUMENTS.map((i) => (
              <option key={i} value={i}>
                {t(`tunings.instrument.${i}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="block w-32">
          <span className="mb-1 block text-sm font-medium">{t("tunings.strings")}</span>
          <select
            className="select w-full"
            value={strings.length}
            onChange={(e) => resize(Number(e.target.value))}
          >
            {Array.from({ length: MAX_STRINGS - MIN_STRINGS + 1 }, (_, i) => MIN_STRINGS + i).map(
              (n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ),
            )}
          </select>
        </label>
      </div>

      <ul className="space-y-3">
        {strings.map((midi, i) => {
          const pc = pitchClass(midi);
          const octave = octaveOf(midi);
          const label = t("tunings.stringN", { n: strings.length - i });
          const hintId = `${id}-hint${i}`;
          let hint: string | null = null;
          if (tooLow[i]) hint = t("tunings.tooLow", { hz: MIN_DETECTABLE_HZ });
          else if (high[i]) hint = t("tunings.high");
          return (
            <li key={i}>
              <div className="flex items-center gap-2">
                <span className="w-16 shrink-0 text-sm font-medium">{label}</span>
                <select
                  className="select min-w-0 flex-1"
                  aria-label={`${label} – ${t("tunings.note")}`}
                  aria-describedby={hint ? hintId : undefined}
                  aria-invalid={tooLow[i] || undefined}
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
                  className="select w-20"
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
                <input
                  type="number"
                  inputMode="numeric"
                  className="input w-20 tabular-nums"
                  aria-label={`${label} – ${t("tunings.offset")}`}
                  title={t("tunings.offset")}
                  min={-MAX_OFFSET_CENTS}
                  max={MAX_OFFSET_CENTS}
                  step={1}
                  value={offsets[i]}
                  onChange={(e) => {
                    const value = Math.round(Number(e.target.value) || 0);
                    const clamped = Math.max(-MAX_OFFSET_CENTS, Math.min(MAX_OFFSET_CENTS, value));
                    setOffsets((prev) => prev.map((o, j) => (j === i ? clamped : o)));
                  }}
                />
              </div>
              {hint && (
                <p
                  id={hintId}
                  className={`mt-1 pl-18 text-xs ${tooLow[i] ? "text-error" : "text-base-content/75"}`}
                >
                  {hint}
                </p>
              )}
            </li>
          );
        })}
      </ul>

      <div className="flex justify-end gap-2 pt-1">
        <button type="button" className="btn min-h-11 btn-ghost" onClick={onCancel}>
          {t("tunings.cancel")}
        </button>
        <button type="submit" className="btn min-h-11 btn-primary" disabled={invalid}>
          {t("tunings.save")}
        </button>
      </div>
    </form>
  );
}
