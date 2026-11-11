"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { IconBookmark, IconBrand, IconExplore, IconSettings } from "./icons";

const NAV = [
  { href: "/", label: "Explore Ads", icon: IconExplore, match: (p: string, saved: boolean) => p === "/" && !saved },
  { href: "/?saved=1", label: "Swipe File", icon: IconBookmark, match: (p: string, saved: boolean) => p === "/" && saved },
  { href: "/brands", label: "Brand Spy", icon: IconBrand, match: (p: string) => p.startsWith("/brands") },
];

export function Sidebar() {
  const path = usePathname();
  const saved = useSearchParams().has("saved");
  // Barre réduite (icônes seulement) : retenue dans le navigateur
  const [small, setSmall] = useState(false);
  useEffect(() => setSmall(document.documentElement.dataset.sidebar === "small"), []);
  const toggle = () => {
    const next = !small;
    setSmall(next);
    document.documentElement.dataset.sidebar = next ? "small" : "";
    try {
      localStorage.setItem("adspy-sidebar", next ? "small" : "");
    } catch {}
  };
  const item = (active: boolean) =>
    `flex items-center gap-3 rounded-lg py-2 text-[15px] font-semibold transition ${small ? "justify-center px-0" : "px-3"} ${
      active ? "bg-white/20" : "hover:bg-white/10"
    }`;
  return (
    <>
      {/* Ordinateur : barre bleue à gauche */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-[var(--sb)] flex-col bg-gradient-to-b from-[#2f4fe0] to-[#2a44c4] px-3 py-5 text-white transition-[width] lg:flex">
        <div className={`mb-6 flex items-start gap-2 ${small ? "flex-col items-center" : "px-3"}`}>
          <Link href="/" className="min-w-0 flex-1">
            {small ? (
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-white/15 text-xl font-bold">a</div>
            ) : (
              <>
                <div className="text-2xl font-bold tracking-tight">adspy</div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">Discover ads</div>
              </>
            )}
          </Link>
          <button onClick={toggle} title={small ? "Agrandir la barre" : "Réduire la barre"}
            className={`rounded-md border border-white/30 p-1 text-white/70 hover:bg-white/10 hover:text-white ${small ? "mt-2" : "mt-1"}`}>
            <svg className={`h-4 w-4 transition ${small ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m14 7-5 5 5 5" /></svg>
          </button>
        </div>
        <nav className="flex flex-col gap-1">
          {NAV.map(({ href, label, icon: Icon, match }) => (
            <Link key={href} href={href} title={small ? label : undefined} className={item(match(path, saved))}>
              <Icon className="h-[18px] w-[18px] shrink-0" /> {!small && label}
            </Link>
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
          <Link key={href} href={href} className={`whitespace-nowrap ${match(path, saved) ? "" : "text-white/70"}`}>{label}</Link>
        ))}
        <Link href="/settings" className="ml-auto text-white/70">Réglages</Link>
      </header>
    </>
  );
}
