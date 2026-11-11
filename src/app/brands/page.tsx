import Link from "next/link";
import { db, isConfigured } from "@/lib/supabase";
import { SetupNotice } from "../setup-notice";
import { IconBrand, IconPulse, IconStar } from "../icons";

export const dynamic = "force-dynamic";

const compact = new Intl.NumberFormat("fr-CA", { notation: "compact", maximumFractionDigits: 1 });
const SORTS = { active_ads: "Plus de pubs actives", winners: "Plus de gagnantes (4★ +)", best_reach: "Plus grosse portée" } as const;

type Brand = { page_id: string; page_name: string | null; active_ads: number; winners: number; best_reach: number | null; category: string | null };

export default async function Brands({ searchParams }: { searchParams: Promise<{ q?: string; sort?: string }> }) {
  if (!isConfigured()) return <SetupNotice />;
  const sp = await searchParams;
  const sort = sp.sort && sp.sort in SORTS ? (sp.sort as keyof typeof SORTS) : "active_ads";

  let query = db().from("brand_stats").select("*").gt("active_ads", 0);
  if (sp.q) query = query.ilike("page_name", `%${sp.q.replace(/[%,()]/g, "")}%`);
  const { data, error } = await query.order(sort, { ascending: false, nullsFirst: false }).limit(120);
  const brands = (data ?? []) as Brand[];

  return (
    <div className="mx-auto max-w-[1920px] space-y-4">
      <div className="flex items-center gap-4">
        <span className="grid h-12 w-12 place-items-center rounded-full border border-white/10 bg-[#141418]"><IconBrand className="h-5 w-5" /></span>
        <div>
          <h1 className="text-2xl font-bold text-white">Brand Spy</h1>
          <p className="text-sm text-zinc-400">Les marques qui ont le plus de pubs actives en ce moment</p>
        </div>
      </div>

      <form className="flex flex-wrap gap-2 rounded-2xl border border-white/10 bg-[#141418] p-2">
        <input name="q" defaultValue={sp.q} placeholder="Chercher une marque…"
          className="min-w-[200px] flex-1 bg-transparent px-3 py-2 text-white outline-none placeholder:text-zinc-500" />
        <select name="sort" defaultValue={sort} className="rounded-xl border border-white/10 bg-[#1a1a1f] px-3 text-sm font-semibold">
          {Object.entries(SORTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500">Chercher</button>
      </form>

      {error && <p className="text-sm text-red-400">Erreur Supabase : {error.message}</p>}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {brands.map((b) => (
          <Link key={b.page_id} href={`/?brand=${b.page_id}`}
            className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#141418] p-4 transition hover:border-white/25">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-blue-600 font-bold text-white">
              {(b.page_name ?? "?").charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-white">{b.page_name ?? "Page inconnue"}</p>
              <p className="truncate text-xs text-zinc-400">{b.category ?? "Non classée"}</p>
            </div>
            <div className="flex flex-col items-end gap-1 text-xs font-semibold">
              <span className="flex items-center gap-1 rounded-md bg-[#0f3a22] px-1.5 py-0.5 text-[#22c55e]"><IconPulse className="h-3 w-3" />{b.active_ads}</span>
              <span className="flex items-center gap-1 text-zinc-400"><IconStar className="h-3 w-3 text-[#22c55e]" />{b.winners} · {b.best_reach ? compact.format(b.best_reach) : "?"}</span>
            </div>
          </Link>
        ))}
      </div>
      {!brands.length && !error && <p className="py-16 text-center text-zinc-500">Aucune marque.</p>}
    </div>
  );
}
