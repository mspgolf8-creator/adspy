"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { IconBookmark, IconBrand, IconExplore, IconFolder, IconFolderPlus, IconSettings, IconX } from "./icons";
import { createFolder, deleteFolder, type Folder } from "./actions";

const NAV = [
  { href: "/", label: "Explore Ads", icon: IconExplore, match: (p: string, saved: boolean, folder?: string | null) => p === "/" && !saved && !folder },
  { href: "/?saved=1", label: "Swipe File", icon: IconBookmark, match: (p: string, saved: boolean) => p === "/" && saved },
  { href: "/brands", label: "Brand Spy", icon: IconBrand, match: (p: string) => p.startsWith("/brands") },
];

export function Sidebar({ folders }: { folders: Folder[] }) {
  const path = usePathname();
  const params = useSearchParams();
  const saved = params.has("saved");
  const openFolder = params.get("folder");
  const [adding, setAdding] = useState(false);
  // Barre réduite (icônes seulement) : retenue dans le navigateur
  const [small, setSmall] = useState(false);
  // Avant que la page soit prête, on ne connaît pas encore le mode : contenu caché pour éviter un flash laid
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setSmall(document.documentElement.dataset.sidebar === "small");
    setReady(true);
  }, []);
  const toggle = () => {
    const next = !small;
    setSmall(next);
    document.documentElement.dataset.sidebar = next ? "small" : "";
    try {
      localStorage.setItem("adspy-sidebar", next ? "small" : "");
    } catch {}
  };
  const item = (active: boolean) =>
    `flex items-center gap-3 rounded-xl text-[15px] font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-white/60 ${small ? "mx-auto h-11 w-11 justify-center" : "px-3 py-2"} ${
      active ? "bg-white/20" : "hover:bg-white/10"
    }`;
  return (
    <>
      {/* Ordinateur : barre bleue à gauche */}
      <aside className={`fixed inset-y-0 left-0 z-20 hidden w-[var(--sb)] flex-col bg-gradient-to-b from-[#2f4fe0] to-[#2a44c4] whitespace-nowrap px-3 py-5 text-white transition-[width] lg:flex ${ready ? "" : "[&>*]:invisible"}`}>
        {/* Bouton réduire / agrandir : pastille ronde à cheval sur le bord droit */}
        <button onClick={toggle} title={small ? "Agrandir la barre" : "Réduire la barre"} aria-label={small ? "Agrandir la barre" : "Réduire la barre"}
          className="absolute -right-3 top-8 grid h-6 w-6 place-items-center rounded-full border border-slate-200 bg-white text-[#2f4fe0] shadow-md outline-none transition hover:scale-110 focus-visible:ring-2 focus-visible:ring-white">
          <svg className={`h-3.5 w-3.5 transition ${small ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m14 7-5 5 5 5" /></svg>
        </button>
        <Link href="/" className={`mb-6 block outline-none ${small ? "mx-auto" : "px-3"}`}>
          {small ? (
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-white/15 text-xl font-bold">a</div>
          ) : (
            <>
              <div className="text-2xl font-bold tracking-tight">adspy</div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">Discover ads</div>
            </>
          )}
        </Link>
        <nav className={`flex flex-col overflow-hidden ${small ? "gap-2" : "gap-1"}`}>
          {NAV.map(({ href, label, icon: Icon, match }) => (
            <div key={href}>
              <Link href={href} title={small ? label : undefined} className={item(match(path, saved, openFolder))}>
                <Icon className="h-[18px] w-[18px] shrink-0" /> {!small && label}
              </Link>
              {/* Dossiers sous Swipe File */}
              {label === "Swipe File" && !small && (
                <div className="ml-4 mt-1 space-y-0.5 border-l border-white/20 pl-2">
                  {folders.map((f) => (
                    <div key={f.id} className={`group flex items-center rounded-md text-[13px] ${openFolder === String(f.id) ? "bg-white/20" : "hover:bg-white/10"}`}>
                      <Link href={`/?folder=${f.id}`} className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5">
                        <IconFolder className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{f.name}</span>
                        <span className="ml-auto text-white/60">{f.n}</span>
                      </Link>
                      {folders.length > 1 && (
                        <button title="Supprimer le dossier (les pubs restent dans les autres dossiers)"
                          onClick={() => { if (confirm(`Supprimer le dossier « ${f.name} » ?`)) deleteFolder(f.id); }}
                          className="hidden pr-2 text-white/60 hover:text-white group-hover:block"><IconX className="h-3 w-3" /></button>
                      )}
                    </div>
                  ))}
                  {adding ? (
                    <form onSubmit={(e) => {
                      e.preventDefault();
                      const name = String(new FormData(e.currentTarget).get("name") ?? "");
                      setAdding(false);
                      if (name.trim()) createFolder(name);
                    }}>
                      <input name="name" autoFocus onBlur={() => setAdding(false)} placeholder="Nom du dossier"
                        className="w-full rounded-md bg-white/15 px-2 py-1 text-[13px] text-white outline-none placeholder:text-white/50" />
                    </form>
                  ) : (
                    <button onClick={() => setAdding(true)} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-white/70 hover:bg-white/10 hover:text-white">
                      <IconFolderPlus className="h-3.5 w-3.5" /> Nouveau dossier
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </nav>
        <Link href="/settings" title={small ? "Réglages" : undefined} className={`mt-auto ${item(path.startsWith("/settings"))}`}>
          <IconSettings className="h-[18px] w-[18px] shrink-0" /> {!small && "Réglages"}
        </Link>
      </aside>

      {/* Téléphone / petite fenêtre : barre du haut */}
      <header className="sticky top-0 z-20 flex items-center gap-4 overflow-x-auto bg-[#2f4fe0] px-4 py-3 text-sm font-semibold text-white lg:hidden">
        <Link href="/" className="text-lg font-bold">adspy</Link>
        {NAV.map(({ href, label, match }) => (
          <Link key={href} href={href} className={`whitespace-nowrap ${match(path, saved, openFolder) ? "" : "text-white/70"}`}>{label}</Link>
        ))}
        <Link href="/settings" className="ml-auto text-white/70">Réglages</Link>
      </header>
    </>
  );
}
