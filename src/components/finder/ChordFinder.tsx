"use client";

import { useState } from "react";
import { HeartIcon, PlayIcon, ResetIcon } from "@/components/ui/icons";
import { playNotes } from "@/lib/audio/tonePlayer";
import { tuningName, useNotation, useT } from "@/lib/i18n/useT";
import { prettyChordName, voicingFrequencies } from "@/lib/music/chords";
import { noteLabel } from "@/lib/music/notes";
import { notesFromFrets, recognizeChord, type Fret } from "@/lib/music/recognize";
import { findTuning, type Tuning } from "@/lib/music/tunings";
import { useFavorites } from "@/store/favorites";
import { useSettings } from "@/store/settings";
import { useCustomTunings } from "@/store/tunings";
import { Fretboard } from "./Fretboard";

const MAX_ALTERNATIVES = 3;

export function ChordFinder() {
  const tuningId = useSettings((s) => s.tuningId);
  const custom = useCustomTunings((s) => s.custom);
  const tuning = findTuning(tuningId, custom);
  // Remount (and reset the fingering) when the tuning changes.
  return <Finder key={`${tuning.id}:${tuning.strings.join(",")}`} tuning={tuning} />;
}

function Finder({ tuning }: { tuning: Tuning }) {
  const t = useT();
  const notation = useNotation();
  const a4 = useSettings((s) => s.a4);
  const saveShape = useFavorites((s) => s.saveShape);
  const [frets, setFrets] = useState<Fret[]>(() => tuning.strings.map(() => null));
  const [saved, setSaved] = useState(false);

  const notes = notesFromFrets(frets, tuning.strings);
  const pitchClasses = new Set(notes.map((n) => n % 12)).size;
  const matches = recognizeChord(notes);
  const names = [...new Set(matches.map((m) => m.name))];
  const best = names[0];
  const alternatives = names.slice(1, 1 + MAX_ALTERNATIVES).map(prettyChordName);

  const update = (next: Fret[]) => {
    setFrets(next);
    setSaved(false);
  };

  return (
    <div className="space-y-4 px-4 pt-4 pb-6">
      <header>
        <h1 className="font-display text-3xl font-semibold">{t("finder.title")}</h1>
        <p className="mt-1 text-sm text-base-content/75">
          {t("finder.tuning", { name: tuningName(t, tuning) })} ·{" "}
          {tuning.strings.map((m) => noteLabel(m, notation)).join(" ")}
        </p>
      </header>

      <section
        className="flex min-h-28 flex-col justify-center rounded-box bg-base-200 px-5 py-4"
        aria-live="polite"
        aria-atomic="true"
      >
        {best ? (
          <>
            <p className="font-display text-5xl font-semibold text-primary">
              {prettyChordName(best)}
            </p>
            {alternatives.length > 0 && (
              <p className="mt-1 text-sm text-base-content/80">
                {t("finder.alternatives", { names: alternatives.join(" / ") })}
              </p>
            )}
          </>
        ) : (
          <p className="text-lg font-medium text-base-content/80">
            {pitchClasses < 2 ? t("finder.placeNotes") : t("finder.noChord")}
          </p>
        )}
        <p className="mt-2 font-mono text-xs text-base-content/75">
          {notes.length > 0 ? notes.map((n) => noteLabel(n, notation)).join(" ") : " "}
        </p>
      </section>

      <p className="text-sm text-base-content/75">{t("finder.hint")}</p>
      <Fretboard strings={tuning.strings} frets={frets} onChange={update} />

      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          className="btn min-h-12 bg-base-200 btn-ghost"
          onClick={() => update(tuning.strings.map(() => null))}
        >
          <ResetIcon width={20} height={20} />
          {t("common.reset")}
        </button>
        <button
          type="button"
          className="btn min-h-12 btn-primary"
          disabled={notes.length === 0}
          onClick={() => playNotes(voicingFrequencies(frets, tuning.strings, a4), { strumMs: 35 })}
        >
          <PlayIcon width={20} height={20} />
          {t("common.play")}
        </button>
        <button
          type="button"
          className="btn min-h-12 btn-outline btn-primary"
          disabled={!best}
          aria-pressed={saved}
          onClick={() => {
            if (!best) return;
            saveShape({ name: best, frets, tuningId: tuning.id });
            setSaved(true);
          }}
        >
          <HeartIcon filled={saved} width={20} height={20} />
          {t("finder.save")}
        </button>
      </div>
      {saved && (
        <p role="status" className="text-center text-sm font-medium text-success">
          {t("finder.saved")}
        </p>
      )}
    </div>
  );
}
