"use client";

import { useActionState } from "react";
import { runClassify, runCollect, runReclassify, type JobState } from "../actions";

function Job({ label, action }: { label: string; action: () => Promise<JobState> }) {
  const [state, run, pending] = useActionState<JobState>(action, null);
  return (
    <div className="space-y-2">
      <form action={run}>
        <button disabled={pending}
          className="w-full rounded-md bg-slate-100 px-4 py-2 text-sm font-medium hover:bg-slate-200 disabled:opacity-50">
          {pending ? "En cours… (peut prendre quelques minutes)" : label}
        </button>
      </form>
      {state && (
        <pre className="max-h-48 overflow-auto rounded-md bg-slate-50 p-3 text-xs text-slate-500">{state.lines.join("\n")}</pre>
      )}
    </div>
  );
}

export function JobButtons({ canCollect }: { canCollect: boolean }) {
  return (
    <div className="space-y-3">
      {canCollect ? (
        <Job label="1. Collecter les pubs maintenant" action={runCollect} />
      ) : (
        <p className="rounded-md bg-slate-50 p-3 text-xs text-slate-500">
          Pour lancer une collecte tout de suite : GitHub → ton dépôt adspy → Actions → « Collecte quotidienne » → Run workflow.
        </p>
      )}
      <Job label="2. Classer les nouvelles pubs" action={runClassify} />
      <Job label="Reclasser avec les règles (après une amélioration)" action={runReclassify} />
    </div>
  );
}
