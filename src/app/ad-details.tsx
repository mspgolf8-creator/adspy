import Link from "next/link";
import type { ScoredAd } from "@/lib/supabase";
import { CHANNELS, countryName, flag, languageName } from "@/lib/filters";
import { AdCard } from "./ad-card";
import { CategorySelect } from "./category-select";
import { CopyText, ModalShell } from "./modal-shell";
import { SaveButton } from "./save-button";
import { Stars } from "./stars";
import { IconBrand, IconExternal, IconEye, IconLayers, IconPulse } from "./icons";
import { MediaPlayer } from "./media-player";

const dayYear = new Intl.DateTimeFormat("fr-CA", { day: "numeric", month: "long", year: "numeric" });
const compact = new Intl.NumberFormat("fr-CA", { notation: "compact", maximumFractionDigits: 1 });

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-sm text-zinc-500">{label}</dt>
      <dd className="mt-1 text-[15px] font-semibold text-white">{children}</dd>
    </div>
  );
}

export function AdDetails({ ad, similar, closeHref, detailsHref }: {
  ad: ScoredAd; similar: ScoredAd[]; closeHref: string; detailsHref: (id: string) => string;
}) {
  const name = ad.page_name ?? "Page inconnue";
  const library = `https://www.facebook.com/ads/library/?id=${ad.id}`;
  const body = ad.bodies[0] ?? "";
  const platforms = ad.publisher_platforms.map((p) => CHANNELS.find((c) => c.value === p)?.label ?? p).join(", ");
  const tech = new Map<string, string[]>();
  for (const t of ad.technologies ?? []) {
    const [cat, n] = t.split("|");
    tech.set(cat, [...(tech.get(cat) ?? []), n]);
  }
  const chips = [ad.angle, ad.offer && `Offre : ${ad.offer}`, ad.media_kind === "video" ? "Vidéo" : ad.media_kind === "image" ? "Image" : null].filter(Boolean) as string[];

  return (
    <ModalShell closeHref={closeHref}>
      {/* Barre du haut */}
      <header className="flex flex-wrap items-center gap-4 border-b border-white/10 px-5 py-4 pr-14">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-blue-600 text-lg font-bold text-white">
          {name.charAt(0).toUpperCase()}
        </span>
        <h2 className="min-w-0 truncate text-lg font-semibold text-white">{name}</h2>
        <span className="text-zinc-500">#{ad.id}</span>
        {ad.page_id && (
          <Link href={`/?brand=${ad.page_id}`} className="flex items-center gap-2 rounded-xl bg-[#1a1a1f] px-4 py-2 font-semibold text-white hover:bg-[#23232a]">
            <IconBrand /> Spy brand
            <span className="flex items-center gap-1 rounded-full bg-blue-500/20 px-2 py-0.5 text-xs text-blue-300"><IconLayers className="h-3 w-3" />{ad.page_active_ads}</span>
          </Link>
        )}
        <div className="ml-auto flex items-center gap-2">
          <span className="flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-1.5 font-semibold text-white">
            <SaveButton id={ad.id} saved={ad.saved} /> Sauvegarder
          </span>
          <a href={library} target="_blank" rel="noreferrer" title="Ouvrir dans la bibliothèque Meta"
            className="rounded-xl bg-[#1a1a1f] p-2.5 text-zinc-200 hover:bg-[#23232a]"><IconExternal className="h-5 w-5" /></a>
        </div>
      </header>

      <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,8fr)]">
        {/* Gauche : visuel + texte */}
        <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#141418]">
          <div className="flex flex-wrap justify-end gap-1.5 px-4 py-3 text-sm font-semibold">
            {ad.eu_total_reach != null && (
              <span className="flex items-center gap-1 rounded-lg bg-blue-500/15 px-2 py-1 text-blue-300" title="Personnes atteintes dans l'UE"><IconEye className="h-3.5 w-3.5" />{compact.format(ad.eu_total_reach)}</span>
            )}
            <span className="flex items-center gap-1 rounded-lg bg-white/[0.06] px-2 py-1 text-zinc-300" title="Fois que cette créa roule"><IconLayers className="h-3.5 w-3.5" />{ad.creative_count}</span>
            <span className="flex items-center gap-1 rounded-lg bg-[#0f3a22] px-2 py-1 text-[#22c55e]" title="Pubs actives de la marque"><IconPulse className="h-3.5 w-3.5" />{ad.page_active_ads}</span>
            <Stars n={ad.stars} />
          </div>
          <MediaPlayer mediaUrl={ad.media_url} kind={ad.media_kind} videoUrl={ad.video_url} videoExpires={ad.video_expires_at}
            library={library} alt={name} tried={Boolean(ad.media_tried_at)} big />
          <div className="space-y-4 p-5">
            {body ? <CopyText text={body} /> : <p className="text-sm text-zinc-500">Pas de texte.</p>}
            {ad.link_titles[0] && <p className="text-[17px] font-semibold text-white">{ad.link_titles[0]}</p>}
            {ad.link_descriptions[0] && <p className="text-sm text-zinc-400">{ad.link_descriptions[0]}</p>}
            {(ad.landing_url || ad.link_captions[0]) && (
              <div className="flex items-center gap-3">
                <span className="min-w-0 flex-1 truncate text-sm text-zinc-400">{ad.landing_url ?? ad.link_captions[0]}</span>
                {ad.landing_url && (
                  <a href={ad.landing_url} target="_blank" rel="noreferrer"
                    className="flex shrink-0 items-center gap-2 rounded-lg bg-white/10 px-3 py-1.5 text-sm font-semibold text-white hover:bg-white/15">
                    <IconExternal /> Voir la page
                  </a>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Droite : Overview */}
        <section className="rounded-2xl border border-white/10 bg-[#141418] p-5">
          <div className="mb-6 rounded-xl bg-[#1a1a1f] p-1.5">
            <span className="inline-block rounded-lg border-2 border-blue-500 px-4 py-1.5 font-semibold text-white">Overview</span>
          </div>

          <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
            <div className="space-y-5">
              <Field label="ID de la pub">
                <a href={library} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-blue-400 underline hover:text-blue-300">{ad.id}<IconExternal /></a>
              </Field>
              <Field label="Vue pour la première fois">{dayYear.format(new Date(ad.first_seen_at))}</Field>
              <Field label="Période active">
                {ad.days_running} jours {ad.is_active ? "(en cours)" : "(arrêtée)"}
                <span className="block text-sm font-normal text-zinc-400">
                  {ad.delivery_start ? dayYear.format(new Date(ad.delivery_start)) : "?"} → {ad.is_active ? "aujourd'hui" : ad.delivery_stop ? dayYear.format(new Date(ad.delivery_stop)) : "?"}
                </span>
              </Field>
              <Field label="Pays">
                {ad.countries?.length ? (
                  <span className="flex flex-wrap gap-1.5 font-normal">
                    {ad.countries.slice(0, 12).map((c) => <span key={c} title={countryName(c)} className="rounded-md bg-white/[0.06] px-1.5 py-0.5 text-sm">{flag(c)} {c}</span>)}
                    {ad.countries.length > 12 && <span className="text-sm text-zinc-400">+{ad.countries.length - 12}</span>}
                  </span>
                ) : "n/d"}
              </Field>
              <Field label="Langue">{ad.languages.length ? ad.languages.map(languageName).join(", ") : "n/d"}</Field>
            </div>
            <div className="space-y-5">
              <Field label="Niche">
                <span className="text-sm"><CategorySelect id={ad.id} category={ad.category} manual={ad.classified_by === "manual"} /></span>
              </Field>
              <Field label="Type de page">{ad.page_type ?? "n/d"}</Field>
              <Field label="Plateformes">{platforms || "n/d"}</Field>
              <Field label="Format">{ad.media_kind === "video" ? "Vidéo" : ad.media_kind === "image" ? "Image" : "n/d"}</Field>
              <Field label="Page de destination">
                {ad.landing_url ? (
                  <a href={ad.landing_url} target="_blank" rel="noreferrer" className="break-all text-blue-400 underline hover:text-blue-300">
                    {ad.landing_url.replace(/^https?:\/\/(www\.)?/, "").split("?")[0]}
                  </a>
                ) : "n/d"}
              </Field>
            </div>
          </dl>

          <h3 className="mb-2 mt-8 text-lg font-semibold text-white">Anatomie du script</h3>
          {ad.hook || ad.product ? (
            <dl className="space-y-2 text-[15px]">
              {ad.hook && <div><dt className="inline font-semibold text-blue-300">Accroche : </dt><dd className="inline text-zinc-200">{ad.hook}</dd></div>}
              {ad.product && <div><dt className="inline font-semibold text-blue-300">Produit : </dt><dd className="inline text-zinc-200">{ad.product}</dd></div>}
              {ad.offer && <div><dt className="inline font-semibold text-blue-300">Offre : </dt><dd className="inline text-zinc-200">{ad.offer}</dd></div>}
            </dl>
          ) : <p className="text-zinc-400">Pas de texte à découper en accroche, produit et offre.</p>}

          <h3 className="mb-3 mt-8 text-lg font-semibold text-white">Insights créatifs</h3>
          {chips.length ? (
            <div className="flex flex-wrap gap-2">
              {chips.map((c) => <span key={c} className="rounded-lg border border-white/15 px-3 py-1.5 text-[15px] text-zinc-100">{c}</span>)}
            </div>
          ) : <p className="text-zinc-400">Aucun pour l&apos;instant.</p>}

          <h3 className="mb-3 mt-8 text-lg font-semibold text-white">Technologies</h3>
          {tech.size ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {[...tech].map(([cat, names]) => (
                <div key={cat} className="rounded-2xl border border-white/10 p-4">
                  <p className="mb-2 text-sm font-semibold text-zinc-300">{cat}</p>
                  <div className="flex flex-wrap gap-2">
                    {names.map((n) => <span key={n} className="rounded-full bg-emerald-400 px-3 py-1 text-sm font-semibold text-emerald-950">{n}</span>)}
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="text-zinc-400">{ad.page_type_tried_at ? "Aucune détectée." : "Le robot n'a pas encore visité la page de destination."}</p>}
        </section>
      </div>

      {similar.length > 0 && (
        <section className="px-5 pb-6">
          <div className="mb-4 flex items-center">
            <h3 className="text-xl font-semibold text-white">Pubs similaires</h3>
            {ad.category && (
              <Link href={`/?niche=${encodeURIComponent(ad.category)}`} className="ml-auto font-semibold text-blue-400 hover:text-blue-300">Voir plus →</Link>
            )}
          </div>
          <div className="grid gap-4 min-[640px]:grid-cols-2 min-[1024px]:grid-cols-4">
            {similar.map((s) => <AdCard key={s.id} ad={s} detailsHref={detailsHref(s.id)} />)}
          </div>
        </section>
      )}
    </ModalShell>
  );
}
