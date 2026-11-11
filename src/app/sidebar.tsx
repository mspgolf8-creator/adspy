"use client";

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
  return (
    <>
      {/* Ordinateur : barre bleue à gauche */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-60 flex-col bg-gradient-to-b from-[#2f4fe0] to-[#2a44c4] px-3 py-5 text-white lg:flex">
        <Link href="/" className="mb-6 px-3">
          <div className="text-2xl font-bold tracking-tight">adspy</div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">Discover ads</div>
        </Link>
        <nav className="flex flex-col gap-1">
          {NAV.map(({ href, label, icon: Icon, match }) => (
            <Link key={href} href={href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-[15px] font-semibold transition ${
                match(path, saved) ? "bg-white/20" : "hover:bg-white/10"
              }`}>
              <Icon className="h-[18px] w-[18px]" /> {label}
            </Link>
          ))}
        </nav>
        <Link href="/settings"
          className={`mt-auto flex items-center gap-3 rounded-lg px-3 py-2 text-[15px] font-semibold transition ${
            path.startsWith("/settings") ? "bg-white/20" : "hover:bg-white/10"
          }`}>
          <IconSettings className="h-[18px] w-[18px]" /> Réglages
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
