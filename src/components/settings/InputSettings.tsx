"use client";

import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n/useT";
import { MAX_INPUT_GAIN, MIN_INPUT_GAIN, useSettings } from "@/store/settings";

/** Sensitivity slider positions: powers of two (×¼ … ×8), half a step apart. */
const GAIN_STEPS = Math.round(Math.log2(MAX_INPUT_GAIN / MIN_INPUT_GAIN) * 2);
const gainAt = (step: number) => MIN_INPUT_GAIN * 2 ** (step / 2);
const stepOf = (gain: number) => Math.round(Math.log2(gain / MIN_INPUT_GAIN) * 2);
const formatGain = (gain: number) => `×${Number(gain.toFixed(2))}`;

/**
 * Microphone choice (audio interfaces on desktop, a headset…) and input sensitivity.
 * Devices are only named once the page may use the microphone; before that they are
 * listed by number.
 */
export function InputSettings() {
  const t = useT();
  const deviceId = useSettings((s) => s.inputDeviceId);
  const gain = useSettings((s) => s.inputGain);
  const set = useSettings((s) => s.set);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);

  useEffect(() => {
    const media = navigator.mediaDevices;
    if (!media?.enumerateDevices) return;
    const refresh = () =>
      void media
        .enumerateDevices()
        .then((all) => setDevices(all.filter((d) => d.kind === "audioinput" && d.deviceId)))
        .catch(() => setDevices([]));
    refresh();
    // A microphone plugged in or out.
    media.addEventListener?.("devicechange", refresh);
    return () => media.removeEventListener?.("devicechange", refresh);
  }, []);

  // The default entry is listed on its own; some browsers also list it as "default".
  const choices = devices.filter((d) => d.deviceId !== "default");
  const known = deviceId === "" || choices.some((d) => d.deviceId === deviceId);

  return (
    <section className="divide-y divide-base-300 rounded-box bg-base-200 px-4">
      <div className="flex min-h-14 items-center justify-between gap-4 py-2">
        <label htmlFor="input-device" className="font-medium">
          {t("settings.input")}
        </label>
        <select
          id="input-device"
          className="select w-48 min-w-0"
          value={known ? deviceId : ""}
          onChange={(e) => set({ inputDeviceId: e.target.value })}
        >
          <option value="">{t("settings.input.default")}</option>
          {choices.map((d, i) => (
            <option key={d.deviceId} value={d.deviceId}>
              {d.label || t("settings.input.unnamed", { n: i + 1 })}
            </option>
          ))}
        </select>
      </div>
      <div className="py-3">
        <div className="mb-1 flex items-baseline justify-between">
          <label htmlFor="input-gain" className="font-medium">
            {t("settings.gain")}
          </label>
          <span className="text-sm font-semibold tabular-nums">{formatGain(gain)}</span>
        </div>
        <input
          id="input-gain"
          type="range"
          className="range w-full range-primary range-sm"
          min={0}
          max={GAIN_STEPS}
          step={1}
          value={stepOf(gain)}
          aria-valuetext={formatGain(gain)}
          onChange={(e) => set({ inputGain: gainAt(Number(e.target.value)) })}
        />
        <p className="mt-1 text-xs text-base-content/75">{t("settings.gain.hint")}</p>
      </div>
    </section>
  );
}
