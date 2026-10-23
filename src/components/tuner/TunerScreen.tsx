"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronDownIcon, MicIcon, MicOffIcon, PaletteIcon } from "@/components/ui/icons";
import { sweepCents, useDemo } from "@/lib/audio/demo";
import { tunerEngine, useEngine, type MicStatus } from "@/lib/audio/engine";
import { keepScreenAwake } from "@/lib/audio/screenAwake";
import {
  PLUCK_DURATION_MS,
  playChime,
  playNotes,
  startDrone,
  stopDrone,
} from "@/lib/audio/tonePlayer";
import { initialFeedback, shouldChime } from "@/lib/audio/tuneFeedback";
import { tuningKey, useTunedStrings, useTuner } from "@/lib/audio/useTuner";
import { tuningName, useNotation, useT } from "@/lib/i18n/useT";
import type { MessageKey } from "@/lib/i18n/messages";
import { DEFAULT_A4, noteLabel } from "@/lib/music/notes";
import { stringFrequencies, stringLabelsIn } from "@/lib/music/tunings";
import { rangeFor } from "@/lib/pitch/range";
import { TUNER_MODES, useSettings } from "@/store/settings";
import { useSettingsHydrated } from "@/store/useSettingsHydrated";
import { Gauge } from "./Gauge";
import { Neck } from "./Neck";
import { Readout } from "./Readout";
import { SkinPicker } from "./SkinPicker";
import { Strobe } from "./Strobe";
import { TuningPicker, tuningNotes } from "./TuningPicker";

/** Suppression long enough to cover a drone of any length (lifted when it stops). */
const FOREVER_MS = 1e12;

export function TunerScreen() {
  const t = useT();
  const tuner = useTuner();
  const settings = useSettings();
  const { skin, headstock, a4, refTone, haptics, tuneChime, leftHanded, precise } = settings;
  const notation = useNotation();
  const setSettings = useSettings((s) => s.set);
  const selectString = useSettings((s) => s.selectString);
  const [sheet, setSheet] = useState<"tuning" | "skin" | null>(null);
  const [droning, setDroning] = useState(false);
  const inTune = tuner.status === "inTune";
  const targets = useMemo(() => stringFrequencies(tuner.tuning, a4), [tuner.tuning, a4]);

  // Listen as soon as the tuner is shown (once saved settings are known, so demo mode never
  // triggers a microphone prompt, and once the microphone was explained); release the
  // microphone when leaving the tab.
  const hydrated = useSettingsHydrated();
  const listen = hydrated && !tuner.demo && settings.micIntroSeen;
  useEffect(() => {
    if (!listen) return;
    void tunerEngine.start();
    return () => tunerEngine.stop();
  }, [listen]);

  // The analysis listens in the band of the tuning's strings (a bass needs lower notes).
  useEffect(() => tunerEngine.setRange(rangeFor(targets)), [targets]);
  useEffect(
    () => tunerEngine.setInput(settings.inputDeviceId, settings.inputGain),
    [settings.inputDeviceId, settings.inputGain],
  );

  // The screen stays on while the tuner is shown: hands are on the guitar, not the phone.
  useEffect(() => keepScreenAwake(), []);

  // A drone stops with the tuner, and the microphone (which would hear it) is muted meanwhile.
  useEffect(() => {
    if (!droning) return;
    tunerEngine.suppress(FOREVER_MS);
    return () => {
      stopDrone();
      tunerEngine.suppress(0);
    };
  }, [droning]);

  // One short buzz and a soft chime when a string reaches in tune: once per note
  // (see tuneFeedback.ts for the debounce rules). The string is ticked off as tuned.
  const feedback = useRef(initialFeedback());
  let noteKey: string | null = null;
  if (tuner.mode === "chromatic") {
    noteKey = tuner.note && `chromatic:${tuner.note}${tuner.octave}`;
  } else if (tuner.targetString !== null) {
    noteKey = `${tuner.tuning.id}:${tuner.targetString}`;
  }
  const silent = tuner.status === "noSignal";
  const currentKey = tuningKey(tuner.tuning, a4);
  const markTuned = useTunedStrings((s) => s.mark);
  const targetString = tuner.targetString;
  useEffect(() => {
    if (tuner.demo) return;
    if (inTune && targetString !== null) markTuned(currentKey, targetString);
    const chime = shouldChime(feedback.current, {
      now: performance.now(),
      note: noteKey,
      inTune,
      silent,
    });
    if (!chime) return;
    if (haptics) navigator.vibrate?.(40);
    if (tuneChime) playChime();
  }, [
    inTune,
    silent,
    noteKey,
    haptics,
    tuneChime,
    tuner.demo,
    targetString,
    currentKey,
    markTuned,
  ]);

  const tunedState = useTunedStrings();
  const tuned = useMemo(
    () => (tunedState.tuningKey === currentKey ? tunedState.tuned : []),
    [tunedState, currentKey],
  );

  const strings = tuner.tuning.strings;
  const onSelectString = useCallback(
    (index: number) => {
      selectString(index);
      if (droning) startDrone(targets[index]);
      else if (refTone) {
        tunerEngine.suppress(PLUCK_DURATION_MS);
        playNotes([targets[index]]);
      }
    },
    [selectString, droning, refTone, targets],
  );

  // Stable props: the neck (a large SVG) only re-renders when what it shows changes, not
  // with every reading.
  const pegLabels = useMemo(
    () => ({
      labels: stringLabelsIn(strings, notation),
      ariaLabels: strings.map((midi, i) =>
        t(i === targetString ? "tuner.stringSelected" : "tuner.string", {
          n: strings.length - i,
          note: noteLabel(midi, notation),
        }),
      ),
      selected: targetString,
      onSelect: onSelectString,
      tuned,
    }),
    [strings, notation, t, targetString, onSelectString, tuned],
  );

  const toggleDrone = () => {
    if (droning) return setDroning(false);
    // The drone plays one string: the one shown, which becomes the manual selection.
    const index = Math.min(targetString ?? settings.selectedString, strings.length - 1);
    selectString(index);
    startDrone(targets[index]);
    setDroning(true);
  };

  const cycleMode = () => {
    const next = TUNER_MODES[(TUNER_MODES.indexOf(tuner.mode) + 1) % TUNER_MODES.length];
    setSettings({ mode: next });
    if (next !== "manual") setDroning(false);
  };

  const name = tuningName(t, tuner.tuning);
  const modeLabel = t(`tuner.${tuner.mode}` as MessageKey);

  return (
    <div className="flex flex-1 flex-col" data-mic-status={tuner.mic}>
      <header className="flex items-center gap-2 px-4 pt-3">
        <button
          type="button"
          onClick={() => setSheet("tuning")}
          aria-label={t("tuner.chooseTuning", { name: `${name}, ${tuningNotes(tuner.tuning)}` })}
          className="flex min-h-11 min-w-0 items-center gap-2 rounded-full bg-base-200 py-2 pr-3 pl-4 transition-colors hover:bg-base-300"
        >
          <span className="truncate font-semibold">{name}</span>
          <span className="truncate text-sm whitespace-nowrap text-base-content/75">
            {tuningNotes(tuner.tuning)}
          </span>
          <ChevronDownIcon width={18} height={18} className="shrink-0" />
        </button>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={cycleMode}
            aria-label={t("tuner.modeButton", { mode: modeLabel })}
            title={t("tuner.modeButton", { mode: modeLabel })}
            className={`min-h-11 rounded-full px-3.5 text-sm font-semibold transition-colors ${
              tuner.mode === "manual"
                ? "bg-base-200 text-base-content/80 hover:bg-base-300"
                : "bg-accent text-accent-content"
            }`}
          >
            {modeLabel}
          </button>
          <button
            type="button"
            onClick={() => setSheet("skin")}
            aria-label={t("tuner.chooseSkin")}
            className="flex size-11 items-center justify-center rounded-full bg-base-200 transition-colors hover:bg-base-300"
          >
            <PaletteIcon width={22} height={22} />
          </button>
        </div>
      </header>

      {a4 !== DEFAULT_A4 && (
        // A non-standard reference shifts every reading: make it impossible to miss.
        <Link
          href="/settings"
          className="mx-4 mt-2 flex min-h-8 items-center justify-center rounded-full bg-warning/15 px-3 text-xs font-semibold text-base-content"
        >
          {t("tuner.a4Warning", { a4 })}
        </Link>
      )}

      <section className="h-[120px] shrink-0 px-4 py-2">
        {settings.gaugeStyle === "strobe" ? (
          <Strobe cents={tuner.cents} inTune={inTune} precise={precise} />
        ) : (
          <Gauge cents={tuner.cents} inTune={inTune} precise={precise} noteKey={noteKey} />
        )}
      </section>

      <div className="flex min-h-0 flex-1 items-center justify-center px-4">
        <div className="h-[clamp(240px,50dvh,440px)] w-full">
          <Neck
            skin={skin}
            model={headstock}
            strings={strings.length}
            target={targetString}
            inTune={inTune}
            mirrored={leftHanded}
            pegLabels={pegLabels}
          />
        </div>
      </div>

      {tuner.mode !== "chromatic" && !tuner.demo && (
        <TunedProgress tuned={tuned.length} total={strings.length} />
      )}

      <div className="space-y-2 py-3">
        <div className="flex items-center gap-2 pr-6">
          <div className="min-w-0 flex-1">
            <Readout {...tuner} />
          </div>
          {tuner.mode !== "chromatic" && (
            <button
              type="button"
              aria-pressed={droning}
              aria-label={t(droning ? "tuner.droneStop" : "tuner.droneStart")}
              title={t(droning ? "tuner.droneStop" : "tuner.droneStart")}
              onClick={toggleDrone}
              className={`min-h-11 shrink-0 rounded-full px-3 text-xs font-semibold transition-colors ${
                droning
                  ? "bg-secondary text-secondary-content"
                  : "bg-base-200 text-base-content/80 hover:bg-base-300"
              }`}
            >
              {t("tuner.drone")}
            </button>
          )}
          {!tuner.demo && settings.micIntroSeen && <MicToggle mic={tuner.mic} />}
        </div>
        {hydrated && !tuner.demo && !settings.micIntroSeen ? (
          <MicIntro
            onAllow={() => setSettings({ micIntroSeen: true })}
            onDemo={() => setSettings({ demo: true })}
          />
        ) : (
          <MicControl mic={tuner.mic} demo={tuner.demo} />
        )}
      </div>

      <TuningPicker
        open={sheet === "tuning"}
        onClose={() => setSheet(null)}
        current={tuner.tuning}
      />
      <SkinPicker open={sheet === "skin"} onClose={() => setSheet(null)} />
    </div>
  );
}

/** "4 / 6 strings in tune", then "All strings are in tune" with a way to start over. */
function TunedProgress({ tuned, total }: { tuned: number; total: number }) {
  const t = useT();
  const clear = useTunedStrings((s) => s.clear);
  if (tuned === 0) return null;
  const done = tuned >= total;
  return (
    <div className="flex items-center justify-center gap-2 px-6 text-sm" role="status">
      <span className={done ? "font-semibold text-success" : "text-base-content/75"}>
        {done ? t("tuner.allTuned") : t("tuner.tunedCount", { n: tuned, total })}
      </span>
      {done && (
        <button type="button" className="btn btn-ghost btn-xs" onClick={clear}>
          {t("tuner.resetTuned")}
        </button>
      )}
    </div>
  );
}

/** Explains the microphone before the browser asks, so the prompt is not a surprise. */
function MicIntro({ onAllow, onDemo }: { onAllow: () => void; onDemo: () => void }) {
  const t = useT();
  return (
    <div className="mx-6 space-y-2 rounded-2xl bg-base-200 p-4">
      <p className="font-semibold">{t("micIntro.title")}</p>
      <p className="text-sm text-base-content/80">{t("micIntro.body")}</p>
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          className="btn h-11 min-h-11 flex-1 rounded-full btn-primary"
          onClick={onAllow}
        >
          <MicIcon width={20} height={20} />
          {t("micIntro.allow")}
        </button>
        <button type="button" className="btn h-11 min-h-11 rounded-full btn-ghost" onClick={onDemo}>
          {t("micIntro.demo")}
        </button>
      </div>
    </div>
  );
}

const MIC_ERRORS: Partial<Record<MicStatus, MessageKey>> = {
  denied: "mic.denied",
  nomic: "mic.nomic",
  insecure: "mic.insecure",
  unsupported: "mic.unsupported",
  error: "mic.error",
};

/** Fixed-height status slot: its content changes, the layout below never moves. */
function MicControl({ mic, demo }: { mic: MicStatus; demo: boolean }) {
  const t = useT();

  let content: ReactNode = null;
  if (demo) {
    content = <DemoPanel />;
  } else if (mic === "starting") {
    content = (
      <p className="flex items-center justify-center gap-2 text-sm text-base-content/75">
        <span className="loading loading-xs loading-dots" aria-hidden="true" />
        {t("tuner.starting")}
      </p>
    );
  } else if (mic === "off") {
    content = <p className="text-center text-sm text-base-content/75">{t("mic.paused")}</p>;
  } else if (mic === "suspended") {
    // Some browsers (desktop Chrome, Firefox) keep audio paused until the first click.
    content = (
      <button
        type="button"
        className="btn h-11 min-h-11 w-full rounded-full btn-soft btn-primary"
        onClick={() => tunerEngine.resume()}
      >
        <MicIcon width={20} height={20} />
        {t("tuner.tapToListen")}
      </button>
    );
  } else if (MIC_ERRORS[mic]) {
    const canRetry = mic === "denied" || mic === "nomic" || mic === "error";
    content = (
      <div className="flex h-full items-center gap-3">
        <p role="alert" className="line-clamp-2 flex-1 text-xs text-error">
          {t(MIC_ERRORS[mic]!)}
        </p>
        {canRetry && (
          <button
            type="button"
            className="btn h-11 min-h-11 shrink-0 rounded-full btn-outline btn-primary"
            onClick={() => tunerEngine.setEnabled(true)}
          >
            {t("mic.retry")}
          </button>
        )}
      </div>
    );
  }

  return content && <div className="flex h-12 flex-col justify-center px-6">{content}</div>;
}

/** Manual microphone on/off; the ring grows with the input level while listening. */
function MicToggle({ mic }: { mic: MicStatus }) {
  const t = useT();
  // Only this button follows the level (it changes with every reading).
  const level = useEngine((s) => s.level);
  const on = mic !== "off";
  const listening = mic === "running";
  const ring = listening ? Math.min(10, 2 + level * 600) : 0;

  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={t(on ? "mic.off" : "mic.on")}
      title={t(on ? "mic.off" : "mic.on")}
      onClick={() => tunerEngine.setEnabled(!on)}
      data-mic-level={level}
      className={`flex size-12 shrink-0 items-center justify-center rounded-full transition-[background-color,box-shadow] duration-150 ${
        on
          ? "bg-primary text-primary-content"
          : "bg-base-200 text-base-content/75 hover:bg-base-300"
      }`}
      style={{
        boxShadow: ring
          ? `0 0 0 ${ring}px color-mix(in oklab, var(--color-primary) 22%, transparent)`
          : undefined,
      }}
    >
      {on ? <MicIcon width={22} height={22} /> : <MicOffIcon width={22} height={22} />}
    </button>
  );
}

function DemoPanel() {
  const t = useT();
  const { cents, sweep, setCents, setSweep } = useDemo();

  useEffect(() => {
    if (!sweep) return;
    const start = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      setCents(Math.round(sweepCents((now - start) / 1000) * 10) / 10);
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [sweep, setCents]);

  return (
    <div className="flex h-12 items-center gap-3 rounded-2xl bg-base-200 px-3">
      <span className="badge shrink-0 font-semibold badge-secondary">{t("tuner.demo")}</span>
      <input
        type="range"
        min={-50}
        max={50}
        step={0.5}
        value={cents}
        disabled={sweep}
        onChange={(e) => setCents(Number(e.target.value))}
        aria-label={t("tuner.demoCents")}
        className="range min-w-0 flex-1 range-primary range-xs"
      />
      <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-sm">
        <input
          type="checkbox"
          className="toggle toggle-primary toggle-sm"
          checked={sweep}
          onChange={(e) => setSweep(e.target.checked)}
        />
        {t("tuner.demoSweep")}
      </label>
    </div>
  );
}
