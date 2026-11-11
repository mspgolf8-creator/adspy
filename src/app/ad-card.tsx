import Link from "next/link";
import type { ScoredAd } from "@/lib/supabase";
import { IconExternal, IconEye, IconLayers, IconPage, IconPulse } from "./icons";
import { MediaPlayer } from "./media-player";
import { Stars } from "./stars";
import { SaveButton } from "./save-button";
import { CategorySelect } from "./category-select";

const day = new Intl.DateTimeFormat("fr-CA", { day: "numeric", month: "short" });
const dayYear = new Intl.DateTimeFormat("fr-CA", { day: "numeric", month: "short", year: "numeric" });
const fmtDay = (iso: string) => {
  const d = new Date(iso);
  return (d.getFullYear() === new Date().getFullYear() ? day : dayYear).format(d);
};
const compact = new Intl.NumberFormat("fr-CA", { notation: "compact", maximumFractionDigits: 1 });
const AVATAR_COLORS = ["bg-rose-600", "bg-blue-600", "bg-emerald-600", "bg-amber-600", "bg-violet-600", "bg-cyan-600", "bg-fuchsia-600", "bg-orange-600"];

function avatarColor(s: string) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function domainOf(ad: ScoredAd) {
  if (ad.landing_url) {
    try {
      return new URL(ad.landing_url).hostname.replace(/^www\./, "") + new URL(ad.landing_url).pathname.replace(/\/$/, "");
    } catch {}
  }
  return ad.link_captions[0] ?? null;
}

export function AdCard({ ad, detailsHref }: { ad: ScoredAd; detailsHref: string }) {
  const library = `https://www.facebook.com/ads/library/?id=${ad.id}`;
  const name = ad.page_name ?? "Page inconnue";
  const start = ad.delivery_start ? fmtDay(ad.delivery_start) : "?";
  const end = ad.is_active ? "Présent" : ad.delivery_stop ? fmtDay(ad.delivery_stop) : "?";
  const body = ad.bodies[0] ?? "";
  const rest = ad.hook && body.startsWith(ad.hook) ? body.slice(ad.hook.length).trim() : body;
  const domain = domainOf(ad);

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#141418]">
      {/* En-tête : marque + dates */}
      <header className="flex items-center gap-3 px-4 py-3">
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-bold text-white ${avatarColor(name)}`}>
          {name.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          {ad.page_id ? (
            <Link href={`/?brand=${ad.page_id}`} className="block truncate text-[15px] font-semibold text-white hover:underline" title="Voir toutes les pubs de cette marque">
              {name}
            </Link>
          ) : <h2 className="truncate text-[15px] font-semibold text-white">{name}</h2>}
          <p className="flex items-center gap-1.5 truncate text-xs text-zinc-400">
            <span className={`h-2 w-2 shrink-0 rounded-full ${ad.is_active ? "bg-emerald-500" : "bg-red-500"}`} />
            {start} - {end} · {ad.days_running} j
          </p>
        </div>
        <a href={library} target="_blank" rel="noreferrer" title="Ouvrir dans la bibliothèque Meta" className="text-zinc-400 hover:text-white">
          <IconExternal className="h-[18px] w-[18px]" />
        </a>
        <SaveButton id={ad.id} saved={ad.saved} />
      </header>

      {/* Visuel : clic = détails, ▶ = lecture sur place */}
      <MediaPlayer mediaUrl={ad.media_url} kind={ad.media_kind} videoUrl={ad.video_url} videoExpires={ad.video_expires_at}
        library={library} detailsHref={detailsHref} alt={name} tried={Boolean(ad.media_tried_at)} />

      {/* Signaux */}
      <div className="flex flex-wrap items-center gap-1.5 px-4 pt-3 text-xs font-semibold">
        <span className="flex items-center gap-1 rounded-md bg-white/[0.06] px-1.5 py-1 text-zinc-300" title="Fois que cette créa roule (même texte)">
          <IconLayers className="h-3.5 w-3.5" /> {ad.creative_count ?? 1}
        </span>
        <span className="flex items-center gap-1 rounded-md bg-[#0f3a22] px-1.5 py-1 text-[#22c55e]" title="Pubs actives de la marque">
          <IconPulse className="h-3.5 w-3.5" /> {ad.page_active_ads}
        </span>
        <Stars n={ad.stars} />
        {ad.eu_total_reach != null && (
          <span className="flex items-center gap-1 rounded-md bg-white/[0.06] px-1.5 py-1 text-zinc-300" title="Personnes atteintes dans l'UE">
            <IconEye className="h-3.5 w-3.5" /> {compact.format(ad.eu_total_reach)}
          </span>
        )}
      </div>

      {/* Texte */}
      <div className="flex flex-1 flex-col gap-1.5 px-4 pb-3 pt-3">
        {ad.hook && <p className="line-clamp-2 text-[15px] font-semibold leading-snug text-white">{ad.hook}</p>}
        {rest && <p className="line-clamp-2 whitespace-pre-line text-sm text-zinc-300">{rest}</p>}
        <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-2 text-xs">
          <CategorySelect id={ad.id} category={ad.category} manual={ad.classified_by === "manual"} />
          {ad.page_type && (
            <span className="flex items-center gap-1 rounded-md bg-white/[0.06] px-2 py-0.5 text-zinc-300"><IconPage className="h-3 w-3" />{ad.page_type}</span>
          )}
        </div>
      </div>

      {/* Lien */}
      <footer className="flex items-center gap-2 border-t border-white/10 px-4 py-2.5 text-xs text-zinc-400">
        {domain ? (
          ad.landing_url ? (
            <a href={ad.landing_url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate hover:text-white">{domain}</a>
          ) : <span className="min-w-0 flex-1 truncate">{domain}</span>
        ) : <span className="flex-1" />}
        <Link href={detailsHref} scroll={false} className="shrink-0 rounded-md bg-white/10 px-2.5 py-1 font-semibold text-white hover:bg-white/15">
          Détails de la pub
        </Link>
      </footer>
    </article>
  );
}
