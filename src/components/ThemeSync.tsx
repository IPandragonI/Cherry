"use client";

import { useEffect } from "react";
import { useLocale } from "@/lib/i18n/useT";
import { useSettings } from "@/store/settings";

const THEME_NAMES = { light: "cherry", dark: "cherry-dark" } as const;

/** Mirrors the theme and language preferences onto <html> and the theme-color meta. */
export function ThemeSync({ light, dark }: { light: string; dark: string }) {
  const theme = useSettings((s) => s.theme);
  const locale = useLocale();

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(() => {
    const root = document.documentElement;
    const metas = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]');
    if (theme === "system") {
      delete root.dataset.theme;
      metas.forEach((m) => {
        const isDark = m.media.includes("dark");
        m.content = isDark ? dark : light;
      });
    } else {
      root.dataset.theme = THEME_NAMES[theme];
      metas.forEach((m) => (m.content = theme === "dark" ? dark : light));
    }
  }, [theme, light, dark]);

  return null;
}
