"use client";

import { useEffect, useRef } from "react";
import { PlayIcon } from "@/components/ui/icons";
import { METRONOME_SOUNDS, metronome, tapTempo, tempoMarking } from "@/lib/audio/metronome";
import { useT } from "@/lib/i18n/useT";
import { MAX_BPM, MIN_BPM, useSettings } from "@/store/settings";

const BEATS = [2, 3, 4, 6];

export function MetronomeScreen() {
  const t = useT();
  const bpm = useSettings((s) => s.bpm);
  const beatsPerBar = useSettings((s) => s.beatsPerBar);
  const sound = useSettings((s) => s.metronomeSound);
  const setBpm = useSettings((s) => s.setBpm);
  const set = useSettings((s) => s.set);
  const playing = metronome.store((s) => s.playing);
  const beat = metronome.store((s) => s.beat);
  const taps = useRef<number[]>([]);

  useEffect(() => metronome.configure(bpm, beatsPerBar, sound), [bpm, beatsPerBar, sound]);
  // Silence when leaving the tab.
  useEffect(() => () => metronome.stop(), []);

  const onTap = () => {
    taps.current = [...taps.current, performance.now()].slice(-8);
    const tempo = tapTempo(taps.current);
    if (tempo) setBpm(tempo);
  };

  const step = (delta: number) => (
    <button
      type="button"
      className="btn btn-circle size-14 bg-base-200 btn-ghost text-2xl"
      aria-label={`${delta > 0 ? "+" : "−"}1 BPM`}
      disabled={delta > 0 ? bpm >= MAX_BPM : bpm <= MIN_BPM}
      onClick={() => setBpm(bpm + delta)}
    >
      {delta > 0 ? "+" : "−"}
    </button>
  );

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 pt-4 pb-6">
      <h1 className="font-display text-3xl font-semibold">{t("metronome.title")}</h1>

      <section className="flex flex-col items-center gap-1 rounded-box bg-base-200 px-4 py-6">
        <div className="flex items-center gap-4">
          {step(-1)}
          <p className="w-40 text-center" aria-live="polite">
            <span className="block font-display text-7xl leading-none font-semibold text-primary tabular-nums">
              {bpm}
            </span>
            <span className="text-sm text-base-content/75">BPM · {tempoMarking(bpm)}</span>
          </p>
          {step(1)}
        </div>
        <input
          type="range"
          min={MIN_BPM}
          max={MAX_BPM}
          value={bpm}
          onChange={(e) => setBpm(Number(e.target.value))}
          aria-label={t("metronome.tempo")}
          aria-valuetext={`${bpm} BPM`}
          className="range mt-4 w-full range-primary range-sm"
        />
      </section>

      <div
        className="flex justify-center gap-3"
        role="img"
        aria-label={playing ? t("metronome.beatOf", { n: beat + 1, total: beatsPerBar }) : ""}
      >
        {Array.from({ length: beatsPerBar }, (_, i) => {
          const on = playing && i === beat;
          return (
            <span
              key={i}
              className={`rounded-full transition-[transform,background-color] duration-75 ${
                i === 0 ? "size-7" : "size-5 self-center"
              } ${on ? "scale-125 bg-primary" : "bg-base-300"}`}
            />
          );
        })}
      </div>

      <div>
        <p id="beats-label" className="mb-2 text-sm font-medium text-base-content/75">
          {t("metronome.beats")}
        </p>
        <div role="radiogroup" aria-labelledby="beats-label" className="grid grid-cols-4 gap-2">
          {BEATS.map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={beatsPerBar === n}
              onClick={() => set({ beatsPerBar: n })}
              className={`min-h-12 rounded-full font-semibold tabular-nums transition-colors ${
                beatsPerBar === n
                  ? "bg-primary text-primary-content"
                  : "bg-base-200 hover:bg-base-300"
              }`}
            >
              {n}/4
            </button>
          ))}
        </div>
      </div>

      <div>
        <p id="sound-label" className="mb-2 text-sm font-medium text-base-content/75">
          {t("metronome.sound")}
        </p>
        <div role="radiogroup" aria-labelledby="sound-label" className="grid grid-cols-2 gap-2">
          {METRONOME_SOUNDS.map((id) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={sound === id}
              onClick={() => {
                set({ metronomeSound: id });
                if (!playing) metronome.preview(id);
              }}
              className={`min-h-12 rounded-full text-sm font-semibold transition-colors ${
                sound === id ? "bg-primary text-primary-content" : "bg-base-200 hover:bg-base-300"
              }`}
            >
              {t(`metronome.sound.${id}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-auto grid grid-cols-2 gap-3">
        <button
          type="button"
          className="btn min-h-14 rounded-full bg-base-200 btn-ghost text-base"
          onClick={onTap}
        >
          {t("metronome.tap")}
        </button>
        <button
          type="button"
          aria-pressed={playing}
          className="btn min-h-14 rounded-full text-base btn-primary"
          onClick={() => (playing ? metronome.stop() : metronome.start())}
        >
          {playing ? (
            <svg viewBox="0 0 24 24" width={20} height={20} aria-hidden="true">
              <rect x="6" y="5" width="12" height="14" rx="2" fill="currentColor" />
            </svg>
          ) : (
            <PlayIcon width={20} height={20} />
          )}
          {t(playing ? "metronome.stop" : "metronome.start")}
        </button>
      </div>
    </div>
  );
}
