"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/supabase";
import { collect } from "@/lib/collect";
import { classifyPending, reclassifyRules } from "@/lib/classify";
import { CATEGORIES } from "@/lib/categories";
import { errMsg } from "@/lib/errors";

export async function toggleSaved(id: string, saved: boolean) {
  await quickSave(id, saved);
}

/** Correction manuelle : les règles ne toucheront plus jamais à cette pub. */
export async function setCategory(id: string, category: string) {
  if (!(CATEGORIES as readonly string[]).includes(category)) return;
  await db()
    .from("ads")
    .update({ category, classified_by: "manual", classified_at: new Date().toISOString() })
    .eq("id", id);
  revalidatePath("/");
}

export async function runReclassify(): Promise<JobState> {
  const lines: string[] = [];
  try {
    await reclassifyRules((m) => lines.push(m));
  } catch (e) {
    lines.push(`Erreur : ${errMsg(e)}`);
  }
  revalidatePath("/", "layout");
  return { lines, done: true };
}

export async function addKeyword(formData: FormData) {
  const term = String(formData.get("term") ?? "").trim().toLowerCase();
  if (!term) return;
  await db().from("keywords").upsert({ term, enabled: true }, { onConflict: "term" });
  revalidatePath("/settings");
}

export async function toggleKeyword(id: number, enabled: boolean) {
  await db().from("keywords").update({ enabled }).eq("id", id);
  revalidatePath("/settings");
}

export async function deleteKeyword(id: number) {
  await db().from("keywords").delete().eq("id", id);
  revalidatePath("/settings");
}

export type JobState = { lines: string[]; done: boolean } | null;

export async function runCollect(): Promise<JobState> {
  const lines: string[] = [];
  try {
    const r = await collect((m) => lines.push(m));
    lines.push(`→ ${r.upserted} pubs sauvegardées, ${r.deactivated} marquées inactives`);
  } catch (e) {
    lines.push(`Erreur : ${errMsg(e)}`);
  }
  revalidatePath("/", "layout");
  return { lines, done: true };
}

export async function runClassify(): Promise<JobState> {
  const lines: string[] = [];
  try {
    const r = await classifyPending((m) => lines.push(m));
    lines.push(`→ ${r.classified} classées, ${r.failed} en échec`);
  } catch (e) {
    lines.push(`Erreur : ${errMsg(e)}`);
  }
  revalidatePath("/", "layout");
  return { lines, done: true };
}

/* ---------- Dossiers et tags ---------- */

export type Folder = { id: number; name: string; n: number };

/** `saved` = la pub est dans au moins un dossier (Swipe File + jamais effacée par le ménage). */
async function syncSaved(adId: string) {
  const { count } = await db().from("folder_ads").select("ad_id", { count: "exact", head: true }).eq("ad_id", adId);
  await db().from("ads").update({ saved: (count ?? 0) > 0 }).eq("id", adId);
}

async function defaultFolderId() {
  const { data } = await db().from("folders").select("id").order("created_at").limit(1).maybeSingle();
  if (data) return data.id as number;
  const { data: f } = await db().from("folders").insert({ name: "Dossier par défaut" }).select("id").single();
  return f!.id as number;
}

/** Bouton Sauvegarder : ajoute au dossier par défaut, ou retire de tous les dossiers. */
export async function quickSave(adId: string, save: boolean) {
  if (save) await db().from("folder_ads").upsert({ folder_id: await defaultFolderId(), ad_id: adId }, { onConflict: "folder_id,ad_id" });
  else await db().from("folder_ads").delete().eq("ad_id", adId);
  await syncSaved(adId);
  revalidatePath("/", "layout");
}

export async function setInFolder(adId: string, folderId: number, inside: boolean) {
  if (inside) await db().from("folder_ads").upsert({ folder_id: folderId, ad_id: adId }, { onConflict: "folder_id,ad_id" });
  else await db().from("folder_ads").delete().eq("ad_id", adId).eq("folder_id", folderId);
  await syncSaved(adId);
  revalidatePath("/", "layout");
}

export async function createFolder(name: string, adId?: string): Promise<number | null> {
  const clean = name.trim().slice(0, 60);
  if (!clean) return null;
  const { data, error } = await db().from("folders").upsert({ name: clean }, { onConflict: "name" }).select("id").single();
  if (error || !data) return null;
  if (adId) await setInFolder(adId, data.id, true);
  revalidatePath("/", "layout");
  return data.id as number;
}

export async function renameFolder(id: number, name: string) {
  const clean = name.trim().slice(0, 60);
  if (clean) await db().from("folders").update({ name: clean }).eq("id", id);
  revalidatePath("/", "layout");
}

/** Supprime le dossier (pas les pubs) ; les pubs qui ne sont plus dans aucun dossier redeviennent non sauvegardées. */
export async function deleteFolder(id: number) {
  const { data } = await db().from("folder_ads").select("ad_id").eq("folder_id", id);
  await db().from("folders").delete().eq("id", id);
  for (const r of data ?? []) await syncSaved(r.ad_id as string);
  revalidatePath("/", "layout");
}

export async function setTags(adId: string, tags: string[]) {
  const clean = [...new Set(tags.map((t) => t.trim().toLowerCase().slice(0, 40)).filter(Boolean))];
  await db().from("ads").update({ tags: clean }).eq("id", adId);
  revalidatePath("/", "layout");
}
