"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { hrefWith, SORTS, type Search, type SortKey } from "@/lib/filters";
import { IconSearch, IconSort } from "./icons";

/** Recherche « Smart » (mots dans n'importe quel ordre) ou « Exact » (expression exacte). */
export function SearchBar({ sp }: { sp: Search }) {
  const router = useRouter();
  const [q, setQ] = useState(sp.q ?? "");
  const exact = sp.mode === "exact";
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        router.push(hrefWith(sp, { q: q.trim() || undefined }));
      }}
      className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#141418] p-2"
    >
      <div className="flex rounded-xl bg-[#1d1d23] p-1 text-sm font-semibold">
        {(["smart", "exact"] as const).map((m) => (
          <button key={m} type="button" onClick={() => router.push(hrefWith(sp, { mode: m === "exact" ? "exact" : undefined }))}
            className={`rounded-lg px-3 py-1.5 transition ${(m === "exact") === exact ? "bg-[#2a2a32] text-white" : "text-zinc-400 hover:text-white"}`}>
            {m === "smart" ? "Smart" : "Exact"}
          </button>
        ))}
      </div>
      <IconSearch className="h-4 w-4 shrink-0 text-zinc-400" />
      <input value={q} onChange={(e) => setQ(e.target.value)}
        placeholder="Rechercher des mots-clés (ex. rides) ou des marques (ex. Ryze)…"
        className="min-w-0 flex-1 bg-transparent py-2 text-[15px] text-white outline-none placeholder:text-zinc-500" />
    </form>
  );
}

export function SortSelect({ sp, sort }: { sp: Search; sort: SortKey }) {
  const router = useRouter();
  return (
    <label className="relative flex items-center gap-2 rounded-xl border border-white/10 bg-[#1a1a1f] py-1.5 pl-3 pr-2 text-sm font-semibold text-zinc-100">
      <IconSort />
      <select value={sort} onChange={(e) => router.push(hrefWith(sp, { sort: e.target.value === "reach" ? undefined : e.target.value }))}
        className="cursor-pointer appearance-none bg-transparent pr-1 outline-none">
        {Object.entries(SORTS).map(([k, v]) => <option key={k} value={k} className="bg-[#1c1c22]">{v}</option>)}
      </select>
    </label>
  );
}
