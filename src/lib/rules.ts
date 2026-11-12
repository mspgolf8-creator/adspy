/**
 * Classement gratuit par règles (mots-clés multilingues : EN, FR, DE, ES, IT, NL).
 *
 * Syntaxe des mots-clés (écrits en minuscules, sans accents) :
 *   "dog"        mot entier (+ pluriel s/es) : dog, dogs
 *   "hund*"      préfixe : hund, hunde, hundebett
 *   "air fryer"  expression (espace = espace, tiret ou rien)
 *
 * Pour améliorer le classement : ajoute des mots ici, puis « Reclasser avec les règles » dans Réglages.
 */
import type { CATEGORIES, ANGLES } from "./categories";

type Category = (typeof CATEGORIES)[number];
type Angle = (typeof ANGLES)[number];

const CATEGORY_KEYWORDS: Record<Exclude<Category, "Autre">, string[]> = {
  "Beauté & soins": [
    "skin", "skincare", "serum", "moisturizer*", "cream", "wrinkle*", "acne", "pore", "collagen", "retinol",
    "makeup", "make up", "mascara", "lipstick*", "lash*", "eyelash*", "brow*", "nail*", "manicure", "hair",
    "shampoo*", "conditioner", "beauty", "glow*", "spf", "sunscreen", "anti aging", "antiaging", "cosmetic*",
    "beaute", "peau", "rides", "creme*", "maquillage", "cheveux", "ongle*", "cosmetique*", "soin*",
    "tattoo*", "tatouage*", "parfum*", "perfume*", "fragrance*", "hautpflege", "falten*", "gesicht*", "haare*", "wimpern*",
    "piel", "arrugas", "belleza", "cabello*", "pestanas", "pelle", "capelli", "rughe", "huid", "haar",
  ],
  "Mode & vêtements": [
    "dress", "shirt*", "tshirt*", "t shirt*", "hoodie*", "jacket*", "jeans", "pants", "legging*", "sneaker*",
    "shoe*", "boots", "outfit*", "fashion", "clothing", "lingerie", "bra", "bras", "swimsuit*", "bikini*",
    "shapewear", "scrubs", "jersey*", "trikot*", "nouvelle collection", "new collection", "collezione", "wear", "pullover*", "sweater*", "cashmere", "kaschmir*", "polewear", "gloves", "gants", "handschuh*", "headband*", "beanie*", "ensemble", "tenue*", "pull", "pulls", "manteau*", "jupe*", "cardigan*", "robe", "robes", "chemise*", "pantalon*", "veste*", "chaussure*", "vetement*", "maillot*",
    "kleid*", "stirnband*", "mutze*", "jacke*", "schuh*", "hose", "hosen", "bekleidung", "ropa", "vestido*", "zapat*", "camiseta*",
    "abbigliamento", "scarpe", "kleding", "schoenen",
  ],
  "Bijoux & accessoires": [
    "jewelry", "jewellery", "necklace*", "bracelet*", "earring*", "pendant necklace*", "watches", "montres", "gold plated", "sterling silver",
    "sunglasses", "wallet*", "handbag*", "purse*", "wristwatch*", "bijou*", "collier*", "bague*",
    "boucles d oreilles", "lunettes de soleil", "sac a main", "portefeuille*", "schmuck", "halskette*",
    "armband*", "ohrring*", "sonnenbrille*", "joya*", "pulsera*", "pendiente*", "gioiell*", "orecchin*",
    "sieraden", "ketting*", "rings*", "sling bag*", "tote bag*", "925", "sterling", "silber*", "juwelier*", "jeweler*", "joaillerie", "goldschmuck",
  ],
  "Maison & déco": [
    "decor*", "home decor", "lamp*", "rug", "carpet*", "curtain*", "pillow*", "cushion*", "blanket*",
    "bedding", "sofa*", "couch*", "furniture", "shelf", "shelves", "organizer*", "storage", "cleaning",
    "cleaner*", "vacuum*", "mop", "laundry", "towel*", "candle*", "diffuser*", "wall art", "led strip*",
    "deco", "lampe*", "tapis", "rideau*", "coussin*", "meuble*", "rangement", "nettoy*", "menage",
    "bougie*", "linge", "pergola*", "terrasse*", "terrace*", "patio*", "veranda*", "serviette*", "handtuch*", "wohnzimmer", "teppich*", "kissen*", "mobel*", "reinig*", "haushalt*", "kerze*",
    "hogar", "lampara*", "alfombra*", "limpieza", "cojin*", "casa", "pulizia", "schoonmaak*",
  ],
  "Cuisine & alimentation": [
    "kitchen*", "cook*", "recipe*", "knife", "knives", "pan", "cookware", "blender*", "air fryer*",
    "airfryer*", "coffee", "espresso", "baking", "chef", "cuisin*", "recette*", "couteau*", "poele*",
    "cafe", "kuche*", "koch*", "messer", "pfanne*", "kaffee", "cocina*", "cuchillo*", "sarten*",
    "receta*", "cucina", "padella", "keuken*",
    "snack*", "chips", "croustill*", "chocolat*", "chocolate*", "candy", "bonbon*", "gourmand*", "delicious",
    "delicieu*", "lecker*", "delicios*", "tea", "matcha", "pizza*", "burger*", "restaurant*", "sushi", "advent calendar", "calendrier de l avent", "adventskalender",
  ],
  Animaux: [
    "dog*", "puppy", "puppies", "cats", "kitten*", "kitty", "pet", "paw*", "leash*", "collar*", "litter",
    "chien*", "chiot*", "chaton*", "animal*", "animaux", "hund*", "katze*", "haustier*", "welpe*",
    "perro*", "gato*", "mascota*", "gatto*", "cucciol*", "hond*", "aquarium*",
  ],
  "Fitness & sport": [
    "fitness", "workout*", "gym", "exercise*", "muscle*", "abs", "yoga", "pilates", "dumbbell*",
    "resistance band*", "protein", "treadmill*", "massage gun*", "sport*", "entrainement*", "musculation",
    "exercice*", "krafttrain*", "ubung*", "entrenamiento*", "ejercicio*", "gimnasio", "allenamento*",
  ],
  "Santé & bien-être": [
    "pain", "back pain", "posture*", "joint*", "knee*", "neck", "massage*", "massager*", "relief", "health*",
    "wellness", "supplement*", "vitamin*", "gut", "digest*", "bloat*", "detox*", "weight loss", "lose weight",
    "slim*", "menopause", "hormon*", "anxiety", "stress", "therap*", "sante", "douleur*", "bien etre",
    "minceur", "articulation*", "libido", "desir", "stimulation*", "plaisir", "vibrat*", "teeth", "denture*", "dentier*", "dents", "zahne", "prothese*", "haftcreme", "sexual*", "intime*", "erect*", "prostat*", "gesundheit*", "schmerz*", "rucken*", "gelenk*", "abnehm*", "salud",
    "dolor*", "adelgaz*", "salute", "dolore", "gezondheid", "pijn",
  ],
  Sommeil: [
    "sleep*", "insomnia", "snor*", "mattress*", "melatonin", "sommeil", "dormir", "matelas", "oreiller*",
    "ronfl*", "insomnie", "schlaf*", "matratze*", "kopfkissen", "sueno", "colchon*", "almohada*", "sonno",
    "materasso", "slaap*",
  ],
  "Bébé & enfants": [
    "baby", "babies", "toddler*", "kid", "kids", "child", "children", "infant*", "newborn*", "stroller*",
    "diaper*", "nursery", "toy", "toys", "mom", "moms", "mum", "mums", "bebe*", "enfant*", "jouet*",
    "poussette*", "maman*", "kinder*", "spielzeug*", "nino*", "juguete*", "bambin*", "giocattol*", "speelgoed",
  ],
  "Tech & gadgets": [
    "gadget*", "phone*", "iphone*", "smartphone*", "charger*", "charging", "wireless", "bluetooth",
    "earbud*", "headphone*", "speaker*", "camera*", "drone*", "smartwatch*", "usb", "power bank*",
    "powerbank*", "laptop*", "keyboard*", "projector*", "gaming", "tech", "telephone*", "chargeur*",
    "ecouteur*", "sans fil", "ladegerat*", "kopfhorer*", "kabellos*", "telefono*", "cargador*",
    "auricular*", "inalambric*", "senza fili", "wifi", "esim", "routeur*", "router*", "generator*", "generateur*", "groupe electrogene", "stromerzeuger*",
  ],
  "Auto & moto": [
    "car", "cars", "vehicle*", "truck*", "dashcam*", "dash cam*", "tire", "tyre*", "motorcycle*", "moto",
    "motos", "voiture*", "vehicule*", "pneu*", "auto", "autos", "fahrzeug*", "reifen*", "coche", "coches",
  ],
  "Plein air & voyage": [
    "camping", "hiking", "hike", "outdoor*", "travel*", "trip", "trips", "luggage", "suitcase*", "backpack*",
    "tent", "tents", "fishing", "beach", "bike", "bikes", "bicycle*", "golf*", "surf*", "kayak*", "voyage*",
    "randonnee*", "plein air", "valise*", "sac a dos", "velo*", "reise*", "wander*", "zelt*",
    "koffer*", "fahrrad*", "viaje*", "playa", "viaggi*", "spiaggia", "fiets*",
  ],
  "Jardin & bricolage": [
    "garden*", "plant", "plants", "lawn*", "tool", "tools", "drill*", "diy", "repair*", "weed*", "seeds",
    "jardin*", "plante*", "outil*", "bricol*", "perceuse*", "potager", "garten*", "pflanze*", "werkzeug*",
    "bohr*", "jardineria", "herramienta*", "giardin*", "attrezz*", "tuin*", "gereedschap",
  ],
  "Livres, jeux & apps": [
    "novel*", "webnovel*", "chapter*", "chapitre*", "kapitel*", "capitulo*", "roman", "romans", "romance",
    "read more", "lire la suite", "weiterlesen", "ebook gratuit", "mobile game*", "jeu mobile", "play now",
    "jouer", "jetzt spielen", "download*", "telecharg*", "app store", "google play",
  ],
  "Info-produits & formations": [
    "book", "books", "livre", "livres", "astrolog*", "horoscop*", "online course*", "free course*", "video course*", "masterclass", "webinar*", "ebook*", "e book*", "coaching", "coach", "mentor*",
    "make money", "side hustle", "trading", "crypto*", "invest*", "entrepreneur*", "freelanc*", "academy",
    "formation*", "cours", "apprendre", "academie", "kurs", "kurse", "lernen", "akademie",
    "curso*", "aprende*", "corso", "corsi", "cursus",
  ],
  Services: [
    "insurance", "lawyer*", "dentist*", "clinic*", "plumb*", "real estate", "mortgage*", "loan*", "solar*",
    "renovation*", "logistics", "freight", "fulfillment", "agency", "consulting", "recruit*", "hiring", "assurance auto", "assurance habitation", "assurance vie", "mutuelle*", "avocat*", "dentiste*",
    "clinique*", "plombier*", "immobili*", "hypothe*", "pret immobilier", "pret personnel", "solaire*", "agence*", "versicherung*",
    "anwalt*", "zahnarzt*", "klinik*", "seguro*", "abogado*", "clinica*", "assicuraz*", "verzekering*",
  ],
};

// Angles : testés dans l'ordre, le premier qui matche gagne
const ANGLE_RULES: [Angle, string[]][] = [
  ["Avant / après", ["before and after", "before after", "avant apres", "vorher nachher", "antes y despues", "prima e dopo", "transform*", "results in"]],
  ["Témoignage / UGC", ["review*", "testimonial*", "i tried", "customers say", "avis", "temoignage*", "j ai teste", "bewertung*", "erfahrung*", "resena*", "recensione*"]],
  ["Comparaison", ["vs", "versus", "better than", "compared to", "unlike", "mieux que", "contrairement", "besser als", "mejor que", "meglio di"]],
  ["Autorité / preuve sociale", ["dermatologist*", "doctor*", "expert*", "recommended", "clinically", "proven", "bestseller*", "best seller*", "viral", "as seen on", "happy customers", "medecin*", "recommande*", "arzt*", "klinisch*", "medico*"]],
  ["Urgence / rareté", ["limited", "last chance", "ends today", "ends tonight", "sold out", "selling fast", "hurry", "stock limite", "derniere chance", "dernieres heures", "nur noch", "letzte chance", "ultimas unidades", "ultima oportunidad", "ultima occasione"]],
  ["Problème / solution", ["tired of", "struggl*", "say goodbye", "no more", "fed up", "problem*", "marre de", "en avez assez", "en a assez", "fini les", "dites adieu", "schluss mit", "nie wieder", "adios a", "cansad*", "basta con"]],
  ["Démo produit", ["how it works", "see how", "demo", "comment ca marche", "so funktioniert", "como funciona", "come funziona"]],
  ["Histoire", ["my story", "when i", "i was", "years ago", "quand j ai", "als ich", "cuando yo", "quando ho"]],
  ["Curiosité", ["secret*", "nobody tells", "you won t believe", "here s why", "this is why", "the reason", "decouvrez", "le secret", "geheimnis*", "descubre", "scopri"]],
];

// Offres, testées sur le texte d'origine (pour afficher l'extrait tel quel)
const OFFER_PATTERNS: RegExp[] = [
  /(?<![\d,.])-?\s?\d{1,2}\s?%\s?(?:off|de r[ée]duction|rabatt|descuento|sconto)?/i,
  /free shipping|livraison (?:offerte|gratuite)|kostenlose?r? versand|env[íi]o gratis|spedizione gratuita|gratis verzending/i,
  /buy \d+,? get \d+(?: free)?|\d\s?\+\s?\d\s?(?:free|gratuit|offert|gratis)|bogo|2 pour 1|1 achet[ée] = 1 offert/i,
  /black friday|cyber monday|soldes|flash sale|\bsale\b|\bpromo\b/i,
];

function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[''`]/g, " ")
    .replace(/[^\p{L}\p{N}%+\s-]/gu, " ")
    .replace(/\s+/g, " ");
}

function escape(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Compile un mot-clé. `loose` = sans frontière de mot au début (pour les noms de page collés). */
function compile(kw: string, loose = false): RegExp {
  const prefix = kw.endsWith("*");
  const body = escape(prefix ? kw.slice(0, -1) : kw).replace(/ /g, "[\\s-]?");
  const start = loose ? "" : "\\b";
  return new RegExp(prefix ? `${start}${body}` : `${start}${body}(?:s|es)?\\b`);
}

const compiledCategories = Object.entries(CATEGORY_KEYWORDS).map(([cat, kws]) => ({
  cat: cat as Category,
  strict: kws.map((k) => compile(k)),
  // Noms de page comme « HappyPaws » : on accepte les préfixes de 4 lettres et plus collés
  loose: kws.filter((k) => k.endsWith("*") && k.length > 4).map((k) => compile(k, true)),
}));

const compiledAngles = ANGLE_RULES.map(([angle, kws]) => ({ angle, res: kws.map((k) => compile(k)) }));

export type RuleInput = {
  page_name: string | null;
  bodies: string[];
  link_titles: string[];
  link_descriptions: string[];
};

export type RuleResult = {
  category: Category;
  angle: Angle;
  hook: string | null;
  offer: string | null;
};

function countMatches(text: string, res: RegExp[]) {
  let n = 0;
  for (const re of res) if (re.test(text)) n++;
  return n;
}

export function firstSentence(text: string): string | null {
  const line = text
    .split(/\n+/)
    .map((l) => l.trim())
    .find((l) => l.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}\s]/gu, "").length > 3);
  if (!line) return null;
  const m = line.match(/^.+?[.!?…](?=\s|$)/u);
  const s = (m ? m[0] : line).trim();
  const chars = Array.from(s); // coupe par caractère complet (jamais un emoji en deux)
  return chars.length > 180 ? chars.slice(0, 177).join("") + "…" : s;
}

export function classifyByRules(ad: RuleInput): RuleResult {
  const body = normalize(ad.bodies.join(" \n "));
  const titles = normalize([...ad.link_titles, ...ad.link_descriptions].join(" "));
  const page = normalize(ad.page_name ?? "");

  // Catégorie : titres et nom de page comptent double
  let best: { cat: Category; score: number } = { cat: "Autre", score: 0 };

  // Signal fort dans le titre ou le nom de page : romans / histoires (leurs longs textes matchent tout le reste)
  const novel = /\b(chapitres?|chapters?|kapitel|capitulos?|novels?|webnovels?|romance|story|stories|dramas?|episodes?|series?|serie corta|reelshort|dramabox|reelygo)\b|lire la suite|start watching|continue watch|watch free|watch now|ver ahora|regarder gratuitement|destined mate|billionaire/;
  if (novel.test(`${titles} ${page}`)) best = { cat: "Livres, jeux & apps", score: Infinity };

  for (const c of compiledCategories) {
    const score =
      countMatches(body, c.strict) +
      2 * countMatches(titles, c.strict) +
      2 * Math.max(countMatches(page, c.strict), countMatches(page.replace(/\s/g, ""), c.loose));
    if (score > best.score) best = { cat: c.cat, score };
  }

  // Offre
  const raw = [...ad.bodies, ...ad.link_titles, ...ad.link_descriptions].join(" \n ");
  const offers = new Set<string>();
  for (const re of OFFER_PATTERNS) {
    const m = raw.match(re);
    if (m) offers.add(m[0].trim());
  }
  const offer = offers.size ? Array.from(offers).slice(0, 3).join(" · ") : null;

  // Angle
  const all = `${body} ${titles}`;
  let angle: Angle = offer ? "Offre / promo" : "Autre";
  for (const a of compiledAngles) {
    if (countMatches(all, a.res) > 0) {
      angle = a.angle;
      break;
    }
  }

  const hook = firstSentence(ad.bodies[0] ?? "") ?? ad.link_titles[0] ?? null;
  return { category: best.cat, angle, hook, offer };
}

/** Débogage : quels mots-clés matchent dans un texte, par catégorie. */
export function explain(text: string) {
  const t = normalize(text);
  const out: Record<string, string[]> = {};
  for (const [cat, kws] of Object.entries(CATEGORY_KEYWORDS)) {
    const hits = kws.filter((k) => compile(k).test(t));
    if (hits.length) out[cat] = hits;
  }
  for (const [angle, kws] of ANGLE_RULES) {
    const hits = kws.filter((k) => compile(k).test(t));
    if (hits.length) out[`angle: ${angle}`] = hits;
  }
  return out;
}

/** Retire les demi-emojis isolés (Supabase refuse ces caractères cassés). */
export function wellFormed<T>(v: T): T {
  if (typeof v === "string") return v.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "") as T;
  if (Array.isArray(v)) return v.map(wellFormed) as T;
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, wellFormed(x)])) as T;
  return v;
}
