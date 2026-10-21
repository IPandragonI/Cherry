"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDownIcon, MicIcon, PaletteIcon } from "@/components/ui/icons";
import { sweepCents, useDemo } from "@/lib/audio/demo";
import { tunerEngine } from "@/lib/audio/engine";
import { PLUCK_DURATION_MS, playNotes } from "@/lib/audio/tonePlayer";
import { useTuner } from "@/lib/audio/useTuner";
import { tuningName, useT } from "@/lib/i18n/useT";
import type { MessageKey } from "@/lib/i18n/messages";
import { midiToFrequency } from "@/lib/music/notes";
import { useSettings } from "@/store/settings";
import { Gauge } from "./Gauge";
import { Neck } from "./Neck";
import { Readout } from "./Readout";
import { SkinPicker } from "./SkinPicker";
import { StringPills } from "./StringPills";
import { TuningPicker, tuningNotes } from "./TuningPicker";

export function TunerScreen() {
  const t = useT();
  const tuner = useTuner();
  const { skin, a4, refTone, haptics } = useSettings();
  const setSettings = useSettings((s) => s.set);
  const selectString = useSettings((s) => s.selectString);
  const [sheet, setSheet] = useState<"tuning" | "skin" | null>(null);
  const inTune = tuner.status === "inTune";

  // Release the microphone when leaving the tuner tab.
  useEffect(() => () => tunerEngine.stop(), []);

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
    <div className="flex flex-1 flex-col">
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

      <section className="flex h-[150px] shrink-0 flex-col justify-end px-6 pb-2">
        <Gauge cents={tuner.cents} inTune={inTune} />
      </section>

      <div className="flex min-h-0 flex-1 items-center justify-center">
        <div className="h-[clamp(200px,38dvh,340px)]">
          <Neck
            skin={skin}
            strings={tuner.tuning.strings.length}
            target={tuner.targetString}
            inTune={inTune}
          />
        </div>
      </div>

      <div className="space-y-3 py-3">
        <Readout {...tuner} />
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

/** Start button (required by iOS), error states, or the demo controls. */
function MicControl() {
  const t = useT();
  const { mic, demo } = useTuner();

  if (demo) return <DemoPanel />;
  if (mic === "running") return null;

  const error = MIC_ERRORS[mic];
  return (
    <div className="space-y-2 px-6">
      {error && (
        <p role="alert" className="text-sm text-error">
          {t(error)}
        </p>
      )}
      <button
        type="button"
        className="btn min-h-12 w-full rounded-full text-base btn-primary"
        disabled={mic === "starting" || mic === "insecure" || mic === "unsupported"}
        onClick={() => void tunerEngine.start()}
      >
        <MicIcon width={20} height={20} />
        {t(mic === "starting" ? "tuner.starting" : "tuner.start")}
      </button>
    </div>
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
    <div className="mx-6 flex items-center gap-3 rounded-2xl bg-base-200 px-3 py-2">
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
