"use client";

import { useTransition } from "react";
import { CATEGORIES } from "@/lib/categories";
import { setCategory } from "./actions";

/** Pastille de catégorie cliquable : choisir une autre valeur corrige la pub à la main. */
export function CategorySelect({ id, category, manual }: { id: string; category: string | null; manual: boolean }) {
  const [pending, start] = useTransition();
  return (
    <select
      value={category ?? ""}
      disabled={pending}
      title={manual ? "Catégorie corrigée à la main" : "Mauvaise catégorie ? Corrige-la ici"}
      onChange={(e) => start(() => setCategory(id, e.target.value))}
      className="cursor-pointer appearance-none rounded bg-violet-500/15 px-2 py-0.5 text-violet-300 outline-none hover:bg-violet-500/25 disabled:opacity-50"
    >
      {!category && <option value="">Non classée</option>}
      {CATEGORIES.map((c) => (
        <option key={c} value={c} className="bg-zinc-900 text-zinc-100">
          {c}
          {manual && c === category ? " ✓" : ""}
        </option>
      ))}
    </select>
  );
}
