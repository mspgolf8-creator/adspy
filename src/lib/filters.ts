/** Filtres de la page Explore : lus et écrits dans l'URL (?perf=5,4&rmin=14…). */

export type Search = Record<string, string | undefined>;

export const SORTS = {
  reach: "Plus d'impressions",
  score: "Score gagnante",
  days: "Jours actifs",
  recent: "Plus récentes",
  creative: "Créa la plus utilisée",
} as const;
export type SortKey = keyof typeof SORTS;
export const SORT_COLUMNS: Record<SortKey, string> = {
  reach: "eu_total_reach",
  score: "winner_score",
  days: "days_running",
  recent: "delivery_start",
  creative: "creative_count",
};

/** Niveaux de performance (mêmes paliers que GetHookd). */
export const STAR_LEVELS = [
  { stars: 5, label: "Top 10 % de la marque · 14 j +" },
  { stars: 4, label: "Top 25 % de la marque · 7 j +" },
  { stars: 3, label: "Performe régulièrement" },
  { stars: 2, label: "Prometteuse" },
  { stars: 1, label: "Début" },
] as const;

export const CHANNELS = [
  { value: "facebook", label: "Facebook" },
  { value: "instagram", label: "Instagram" },
  { value: "messenger", label: "Messenger" },
  { value: "audience_network", label: "Audience Network" },
  { value: "threads", label: "Threads" },
] as const;

/** Paramètres multi-valeurs (séparés par des virgules). */
export const LIST_KEYS = ["perf", "country", "lang", "niche", "ch", "pt", "tag"] as const;

/** Pays collectés par la bibliothèque publique (pas de portée : classés par rang d'impressions de Meta). */
export const LIB_COUNTRIES = ["US", "CA"];

export function list(sp: Search, key: string): string[] {
  return (sp[key] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}

export function num(sp: Search, key: string): number | null {
  const n = Number(sp[key]);
  return sp[key] && Number.isFinite(n) && n > 0 ? n : null;
}

export function hrefWith(sp: Search, patch: Search) {
  const next: Search = { ...sp, ...patch };
  if (!("page" in patch)) delete next.page;
  const qs = new URLSearchParams(
    Object.entries(next).filter((e): e is [string, string] => Boolean(e[1])),
  ).toString();
  return qs ? `/?${qs}` : "/";
}

const regionNames = new Intl.DisplayNames(["fr"], { type: "region" });
const languageNames = new Intl.DisplayNames(["fr"], { type: "language" });

export function countryName(code: string) {
  try {
    return regionNames.of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}
export function languageName(code: string) {
  try {
    const n = languageNames.of(code) ?? code;
    return n.charAt(0).toUpperCase() + n.slice(1);
  } catch {
    return code;
  }
}
export function flag(code: string) {
  if (!/^[A-Za-z]{2}$/.test(code)) return "🏳️";
  return String.fromCodePoint(...[...code.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

/** Libellés des filtres appliqués (les pastilles « Filtres appliqués »). */
export function appliedFilters(sp: Search): { key: string; keys: string[]; label: string }[] {
  const out: { key: string; keys: string[]; label: string }[] = [];
  const perf = list(sp, "perf");
  if (perf.length) out.push({ key: "perf", keys: ["perf"], label: `Performance ${perf.map((s) => `${s}★`).join(", ")}` });
  if (sp.rmin || sp.rmax) out.push({ key: "run", keys: ["rmin", "rmax"], label: `Durée ${range(sp.rmin, sp.rmax, "j")}` });
  if (sp.cu) out.push({ key: "cu", keys: ["cu"], label: `Créa utilisée ${sp.cu}× +` });
  if (sp.bmin || sp.bmax) out.push({ key: "brand", keys: ["bmin", "bmax"], label: `Pubs actives marque ${range(sp.bmin, sp.bmax, "")}` });
  if (sp.limit) out.push({ key: "limit", keys: ["limit"], label: `Max par marque ${sp.limit}` });
  const c = list(sp, "country");
  if (c.length) out.push({ key: "country", keys: ["country"], label: `Pays ${c.join(", ")}` });
  const l = list(sp, "lang");
  if (l.length) out.push({ key: "lang", keys: ["lang"], label: `Langue ${l.map(languageName).join(", ")}` });
  const n = list(sp, "niche");
  if (n.length) out.push({ key: "niche", keys: ["niche"], label: n.length > 2 ? `Niche (${n.length})` : `Niche ${n.join(", ")}` });
  const ch = list(sp, "ch");
  if (ch.length) out.push({ key: "ch", keys: ["ch"], label: `Canaux ${ch.map((v) => CHANNELS.find((x) => x.value === v)?.label ?? v).join(", ")}` });
  const pt = list(sp, "pt");
  if (pt.length) out.push({ key: "pt", keys: ["pt"], label: pt.length > 2 ? `Type de page (${pt.length})` : `Type de page ${pt.join(", ")}` });
  const tg = list(sp, "tag");
  if (tg.length) out.push({ key: "tag", keys: ["tag"], label: `Tag ${tg.join(", ")}` });
  if (sp.status && sp.status !== "active") out.push({ key: "status", keys: ["status"], label: sp.status === "all" ? "Statut : toutes" : "Statut : arrêtées" });
  if (sp.brand) out.push({ key: "brandid", keys: ["brand"], label: "Une marque" });
  return out;
}

function range(min?: string, max?: string, unit = "") {
  if (min && max) return `${min} à ${max}${unit && ` ${unit}`}`;
  if (min) return `${min}${unit && ` ${unit}`} +`;
  return `≤ ${max}${unit && ` ${unit}`}`;
}
