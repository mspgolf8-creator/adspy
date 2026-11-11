"use client";

import { useOptimistic, useTransition } from "react";
import { toggleSaved } from "./actions";
import { IconBookmark } from "./icons";

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
      className={`rounded-md p-1 transition ${optimistic ? "text-blue-400" : "text-zinc-400 hover:text-white"}`}
    >
      <IconBookmark className={`h-[18px] w-[18px] ${optimistic ? "fill-current" : ""}`} />
    </button>
  );
}
