"use client";

import { useRef, useState } from "react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  HeartIcon,
  PlayIcon,
  TrashIcon,
} from "@/components/ui/icons";
import { playNotes } from "@/lib/audio/tonePlayer";
import { useT } from "@/lib/i18n/useT";
import { LIBRARY_QUALITIES } from "@/lib/music/chordFormulas";
import {
  chordById,
  chordName,
  diagramFor,
  findChord,
  fretsLabel,
  prettyChordName,
  voicingFrequencies,
} from "@/lib/music/chords";
import { NOTE_NAMES, displayNote } from "@/lib/music/notes";
import { DEFAULT_TUNING, findTuning } from "@/lib/music/tunings";
import { useFavorites } from "@/store/favorites";
import { useSettings } from "@/store/settings";
import { useCustomTunings } from "@/store/tunings";
import { ChordDiagram } from "./ChordDiagram";
import type { Fret } from "@/lib/music/recognize";

const STRUM_MS = 35;

function useStrum() {
  const a4 = useSettings((s) => s.a4);
  return (frets: Fret[], strings = DEFAULT_TUNING.strings) =>
    playNotes(voicingFrequencies(frets, strings, a4), { strumMs: STRUM_MS });
}

const chip = (active: boolean) =>
  `min-h-11 shrink-0 rounded-full px-4 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
    active ? "bg-primary text-primary-content" : "bg-base-200 hover:bg-base-300"
  }`;

export function ChordLibrary() {
  const t = useT();
  const [root, setRoot] = useState("C");
  const [quality, setQuality] = useState("major");
  const [showFavorites, setShowFavorites] = useState(false);

  return (
    <div className="space-y-4 px-4 pt-4 pb-6">
      <header className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-semibold">{t("chords.title")}</h1>
        <div className="flex rounded-full bg-base-200 p-1" role="group">
          {(["all", "favorites"] as const).map((v) => {
            const active = (v === "favorites") === showFavorites;
            return (
              <button
                key={v}
                type="button"
                aria-pressed={active}
                onClick={() => setShowFavorites(v === "favorites")}
                className={`min-h-10 rounded-full px-4 text-sm font-semibold transition-colors ${
                  active ? "bg-base-100 shadow-sm" : "text-base-content/75"
                }`}
              >
                {t(v === "all" ? "chords.all" : "chords.favorites")}
              </button>
            );
          })}
        </div>
      </header>

      {showFavorites ? (
        <Favorites />
      ) : (
        <>
          <fieldset className="min-w-0">
            <legend className="mb-1.5 text-xs font-semibold tracking-wide text-base-content/75 uppercase">
              {t("chords.root")}
            </legend>
            <div className="-mx-4 flex [scrollbar-width:none] gap-1.5 overflow-x-auto px-4 pb-1">
              {NOTE_NAMES.map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-pressed={n === root}
                  onClick={() => setRoot(n)}
                  className={`${chip(n === root)} w-12 px-0`}
                >
                  {displayNote(n)}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset className="min-w-0">
            <legend className="mb-1.5 text-xs font-semibold tracking-wide text-base-content/75 uppercase">
              {t("chords.quality")}
            </legend>
            <div className="-mx-4 flex [scrollbar-width:none] gap-1.5 overflow-x-auto px-4 pb-1">
              {LIBRARY_QUALITIES.map((q) => (
                <button
                  key={q.id}
                  type="button"
                  aria-pressed={q.id === quality}
                  onClick={() => setQuality(q.id)}
                  className={chip(q.id === quality)}
                >
                  {t(`quality.${q.id}` as Parameters<typeof t>[0])}
                </button>
              ))}
            </div>
          </fieldset>
          <ChordCard key={`${root}-${quality}`} root={root} quality={quality} />
        </>
      )}
    </div>
  );
}

function ChordCard({ root, quality }: { root: string; quality: string }) {
  const t = useT();
  const strum = useStrum();
  const chord = findChord(root, quality);
  const { chordIds, toggleChord } = useFavorites();
  const scroller = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  if (!chord) return null;

  const name = chordName(chord);
  const favorite = chordIds.includes(chord.id);
  const total = chord.voicings.length;
  const current = chord.voicings[Math.min(index, total - 1)];

  const goTo = (i: number) => {
    const el = scroller.current;
    if (!el) return;
    const next = Math.max(0, Math.min(total - 1, i));
    el.scrollTo({
      left: next * el.clientWidth,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
    setIndex(next);
  };

  return (
    <article className="rounded-box bg-base-200 p-4">
      <div className="flex items-center gap-2">
        <h2 className="font-display text-4xl font-semibold text-primary">{name}</h2>
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            className="btn btn-circle size-11 btn-ghost"
            aria-pressed={favorite}
            aria-label={t(favorite ? "chords.removeFavorite" : "chords.addFavorite", { name })}
            onClick={() => toggleChord(chord.id)}
          >
            <HeartIcon
              filled={favorite}
              width={24}
              height={24}
              className={favorite ? "text-primary" : ""}
            />
          </button>
          <button
            type="button"
            className="btn btn-circle size-11 btn-primary"
            aria-label={t("chords.play", { name })}
            onClick={() => strum(current.frets)}
          >
            <PlayIcon width={22} height={22} />
          </button>
        </div>
      </div>

      <div className="mt-2 flex items-center gap-1">
        <button
          type="button"
          className="btn btn-circle size-11 btn-ghost"
          aria-label={t("chords.prev")}
          disabled={index === 0}
          onClick={() => goTo(index - 1)}
        >
          <ChevronLeftIcon width={22} height={22} />
        </button>
        <div
          ref={scroller}
          className="flex min-w-0 flex-1 snap-x snap-mandatory [scrollbar-width:none] overflow-x-auto"
          onScroll={(e) => {
            const el = e.currentTarget;
            setIndex(Math.round(el.scrollLeft / el.clientWidth));
          }}
          aria-roledescription="carousel"
        >
          {chord.voicings.map((v, i) => (
            <button
              key={v.frets.join(",")}
              type="button"
              className="w-full shrink-0 snap-center"
              onClick={() => strum(v.frets)}
              aria-label={t("chords.play", { name: `${name} (${fretsLabel(v.frets)})` })}
              tabIndex={i === index ? 0 : -1}
            >
              <ChordDiagram
                voicing={v}
                label={t("chords.diagram", { name, frets: fretsLabel(v.frets) })}
                className="mx-auto h-52 w-auto"
              />
            </button>
          ))}
        </div>
        <button
          type="button"
          className="btn btn-circle size-11 btn-ghost"
          aria-label={t("chords.next")}
          disabled={index >= total - 1}
          onClick={() => goTo(index + 1)}
        >
          <ChevronRightIcon width={22} height={22} />
        </button>
      </div>

      <p className="mt-1 text-center text-sm text-base-content/75 tabular-nums" aria-live="polite">
        {t("chords.voicing", { n: Math.min(index, total - 1) + 1, total })}
        <span className="ml-2 font-mono">{fretsLabel(current.frets)}</span>
      </p>
    </article>
  );
}

function Favorites() {
  const t = useT();
  const strum = useStrum();
  const { chordIds, shapes, toggleChord, removeShape } = useFavorites();
  const custom = useCustomTunings((s) => s.custom);
  const chords = chordIds.flatMap((id) => chordById(id) ?? []);

  if (chords.length === 0 && shapes.length === 0) {
    return <p className="py-10 text-center text-base-content/75">{t("chords.noFavorites")}</p>;
  }

  return (
    <div className="space-y-5">
      {chords.length > 0 && (
        <ul className="grid grid-cols-2 gap-3">
          {chords.map((c) => {
            const name = chordName(c);
            const v = c.voicings[0];
            return (
              <li key={c.id} className="relative rounded-box bg-base-200 p-3">
                <button
                  type="button"
                  className="block w-full"
                  onClick={() => strum(v.frets)}
                  aria-label={t("chords.play", { name })}
                >
                  <span className="block text-left font-display text-2xl font-semibold text-primary">
                    {name}
                  </span>
                  <ChordDiagram
                    voicing={v}
                    label={t("chords.diagram", { name, frets: fretsLabel(v.frets) })}
                    className="mx-auto h-32 w-auto"
                  />
                </button>
                <button
                  type="button"
                  className="btn absolute top-1.5 right-1.5 btn-circle size-11 btn-ghost"
                  aria-label={t("chords.removeFavorite", { name })}
                  onClick={() => toggleChord(c.id)}
                >
                  <HeartIcon filled width={22} height={22} className="text-primary" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {shapes.length > 0 && (
        <section>
          <h2 className="mb-2 text-xs font-semibold tracking-wide text-base-content/75 uppercase">
            {t("chords.savedShapes")}
          </h2>
          <ul className="grid grid-cols-2 gap-3">
            {shapes.map((s) => {
              const name = prettyChordName(s.name);
              const strings = findTuning(s.tuningId, custom).strings;
              return (
                <li key={s.id} className="relative rounded-box bg-base-200 p-3">
                  <button
                    type="button"
                    className="block w-full"
                    onClick={() => strum(s.frets, strings)}
                    aria-label={t("chords.play", { name })}
                  >
                    <span className="block text-left font-display text-2xl font-semibold text-primary">
                      {name}
                    </span>
                    <ChordDiagram
                      voicing={diagramFor(s.frets)}
                      label={t("chords.diagram", { name, frets: fretsLabel(s.frets) })}
                      className="mx-auto h-32 w-auto"
                    />
                  </button>
                  <button
                    type="button"
                    className="btn absolute top-1.5 right-1.5 btn-circle size-11 btn-ghost"
                    aria-label={t("tunings.delete", { name })}
                    onClick={() => removeShape(s.id)}
                  >
                    <TrashIcon width={20} height={20} />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
