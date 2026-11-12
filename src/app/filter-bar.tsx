"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { CHANNELS, STAR_LEVELS, appliedFilters, countryName, flag, hrefWith, languageName, list, type Search } from "@/lib/filters";
import {
  IconBars, IconChevron, IconFlag, IconHourglass, IconLanguage, IconLayers, IconLimit, IconMegaphone,
  IconPage, IconPulse, IconReset, IconStatus, IconTag, IconTarget, IconX,
} from "./icons";
import { Stars } from "./stars";

type Facet = { value: string; n?: number };
export type Facets = { countries: Facet[]; languages: Facet[]; niches: Facet[]; pageTypes: Facet[]; tags: Facet[] };

export function FilterBar({ sp, facets }: { sp: Search; facets: Facets }) {
  const router = useRouter();
  const [open, setOpen] = useState<string | null>(null);
  const go = (patch: Search) => {
    setOpen(null);
    router.push(hrefWith(sp, patch));
  };
  const applied = appliedFilters(sp);
  const props = (id: string) => ({ id, open: open === id, setOpen, sp, go });

  return (
    <section className="rounded-2xl border border-white/10 bg-[#141418] p-4">
      <div className="mb-3 flex min-h-8 flex-wrap items-center gap-2 text-sm">
        <span className="font-semibold text-zinc-200">Filtres appliqués ({applied.length}) :</span>
        {applied.map((f) => (
          <button key={f.key} onClick={() => go(Object.fromEntries(f.keys.map((k) => [k, undefined])))}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-2.5 py-1 font-medium text-white hover:bg-blue-500">
            {f.label} <span className="rounded-full bg-white/25 p-0.5"><IconX /></span>
          </button>
        ))}
        {applied.length > 0 && (
          <button onClick={() => router.push(sp.folder ? `/?folder=${sp.folder}` : sp.saved ? "/?saved=1" : "/")} className="ml-auto flex items-center gap-1 text-xs text-zinc-400 hover:text-white">
            <IconReset /> Réinitialiser
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Checklist {...props("perf")} param="perf" icon={<IconBars />} label="Performance"
          options={STAR_LEVELS.map((l) => ({ value: String(l.stars), render: <div><Stars n={l.stars} /><div className="mt-0.5 text-[11px] text-zinc-400">{l.label}</div></div> }))} />
        <Range {...props("run")} min="rmin" max="rmax" icon={<IconHourglass />} label="Durée active" minPh="Minimum de jours" maxPh="Maximum de jours" />
        <Single {...props("cu")} param="cu" icon={<IconLayers />} label="Usage de la créa" prefix="Minimum" ph="X fois utilisée" />
        <Range {...props("brand")} min="bmin" max="bmax" icon={<IconPulse />} label="Pubs actives de la marque" minPh="Minimum de pubs" maxPh="Maximum de pubs" />
        <Single {...props("limit")} param="limit" icon={<IconLimit />} label="Max de pubs par marque" prefix="Maximum" ph="pubs par marque" />
        <Checklist {...props("country")} param="country" icon={<IconFlag />} label="Pays" searchable
          options={facets.countries.map((c) => ({ value: c.value, n: c.n, render: `${flag(c.value)} ${countryName(c.value)}` }))} />
        <Checklist {...props("lang")} param="lang" icon={<IconLanguage />} label="Langue" searchable
          options={facets.languages.map((c) => ({ value: c.value, n: c.n, render: languageName(c.value) }))} />
        <Checklist {...props("niche")} param="niche" icon={<IconTarget />} label="Niche" searchable
          options={facets.niches.map((c) => ({ value: c.value, n: c.n, render: c.value }))} />
        <Checklist {...props("ch")} param="ch" icon={<IconMegaphone />} label="Canaux"
          options={CHANNELS.map((c) => ({ value: c.value, render: c.label }))} />
        <Checklist {...props("pt")} param="pt" icon={<IconPage />} label="Type de page" searchable
          options={facets.pageTypes.map((c) => ({ value: c.value, n: c.n, render: c.value }))} />
        <Checklist {...props("tag")} param="tag" icon={<IconTag />} label="Tags" searchable
          options={facets.tags.map((c) => ({ value: c.value, n: c.n, render: c.value }))} />
        <Status {...props("status")} />
      </div>
    </section>
  );
}

/* ---------- Briques ---------- */

type Base = { id: string; open: boolean; setOpen: (v: string | null) => void; sp: Search; go: (p: Search) => void };

function Pill({ base, icon, label, count, onClear, children, wide }: {
  base: Base; icon: ReactNode; label: string; count: number; onClear: () => void; children: ReactNode; wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!base.open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) base.setOpen(null);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && base.setOpen(null);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [base]);
  // Menu près du bord droit : on l'aligne à droite pour qu'il reste dans l'écran (sinon la page se décale)
  const [alignRight, setAlignRight] = useState(false);
  useLayoutEffect(() => {
    if (!base.open || !ref.current) return;
    const menuWidth = wide ? 288 : 256;
    setAlignRight(ref.current.getBoundingClientRect().left + menuWidth > document.documentElement.clientWidth - 16);
  }, [base.open, wide]);
  const active = count > 0;
  return (
    <div ref={ref} className="relative">
      <div className={`flex items-center rounded-xl border text-sm font-semibold transition ${
        active ? "border-blue-500/70 bg-blue-500/10" : base.open ? "border-white/30 bg-[#1d1d23]" : "border-white/10 bg-[#1a1a1f] hover:border-white/25"
      }`}>
        <button onClick={() => base.setOpen(base.open ? null : base.id)} className="flex items-center gap-2 py-1.5 pl-3 pr-2 text-zinc-100">
          {icon} {label}
          {active && <span className="grid h-4 min-w-4 place-items-center rounded-full bg-blue-600 px-1 text-[10px] text-white">{count}</span>}
          <IconChevron className={`h-3.5 w-3.5 transition ${base.open ? "rotate-180" : ""}`} />
        </button>
        {active && (
          <button onClick={onClear} title="Retirer" className="py-1.5 pr-2.5 text-zinc-400 hover:text-white"><IconX /></button>
        )}
      </div>
      {base.open && (
        <div className={`absolute ${alignRight ? "right-0" : "left-0"} top-full z-30 mt-2 rounded-xl border border-white/10 bg-[#1c1c22] p-3 shadow-2xl shadow-black/60 ${wide ? "w-72" : "w-64"}`}>
          {children}
        </div>
      )}
    </div>
  );
}

function Actions({ onCancel, onApply, disabled }: { onCancel: () => void; onApply: () => void; disabled?: boolean }) {
  return (
    <div className="mt-3 flex justify-end gap-2 border-t border-white/10 pt-3">
      <button onClick={onCancel} className="rounded-lg px-3 py-1.5 text-sm font-semibold text-zinc-300 hover:bg-white/5">Annuler</button>
      <button onClick={onApply} disabled={disabled}
        className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:bg-blue-900 disabled:text-white/50">
        Appliquer
      </button>
    </div>
  );
}

const inputCls = "w-full rounded-full border border-white/10 bg-[#141418] px-4 py-2 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40";

function Checklist(p: Base & { param: string; icon: ReactNode; label: string; searchable?: boolean;
  options: { value: string; n?: number; render: ReactNode }[] }) {
  const current = list(p.sp, p.param);
  const [sel, setSel] = useState<string[]>(current);
  const [q, setQ] = useState("");
  useEffect(() => { if (p.open) { setSel(list(p.sp, p.param)); setQ(""); } }, [p.open, p.sp, p.param]);
  const toggle = (v: string) => setSel((s) => (s.includes(v) ? s.filter((x) => x !== v) : [...s, v]));
  const shown = p.options.filter((o) => !q || `${o.value} ${typeof o.render === "string" ? o.render : ""}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <Pill base={p} icon={p.icon} label={p.label} count={current.length} onClear={() => p.go({ [p.param]: undefined })} wide={p.searchable}>
      {p.searchable && <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher" className={`${inputCls} mb-2`} />}
      <ul className="max-h-72 space-y-0.5 overflow-y-auto pr-1">
        {shown.map((o) => (
          <li key={o.value}>
            <label className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 text-sm text-zinc-200 hover:bg-white/5">
              <input type="checkbox" checked={sel.includes(o.value)} onChange={() => toggle(o.value)}
                className="h-4 w-4 shrink-0 accent-blue-600" />
              <span className="min-w-0 flex-1">{o.render}</span>
              {o.n != null && <span className="text-xs text-zinc-500">{o.n}</span>}
            </label>
          </li>
        ))}
        {!shown.length && <li className="px-2 py-3 text-sm text-zinc-500">Aucun résultat (pas encore de données ?)</li>}
      </ul>
      <Actions onCancel={() => p.setOpen(null)} onApply={() => p.go({ [p.param]: sel.join(",") || undefined })} />
    </Pill>
  );
}

function Range(p: Base & { min: string; max: string; icon: ReactNode; label: string; minPh: string; maxPh: string }) {
  const [a, setA] = useState(p.sp[p.min] ?? "");
  const [b, setB] = useState(p.sp[p.max] ?? "");
  useEffect(() => { if (p.open) { setA(p.sp[p.min] ?? ""); setB(p.sp[p.max] ?? ""); } }, [p.open, p.sp, p.min, p.max]);
  const count = Number(Boolean(p.sp[p.min])) + Number(Boolean(p.sp[p.max]));
  const apply = () => p.go({ [p.min]: a || undefined, [p.max]: b || undefined });
  return (
    <Pill base={p} icon={p.icon} label={p.label} count={count ? 1 : 0} onClear={() => p.go({ [p.min]: undefined, [p.max]: undefined })}>
      <div className="space-y-2" onKeyDown={(e) => e.key === "Enter" && apply()}>
        <input autoFocus type="number" min={0} value={a} onChange={(e) => setA(e.target.value)} placeholder={p.minPh} className={inputCls} />
        <input type="number" min={0} value={b} onChange={(e) => setB(e.target.value)} placeholder={p.maxPh} className={inputCls} />
      </div>
      <Actions onCancel={() => p.setOpen(null)} onApply={apply} disabled={!a && !b && !count} />
    </Pill>
  );
}

function Single(p: Base & { param: string; icon: ReactNode; label: string; prefix: string; ph: string }) {
  const [v, setV] = useState(p.sp[p.param] ?? "");
  useEffect(() => { if (p.open) setV(p.sp[p.param] ?? ""); }, [p.open, p.sp, p.param]);
  const apply = () => p.go({ [p.param]: v || undefined });
  return (
    <Pill base={p} icon={p.icon} label={p.label} count={p.sp[p.param] ? 1 : 0} onClear={() => p.go({ [p.param]: undefined })}>
      <div className="flex items-center gap-3" onKeyDown={(e) => e.key === "Enter" && apply()}>
        <span className="text-sm font-semibold text-zinc-300">{p.prefix}</span>
        <input autoFocus type="number" min={1} value={v} onChange={(e) => setV(e.target.value)} placeholder={p.ph} className={inputCls} />
      </div>
      <Actions onCancel={() => p.setOpen(null)} onApply={apply} disabled={!v && !p.sp[p.param]} />
    </Pill>
  );
}

function Status(p: Base) {
  const cur = p.sp.status ?? "active";
  const opts = [
    { v: "active", l: "Actives" },
    { v: "inactive", l: "Arrêtées" },
    { v: "all", l: "Toutes" },
  ];
  return (
    <Pill base={p} icon={<IconStatus />} label="Statut" count={cur !== "active" ? 1 : 0} onClear={() => p.go({ status: undefined })}>
      <ul className="space-y-0.5">
        {opts.map((o) => (
          <li key={o.v}>
            <button onClick={() => p.go({ status: o.v === "active" ? undefined : o.v })}
              className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-white/5 ${cur === o.v ? "text-blue-400" : "text-zinc-200"}`}>
              <span className={`h-2 w-2 rounded-full ${o.v === "active" ? "bg-emerald-500" : o.v === "inactive" ? "bg-red-500" : "bg-zinc-400"}`} />
              {o.l}
            </button>
          </li>
        ))}
      </ul>
    </Pill>
  );
}
