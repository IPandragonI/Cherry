"use client";

import { Sheet } from "@/components/ui/Sheet";
import { useT } from "@/lib/i18n/useT";
import { NECK_SKINS, useSettings } from "@/store/settings";
import { HEADSTOCK_IDS } from "./headstocks";
import { Neck } from "./Neck";

const option = (active: boolean) =>
  `flex flex-col items-center gap-2 rounded-2xl border-2 p-2.5 transition-colors ${
    active ? "border-primary bg-primary/8" : "border-base-300 hover:bg-base-200"
  }`;

export function SkinPicker({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const skin = useSettings((s) => s.skin);
  const headstock = useSettings((s) => s.headstock);
  const set = useSettings((s) => s.set);

  return (
    <Sheet open={open} onClose={onClose} title={t("skin.title")}>
      <h3 id="headstock-label" className="mb-2 text-sm font-semibold text-base-content/75">
        {t("headstock.title")}
      </h3>
      <div role="radiogroup" aria-labelledby="headstock-label" className="grid grid-cols-2 gap-3">
        {HEADSTOCK_IDS.map((h) => (
          <button
            key={h}
            type="button"
            role="radio"
            aria-checked={h === headstock}
            onClick={() => set({ headstock: h })}
            className={option(h === headstock)}
          >
            <Neck
              skin={skin}
              model={h}
              strings={6}
              target={null}
              inTune={false}
              className="neck h-24 w-auto"
            />
            <span className="text-sm font-medium">{t(`headstock.${h}`)}</span>
          </button>
        ))}
      </div>

      <h3 id="skin-label" className="mt-5 mb-2 text-sm font-semibold text-base-content/75">
        {t("skin.fingerboard")}
      </h3>
      <div role="radiogroup" aria-labelledby="skin-label" className="grid grid-cols-3 gap-3">
        {NECK_SKINS.map((s) => (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={s === skin}
            onClick={() => set({ skin: s })}
            className={option(s === skin)}
          >
            <span
              className="neck block h-16 w-10 rounded-md shadow-inner"
              data-skin={s}
              style={{
                background:
                  "repeating-linear-gradient(to bottom, transparent 0 22px, var(--fret) 22px 24px), linear-gradient(to right, var(--wood-2), var(--wood-1), var(--wood-2))",
              }}
              aria-hidden="true"
            />
            <span className="text-sm font-medium">{t(`skin.${s}`)}</span>
          </button>
        ))}
      </div>
    </Sheet>
  );
}
