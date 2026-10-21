"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { tunerEngine } from "@/lib/audio/engine";
import { useNumberFormat, useT } from "@/lib/i18n/useT";
import { DEFAULT_A4, displayNote, nearestNote } from "@/lib/music/notes";
import { useSettings } from "@/store/settings";

function formatCents(cents: number) {
  const r = Math.round(cents * 10) / 10;
  return `${r > 0 ? "+" : r < 0 ? "−" : ""}${Math.abs(r).toFixed(1)}`;
}

/**
 * Live view of what the browser actually delivers (sample rates, device, level) and of
 * the raw detected pitch against A4 = 440 Hz, so a remaining offset can be traced to the
 * device, the reference pitch setting, or the guitar.
 */
export function AudioDiagnostic() {
  const t = useT();
  const a4 = useSettings((s) => s.a4);
  const hz = useNumberFormat(2);
  const [open, setOpen] = useState(false);
  const engine = useSyncExternalStore(
    tunerEngine.subscribe,
    tunerEngine.getSnapshot,
    tunerEngine.getServerSnapshot,
  );

  useEffect(() => {
    if (!open) return;
    void tunerEngine.start();
    return () => tunerEngine.stop();
  }, [open]);

  const { status, frequency, level, info } = engine;
  const at440 = frequency ? nearestNote(frequency, DEFAULT_A4) : null;
  const atSetting = frequency && a4 !== DEFAULT_A4 ? nearestNote(frequency, a4) : null;
  const rows: [string, string][] = info
    ? [
        [t("diag.contextRate"), `${info.contextRate} Hz`],
        [t("diag.trackRate"), info.trackRate ? `${info.trackRate} Hz` : "–"],
        [t("diag.channels"), info.channels ? String(info.channels) : "–"],
        [t("diag.device"), info.device || "–"],
      ]
    : [];

  return (
    <section className="rounded-box bg-base-200 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-medium">{t("diag.title")}</h2>
          <p className="text-xs text-base-content/75">{t("diag.help")}</p>
        </div>
        <button
          type="button"
          aria-pressed={open}
          onClick={() => setOpen(!open)}
          className={`btn min-h-11 shrink-0 rounded-full ${open ? "btn-primary" : "btn-outline btn-primary"}`}
        >
          {t(open ? "diag.stop" : "diag.start")}
        </button>
      </div>

      {open && (
        <div className="mt-3 space-y-3" aria-live="polite">
          <p className="text-sm">
            {t("diag.status")} : <span className="font-semibold">{t(`diag.status.${status}`)}</span>
          </p>
          {status === "suspended" && (
            <button
              type="button"
              className="btn min-h-11 w-full rounded-full btn-soft btn-primary"
              onClick={() => tunerEngine.resume()}
            >
              {t("tuner.tapToListen")}
            </button>
          )}

          <div
            className="h-2 overflow-hidden rounded-full bg-base-100"
            role="meter"
            aria-label={t("diag.level")}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.min(100, Math.round(level * 2000))}
          >
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-100"
              style={{ width: `${Math.min(100, level * 2000)}%` }}
            />
          </div>

          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            {rows.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-base-content/75">{k}</dt>
                <dd className="truncate font-mono">{v}</dd>
              </div>
            ))}
            <dt className="text-base-content/75">{t("diag.frequency")}</dt>
            <dd className="font-mono font-semibold">{frequency ? `${hz(frequency)} Hz` : "–"}</dd>
            <dt className="text-base-content/75">{t("diag.at440")}</dt>
            <dd className="font-mono font-semibold">
              {at440
                ? `${displayNote(at440.name)}${at440.octave} ${formatCents(at440.cents)} c`
                : "–"}
            </dd>
            {atSetting && (
              <>
                <dt className="text-warning">{t("diag.atSetting", { a4 })}</dt>
                <dd className="font-mono font-semibold text-warning">
                  {`${displayNote(atSetting.name)}${atSetting.octave} ${formatCents(atSetting.cents)} c`}
                </dd>
              </>
            )}
          </dl>
        </div>
      )}
    </section>
  );
}
