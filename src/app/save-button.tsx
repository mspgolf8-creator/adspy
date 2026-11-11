"use client";

import { useOptimistic, useTransition } from "react";
import { toggleSaved } from "./actions";

export function SaveButton({ id, saved }: { id: string; saved: boolean }) {
  const [optimistic, setOptimistic] = useOptimistic(saved);
  const [, start] = useTransition();
  return (
    <button
      type="button"
      title={optimistic ? "Retirer des sauvegardées" : "Sauvegarder"}
      onClick={() =>
        start(async () => {
          setOptimistic(!optimistic);
          await toggleSaved(id, !optimistic);
        })
      }
      className={`rounded-md px-2 py-1 text-sm transition ${
        optimistic ? "bg-blue-100 text-blue-700" : "text-slate-500 hover:bg-slate-200 hover:text-slate-800"
      }`}
    >
      {optimistic ? "★" : "☆"}
    </button>
  );
}
