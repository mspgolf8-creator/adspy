import { db, isConfigured } from "@/lib/supabase";
import { addKeyword, deleteKeyword, toggleKeyword } from "../actions";
import { SetupNotice } from "../setup-notice";
import { JobButtons } from "./job-buttons";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // maximum du plan gratuit Vercel

const dt = new Intl.DateTimeFormat("fr-CA", { dateStyle: "short", timeStyle: "short" });

export default async function Settings() {
  if (!isConfigured()) return <SetupNotice />;

  const [{ data: keywords }, { data: runs }, { count: pending }, { count: total }] = await Promise.all([
    db().from("keywords").select("*").order("id"),
    db().from("runs").select("*").order("id", { ascending: false }).limit(8),
    db().from("ads").select("id", { count: "exact", head: true }).is("classified_at", null),
    db().from("ads").select("id", { count: "exact", head: true }),
  ]);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
        <div>
          <h2 className="text-lg font-semibold">Mots-clés surveillés</h2>
          <p className="text-sm text-zinc-500">
            Chaque collecte cherche les pubs actives qui contiennent ces mots, dans les pays UE configurés.
            Mets des mots dans la langue des pubs (anglais, français, allemand…).
          </p>
        </div>
        <form action={addKeyword} className="flex gap-2">
          <input name="term" placeholder="ex. posture corrector"
            className="flex-1 rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-violet-500" />
          <button className="rounded-md bg-violet-500 px-4 py-2 text-sm font-medium text-white hover:bg-violet-400">Ajouter</button>
        </form>
        <ul className="divide-y divide-zinc-800 text-sm">
          {(keywords ?? []).map((k) => (
            <li key={k.id} className="flex items-center gap-3 py-2">
              <span className={`flex-1 ${k.enabled ? "" : "text-zinc-600 line-through"}`}>{k.term}</span>
              <span className="text-xs text-zinc-500">
                {k.last_collected_at ? dt.format(new Date(k.last_collected_at)) : "jamais"}
              </span>
              <form action={toggleKeyword.bind(null, k.id, !k.enabled)}>
                <button className="text-xs text-zinc-400 hover:text-zinc-100">{k.enabled ? "Pause" : "Activer"}</button>
              </form>
              <form action={deleteKeyword.bind(null, k.id)}>
                <button className="text-xs text-red-400 hover:text-red-300">Supprimer</button>
              </form>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
        <div>
          <h2 className="text-lg font-semibold">Collecte et classification</h2>
          <p className="text-sm text-zinc-500">
            {total ?? 0} pubs en base · {pending ?? 0} pas encore classées.
            La collecte roule toute seule chaque jour à 7 h (GitHub Actions).
          </p>
        </div>
        {/* En ligne (Vercel), une collecte complète dépasse le temps permis : elle passe par GitHub Actions */}
        <JobButtons canCollect={!process.env.VERCEL} />
        <div>
          <h3 className="mb-2 text-sm font-medium text-zinc-300">Dernières exécutions</h3>
          <ul className="space-y-1 text-xs text-zinc-400">
            {(runs ?? []).map((r) => (
              <li key={r.id}>
                {r.ok === null ? "⏳" : r.ok ? "✓" : "✗"} {r.kind} · {dt.format(new Date(r.started_at))}
                {r.detail?.upserted != null && ` · ${r.detail.upserted} pubs`}
              </li>
            ))}
            {!runs?.length && <li>Aucune pour l’instant.</li>}
          </ul>
        </div>
      </section>
    </div>
  );
}
