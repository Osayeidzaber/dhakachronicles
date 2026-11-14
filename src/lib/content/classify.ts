/**
 * Automatic section + tags for imported stories (pure, no I/O, unit-tested).
 * Every story gets exactly one section: the best keyword match, falling back to "national".
 */

export const SECTION_SLUGS = ["national", "politics", "dhaka", "business", "sports", "entertainment", "international"] as const;
export type SectionSlug = (typeof SECTION_SLUGS)[number];

/** Keyword → weight per section. Lower-case English; Bangla as written. Multi-word phrases count more. */
const SECTION_KEYWORDS: Record<SectionSlug, Record<string, number>> = {
  sports: {
    football: 3, cricket: 3, match: 2, goal: 2, tournament: 3, championship: 3, saff: 4, fifa: 4, "world cup": 4, olympic: 3,
    tigers: 2, squad: 2, coach: 2, captain: 2, striker: 3, defender: 3, stadium: 2, league: 2, messi: 3, ronaldo: 3, bpl: 3, icc: 4,
    wicket: 4, innings: 4, "t20": 4, odi: 4, hamza: 2, "jamal bhuiyan": 4, ক্রিকেট: 4, ফুটবল: 4, ম্যাচ: 3, গোল: 2, খেলা: 2, টাইগার: 3,
  },
  entertainment: {
    film: 3, movie: 3, actor: 3, actress: 3, singer: 3, song: 2, album: 3, concert: 3, music: 2, drama: 2, celebrity: 3, netflix: 3,
    "gta": 3, "gta 6": 4, "gta vi": 4, "video game": 3, gaming: 3, rockstar: 3, festival: 2, indiefest: 4, trailer: 3, box: 1,
    "pop-up": 2, fashion: 2, viral: 2, influencer: 2, সিনেমা: 4, গান: 3, নাটক: 3, অভিনেতা: 4, অভিনেত্রী: 4, শিল্পী: 3, বিনোদন: 3,
  },
  business: {
    economy: 3, economic: 3, market: 2, shares: 3, stock: 3, bank: 2, banking: 3, price: 2, prices: 2, export: 3, import: 2,
    trade: 2, company: 2, ceo: 3, cfo: 3, investment: 3, investor: 3, revenue: 3, profit: 3, inflation: 4, taka: 3, dollar: 2,
    lng: 3, gas: 2, fuel: 2, electricity: 2, budget: 3, tax: 2, garment: 3, rmg: 4, startup: 3, nvidia: 3, tesla: 2,
    অর্থনীতি: 4, বাজার: 3, ব্যাংক: 3, দাম: 2, রপ্তানি: 4, বাণিজ্য: 4, শেয়ার: 3, মূল্যস্ফীতি: 4, বিনিয়োগ: 4,
  },
  politics: {
    election: 4, elections: 4, parliament: 4, minister: 3, "prime minister": 4, government: 2, party: 2, opposition: 3, vote: 3,
    hasina: 4, "sheikh hasina": 4, bnp: 4, "awami league": 4, jamaat: 4, "interim government": 4, yunus: 3, senator: 3, president: 2,
    protest: 2, rally: 2, policy: 2, mp: 2, politician: 3, politicians: 3, cabinet: 3, constitution: 3,
    নির্বাচন: 4, সংসদ: 4, মন্ত্রী: 3, সরকার: 2, রাজনীতি: 4, দল: 1, বিএনপি: 4, আওয়ামী: 4, প্রধানমন্ত্রী: 4,
  },
  international: {
    "united states": 3, usa: 3, "us ": 1, america: 2, uk: 2, britain: 3, british: 3, india: 2, indian: 2, china: 2, chinese: 2,
    pakistan: 2, russia: 3, ukraine: 3, gaza: 4, palestine: 4, israel: 4, iran: 3, europe: 2, "united nations": 3, un: 1,
    faa: 3, washington: 3, london: 3, "new delhi": 3, global: 1, world: 1, sydney: 2, australia: 2, japan: 2, saudi: 2,
    যুক্তরাষ্ট্র: 3, ভারত: 2, চীন: 2, গাজা: 4, ফিলিস্তিন: 4, বিশ্ব: 1, আন্তর্জাতিক: 3,
  },
  dhaka: {
    dhaka: 2, uttara: 4, mirpur: 4, gulshan: 4, dhanmondi: 4, banani: 4, mohammadpur: 4, motijheel: 4, kadamtali: 4, jatrabari: 4,
    badda: 4, rampura: 4, "old dhaka": 4, shahbagh: 4, farmgate: 4, tejgaon: 4, "dhaka university": 3, "metro rail": 3, dncc: 4, dscc: 4,
    ঢাকা: 2, উত্তরা: 4, মিরপুর: 4, গুলশান: 4, ধানমন্ডি: 4, বনানী: 4, কদমতলী: 4, শাহবাগ: 4,
  },
  national: {
    bangladesh: 1, bangladeshi: 1, district: 2, upazila: 3, division: 1, chattogram: 3, chittagong: 3, sylhet: 3, khulna: 3,
    rajshahi: 3, barishal: 3, rangpur: 3, mymensingh: 3, police: 1, court: 2, rab: 3, flood: 2, cyclone: 3, students: 1, university: 1,
    বাংলাদেশ: 1, জেলা: 2, উপজেলা: 3, চট্টগ্রাম: 3, সিলেট: 3, পুলিশ: 1, আদালত: 2,
  },
};

/** Tie-break order: more specific sections win over broader ones. */
const PRIORITY: SectionSlug[] = ["sports", "entertainment", "business", "politics", "dhaka", "international", "national"];

function normalise(text: string) {
  return ` ${text.toLowerCase().replace(/[“”"’'`]/g, "").replace(/\s+/g, " ")} `;
}

function countHits(hay: string, kw: string): number {
  // Latin keywords match whole words; Bangla (no word boundaries in \b) matches substrings.
  if (/^[\x20-\x7e]+$/.test(kw)) {
    const re = new RegExp(`(^|[^a-z0-9])${kw.trim().replace(/[.*+?^${}()|[\]\\-]/g, "\\$&")}([^a-z0-9]|$)`, "g");
    return (hay.match(re) ?? []).length;
  }
  return hay.split(kw).length - 1;
}

export function scoreSections(text: string): Record<SectionSlug, number> {
  const hay = normalise(text);
  const scores = Object.fromEntries(SECTION_SLUGS.map((s) => [s, 0])) as Record<SectionSlug, number>;
  for (const slug of SECTION_SLUGS) {
    for (const [kw, w] of Object.entries(SECTION_KEYWORDS[slug])) {
      const n = countHits(hay, kw);
      if (n) scores[slug] += w * Math.min(n, 3);
    }
  }
  return scores;
}

/** Best section for a caption/title; never empty. */
export function classifySection(text: string): SectionSlug {
  const scores = scoreSections(text);
  let best: SectionSlug = "national";
  let top = 0;
  for (const slug of PRIORITY) {
    if (scores[slug] > top) {
      top = scores[slug];
      best = slug;
    }
  }
  return best;
}

/** Known entities → tag (English, Bangla). Matched case-insensitively in the caption. */
const ENTITIES: { match: string[]; en: string; bn: string }[] = [
  { match: ["bangladesh", "বাংলাদেশ"], en: "Bangladesh", bn: "বাংলাদেশ" },
  { match: ["dhaka", "ঢাকা"], en: "Dhaka", bn: "ঢাকা" },
  { match: ["sheikh hasina", "hasina", "হাসিনা"], en: "Sheikh Hasina", bn: "শেখ হাসিনা" },
  { match: ["awami league", "আওয়ামী লীগ"], en: "Awami League", bn: "আওয়ামী লীগ" },
  { match: ["bnp", "বিএনপি"], en: "BNP", bn: "বিএনপি" },
  { match: ["yunus", "ইউনূস"], en: "Muhammad Yunus", bn: "মুহাম্মদ ইউনূস" },
  { match: ["election", "নির্বাচন"], en: "Election", bn: "নির্বাচন" },
  { match: ["saff"], en: "SAFF Championship", bn: "সাফ চ্যাম্পিয়নশিপ" },
  { match: ["cricket", "ক্রিকেট"], en: "Cricket", bn: "ক্রিকেট" },
  { match: ["football", "ফুটবল"], en: "Football", bn: "ফুটবল" },
  { match: ["messi"], en: "Lionel Messi", bn: "লিওনেল মেসি" },
  { match: ["argentina", "আর্জেন্টিনা"], en: "Argentina", bn: "আর্জেন্টিনা" },
  { match: ["gta 6", "gta vi", "grand theft auto"], en: "GTA 6", bn: "জিটিএ ৬" },
  { match: ["nvidia"], en: "Nvidia", bn: "এনভিডিয়া" },
  { match: ["gaza", "palestine", "গাজা", "ফিলিস্তিন"], en: "Palestine", bn: "ফিলিস্তিন" },
  { match: ["india", "ভারত"], en: "India", bn: "ভারত" },
  { match: ["united states", "usa", "america", "যুক্তরাষ্ট্র"], en: "United States", bn: "যুক্তরাষ্ট্র" },
  { match: ["united nations", "জাতিসংঘ"], en: "United Nations", bn: "জাতিসংঘ" },
  { match: ["uttara", "উত্তরা"], en: "Uttara", bn: "উত্তরা" },
  { match: ["metro rail", "মেট্রোরেল"], en: "Metro Rail", bn: "মেট্রোরেল" },
  { match: ["police", "পুলিশ"], en: "Police", bn: "পুলিশ" },
  { match: ["dengue", "ডেঙ্গু"], en: "Dengue", bn: "ডেঙ্গু" },
  { match: ["flood", "বন্যা"], en: "Floods", bn: "বন্যা" },
  { match: ["lng", "gas supply", "গ্যাস"], en: "Energy", bn: "জ্বালানি" },
];

export interface AutoTag {
  slug: string;
  en: string;
  bn: string;
}

export function tagSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "tag"
  );
}

/** ASCII slug for a tag (tags use ASCII slugs); Bangla-only names fall back to a hashed slug. */
function asciiSlug(name: string): string {
  const s = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  if (s) return s;
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.codePointAt(0)!) >>> 0;
  return `tag-${h.toString(36)}`;
}

/** Paid or partner content: brand collaborations must always be labelled. */
const SPONSORED_SIGNALS = [
  "in collaboration with", "in partnership with", "paid partnership", "sponsored by", "presented by", "powered by",
  "brought to you by", "#ad", "#ads", "#sponsored", "#collab", "#collaboration", "#partner", "#paidpartnership",
  "সহযোগিতায়", "পৃষ্ঠপোষকতায়", "স্পনসরড",
];

export const SPONSORED_TAG: AutoTag = { slug: "sponsored", en: "Sponsored", bn: "স্পনসরড" };

export function isSponsored(caption: string): boolean {
  const hay = caption.toLowerCase();
  return SPONSORED_SIGNALS.some((sig) => (sig.startsWith("#") ? new RegExp(`${sig}(?![\\p{L}\\p{N}_])`, "u").test(hay) : hay.includes(sig)));
}

/** Tags from the caption: Sponsored (if a collaboration), its own #hashtags, plus known entities. Max 6, no duplicates. */
export function autoTags(caption: string, max = 6): AutoTag[] {
  const out = new Map<string, AutoTag>();
  if (isSponsored(caption)) out.set(SPONSORED_TAG.slug, SPONSORED_TAG);
  const hay = normalise(caption);
  for (const e of ENTITIES) {
    if (e.match.some((m) => countHits(hay, m) > 0)) {
      const slug = asciiSlug(e.en);
      if (!out.has(slug)) out.set(slug, { slug, en: e.en, bn: e.bn });
    }
  }
  for (const m of caption.matchAll(/#([\p{L}\p{N}_]{3,40})/gu)) {
    // "#HumanRights" / "#human_rights" → "Human Rights"
    const raw = m[1].replace(/_/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2");
    const name = /^[a-z0-9 ]+$/i.test(raw) ? raw.replace(/\b\w/g, (c) => c.toUpperCase()) : raw;
    const slug = asciiSlug(name);
    if (["dhakachronicles", "dhaka-chronicles", "news", "breaking", "bangladeshnews", "ad", "ads", "sponsored", "collab", "collaboration", "partner", "paidpartnership"].includes(slug)) continue;
    if (!out.has(slug)) out.set(slug, { slug, en: name, bn: name });
  }
  return [...out.values()].slice(0, max);
}
