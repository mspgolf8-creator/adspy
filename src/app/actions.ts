"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/supabase";
import { collect } from "@/lib/collect";
import { classifyPending, reclassifyRules } from "@/lib/classify";
import { CATEGORIES } from "@/lib/categories";
import { errMsg } from "@/lib/errors";

export async function toggleSaved(id: string, saved: boolean) {
  await db().from("ads").update({ saved }).eq("id", id);
  revalidatePath("/");
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
