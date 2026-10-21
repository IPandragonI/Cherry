"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { useT } from "@/lib/i18n/useT";
import { CloseIcon } from "./icons";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

/** Bottom sheet on phones, centred dialog on wider screens (native <dialog>, focus-trapped). */
export function Sheet({ open, onClose, title, children }: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const t = useT();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="modal modal-bottom sm:modal-middle"
      aria-labelledby={titleId}
      onClose={onClose}
      onCancel={onClose}
    >
      <div
        className="modal-box max-h-[85dvh] bg-base-100 px-5 pt-3"
        style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-base-300 sm:hidden" />
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 id={titleId} className="font-display text-xl font-semibold">
            {title}
          </h2>
          <button
            type="button"
            className="btn btn-circle size-11 btn-ghost"
            onClick={onClose}
            aria-label={t("common.close")}
          >
            <CloseIcon width={22} height={22} />
          </button>
        </div>
        {children}
      </div>
      <form method="dialog" className="modal-backdrop">
        <button type="submit" tabIndex={-1} aria-hidden="true" onClick={onClose}>
          {t("common.close")}
        </button>
      </form>
    </dialog>
  );
}
