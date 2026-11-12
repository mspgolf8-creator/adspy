import Link from "next/link";
import type { ScoredAd } from "@/lib/supabase";
import { IconExternal, IconEye, IconLayers, IconPage, IconPulse, IconTrendUp } from "./icons";
import { flag } from "@/lib/filters";
import { CardActions } from "./card-actions";
import type { Folder } from "./actions";
import { MediaPlayer } from "./media-player";
import { Stars } from "./stars";
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

/** Lien complet sans « https://www. » (comme GetHookd). */
function linkOf(ad: ScoredAd) {
  const raw = ad.landing_url ?? (ad.link_captions[0] ? `https://${ad.link_captions[0]}` : null);
  if (!raw) return null;
  return { href: raw, text: raw.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/$/, "") };
}

export type CardExtras = { folders: Folder[]; folderIds: number[]; allTags: string[] };

export function AdCard({ ad, detailsHref, extras }: { ad: ScoredAd; detailsHref: string; extras?: CardExtras }) {
  const library = `https://www.facebook.com/ads/library/?id=${ad.id}`;
  const name = ad.page_name ?? "Page inconnue";
  const start = ad.delivery_start ? fmtDay(ad.delivery_start) : "?";
  const end = ad.is_active ? "Présent" : ad.delivery_stop ? fmtDay(ad.delivery_stop) : "?";
  const body = ad.bodies[0] ?? "";
  const title = ad.link_titles[0] || ad.hook;
  const rest = !ad.link_titles[0] && ad.hook && body.startsWith(ad.hook) ? body.slice(ad.hook.length).trim() : body;
  const link = linkOf(ad);
  const top = ad.brand_pct != null && ad.page_active_ads > 1 ? Math.max(1, Math.round(ad.brand_pct * 100)) : null;

  return (
    <article className="flex flex-col rounded-2xl border border-white/10 bg-[#141418]">
      {/* En-tête : marque + dates */}
      <header className="flex items-center gap-3 px-4 py-3">
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-bold text-white ${avatarColor(name)}`}>
          {name.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          {ad.page_id ? (
            <Link href={`/?brand=${ad.page_id}`} className="block truncate text-[15px] font-semibold text-white hover:underline" title="Voir toutes les pubs de cette marque">
              {name}
            </Link>
          ) : <h2 className="truncate text-[15px] font-semibold text-white">{name}</h2>}
          <p className="flex items-center gap-1.5 truncate text-xs text-zinc-400">
            <span className={`h-2 w-2 shrink-0 rounded-full ${ad.is_active ? "bg-emerald-500" : "bg-zinc-500"}`} />
            {start} - {end} · <span className="text-zinc-500">{ad.days_running} j</span>
            {ad.countries?.slice(0, 3).map((c) => <span key={c} title={c}>{flag(c)}</span>)}
          </p>
        </div>
        <a href={library} target="_blank" rel="noreferrer" title="Ouvrir dans la bibliothèque Meta" className="text-zinc-400 hover:text-white">
          <IconExternal className="h-5 w-5" />
        </a>
      </header>

      {/* Visuel : clic = détails, ▶ = lecture sur place */}
      <MediaPlayer mediaUrl={ad.media_url} kind={ad.media_kind} videoUrl={ad.video_url} videoExpires={ad.video_expires_at}
        library={library} detailsHref={detailsHref} alt={name} tried={Boolean(ad.media_tried_at)} />

      {/* Signaux */}
      <div className="flex flex-wrap items-center gap-1.5 px-4 pt-3 text-xs font-semibold">
        <span className="flex items-center gap-1 rounded-full bg-white/[0.08] px-2 py-1 text-zinc-300" title="Fois que cette créa roule (copies identiques)">
          <IconLayers className="h-3.5 w-3.5" /> {ad.creative_count ?? 1}
        </span>
        <span className="flex items-center gap-1 rounded-full bg-[#0f3a22] px-2 py-1 text-[#22c55e]" title="Pubs actives de la marque">
          <IconPulse className="h-3.5 w-3.5" /> {ad.page_active_ads}
        </span>
        <Stars n={ad.stars} />
        {top != null && (
          <span className="flex items-center gap-1 rounded-full bg-blue-500/15 px-2 py-1 text-blue-300"
            title={`Top ${top} % des pubs de la marque (${ad.eu_total_reach != null ? "portée" : "durée + doublons"})`}>
            <IconTrendUp className="h-3.5 w-3.5" /> {top}%
          </span>
        )}
        {ad.eu_total_reach != null && (
          <span className="flex items-center gap-1 rounded-full bg-white/[0.08] px-2 py-1 text-zinc-300" title="Personnes atteintes en Europe">
            <IconEye className="h-3.5 w-3.5" /> {compact.format(ad.eu_total_reach)}
          </span>
        )}
      </div>

      {/* Texte */}
      <div className="flex flex-1 flex-col gap-1.5 px-4 pb-3 pt-3">
        {title && <p className="line-clamp-2 text-[15px] font-semibold leading-snug text-white">{title}</p>}
        {rest && <p className="line-clamp-2 whitespace-pre-line text-sm text-zinc-300">{rest}</p>}
        <div className="mt-auto flex items-center gap-3 pt-2 text-sm">
          {link ? (
            <a href={link.href} target="_blank" rel="noreferrer" title={link.href} className="min-w-0 flex-1 truncate text-zinc-400 hover:text-white">{link.text}</a>
          ) : <span className="flex-1" />}
          {link && (
            <a href={link.href} target="_blank" rel="noreferrer" className="flex shrink-0 items-center gap-1 text-zinc-300 hover:text-white">
              {ad.cta_text ? ad.cta_text.charAt(0).toUpperCase() + ad.cta_text.slice(1) : "Voir le site"} <IconExternal className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
          <CategorySelect id={ad.id} category={ad.category} manual={ad.classified_by === "manual"} />
          {ad.page_type && (
            <span className="flex items-center gap-1 rounded-md bg-white/[0.06] px-2 py-0.5 text-zinc-300"><IconPage className="h-3 w-3" />{ad.page_type}</span>
          )}
        </div>
      </div>

      <CardActions adId={ad.id} detailsHref={detailsHref} saved={ad.saved} tags={ad.tags ?? []}
        folders={extras?.folders ?? []} folderIds={extras?.folderIds ?? []} allTags={extras?.allTags ?? []} />
    </article>
  );
}
