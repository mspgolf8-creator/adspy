import Link from "next/link";
import { db, isConfigured, ScoredAd } from "@/lib/supabase";
import { ANGLES } from "@/lib/categories";
import { SetupNotice } from "./setup-notice";
import { SaveButton } from "./save-button";
import { CategorySelect } from "./category-select";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 48;
const HIDDEN_IN_ALL = "Livres, jeux & apps";
const SORTS = {
  score: { label: "Score gagnante", column: "winner_score" },
  days: { label: "Jours actifs", column: "days_running" },
  reach: { label: "Portée UE", column: "eu_total_reach" },
  recent: { label: "Plus récentes", column: "delivery_start" },
} as const;
type SortKey = keyof typeof SORTS;

type Search = Record<string, string | undefined>;

function href(current: Search, patch: Search) {
  const next = { ...current, ...patch };
  if (!("page" in patch)) delete next.page;
  const qs = new URLSearchParams(
    Object.entries(next).filter((e): e is [string, string] => Boolean(e[1])),
  ).toString();
  return qs ? `/?${qs}` : "/";
}

const fmt = new Intl.NumberFormat("fr-CA", { notation: "compact", maximumFractionDigits: 1 });

export default async function Home({ searchParams }: { searchParams: Promise<Search> }) {
  if (!isConfigured()) return <SetupNotice />;
  const sp = await searchParams;
  const sort: SortKey = (sp.sort as SortKey) in SORTS ? (sp.sort as SortKey) : "score";
  const page = Math.max(1, Number(sp.page || 1));
  const minDays = Number(sp.min || 0);

  let query = db().from("ads_scored").select("*", { count: "exact" });
  if (sp.saved) query = query.eq("saved", true);
  else if (!sp.all) query = query.eq("is_active", true);
  if (sp.cat === "Non classée") query = query.is("category", null);
  else if (sp.cat) query = query.eq("category", sp.cat);
  // « Toutes » = les pubs de produits : les romans / apps restent dans leur propre catégorie
  else if (!sp.saved) query = query.or(`category.is.null,category.neq."${HIDDEN_IN_ALL}"`);
  if (sp.angle) query = query.eq("angle", sp.angle);
  if (minDays) query = query.gte("days_running", minDays);
  if (sp.q) query = query.textSearch("search", sp.q, { type: "websearch", config: "simple" });
  query = query
    .order(SORTS[sort].column, { ascending: false, nullsFirst: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  const [{ data, count, error }, { data: cats }] = await Promise.all([
    query,
    db().from("category_counts").select("category, n"),
  ]);
  const ads = (data ?? []) as ScoredAd[];
  const total = count ?? 0;
  const pages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-5">
      {/* Catégories */}
      <div className="flex flex-wrap gap-2">
        <Link
          href={href(sp, { cat: undefined })}
          className={`rounded-full px-3 py-1 text-sm ${!sp.cat ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
        >
          Toutes
        </Link>
        {[...(cats ?? [])]
          .sort((a, b) => Number(a.category === HIDDEN_IN_ALL) - Number(b.category === HIDDEN_IN_ALL))
          .map((c) => (
          <Link
            key={c.category}
            href={href(sp, { cat: c.category })}
            className={`rounded-full px-3 py-1 text-sm ${sp.cat === c.category ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
          >
            {c.category} <span className="opacity-60">{c.n}</span>
          </Link>
        ))}
      </div>

      {/* Filtres */}
      <form className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-3 text-sm">
        {sp.cat && <input type="hidden" name="cat" value={sp.cat} />}
        {sp.saved && <input type="hidden" name="saved" value="1" />}
        <label className="flex min-w-[200px] flex-1 flex-col gap-1">
          <span className="text-slate-500">Recherche</span>
          <input name="q" defaultValue={sp.q} placeholder="produit, marque, mot dans la pub…"
            className="rounded-md border border-slate-300 bg-white px-3 py-2 outline-none focus:border-blue-500" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-slate-500">Angle</span>
          <select name="angle" defaultValue={sp.angle ?? ""} className="rounded-md border border-slate-300 bg-white px-3 py-2">
            <option value="">Tous</option>
            {ANGLES.map((a) => <option key={a}>{a}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-slate-500">Actives depuis</span>
          <select name="min" defaultValue={sp.min ?? ""} className="rounded-md border border-slate-300 bg-white px-3 py-2">
            <option value="">Peu importe</option>
            <option value="7">7 jours +</option>
            <option value="14">14 jours +</option>
            <option value="30">30 jours +</option>
            <option value="60">60 jours +</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-slate-500">Trier par</span>
          <select name="sort" defaultValue={sort} className="rounded-md border border-slate-300 bg-white px-3 py-2">
            {Object.entries(SORTS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 pb-2 text-slate-500">
          <input type="checkbox" name="all" value="1" defaultChecked={Boolean(sp.all)} /> Inclure les arrêtées
        </label>
        <button className="rounded-md bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700">Filtrer</button>
      </form>

      {error && <p className="text-sm text-red-600">Erreur Supabase : {error.message}</p>}
      <p className="text-sm text-slate-500">{total} pubs</p>

      {/* Grille */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ads.map((ad) => (
          <article key={ad.id} className="flex flex-col gap-3 overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            {ad.media_url ? (
              <a href={`https://www.facebook.com/ads/library/?id=${ad.id}`} target="_blank" rel="noreferrer"
                className="relative -mx-4 -mt-4 block bg-slate-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={ad.media_url} alt={ad.page_name ?? "Visuel de la pub"} loading="lazy"
                  className="max-h-96 w-full object-cover object-top" />
                {ad.media_kind === "video" && (
                  <span className="absolute bottom-2 left-2 rounded-full bg-black/70 px-2.5 py-1 text-xs font-medium text-white">
                    ▶ Vidéo
                  </span>
                )}
              </a>
            ) : (
              <div className="-mx-4 -mt-4 flex h-24 items-center justify-center bg-slate-100 text-xs text-slate-400">
                {ad.media_tried_at ? "Pas de visuel" : "Visuel à venir"}
              </div>
            )}
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <h2 className="truncate font-medium">{ad.page_name ?? "Page inconnue"}</h2>
                <p className="text-xs text-slate-500">
                  {ad.page_active_ads} pubs actives · {ad.publisher_platforms.map((p) => p.toLowerCase()).join(", ")}
                </p>
              </div>
              <SaveButton id={ad.id} saved={ad.saved} />
            </div>

            <div className="flex flex-wrap gap-1.5 text-xs">
              <span className={`rounded px-2 py-0.5 ${ad.days_running >= 30 ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-700"}`}>
                {ad.days_running} j
              </span>
              {ad.eu_total_reach != null && (
                <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-700">{fmt.format(ad.eu_total_reach)} vues UE</span>
              )}
              <CategorySelect id={ad.id} category={ad.category} manual={ad.classified_by === "manual"} />
              {ad.angle && <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-500">{ad.angle}</span>}
              {!ad.is_active && <span className="rounded bg-red-500/15 px-2 py-0.5 text-red-300">Arrêtée</span>}
            </div>

            {ad.product && <p className="text-sm text-slate-500">🛒 {ad.product}{ad.offer ? ` · ${ad.offer}` : ""}</p>}
            {ad.hook && <p className="font-medium leading-snug text-slate-900">« {ad.hook} »</p>}
            <p className="line-clamp-5 whitespace-pre-line text-sm text-slate-700">{ad.bodies[0] ?? ""}</p>
            {ad.link_titles[0] && <p className="text-sm font-medium text-slate-800">{ad.link_titles[0]}</p>}

            <div className="mt-auto flex gap-3 border-t border-slate-200 pt-3 text-xs">
              <a className="text-blue-700 hover:underline" target="_blank" rel="noreferrer"
                href={`https://www.facebook.com/ads/library/?id=${ad.id}`}>Voir la pub ↗</a>
              {ad.page_id && (
                <a className="text-slate-500 hover:underline" target="_blank" rel="noreferrer"
                  href={`https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&view_all_page_id=${ad.page_id}`}>
                  Toutes les pubs de la page ↗
                </a>
              )}
            </div>
          </article>
        ))}
      </div>

      {total === 0 && !error && (
        <p className="py-16 text-center text-slate-500">
          Aucune pub. Va dans <Link href="/settings" className="text-blue-700 underline">Réglages</Link> et lance une collecte.
        </p>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-center gap-4 text-sm">
          {page > 1 && <Link href={href(sp, { page: String(page - 1) })} className="text-blue-700">← Précédent</Link>}
          <span className="text-slate-500">Page {page} / {pages}</span>
          {page < pages && <Link href={href(sp, { page: String(page + 1) })} className="text-blue-700">Suivant →</Link>}
        </div>
      )}
    </div>
  );
}
