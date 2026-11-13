/**
 * Ménage des grosses marques (100+ pubs actives), par petits paquets pour ne jamais remplir
 * le disque du plan gratuit : on calcule le rang réel de chaque pub dans sa marque (sur TOUTES
 * ses pubs), on le garde dans ad_ext, puis on efface les pubs qui ne pourront jamais passer
 * le pré-filtre (3 étoiles et +, 7 jours et +). Les pubs sauvegardées ou en dossier restent.
 */
import { db } from "./supabase";

type Log = (msg: string) => void;
type Row = { id: string; page_id: string; eu_total_reach: number | null; delivery_start: string | null; first_seen_at: string | null; saved: boolean };

const BIG = 100;
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function all<T>(make: (from: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await make(from);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < 1000) return out;
  }
}

/** Rang (0 = la plus vue) et règle « peut passer » : 14 j+, ou 7 j+ dans la meilleure moitié. */
export function rankBrand<T>(items: T[], reach: (x: T) => number, start: (x: T) => string | null) {
  const now = Date.now();
  const days = (x: T) => Math.max(1, Math.floor((now - Date.parse(start(x) ?? new Date().toISOString())) / 86400_000));
  const sorted = [...items].sort((a, b) => reach(b) - reach(a) || days(b) - days(a));
  const n = sorted.length;
  return sorted.map((x, i) => {
    const pct = n > 1 ? i / (n - 1) : 0;
    const d = days(x);
    return { item: x, pct, keep: d >= 14 || (d >= 7 && pct <= 0.5) };
  });
}

export async function alleger(log: Log = console.log) {
  const big = new Set((await all<{ page_id: string }>((f) =>
    db().from("brands").select("page_id").gte("total_active", BIG).order("page_id").range(f, f + 999))).map((b) => b.page_id));
  const inFolder = new Set((await all<{ ad_id: string }>((f) =>
    db().from("folder_ads").select("ad_id").order("ad_id").range(f, f + 999))).map((r) => r.ad_id));
  const rows = await all<Row>((f) => db().from("ads")
    .select("id, page_id, eu_total_reach, delivery_start, first_seen_at, saved")
    .eq("is_active", true).eq("source", "api").not("page_id", "is", null).order("id").range(f, f + 999));
  const byBrand = new Map<string, Row[]>();
  for (const r of rows) if (big.has(r.page_id)) byBrand.set(r.page_id, [...(byBrand.get(r.page_id) ?? []), r]);
  log(`Ménage : ${byBrand.size} grosses marques, ${[...byBrand.values()].reduce((s, l) => s + l.length, 0)} pubs à trier`);

  const ext: { id: string; ext_pct: number }[] = [];
  const drop: string[] = [];
  for (const list of byBrand.values()) {
    for (const r of rankBrand(list, (x) => x.eu_total_reach ?? 0, (x) => x.delivery_start ?? x.first_seen_at)) {
      if (r.keep || r.item.saved || inFolder.has(r.item.id)) ext.push({ id: r.item.id, ext_pct: r.pct });
      else drop.push(r.item.id);
    }
  }
  log(`→ ${ext.length} pubs gardées, ${drop.length} à effacer`);

  for (let i = 0; i < ext.length; i += 1000) {
    const { error } = await db().from("ad_ext").upsert(ext.slice(i, i + 1000), { onConflict: "id" });
    if (error) throw error;
  }
  log(`✓ rang réel enregistré pour ${ext.length} pubs`);

  let done = 0;
  for (let i = 0; i < drop.length; i += 200) {
    const { error } = await db().from("ads").delete().in("id", drop.slice(i, i + 200));
    if (error) throw new Error(`${error.message} (après ${done} effacées)`);
    done += Math.min(200, drop.length - i);
    if (done % 10000 < 200) log(`  … ${done}/${drop.length} effacées`);
    await pause(300); // laisse le disque respirer
  }
  log(`✓ ménage : ${done} pubs effacées`);
}
