"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronRightIcon, TrashIcon } from "@/components/ui/icons";
import { AudioDiagnostic } from "./AudioDiagnostic";
import { useT } from "@/lib/i18n/useT";
import { DEFAULT_A4, MAX_A4, MIN_A4 } from "@/lib/music/notes";
import {
  DEFAULT_SETTINGS,
  SETTINGS_STORAGE_KEY,
  useSettings,
  type LocalePref,
  type NotationPref,
  type ThemePref,
} from "@/store/settings";
import { useFavorites } from "@/store/favorites";
import { useCustomTunings } from "@/store/tunings";

const THEMES: ThemePref[] = ["system", "light", "dark"];
const A4_PRESETS = [432, 440, 442, 444];
const STORAGE_KEYS = [SETTINGS_STORAGE_KEY, "cherry-tunings", "cherry-favorites"];
const TOGGLES = [
  ["precise", "settings.precise"],
  ["leftHanded", "settings.leftHanded"],
  ["refTone", "settings.refTone"],
  ["haptics", "settings.haptics"],
  ["tuneChime", "settings.tuneChime"],
  ["demo", "settings.demo"],
] as const;

function Row({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-14 items-center justify-between gap-4 py-2">
      <label htmlFor={htmlFor} className="font-medium">
        {label}
      </label>
      {children}
    </div>
  );
}

export function SettingsScreen() {
  const t = useT();
  const s = useSettings();

  const clearData = () => {
    if (!window.confirm(t("settings.clearConfirm"))) return;
    STORAGE_KEYS.forEach((k) => localStorage.removeItem(k));
    useSettings.setState(DEFAULT_SETTINGS);
    useCustomTunings.setState({ custom: [] });
    useFavorites.setState({ chordIds: [], shapes: [] });
  };

  return (
    <div className="space-y-6 px-4 pt-4 pb-6">
      <h1 className="font-display text-3xl font-semibold">{t("settings.title")}</h1>

      <section className="divide-y divide-base-300 rounded-box bg-base-200 px-4">
        <div className="py-3">
          <p id="theme-label" className="mb-2 font-medium">
            {t("settings.theme")}
          </p>
          <div
            role="radiogroup"
            aria-labelledby="theme-label"
            className="grid grid-cols-3 gap-1 rounded-full bg-base-100 p-1"
          >
            {THEMES.map((theme) => (
              <button
                key={theme}
                type="button"
                role="radio"
                aria-checked={s.theme === theme}
                onClick={() => s.set({ theme })}
                className={`min-h-11 rounded-full text-sm font-semibold transition-colors ${
                  s.theme === theme ? "bg-primary text-primary-content" : "hover:bg-base-200"
                }`}
              >
                {t(`settings.theme.${theme}`)}
              </button>
            ))}
          </div>
        </div>

        <div className="py-3">
          <div className="mb-2 flex items-baseline justify-between">
            <p id="a4-label" className="font-medium">
              {t("settings.a4")}
            </p>
            <span
              className={`font-display text-2xl font-semibold tabular-nums ${
                s.a4 === DEFAULT_A4 ? "text-primary" : "text-warning"
              }`}
            >
              {s.a4} Hz
            </span>
          </div>
          {/* Steppers and presets only: a slider here could be nudged while scrolling the
              page, silently shifting every reading (444 Hz reads −16 cents everywhere). */}
          <div role="group" aria-labelledby="a4-label" className="flex items-center gap-2">
            <button
              type="button"
              className="btn btn-circle size-11 bg-base-100 btn-ghost text-lg"
              aria-label={`${t("settings.a4")} −1 Hz`}
              disabled={s.a4 <= MIN_A4}
              onClick={() => s.setA4(s.a4 - 1)}
            >
              −
            </button>
            <div className="grid flex-1 grid-cols-4 gap-1">
              {A4_PRESETS.map((hz) => (
                <button
                  key={hz}
                  type="button"
                  aria-pressed={s.a4 === hz}
                  onClick={() => s.setA4(hz)}
                  className={`min-h-11 rounded-full text-sm font-semibold tabular-nums transition-colors ${
                    s.a4 === hz
                      ? "bg-primary text-primary-content"
                      : "bg-base-100 hover:bg-base-300"
                  }`}
                >
                  {hz}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="btn btn-circle size-11 bg-base-100 btn-ghost text-lg"
              aria-label={`${t("settings.a4")} +1 Hz`}
              disabled={s.a4 >= MAX_A4}
              onClick={() => s.setA4(s.a4 + 1)}
            >
              +
            </button>
          </div>
          <p className="mt-2 text-xs text-base-content/75">{t("settings.a4.help")}</p>
        </div>

        <Row label={t("settings.language")} htmlFor="locale">
          <select
            id="locale"
            className="select w-40"
            value={s.locale}
            onChange={(e) => s.set({ locale: e.target.value as LocalePref })}
          >
            <option value="auto">{t("settings.language.auto")}</option>
            <option value="fr">Français</option>
            <option value="en">English</option>
          </select>
        </Row>

        <Row label={t("settings.notation")} htmlFor="notation">
          <select
            id="notation"
            className="select w-40"
            value={s.notation}
            onChange={(e) => s.set({ notation: e.target.value as NotationPref })}
          >
            <option value="auto">{t("settings.notation.auto")}</option>
            <option value="letters">{t("settings.notation.letters")}</option>
            <option value="solfege">{t("settings.notation.solfege")}</option>
          </select>
        </Row>
      </section>

      <section className="divide-y divide-base-300 rounded-box bg-base-200 px-4">
        {TOGGLES.map(([key, label]) => (
          <Row key={key} label={t(label)} htmlFor={`opt-${key}`}>
            <input
              id={`opt-${key}`}
              type="checkbox"
              className="toggle toggle-primary"
              checked={s[key]}
              onChange={(e) => s.set({ [key]: e.target.checked })}
            />
          </Row>
        ))}
      </section>

      <AudioDiagnostic />

      <Link
        href="/settings/credits"
        className="flex min-h-14 items-center justify-between rounded-box bg-base-200 px-4 font-medium transition-colors hover:bg-base-300"
      >
        {t("credits.title")}
        <ChevronRightIcon width={20} height={20} aria-hidden="true" />
      </Link>

      <button
        type="button"
        className="btn min-h-12 w-full btn-outline btn-error"
        onClick={clearData}
      >
        <TrashIcon width={20} height={20} />
        {t("settings.clear")}
      </button>

      <p className="text-center text-sm text-base-content/75">{t("settings.about")}</p>
    </div>
  );
}
