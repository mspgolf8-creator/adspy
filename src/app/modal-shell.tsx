"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { IconX } from "./icons";

/** Fenêtre par-dessus la page : Échap ou clic à côté pour fermer. */
export function ModalShell({ closeHref, children }: { closeHref: string; children: ReactNode }) {
  const router = useRouter();
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const esc = (e: KeyboardEvent) => e.key === "Escape" && router.push(closeHref, { scroll: false });
    document.addEventListener("keydown", esc);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", esc);
    };
  }, [closeHref, router]);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && router.push(closeHref, { scroll: false })}>
      <div className="relative mx-auto my-4 w-[min(1500px,calc(100%-2rem))] rounded-2xl border border-white/10 bg-[#0f0f13] shadow-2xl">
        <button onClick={() => router.push(closeHref, { scroll: false })} title="Fermer (Échap)"
          className="absolute right-3 top-3 z-10 rounded-lg p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white">
          <IconX className="h-5 w-5" />
        </button>
        {children}
      </div>
    </div>
  );
}

/** Texte complet de la pub : bouton Copier + « Voir tout ». */
export function CopyText({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const long = text.length > 220 || text.split("\n").length > 4;
  return (
    <div>
      <p className={`whitespace-pre-line text-[15px] leading-relaxed text-zinc-100 ${open || !long ? "" : "line-clamp-4"}`}>{text}</p>
      <div className="mt-3 flex items-center gap-3">
        <button onClick={async () => {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }} className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-1.5 text-sm font-semibold text-white hover:bg-white/15">
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>
          {copied ? "Copié !" : "Copier"}
        </button>
        {long && (
          <button onClick={() => setOpen(!open)} className="flex items-center gap-1 text-sm font-semibold text-blue-400 hover:text-blue-300">
            {open ? "Voir moins" : "Voir tout"}
            <svg className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6" /></svg>
          </button>
        )}
      </div>
    </div>
  );
}
