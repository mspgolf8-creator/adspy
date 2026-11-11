import Link from "next/link";
import { db, isConfigured, ScoredAd } from "@/lib/supabase";
import { PAGE_TYPES } from "@/lib/categories";
import { hrefWith, list, num, SORT_COLUMNS, SORTS, type Search, type SortKey } from "@/lib/filters";
import { SetupNotice } from "./setup-notice";
import { AdCard } from "./ad-card";
import { FilterBar, type Facets } from "./filter-bar";
import { SearchBar, SortSelect } from "./search-bar";
import { IconBolt, IconExplore } from "./icons";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;
const HIDDEN_IN_ALL = "Livres, jeux & apps";
const fmt = new Intl.NumberFormat("fr-CA");

/** Raccourcis du haut (comme « Best of the Month », « VSL's »…). */
const PRESETS: { label: string; patch: Search }[] = [
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

  let query = db().from("ads_scored").select("*", { count: "exact" });
  if (sp.saved) query = query.eq("saved", true);
  if (sp.status === "inactive") query = query.eq("is_active", false);
  else if (sp.status !== "all" && !sp.saved) query = query.eq("is_active", true);
  if (sp.brand) query = query.eq("page_id", sp.brand);

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
  const pt = list(sp, "pt");
  if (pt.length) query = query.in("page_type", pt);

  const niches = list(sp, "niche");
  if (niches.length) {
    const named = niches.filter((n) => n !== "Non classée");
    if (niches.includes("Non classée")) {
      const quoted = named.map((n) => `"${n.replace(/"/g, "")}"`).join(",");
      query = query.or(named.length ? `category.is.null,category.in.(${quoted})` : "category.is.null");
    } else query = query.in("category", named);
  } else if (!sp.saved && !sp.brand) {
    // Par défaut on cache les romans / apps : ils ont leur propre niche
    query = query.or(`category.is.null,category.neq."${HIDDEN_IN_ALL}"`);
  }
  if (sp.q) query = query.textSearch("search", sp.q, { type: sp.mode === "exact" ? "phrase" : "websearch", config: "simple" });

  query = query
    .order(SORT_COLUMNS[sort], { ascending: false, nullsFirst: false })
    .order("id")
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  const [{ data, count, error }, cats, ctry, lng, pts, totalActive, brand] = await Promise.all([
    query,
    db().from("category_counts").select("category, n"),
    db().from("facet_countries").select("code, n"),
    db().from("facet_languages").select("code, n"),
    db().from("facet_page_types").select("page_type, n"),
    db().from("ads").select("id", { count: "exact", head: true }).eq("is_active", true),
    sp.brand ? db().from("ads").select("page_name").eq("page_id", sp.brand).limit(1).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const ads = (data ?? []) as ScoredAd[];
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
  };

  const title = sp.saved ? "Swipe File" : brand.data?.page_name ? brand.data.page_name : "Explore";
  const subtitle = sp.saved ? "Les pubs que tu as sauvegardées" : sp.brand ? "Toutes les pubs de cette marque" : "Découvre les pubs qui roulent en ce moment pour t'inspirer";

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

      {!sp.saved && !sp.brand && (
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
        {ads.map((ad) => <AdCard key={ad.id} ad={ad} />)}
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
    </div>
  );
}
