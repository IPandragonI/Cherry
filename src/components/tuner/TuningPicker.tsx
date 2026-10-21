"use client";

import { useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { PencilIcon, PlusIcon, TrashIcon } from "@/components/ui/icons";
import { tuningName, useT } from "@/lib/i18n/useT";
import { displayNote, noteName } from "@/lib/music/notes";
import { DEFAULT_TUNING, PRESET_TUNINGS, type Tuning } from "@/lib/music/tunings";
import { useSettings } from "@/store/settings";
import { useCustomTunings } from "@/store/tunings";
import { TuningEditor } from "./TuningEditor";

export const tuningNotes = (tuning: Tuning) =>
  tuning.strings.map((m) => displayNote(noteName(m))).join(" ");

interface TuningPickerProps {
  open: boolean;
  onClose: () => void;
  current: Tuning;
}

export function TuningPicker({ open, onClose, current }: TuningPickerProps) {
  const t = useT();
  const setSettings = useSettings((s) => s.set);
  const { custom, save, remove } = useCustomTunings();
  const [editing, setEditing] = useState<Tuning | null>(null);

  const choose = (tuning: Tuning) => {
    setSettings({ tuningId: tuning.id });
    onClose();
  };

  const close = () => {
    setEditing(null);
    onClose();
  };

  const row = (tuning: Tuning) => {
    const active = tuning.id === current.id;
    const name = tuningName(t, tuning);
    return (
      <li key={tuning.id} className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => choose(tuning)}
          aria-current={active ? "true" : undefined}
          className={`flex min-h-12 flex-1 items-center justify-between rounded-xl px-3 text-left transition-colors ${
            active ? "bg-primary text-primary-content" : "hover:bg-base-200"
          }`}
        >
          <span className="font-medium">{name}</span>
          <span className={`text-sm tabular-nums ${active ? "" : "text-base-content/75"}`}>
            {tuningNotes(tuning)}
          </span>
        </button>
        {tuning.custom && (
          <>
            <button
              type="button"
              className="btn btn-circle size-11 btn-ghost"
              aria-label={t("tunings.edit", { name })}
              onClick={() => setEditing(tuning)}
            >
              <PencilIcon width={20} height={20} />
            </button>
            <button
              type="button"
              className="btn btn-circle size-11 btn-ghost"
              aria-label={t("tunings.delete", { name })}
              onClick={() => {
                remove(tuning.id);
                if (active) setSettings({ tuningId: DEFAULT_TUNING.id });
              }}
            >
              <TrashIcon width={20} height={20} />
            </button>
          </>
        )}
      </li>
    );
  };

  return (
    <Sheet
      open={open}
      onClose={close}
      title={
        editing
          ? t(editing.custom ? "tunings.edit" : "tunings.new", { name: editing.name })
          : t("tunings.title")
      }
    >
      {editing ? (
        <TuningEditor
          key={editing.id}
          initial={editing}
          onCancel={() => setEditing(null)}
          onSave={({ name, strings }) => {
            const id = editing.custom ? editing.id : `custom-${crypto.randomUUID()}`;
            save({ id, name, strings, custom: true });
            setSettings({ tuningId: id });
            setEditing(null);
            onClose();
          }}
        />
      ) : (
        <div className="space-y-4">
          <section>
            <h3 className="mb-1 px-1 text-xs font-semibold tracking-wide text-base-content/75 uppercase">
              {t("tunings.presets")}
            </h3>
            <ul className="space-y-0.5">{PRESET_TUNINGS.map(row)}</ul>
          </section>
          <section>
            <h3 className="mb-1 px-1 text-xs font-semibold tracking-wide text-base-content/75 uppercase">
              {t("tunings.custom")}
            </h3>
            <ul className="space-y-0.5">{custom.map(row)}</ul>
            <button
              type="button"
              className="btn mt-2 min-h-12 w-full btn-outline btn-primary"
              onClick={() => setEditing({ ...current, id: "new", custom: false })}
            >
              <PlusIcon width={20} height={20} />
              {t("tunings.new")}
            </button>
          </section>
        </div>
      )}
    </Sheet>
  );
}
