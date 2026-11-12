import Link from "next/link";
import { db, isConfigured, ScoredAd } from "@/lib/supabase";
import { PAGE_TYPES } from "@/lib/categories";
import { hrefWith, LIB_COUNTRIES, list, num, PREFILTER, SORT_COLUMNS, SORTS, type Search, type SortKey } from "@/lib/filters";
import type { Folder } from "./actions";
import { SetupNotice } from "./setup-notice";
import { AdCard } from "./ad-card";
import { AdDetails } from "./ad-details";
import { FilterBar, type Facets } from "./filter-bar";
import { SearchBar, SortSelect } from "./search-bar";
import { IconBolt, IconExplore } from "./icons";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;
const HIDDEN_IN_ALL = "Livres, jeux & apps";
const fmt = new Intl.NumberFormat("fr-CA");

/** Raccourcis du haut (comme « Best of the Month », « VSL's »…). */
const PRESETS: { label: string; patch: Search }[] = [
  { label: "🇺🇸 Pubs US / Canada", patch: { country: "US,CA" } },
  { label: "🏆 Meilleures du mois", patch: { perf: "5,4", rmax: "31" } },
  { label: "🎬 Pages VSL", patch: { pt: "Page VSL" } },
  { label: "📈 Marques avec 100+ pubs actives", patch: { bmin: "100" } },
  { label: "💄 Pubs beauté", patch: { niche: "Beauté & soins" } },
];

export default async function Home({ searchParams }: { searchParams: Promise<Search> }) {
  if (!isConfigured()) return <SetupNotice />;
  const sp = await searchParams;
  const sort: SortKey = sp.sort && sp.sort in SORTS ? (sp.sort as SortKey) : "reach";
  const page = Math.max(1, Number(sp.page || 1));

  // Dossier ouvert (?folder=ID) : on prend la liste des pubs qu'il contient
  const folderId = num(sp, "folder");
  let folderAdIds: string[] | null = null;
  if (folderId) {
    const { data: fa } = await db().from("folder_ads").select("ad_id").eq("folder_id", folderId).order("added_at", { ascending: false }).limit(5000);
    folderAdIds = (fa ?? []).map((r) => r.ad_id as string);
  }
  const inSwipe = Boolean(sp.saved || folderId);

  let query = db().from("ads_scored").select("*", { count: "exact" });
  if (folderAdIds) query = query.in("id", folderAdIds.length ? folderAdIds : ["-"]);
  else if (sp.saved) query = query.eq("saved", true);
  if (sp.status === "inactive") query = query.eq("is_active", false);
  else if (sp.status !== "all" && !inSwipe) query = query.eq("is_active", true);
  if (sp.brand) query = query.eq("page_id", sp.brand);
  // Jamais de carte « Visuel à venir » : une pub apparaît quand son visuel est prêt (sauf dans tes dossiers)
  if (!inSwipe) query = prefilter(query.not("media_url", "is", null));

  const perf = list(sp, "perf").map(Number).filter((n) => n >= 1 && n <= 5);
  if (perf.length) query = query.in("stars", perf);
  if (num(sp, "rmin")) query = query.gte("days_running", num(sp, "rmin")!);
  if (num(sp, "rmax")) query = query.lte("days_running", num(sp, "rmax")!);
  if (num(sp, "cu")) query = query.gte("creative_count", num(sp, "cu")!);
  if (num(sp, "bmin")) query = query.gte("page_active_ads", num(sp, "bmin")!);
  if (num(sp, "bmax")) query = query.lte("page_active_ads", num(sp, "bmax")!);
  if (num(sp, "limit")) query = query.lte("brand_rank", num(sp, "limit")!);
  const countries = list(sp, "country");
  if (countries.length) query = query.overlaps("countries", countries);
  const langs = list(sp, "lang");
  if (langs.length) query = query.overlaps("languages", langs);
  const ch = list(sp, "ch");
  if (ch.length) query = query.overlaps("publisher_platforms", ch);
  const tags = list(sp, "tag");
  if (tags.length) query = query.overlaps("tags", tags);
  const pt = list(sp, "pt");
  if (pt.length) query = query.in("page_type", pt);

  const niches = list(sp, "niche");
  if (niches.length) {
    const named = niches.filter((n) => n !== "Non classée");
    if (niches.includes("Non classée")) {
      const quoted = named.map((n) => `"${n.replace(/"/g, "")}"`).join(",");
      query = query.or(named.length ? `category.is.null,category.in.(${quoted})` : "category.is.null");
    } else query = query.in("category", named);
  } else if (!inSwipe && !sp.brand) {
    // Par défaut on cache les romans / apps : ils ont leur propre niche
    query = query.or(`category.is.null,category.neq."${HIDDEN_IN_ALL}"`);
  }
  if (sp.q) query = query.textSearch("search", sp.q, { type: sp.mode === "exact" ? "phrase" : "websearch", config: "simple" });

  // US / Canada : pas de portée, donc « Plus d'impressions » = l'ordre de Meta (rang 1 = la plus vue)
  const libOnly = countries.length > 0 && countries.every((c) => LIB_COUNTRIES.includes(c));
  if (sort === "reach" && libOnly) query = query.order("lib_rank", { ascending: true, nullsFirst: false });
  else query = query.order(SORT_COLUMNS[sort], { ascending: false, nullsFirst: false });
  query = query
    .order("id")
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  const [{ data, count, error }, cats, ctry, lng, pts, totalActive, brand, fold, tagc] = await Promise.all([
    query,
    db().from("category_counts").select("category, n"),
    db().from("facet_countries").select("code, n"),
    db().from("facet_languages").select("code, n"),
    db().from("facet_page_types").select("page_type, n"),
    prefilter(db().from("ads_scored").select("id", { count: "exact", head: true }).eq("is_active", true).not("media_url", "is", null)),
    sp.brand ? db().from("ads").select("page_name").eq("page_id", sp.brand).limit(1).maybeSingle() : Promise.resolve({ data: null }),
    db().from("folder_counts").select("id, name, n"),
    db().from("tag_counts").select("tag, n"),
  ]);
  const ads = (data ?? []) as ScoredAd[];
  const folders = (fold.data ?? []) as Folder[];
  const allTags = (tagc.data ?? []).map((t) => t.tag as string);
  const detailsHref = (id: string) => hrefWith(sp, { ad: id, page: sp.page });

  // Fenêtre « Détails de la pub » (?ad=ID) + pubs similaires (même niche, autres marques)
  let selected: ScoredAd | null = null;
  let similar: ScoredAd[] = [];
  if (sp.ad) {
    const { data: one } = await db().from("ads_scored").select("*").eq("id", sp.ad).maybeSingle();
    selected = (one as ScoredAd) ?? null;
    if (selected?.category) {
      let sim = prefilter(db().from("ads_scored").select("*").eq("is_active", true).not("media_url", "is", null)).eq("category", selected.category).neq("id", selected.id);
      if (selected.page_id) sim = sim.neq("page_id", selected.page_id);
      const { data: s } = await sim.order("eu_total_reach", { ascending: false, nullsFirst: false }).limit(4);
      similar = (s ?? []) as ScoredAd[];
    }
  }
  // Dossiers de chaque pub affichée (menu Sauvegarder)
  const shownIds = [...ads.map((a) => a.id), ...similar.map((a) => a.id), ...(selected ? [selected.id] : [])];
  const { data: fa } = shownIds.length ? await db().from("folder_ads").select("ad_id, folder_id").in("ad_id", shownIds) : { data: [] };
  const folderMap = new Map<string, number[]>();
  for (const r of fa ?? []) folderMap.set(r.ad_id as string, [...(folderMap.get(r.ad_id as string) ?? []), r.folder_id as number]);
  const extras = (id: string) => ({ folders, allTags, folderIds: folderMap.get(id) ?? [] });

  const total = count ?? 0;
  const pages = Math.ceil(total / PAGE_SIZE);

  const ptCounts = new Map((pts.data ?? []).map((p) => [p.page_type as string, p.n as number]));
  const facets: Facets = {
    countries: (ctry.data ?? []).map((c) => ({ value: c.code, n: c.n })),
    languages: (lng.data ?? []).map((c) => ({ value: c.code, n: c.n })),
    niches: [...(cats.data ?? [])]
      .sort((a, b) => Number(a.category === HIDDEN_IN_ALL) - Number(b.category === HIDDEN_IN_ALL))
      .map((c) => ({ value: c.category, n: c.n })),
    pageTypes: PAGE_TYPES.map((t) => ({ value: t, n: ptCounts.get(t) ?? 0 })),
    tags: (tagc.data ?? []).map((t) => ({ value: t.tag as string, n: t.n as number })),
  };

  const folderName = folderId ? folders.find((f) => f.id === folderId)?.name : null;
  const title = folderName ?? (sp.saved ? "Swipe File" : brand.data?.page_name ? brand.data.page_name : "Explore");
  const subtitle = folderName ? "Dossier de ton Swipe File" : sp.saved ? "Les pubs que tu as sauvegardées" : sp.brand ? "Toutes les pubs de cette marque" : "Découvre les pubs qui roulent en ce moment pour t'inspirer";

  return (
    <div className="mx-auto max-w-[1920px] space-y-4">
      {/* Titre */}
      <div className="flex items-center gap-4">
        <span className="grid h-12 w-12 place-items-center rounded-full border border-white/10 bg-[#141418]">
          <IconExplore className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-bold text-white">{title}</h1>
          <p className="text-sm text-zinc-400">{subtitle}</p>
        </div>
      </div>

      {!inSwipe && !sp.brand && (
        <div className="flex flex-wrap justify-center gap-2">
          {PRESETS.map((p) => (
            <Link key={p.label} href={hrefWith({}, p.patch)}
              className="rounded-lg bg-[#141418] px-3 py-1.5 text-sm font-semibold text-zinc-100 hover:bg-[#1d1d23]">
              {p.label}
            </Link>
          ))}
        </div>
      )}

      <SearchBar sp={sp} />
      <FilterBar sp={sp} facets={facets} />

      {error && <p className="text-sm text-red-400">Erreur Supabase : {error.message}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm font-semibold text-zinc-300">
          {fmt.format(total)} <span className="font-normal text-zinc-500">sur {fmt.format(totalActive.count ?? 0)} pubs actives</span>
        </p>
        <div className="ml-auto"><SortSelect sp={sp} sort={sort} /></div>
      </div>

      <div className="grid gap-4 min-[640px]:grid-cols-2 min-[1024px]:grid-cols-3 min-[1280px]:grid-cols-4 min-[1400px]:grid-cols-5">
        {ads.map((ad) => <AdCard key={ad.id} ad={ad} detailsHref={detailsHref(ad.id)} extras={extras(ad.id)} />)}
      </div>

      {total === 0 && !error && (
        <p className="flex items-center justify-center gap-2 py-16 text-center text-zinc-500">
          <IconBolt /> Aucune pub avec ces filtres.
        </p>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-center gap-4 py-4 text-sm">
          {page > 1 && <Link href={hrefWith(sp, { page: String(page - 1) })} className="rounded-lg bg-[#141418] px-3 py-1.5 text-zinc-200 hover:bg-[#1d1d23]">← Précédent</Link>}
          <span className="text-zinc-500">Page {page} / {pages}</span>
          {page < pages && <Link href={hrefWith(sp, { page: String(page + 1) })} className="rounded-lg bg-[#141418] px-3 py-1.5 text-zinc-200 hover:bg-[#1d1d23]">Suivant →</Link>}
        </div>
      )}
      {selected && (
        <AdDetails ad={selected} similar={similar} detailsHref={detailsHref} extras={extras}
          closeHref={hrefWith(sp, { ad: undefined, page: sp.page })} />
      )}
    </div>
  );
}

/**
 * Pré-filtre de l'adspy : seules les pubs qui valent la peine entrent dans Explore
 * (3 étoiles et +, 7 jours et +, marque avec 100 pubs actives et +). Tes dossiers montrent tout.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function prefilter<Q extends { gte: (col: string, v: number) => any }>(q: Q): Q {
  return q.gte("stars", PREFILTER.stars).gte("days_running", PREFILTER.days).gte("page_active_ads", PREFILTER.brandAds);
}
