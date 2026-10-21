"use client";

import { Sheet } from "@/components/ui/Sheet";
import { useT } from "@/lib/i18n/useT";
import { NECK_SKINS, useSettings } from "@/store/settings";

export function SkinPicker({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const skin = useSettings((s) => s.skin);
  const set = useSettings((s) => s.set);

  return (
    <Sheet open={open} onClose={onClose} title={t("skin.title")}>
      <div role="radiogroup" aria-label={t("skin.title")} className="grid grid-cols-3 gap-3">
        {NECK_SKINS.map((s) => {
          const active = s === skin;
          return (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => set({ skin: s })}
              className={`flex flex-col items-center gap-2 rounded-2xl border-2 p-3 transition-colors ${
                active ? "border-primary bg-primary/8" : "border-base-300 hover:bg-base-200"
              }`}
            >
              <span
                className="neck block h-20 w-10 rounded-md shadow-inner"
                data-skin={s}
                style={{
                  background:
                    "repeating-linear-gradient(to bottom, transparent 0 22px, var(--fret) 22px 24px), linear-gradient(to right, var(--wood-2), var(--wood-1), var(--wood-2))",
                }}
                aria-hidden="true"
              />
              <span className="text-sm font-medium">{t(`skin.${s}`)}</span>
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}
