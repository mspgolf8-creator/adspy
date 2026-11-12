"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { createFolder, quickSave, setInFolder, setTags, type Folder } from "./actions";
import { IconAd, IconBookmark, IconCheck, IconChevron, IconFolder, IconFolderPlus, IconPlus, IconX } from "./icons";

type Props = {
  adId: string;
  detailsHref: string;
  saved: boolean;
  folderIds: number[];
  folders: Folder[];
  tags: string[];
  allTags: string[];
};

/** Bas de la carte : tags, bouton Détails, Sauvegarder + menu Dossiers / Tags (comme GetHookd). */
export function CardActions({ adId, detailsHref, saved, folderIds, folders, tags, allTags }: Props) {
  const [inFolders, setInFolders] = useState(folderIds);
  const [myTags, setMyTags] = useState(tags);
  const [isSaved, setIsSaved] = useState(saved);
  const [menu, setMenu] = useState(false);
  const [adding, setAdding] = useState(false);
  const [, start] = useTransition();
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => setInFolders(folderIds), [folderIds]);
  useEffect(() => setMyTags(tags), [tags]);
  useEffect(() => setIsSaved(saved), [saved]);
  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setMenu(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menu]);

  const saveTags = (next: string[]) => {
    setMyTags(next);
    start(() => setTags(adId, next));
  };
  const toggleQuick = () => {
    const next = !isSaved;
    setIsSaved(next);
    setInFolders(next ? [folders[0]?.id].filter(Boolean) as number[] : []);
    start(() => quickSave(adId, next));
  };

  return (
    <div className="space-y-3 px-4 pb-4">
      {/* Tags */}
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        {myTags.map((t) => (
          <span key={t} className="flex items-center gap-1 rounded-full bg-violet-500/15 px-2.5 py-1 font-medium text-violet-200">
            {t}
            <button onClick={() => saveTags(myTags.filter((x) => x !== t))} title="Retirer ce tag" className="text-violet-300/70 hover:text-white">
              <IconX className="h-3 w-3" />
            </button>
          </span>
        ))}
        {adding ? (
          <TagInput allTags={allTags} exclude={myTags} onDone={(t) => { setAdding(false); if (t) saveTags([...myTags, t]); }} />
        ) : (
          <button onClick={() => setAdding(true)} className="flex items-center gap-1 rounded-full border border-dashed border-white/15 px-2.5 py-1 text-zinc-400 hover:border-white/30 hover:text-white">
            <IconPlus className="h-3 w-3" /> Ajouter un tag
          </button>
        )}
      </div>

      {/* Boutons */}
      <div className="flex gap-2">
        <Link href={detailsHref} scroll={false}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-white/10 py-2 text-sm font-semibold text-white hover:bg-white/15">
          <IconAd className="h-[18px] w-[18px]" /> Détails
        </Link>
        <div ref={box} className="relative flex flex-1">
          <button onClick={toggleQuick} title={isSaved ? "Retirer de tous les dossiers" : "Sauvegarder dans le dossier par défaut"}
            className="flex flex-1 items-center justify-center gap-2 rounded-l-xl bg-blue-600 py-2 text-sm font-semibold text-white hover:bg-blue-500">
            <IconBookmark className={`h-[18px] w-[18px] ${isSaved ? "fill-current" : ""}`} /> {isSaved ? "Sauvée" : "Save"}
          </button>
          <button onClick={() => setMenu(!menu)} title="Choisir les dossiers et les tags"
            className="rounded-r-xl border-l border-white/20 bg-blue-600 px-2.5 text-white hover:bg-blue-500">
            <IconChevron className={`h-4 w-4 transition ${menu ? "rotate-180" : ""}`} />
          </button>
          {menu && (
            <SaveMenu adId={adId} folders={folders} inFolders={inFolders} tags={myTags} allTags={allTags}
              onFolder={(id, on) => {
                const next = on ? [...inFolders, id] : inFolders.filter((x) => x !== id);
                setInFolders(next);
                setIsSaved(next.length > 0);
                start(() => setInFolder(adId, id, on));
              }}
              onNewFolder={(name) => start(async () => {
                const id = await createFolder(name, adId);
                if (id) { setInFolders((f) => [...f, id]); setIsSaved(true); }
              })}
              onTags={saveTags} />
          )}
        </div>
      </div>
    </div>
  );
}

function TagInput({ allTags, exclude, onDone }: { allTags: string[]; exclude: string[]; onDone: (t: string | null) => void }) {
  const [v, setV] = useState("");
  const hints = allTags.filter((t) => !exclude.includes(t) && t.includes(v.toLowerCase())).slice(0, 5);
  return (
    <span className="relative">
      <input autoFocus value={v} onChange={(e) => setV(e.target.value)} placeholder="Nom du tag…"
        onKeyDown={(e) => {
          if (e.key === "Enter") onDone(v.trim().toLowerCase() || null);
          if (e.key === "Escape") onDone(null);
        }}
        onBlur={() => setTimeout(() => onDone(v.trim().toLowerCase() || null), 150)}
        className="w-32 rounded-full border border-white/20 bg-transparent px-2.5 py-1 text-zinc-100 outline-none focus:border-violet-400" />
      {hints.length > 0 && (
        <span className="absolute left-0 top-full z-30 mt-1 flex w-40 flex-col rounded-lg border border-white/10 bg-[#1c1c22] p-1 shadow-xl">
          {hints.map((t) => (
            <button key={t} onMouseDown={(e) => { e.preventDefault(); onDone(t); }} className="rounded px-2 py-1 text-left text-zinc-200 hover:bg-white/10">{t}</button>
          ))}
        </span>
      )}
    </span>
  );
}

function SaveMenu({ folders, inFolders, tags, allTags, onFolder, onNewFolder, onTags }: {
  adId: string; folders: Folder[]; inFolders: number[]; tags: string[]; allTags: string[];
  onFolder: (id: number, on: boolean) => void; onNewFolder: (name: string) => void; onTags: (t: string[]) => void;
}) {
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [tag, setTag] = useState("");
  const shown = folders.filter((f) => f.name.toLowerCase().includes(q.toLowerCase()));
  const tagHints = allTags.filter((t) => !tags.includes(t) && (!tag || t.includes(tag.toLowerCase()))).slice(0, 8);

  return (
    <div className="absolute bottom-full right-0 z-30 mb-2 w-72 rounded-2xl border border-white/10 bg-[#1c1c22] text-sm shadow-2xl">
      <div className="space-y-3 p-4">
        <div className="flex items-center">
          <p className="text-base font-semibold text-white">Dossiers</p>
          <button onClick={() => setCreating(!creating)} title="Nouveau dossier" className="ml-auto text-zinc-300 hover:text-white">
            <IconFolderPlus className="h-5 w-5" />
          </button>
        </div>
        {creating && (
          <form onSubmit={(e) => { e.preventDefault(); if (name.trim()) onNewFolder(name); setName(""); setCreating(false); }} className="flex gap-1.5">
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom du dossier"
              className="min-w-0 flex-1 rounded-lg border border-white/15 bg-transparent px-2.5 py-1.5 text-zinc-100 outline-none focus:border-blue-500" />
            <button className="rounded-lg bg-blue-600 px-2.5 font-semibold text-white hover:bg-blue-500">Créer</button>
          </form>
        )}
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher"
          className="w-full rounded-full border border-white/10 bg-transparent px-3.5 py-2 text-zinc-100 outline-none focus:border-white/25" />
        <div className="max-h-48 space-y-0.5 overflow-y-auto">
          {shown.map((f) => {
            const on = inFolders.includes(f.id);
            return (
              <button key={f.id} onClick={() => onFolder(f.id, !on)}
                className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-white/5 ${on ? "text-white" : "text-zinc-300"}`}>
                <IconFolder className={`h-[18px] w-[18px] ${on ? "fill-blue-500/30 text-blue-400" : ""}`} />
                <span className="min-w-0 flex-1 truncate">{f.name}</span>
                {on ? <IconCheck className="h-4 w-4 text-blue-400" /> : <span className="text-zinc-500">{f.n}</span>}
              </button>
            );
          })}
          {!shown.length && <p className="px-2 py-2 text-zinc-500">Aucun dossier.</p>}
        </div>
      </div>
      <div className="space-y-2 border-t border-white/10 p-4">
        <p className="font-semibold text-zinc-400">Tags</p>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <button key={t} onClick={() => onTags(tags.filter((x) => x !== t))}
                className="flex items-center gap-1 rounded-full bg-violet-500/20 px-2.5 py-0.5 text-xs text-violet-200 hover:bg-violet-500/30">
                {t} <IconX className="h-3 w-3" />
              </button>
            ))}
          </div>
        )}
        <input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="Ajouter un tag…"
          onKeyDown={(e) => { if (e.key === "Enter" && tag.trim()) { onTags([...tags, tag.trim().toLowerCase()]); setTag(""); } }}
          className="w-full bg-transparent py-1 text-zinc-100 outline-none placeholder:text-zinc-500" />
        {tagHints.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {tagHints.map((t) => (
              <button key={t} onClick={() => { onTags([...tags, t]); setTag(""); }}
                className="rounded-full border border-white/15 px-2.5 py-0.5 text-xs text-zinc-300 hover:border-white/30 hover:text-white">{t}</button>
            ))}
          </div>
        ) : !allTags.length && <p className="text-xs text-zinc-500">Aucun tag pour l&apos;instant. Écris un nom pour créer ton premier tag.</p>}
      </div>
    </div>
  );
}
