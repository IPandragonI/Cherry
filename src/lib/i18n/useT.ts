"use client";

import { useCallback, useSyncExternalStore } from "react";
import { useSettings } from "@/store/settings";
import type { Notation } from "@/lib/music/notes";
import { MESSAGES, type Locale, type MessageKey } from "./messages";

export type Translate = (key: MessageKey, vars?: Record<string, string | number>) => string;

const noopSubscribe = () => () => {};

function browserLocale(): Locale {
  return navigator.language.toLowerCase().startsWith("fr") ? "fr" : "en";
}

/** The active UI locale: the user's choice, else the browser language (FR during SSR). */
export function useLocale(): Locale {
  const pref = useSettings((s) => s.locale);
  const detected = useSyncExternalStore(noopSubscribe, browserLocale, () => "fr" as const);
  return pref === "auto" ? detected : pref;
}

export function translate(locale: Locale, key: MessageKey, vars?: Record<string, string | number>) {
  const template = MESSAGES[locale][key] ?? key;
  return vars ? template.replace(/\{(\w+)\}/g, (m, name) => String(vars[name] ?? m)) : template;
}

export function useT(): Translate {
  const locale = useLocale();
  return useCallback((key, vars) => translate(locale, key, vars), [locale]);
}

/** Display name of a tuning: preset names are i18n keys, custom names are free text. */
export function tuningName(t: Translate, tuning: { name: string; custom?: boolean }): string {
  return tuning.custom ? tuning.name : t(tuning.name as MessageKey);
}

/** Locale-aware number formatting ("110,0" in French). */
export function useNumberFormat(fractionDigits = 1) {
  const locale = useLocale();
  return useCallback(
    (n: number) =>
      n.toLocaleString(locale === "fr" ? "fr-FR" : "en-US", {
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
      }),
    [locale, fractionDigits],
  );
}

/** Note naming convention in effect: the user's choice, else the interface language's. */
export function useNotation(): Notation {
  const pref = useSettings((s) => s.notation);
  const locale = useLocale();
  if (pref !== "auto") return pref;
  return locale === "fr" ? "solfege" : "letters";
}
