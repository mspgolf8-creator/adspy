"use client";

import { useActionState } from "react";
import { runClassify, runCollect, runReclassify, type JobState } from "../actions";

function Job({ label, action }: { label: string; action: () => Promise<JobState> }) {
  const [state, run, pending] = useActionState<JobState>(action, null);
  return (
    <div className="space-y-2">
      <form action={run}>
        <button disabled={pending}
          className="w-full rounded-md bg-zinc-800 px-4 py-2 text-sm font-medium hover:bg-zinc-700 disabled:opacity-50">
          {pending ? "En cours… (peut prendre quelques minutes)" : label}
        </button>
      </form>
      {state && (
        <pre className="max-h-48 overflow-auto rounded-md bg-zinc-950 p-3 text-xs text-zinc-400">{state.lines.join("\n")}</pre>
      )}
    </div>
  );
}

export function JobButtons() {
  return (
    <div className="space-y-3">
      <Job label="1. Collecter les pubs maintenant" action={runCollect} />
      <Job label="2. Classer les nouvelles pubs" action={runClassify} />
      <Job label="Reclasser avec les règles (après une amélioration)" action={runReclassify} />
    </div>
  );
}
