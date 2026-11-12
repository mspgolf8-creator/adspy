/**
 * Type de page de destination : le robot récupère le lien de la pub (aperçu officiel),
 * ouvre la page du marchand et la classe par règles (gratuit).
 */
import { chromium, type Page } from "playwright";
import { db } from "./supabase";
import { metaConfig } from "./meta";
import { errMsg } from "./errors";
import { PAGE_TYPES } from "./categories";

type Log = (msg: string) => void;


/** Le vrai lien derrière l'aperçu Meta (l.facebook.com/l.php?u=…). */
export async function landingFromSnapshot(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    for (const a of document.querySelectorAll<HTMLAnchorElement>("a[href]")) {
      try {
        const u = new URL(a.href);
        if (u.hostname.startsWith("l.facebook.com") || u.hostname.startsWith("lm.facebook.com")) {
          const target = u.searchParams.get("u");
          if (target) return target;
        } else if (!/facebook\.com|fbcdn|instagram\.com|meta\.com/.test(u.hostname) && u.protocol.startsWith("http")) {
          return u.href;
        }
      } catch {}
    }
    return null;
  });
}

/** Technologies détectées dans le code de la page : « Catégorie|Nom ». */
const TECH_RULES: [string, string, RegExp][] = [
  ["E-commerce", "Shopify", /cdn\.shopify\.com|shopify\.theme|myshopify\.com/],
  ["E-commerce", "WooCommerce", /woocommerce/],
  ["E-commerce", "Magento", /mage\/cookies|magento/],
  ["E-commerce", "BigCommerce", /bigcommerce\.com/],
  ["E-commerce", "PrestaShop", /prestashop/],
  ["E-commerce", "Shopware", /shopware/],
  ["CMS", "WordPress", /wp-content|wp-includes/],
  ["CMS", "Wix", /wixstatic\.com|static\.parastorage\.com/],
  ["CMS", "Squarespace", /squarespace\.com|static1\.squarespace/],
  ["CMS", "Webflow", /webflow\.(com|io)|data-wf-page/],
  ["Funnel / landing", "ClickFunnels", /clickfunnels|cf-assets/],
  ["Funnel / landing", "Funnelish", /funnelish/],
  ["Funnel / landing", "GemPages", /gempages|gem-page/],
  ["Funnel / landing", "PageFly", /pagefly/],
  ["Funnel / landing", "Replo", /replo/],
  ["Funnel / landing", "Shogun", /getshogun|shogun-/],
  ["Funnel / landing", "Zipify Pages", /zipify/],
  ["Funnel / landing", "Unbounce", /unbounce/],
  ["Funnel / landing", "Instapage", /instapage/],
  ["Funnel / landing", "Leadpages", /leadpages/],
  ["Funnel / landing", "GoHighLevel", /leadconnectorhq|msgsndr|highlevel/],
  ["Funnel / landing", "Systeme.io", /systeme\.io/],
  ["Email / SMS", "Klaviyo", /klaviyo/],
  ["Email / SMS", "Mailchimp", /mailchimp|chimpstatic/],
  ["Email / SMS", "Omnisend", /omnisend/],
  ["Email / SMS", "Attentive", /attn\.tv|attentivemobile/],
  ["Email / SMS", "Postscript", /postscript\.io/],
  ["Avis clients", "Judge.me", /judge\.me/],
  ["Avis clients", "Loox", /loox\.io/],
  ["Avis clients", "Okendo", /okendo/],
  ["Avis clients", "Yotpo", /yotpo/],
  ["Avis clients", "Trustpilot", /trustpilot/],
  ["Avis clients", "Stamped", /stamped\.io/],
  ["Suivi / pixels", "Meta Pixel", /connect\.facebook\.net\/[^"']*fbevents|fbq\(/],
  ["Suivi / pixels", "TikTok Pixel", /analytics\.tiktok\.com/],
  ["Suivi / pixels", "Google Analytics", /googletagmanager\.com|google-analytics\.com/],
  ["Suivi / pixels", "Hotjar", /hotjar/],
  ["Suivi / pixels", "Triple Whale", /triplewhale|triplepixel/],
  ["Paiement", "Klarna", /klarna/],
  ["Paiement", "Afterpay", /afterpay|clearpay/],
  ["Paiement", "PayPal", /paypal\.com\/sdk|paypalobjects/],
  ["Paiement", "Stripe", /js\.stripe\.com/],
  ["Vidéo", "Vidalytics", /vidalytics/],
  ["Vidéo", "Wistia", /wistia/],
  ["Vidéo", "VTurb", /vturb|converteai/],
  ["Vidéo", "YouTube", /youtube\.com\/embed|youtube-nocookie/],
];

async function detectTech(page: Page): Promise<string[]> {
  // Seulement les fichiers vraiment chargés (scripts, styles, iframes) + le pixel Meta en ligne :
  // le texte brut de la page cite souvent des apps qu'elle n'utilise pas.
  const haystack = (
    await page.evaluate(() => {
      const srcs = [...document.querySelectorAll<HTMLScriptElement | HTMLIFrameElement>("script[src], iframe[src]")].map((e) => e.src);
      const links = [...document.querySelectorAll<HTMLLinkElement>("link[href]")].map((e) => e.href);
      const res = performance.getEntriesByType("resource").map((r) => r.name);
      const inline = [...document.querySelectorAll("script:not([src])")].map((e) => (e.textContent ?? "").slice(0, 3000)).join(" ");
      const hasFbq = /fbq\(\s*['"]init/.test(inline) ? "connect.facebook.net/x/fbevents" : "";
      const meta = (window as unknown as { Shopify?: unknown }).Shopify ? "cdn.shopify.com" : "";
      const body = document.body?.className ?? "";
      return [...srcs, ...links, ...res, hasFbq, meta, body].join(" ");
    })
  ).toLowerCase();
  return TECH_RULES.filter(([, , re]) => re.test(haystack)).map(([cat, name]) => `${cat}|${name}`);
}

type Signals = {
  path: string;
  title: string;
  words: number;
  h: string[];
  addToCart: boolean;
  productSchema: boolean;
  emailInputs: number;
  formFields: number;
  videos: number;
  numberedHeads: number;
  productLinks: number;
  quizHints: boolean;
  byline: boolean;
};

async function readSignals(page: Page): Promise<Signals> {
  return page.evaluate(() => {
    const text = document.body?.innerText ?? "";
    const h = [...document.querySelectorAll("h1, h2, h3")].map((e) => (e.textContent ?? "").trim()).filter(Boolean).slice(0, 40);
    const buttons = [...document.querySelectorAll("button, input[type=submit], a")].map((e) =>
      ((e as HTMLElement).innerText || (e as HTMLInputElement).value || "").toLowerCase(),
    );
    const ld = [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => s.textContent ?? "").join(" ");
    return {
      path: location.pathname.toLowerCase(),
      title: document.title,
      words: text.split(/\s+/).length,
      h,
      addToCart: buttons.some((b) =>
        /add to (cart|bag)|ajouter au panier|in den warenkorb|in winkelwagen|añadir al carrito|aggiungi al carrello|buy now|acheter maintenant|jetzt kaufen/.test(b),
      ),
      productSchema: /"@type"\s*:\s*"Product"/i.test(ld) || Boolean(document.querySelector('meta[property="og:type"][content="product"]')),
      emailInputs: document.querySelectorAll('input[type=email], input[name*=email i]').length,
      formFields: document.querySelectorAll("form input:not([type=hidden]), form select").length,
      videos:
        document.querySelectorAll("video").length +
        document.querySelectorAll('iframe[src*="youtube"], iframe[src*="vimeo"], iframe[src*="wistia"], iframe[src*="vidalytics"], iframe[src*="vturb"], [class*="vidalytics"], [id*="vidalytics"], [class*="wistia"]').length,
      numberedHeads: h.filter((t) => /^(#?\d{1,2}[.):\-]|n[°o]\s?\d)/i.test(t)).length,
      productLinks: document.querySelectorAll('a[href*="/products/"], a[href*="/product/"]').length,
      quizHints: /question \d+ (of|sur|von)|step \d+ of|étape \d+ sur|take (the|our) quiz|faites le quiz/i.test(text.slice(0, 3000)) || Boolean(document.querySelector('form[class*="quiz" i], [id^="quiz" i]')),
      byline: /\b(by|par|von|door)\s+[A-Z][a-z]+ [A-Z][a-z]+|updated|mis à jour|aktualisiert|min read|lecture/i.test(text.slice(0, 2500)),
    };
  });
}

export function classifyPage(s: Signals): (typeof PAGE_TYPES)[number] {
  const p = s.path;
  const home = p === "/" || p === "" || /^\/(en|fr|de|nl|es|it|[a-z]{2}-[a-z]{2})\/?$/.test(p);
  if (/\/(cart|checkout|panier|warenkorb)/.test(p)) return "Panier / checkout";
  if (/quiz/.test(p) || (s.quizHints && s.words < 600 && !s.addToCart)) return "Quiz";
  if (/\/(products?|produits?|produkt|p)\//.test(p) || (s.productSchema && s.addToCart)) return "Page produit";
  if (/\/(collections?|categor(y|ies)|catalog)/.test(p)) return "Collection";
  if (home) return "Page d'accueil";
  if (/\/(blogs?|articles?|news|journal|magazine)\//.test(p) && !s.addToCart) {
    if (s.numberedHeads >= 3) return "Listicle";
    return "Article de blog";
  }
  if (s.numberedHeads >= 3 && s.words > 500 && s.productLinks < 8 && !s.addToCart) return "Listicle";
  if (s.videos >= 1 && s.words < 700 && !s.addToCart) return "Page VSL";
  if (s.emailInputs >= 1 && s.formFields <= 4 && s.words < 600 && !s.addToCart && s.productLinks < 3) return "Capture de leads";
  // Advertorial : long texte de vente hors du blog (souvent /pages/… sur Shopify)
  if (s.words > 800 && s.productLinks < 3) return s.byline && !/\/pages\//.test(p) ? "Article de blog" : "Advertorial";
  if (s.addToCart) return "Page produit";
  if (s.productLinks >= 8) return "Collection";
  if (s.words > 300) return "Landing page";
  return "Autre";
}

export async function fetchPageTypes(log: Log = console.log) {
  const limit = Number(process.env.PAGE_LIMIT || 150);
  const { token } = metaConfig();

  // Moitié Europe (par score), moitié US/CA (par rang d'impressions) ; le reste va à l'autre si une moitié est vide
  const pending = (source: string, n: number) => {
    let q = db()
      .from("ads_scored")
      .select("id, landing_url")
      .eq("is_active", true)
      .eq("source", source)
      .is("page_type_tried_at", null)
      .or('category.is.null,category.neq."Livres, jeux & apps"'); // les romans / apps : pas utile
    q = source === "api" ? q.order("winner_score", { ascending: false }) : q.order("lib_rank", { ascending: true, nullsFirst: false });
    return q.limit(n);
  };
  const lib = await pending("library", Math.ceil(limit / 2));
  if (lib.error) throw lib.error;
  const api = await pending("api", limit - (lib.data?.length ?? 0));
  if (api.error) throw api.error;
  const rows = [...(api.data ?? []), ...(lib.data ?? [])] as { id: string; landing_url: string | null }[];
  if (!rows.length) return log("✓ types de page : rien de nouveau");

  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    locale: "fr-FR",
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36",
  });
  const page = await ctx.newPage();
  const cache = new Map<string, { url: string; type: string; tech: string[] }>(); // même page pour plusieurs pubs
  let ok = 0;
  let none = 0;
  let failed = 0;
  try {
    for (const row of rows) {
      const now = new Date().toISOString();
      try {
        let link = row.landing_url;
        if (!link) {
          await page.goto(`https://www.facebook.com/ads/archive/render_ad/?id=${row.id}&access_token=${token}`, {
            waitUntil: "networkidle",
            timeout: 30000,
          }).catch(() => {});
          if (/login|checkpoint/.test(page.url())) throw new Error("Meta demande une connexion : arrêt");
          link = await landingFromSnapshot(page);
        }
        if (!link) {
          none++;
          await db().from("ads").update({ page_type_tried_at: now }).eq("id", row.id);
          continue;
        }
        const key = link.split("?")[0];
        let hit = cache.get(key);
        if (!hit) {
          await page.goto(link, { waitUntil: "domcontentloaded", timeout: 25000 });
          await page.waitForTimeout(2500); // laisse les pages JS (Shopify, funnels) s'afficher
          const signals = await readSignals(page);
          hit = { url: page.url(), type: classifyPage(signals), tech: await detectTech(page).catch(() => []) };
          cache.set(key, hit);
        }
        await db().from("ads").update({ landing_url: hit.url, page_type: hit.type, technologies: hit.tech, page_type_tried_at: now }).eq("id", row.id);
        ok++;
      } catch (e) {
        failed++;
        const msg = errMsg(e);
        await db().from("ads").update({ page_type_tried_at: now }).eq("id", row.id);
        if (/connexion : arrêt/.test(msg)) {
          log(`✗ ${msg}`);
          break;
        }
      }
    }
  } finally {
    await browser.close();
  }
  log(`✓ types de page : ${ok} classées, ${none} sans lien, ${failed} pages inaccessibles`);
}
export const readSignalsForTest = readSignals;
