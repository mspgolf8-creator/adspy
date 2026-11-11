"use client";

import { useState } from "react";
import Link from "next/link";
import { IconPlay } from "./icons";

/**
 * Visuel de la pub. Vidéo : clic sur ▶ = lecture sur place (comme GetHookd).
 * Si Meta a expiré le lien vidéo, on ouvre la pub dans la bibliothèque Meta.
 */
export function MediaPlayer({ mediaUrl, kind, videoUrl, videoExpires, library, detailsHref, alt, tried, big }: {
  mediaUrl: string | null; kind: string | null; videoUrl?: string | null; videoExpires?: string | null;
  library: string; detailsHref?: string; alt: string; tried: boolean; big?: boolean;
}) {
  const [playing, setPlaying] = useState(false);
  const [broken, setBroken] = useState(false);
  const frame = big ? "mx-auto max-h-[70vh] w-full object-contain" : "aspect-[4/5] w-full object-contain object-center";
  const canPlay = kind === "video" && videoUrl && !broken && (!videoExpires || new Date(videoExpires) > new Date());

  if (playing && canPlay) {
    return (
      <div className="bg-black">
        <video src={videoUrl!} poster={mediaUrl ?? undefined} autoPlay controls playsInline className={frame}
          onError={() => { setBroken(true); setPlaying(false); }} />
      </div>
    );
  }

  const image = mediaUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={mediaUrl} alt={alt} loading="lazy" className={frame} />
  ) : (
    <div className={`grid ${big ? "aspect-[4/5]" : "aspect-[4/5] w-full"} place-items-center text-xs text-zinc-500`}>
      {tried ? "Pas de visuel" : "Visuel à venir"}
    </div>
  );

  return (
    <div className="relative bg-black">
      {detailsHref ? <Link href={detailsHref} scroll={false} className="block">{image}</Link> : image}
      {kind === "video" && (
        canPlay ? (
          <button onClick={() => setPlaying(true)} title="Lire la vidéo"
            className="absolute left-1/2 top-1/2 grid h-14 w-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-blue-600 text-white shadow-lg shadow-black/40 transition hover:scale-105 hover:bg-blue-500">
            <IconPlay className="ml-0.5 h-7 w-7" />
          </button>
        ) : (
          <a href={library} target="_blank" rel="noreferrer" title="Lien vidéo pas encore récupéré : ouvrir chez Meta"
            className="absolute left-1/2 top-1/2 grid h-14 w-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-blue-600/80 text-white shadow-lg shadow-black/40 hover:bg-blue-500">
            <IconPlay className="ml-0.5 h-7 w-7" />
          </a>
        )
      )}
    </div>
  );
}
