/**
 * Classement des pubs. Trois modes (CLASSIFY_MODE dans .env.local) :
 *   rules  (défaut) gratuit, par mots-clés (voir rules.ts)
 *   hybrid règles d'abord, puis Claude seulement pour les pubs restées en « Autre »
 *   ai     tout par Claude
 */
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { db } from "./supabase";
import { ANGLES, CATEGORIES } from "./categories";
import { classifyByRules } from "./rules";
import { errMsg } from "./errors";

type Mode = "rules" | "hybrid" | "ai";
export function classifyMode(): Mode {
  const m = (process.env.CLASSIFY_MODE || "rules").toLowerCase();
  return m === "ai" || m === "hybrid" ? m : "rules";
}

type AdText = {
  id: string;
  page_name: string | null;
  bodies: string[];
  link_titles: string[];
  link_descriptions: string[];
};
const TEXT_COLUMNS = "id, page_name, bodies, link_titles, link_descriptions";
type Log = (msg: string) => void;

// ───────────── Règles ─────────────

async function applyRules(ads: AdText[]) {
  const now = new Date().toISOString();
  const rows = ads.map((ad) => ({ id: ad.id, ...classifyByRules(ad), classified_at: now, classified_by: "rules" }));
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await db().from("ads").upsert(rows.slice(i, i + 500), { onConflict: "id" });
    if (error) throw error;
  }
  return rows.length;
}

async function rulesOnPending(log: Log) {
  let total = 0;
  for (let round = 0; round < 50; round++) {
    const { data, error } = await db().from("ads").select(TEXT_COLUMNS).is("classified_at", null).limit(1000);
    if (error) throw error;
    if (!data?.length) break;
    total += await applyRules(data as AdText[]);
  }
  log(`✓ règles : ${total} pubs classées`);
  return total;
}

/** Après avoir amélioré rules.ts : reclasse tout ce qui a été classé par les règles (pas le manuel ni l'IA). */
export async function reclassifyRules(log: Log = console.log) {
  let total = 0;
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db()
      .from("ads")
      .select(TEXT_COLUMNS)
      .eq("classified_by", "rules")
      .order("id")
      .range(from, from + 999);
    if (error) throw error;
    if (!data?.length) break;
    total += await applyRules(data as AdText[]);
    if (data.length < 1000) break;
  }
  log(`✓ ${total} pubs reclassées avec les règles`);
  return total;
}

// ───────────── IA (Claude) ─────────────

const ResultSchema = z.object({
  ads: z.array(
    z.object({
      id: z.string(),
      category: z.enum(CATEGORIES),
      product: z.string().describe("Le produit ou service vendu, en 2 à 6 mots, en français"),
      angle: z.enum(ANGLES),
      hook: z.string().describe("La première phrase accrocheuse de la pub, telle quelle (langue d'origine)"),
      offer: z.string().describe("L'offre (rabais, livraison gratuite, bundle...) ou chaîne vide s'il n'y en a pas"),
    }),
  ),
});

const SYSTEM = `Tu classes des publicités Meta pour un outil d'espionnage publicitaire (adspy) utilisé par un dropshipper.
Pour chaque pub, à partir de son texte, du nom de la page et des titres de lien :
- category : la niche du produit vendu (pas le ton de la pub).
- product : ce qui est vendu, court et concret (ex. « brosse nettoyante pour chien »).
- angle : l'angle publicitaire principal.
- hook : la première phrase qui sert d'accroche, copiée telle quelle.
- offer : l'offre commerciale s'il y en a une.
Retourne exactement une entrée par pub, avec le même id.`;

let anthropic: Anthropic | null = null;
function client() {
  if (!anthropic) anthropic = new Anthropic();
  return anthropic;
}

function describe(ad: AdText) {
  return [
    `### id: ${ad.id}`,
    `Page : ${ad.page_name ?? "?"}`,
    `Texte : ${ad.bodies.slice(0, 2).join("\n---\n").slice(0, 1500) || "(aucun)"}`,
    ad.link_titles.length ? `Titres : ${ad.link_titles.slice(0, 3).join(" | ")}` : "",
    ad.link_descriptions.length ? `Descriptions : ${ad.link_descriptions.slice(0, 2).join(" | ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

async function aiBatch(ads: AdText[]) {
  const model = process.env.CLASSIFY_MODEL || "claude-haiku-5-5";
  // Repli automatique si un modèle refuse (supporté par Opus / Sonnet / Fable, pas Haiku)
  const fallback = model.includes("haiku")
    ? {}
    : { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const };

  const response = await client().beta.messages.parse({
    model,
    max_tokens: 16000,
    system: SYSTEM,
    output_config: { effort: "low", format: betaZodOutputFormat(ResultSchema) },
    messages: [{ role: "user", content: ads.map(describe).join("\n\n") }],
    ...fallback,
  });

  if (response.stop_reason === "refusal") throw new Error("Le modèle a refusé ce lot");
  if (response.stop_reason === "max_tokens") throw new Error("Réponse coupée (max_tokens)");
  if (!response.parsed_output) throw new Error("Réponse illisible");
  return response.parsed_output.ads;
}

async function aiOn(ads: AdText[], log: Log) {
  if (!process.env.ANTHROPIC_API_KEY) {
    log("✗ IA ignorée : ANTHROPIC_API_KEY vide dans .env.local");
    return { classified: 0, failed: 0 };
  }
  const batchSize = Number(process.env.CLASSIFY_BATCH || 20);
  let classified = 0;
  let failed = 0;
  for (let i = 0; i < ads.length; i += batchSize) {
    const batch = ads.slice(i, i + batchSize);
    try {
      const results = await aiBatch(batch);
      const known = new Set(batch.map((a) => a.id));
      const now = new Date().toISOString();
      const rows = results
        .filter((r) => known.has(r.id))
        .map((r) => ({ ...r, offer: r.offer || null, classified_at: now, classified_by: "ai" }));
      const { error } = await db().from("ads").upsert(rows, { onConflict: "id" });
      if (error) throw error;
      classified += rows.length;
      log(`✓ IA lot ${i / batchSize + 1} : ${rows.length} pubs`);
    } catch (e) {
      failed += batch.length;
      if (e instanceof Anthropic.AuthenticationError) throw new Error("ANTHROPIC_API_KEY invalide");
      if (e instanceof Anthropic.RateLimitError) {
        log("✗ Limite de requêtes Claude atteinte, on arrête pour cette fois");
        break;
      }
      log(`✗ IA lot ${i / batchSize + 1} : ${errMsg(e)}`);
    }
  }
  return { classified, failed };
}

// ───────────── Point d'entrée ─────────────

export async function classifyPending(log: Log = console.log): Promise<{ classified: number; failed: number }> {
  const mode = classifyMode();
  const aiLimit = Number(process.env.CLASSIFY_LIMIT || 500);

  if (mode === "ai") {
    const { data, error } = await db()
      .from("ads")
      .select(TEXT_COLUMNS)
      .is("classified_at", null)
      .order("last_seen_at", { ascending: false })
      .limit(aiLimit);
    if (error) throw error;
    return aiOn((data ?? []) as AdText[], log);
  }

  const byRules = await rulesOnPending(log);
  if (mode === "rules") return { classified: byRules, failed: 0 };

  // hybrid : l'IA repasse seulement sur ce que les règles ont laissé en « Autre »
  const { data, error } = await db()
    .from("ads")
    .select(TEXT_COLUMNS)
    .eq("classified_by", "rules")
    .eq("category", "Autre")
    .order("last_seen_at", { ascending: false })
    .limit(aiLimit);
  if (error) throw error;
  const ai = await aiOn((data ?? []) as AdText[], log);
  return { classified: byRules, failed: ai.failed };
}
