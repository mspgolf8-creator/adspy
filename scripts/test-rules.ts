// Test des règles sur des pubs live de Meta (n'écrit rien en base)
// Usage : npx tsx scripts/test-rules.ts [filtre nom de page]
import { config } from "dotenv"; config({ path: ".env.local", quiet: true });
import { classifyByRules, explain } from "../src/lib/rules";
(async () => {
  const t = process.env.META_ACCESS_TOKEN!, v = process.env.META_API_VERSION!;
  const filter = process.argv[2]?.toLowerCase();
  const ads: any[] = [];
  for (const term of ["free shipping", "50% off", "livraison gratuite", "kostenloser versand"]) {
    const p = new URLSearchParams({ search_terms: term, ad_reached_countries: JSON.stringify(["FR","DE","NL"]), ad_type: "ALL", ad_active_status: "ACTIVE", fields: "id,page_name,ad_creative_bodies,ad_creative_link_titles,ad_creative_link_descriptions", limit: "50", access_token: t });
    const r = await (await fetch(`https://graph.facebook.com/${v}/ads_archive?${p}`)).json();
    if (r.error) { console.log("ERR", r.error.message); return; }
    ads.push(...r.data);
  }
  const dist: Record<string, number> = {};
  for (const a of ads) {
    const input = { page_name: a.page_name ?? null, bodies: a.ad_creative_bodies ?? [], link_titles: a.ad_creative_link_titles ?? [], link_descriptions: a.ad_creative_link_descriptions ?? [] };
    const res = classifyByRules(input);
    dist[res.category] = (dist[res.category] ?? 0) + 1;
    if (filter && (a.page_name ?? "").toLowerCase().includes(filter)) {
      console.log(`\n[${res.category} | ${res.angle}] ${a.page_name} offre=${res.offer}`);
      console.log("  titres:", input.link_titles.join(" | ").slice(0, 150));
      console.log("  matchs:", JSON.stringify(explain([input.page_name, ...input.bodies, ...input.link_titles, ...input.link_descriptions].join(" "))));
    }
  }
  if (!filter) {
    console.log("Total", ads.length, dist);
    for (const a of ads.filter((x) => classifyByRules({ page_name: x.page_name ?? null, bodies: x.ad_creative_bodies ?? [], link_titles: x.ad_creative_link_titles ?? [], link_descriptions: x.ad_creative_link_descriptions ?? [] }).category === "Autre").slice(0, 30))
      console.log(`  Autre: ${a.page_name} :: ${(a.ad_creative_bodies?.[0] ?? a.ad_creative_link_titles?.[0] ?? "").replace(/\s+/g, " ").slice(0, 100)}`);
  }
})();
