"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDownIcon, MicIcon, MicOffIcon, PaletteIcon } from "@/components/ui/icons";
import { sweepCents, useDemo } from "@/lib/audio/demo";
import { tunerEngine } from "@/lib/audio/engine";
import { PLUCK_DURATION_MS, playNotes } from "@/lib/audio/tonePlayer";
import { useTuner } from "@/lib/audio/useTuner";
import { tuningName, useT } from "@/lib/i18n/useT";
import type { MessageKey } from "@/lib/i18n/messages";
import { midiToFrequency } from "@/lib/music/notes";
import { useSettings } from "@/store/settings";
import { useSettingsHydrated } from "@/store/useSettingsHydrated";
import { Gauge } from "./Gauge";
import { Neck } from "./Neck";
import { Readout } from "./Readout";
import { SkinPicker } from "./SkinPicker";
import { StringPills } from "./StringPills";
import { TuningPicker, tuningNotes } from "./TuningPicker";

export function TunerScreen() {
  const t = useT();
  const tuner = useTuner();
  const { skin, headstock, a4, refTone, haptics } = useSettings();
  const setSettings = useSettings((s) => s.set);
  const selectString = useSettings((s) => s.selectString);
  const [sheet, setSheet] = useState<"tuning" | "skin" | null>(null);
  const inTune = tuner.status === "inTune";

  // Listen as soon as the tuner is shown (once saved settings are known, so demo mode never
  // triggers a microphone prompt); release the microphone when leaving the tab.
  const hydrated = useSettingsHydrated();
  useEffect(() => {
    if (!hydrated || tuner.demo) return;
    void tunerEngine.start();
    return () => tunerEngine.stop();
  }, [hydrated, tuner.demo]);

  // One short buzz each time a string reaches the in-tune zone.
  const wasInTune = useRef(false);
  useEffect(() => {
    if (inTune && !wasInTune.current && haptics && !tuner.demo) navigator.vibrate?.(40);
    wasInTune.current = inTune;
  }, [inTune, haptics, tuner.demo]);

  const onSelectString = (index: number) => {
    selectString(index);
    if (refTone) {
      tunerEngine.suppress(PLUCK_DURATION_MS);
      playNotes([midiToFrequency(tuner.tuning.strings[index], a4)]);
    }
  };

  const name = tuningName(t, tuner.tuning);

  return (
    <div className="flex flex-1 flex-col" data-mic-status={tuner.mic} data-mic-level={tuner.level}>
      <header className="flex items-center gap-2 px-4 pt-3">
        <button
          type="button"
          onClick={() => setSheet("tuning")}
          aria-label={t("tuner.chooseTuning", { name: `${name}, ${tuningNotes(tuner.tuning)}` })}
          className="flex min-h-11 min-w-0 items-center gap-2 rounded-full bg-base-200 py-2 pr-3 pl-4 transition-colors hover:bg-base-300"
        >
          <span className="truncate font-semibold">{name}</span>
          <span className="text-sm whitespace-nowrap text-base-content/75">
            {tuningNotes(tuner.tuning)}
          </span>
          <ChevronDownIcon width={18} height={18} className="shrink-0" />
        </button>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            aria-pressed={tuner.mode === "auto"}
            onClick={() => setSettings({ mode: tuner.mode === "auto" ? "manual" : "auto" })}
            className={`min-h-11 rounded-full px-3.5 text-sm font-semibold transition-colors ${
              tuner.mode === "auto"
                ? "bg-accent text-accent-content"
                : "bg-base-200 text-base-content/80 hover:bg-base-300"
            }`}
          >
            {t(tuner.mode === "auto" ? "tuner.auto" : "tuner.manual")}
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

      <section className="h-[120px] shrink-0 px-4 py-2">
        <Gauge cents={tuner.cents} inTune={inTune} />
      </section>

      <div className="flex min-h-0 flex-1 items-center justify-center px-4">
        <div className="h-[clamp(220px,44dvh,380px)] w-full">
          <Neck
            skin={skin}
            model={headstock}
            strings={tuner.tuning.strings.length}
            target={tuner.targetString}
            inTune={inTune}
          />
        </div>
      </div>

      <div className="space-y-2 py-3">
        <div className="flex items-center pr-6">
          <div className="min-w-0 flex-1">
            <Readout {...tuner} />
          </div>
          {!tuner.demo && <MicToggle />}
        </div>
        <MicControl />
        <StringPills
          strings={tuner.tuning.strings}
          selected={tuner.targetString}
          inTune={inTune}
          onSelect={onSelectString}
        />
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

const MIC_ERRORS: Partial<Record<string, MessageKey>> = {
  denied: "mic.denied",
  nomic: "mic.nomic",
  insecure: "mic.insecure",
  unsupported: "mic.unsupported",
  error: "mic.error",
};

/** Fixed-height status slot: its content changes, the layout below never moves. */
function MicControl() {
  const t = useT();
  const { mic, demo } = useTuner();

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

  return <div className="flex h-12 flex-col justify-center px-6">{content}</div>;
}

/** Manual microphone on/off; the ring grows with the input level while listening. */
function MicToggle() {
  const t = useT();
  const { mic, level } = useTuner();
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
