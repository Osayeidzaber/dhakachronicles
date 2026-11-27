import type { StaticImageData } from "next/image";
import type { Partner } from "@/lib/articles/queries";
import type { Lang } from "@/lib/db/types";
import abdulAwalMintoo from "../../public/interviews/abdul-awal-mintoo.jpg";
import abdulHannanMasud from "../../public/interviews/abdul-hannan-masud.jpg";
import asfarHussain from "../../public/interviews/asfar-hussain.jpg";
import bobbyHajjaj from "../../public/interviews/bobby-hajjaj.jpg";
import habiburRashidHabib from "../../public/interviews/habibur-rashid-habib.jpg";
import mahbubUddinKhokon from "../../public/interviews/mahbub-uddin-khokon.jpg";
import masoodKamal from "../../public/interviews/masood-kamal.jpg";
import murtazaQizilbash from "../../public/interviews/murtaza-qizilbash.jpg";
import nayabYusuf from "../../public/interviews/nayab-yusuf.jpg";
import rashnaImam from "../../public/interviews/rashna-imam.jpg";
import otilia from "../../public/interviews/otilia.jpg";
import nolbertoSolano from "../../public/interviews/nolberto-solano.jpg";
import sumayaMatsushima from "../../public/interviews/sumaya-matsushima.jpg";

/**
 * Past work that is not (yet) recorded as a brand deal in the CMS: brands we have worked with and
 * people we have interviewed. Shown on the Advertise page and the homepage.
 * Brand deals ticked "Show on the website" in the CMS come first; these fill in after them.
 */

type Text = Record<Lang, string>;

export interface PastBrand {
  name: string;
  /** Path under /public, e.g. "/brands/hisense.svg". Without one, the name is shown in type. */
  logo?: string;
}

export const PAST_BRANDS: PastBrand[] = [
  { name: "Hisense", logo: "/brands/hisense.svg" },
  { name: "Hyundai", logo: "/brands/hyundai.svg" },
  { name: "bKash", logo: "/brands/bkash.svg" },
  { name: "Footsteps" },
  { name: "Drinko" },
  { name: "Clemon" },
  { name: "Abul Khair Group", logo: "/brands/abul-khair-group.svg" },
  { name: "Marks" },
  { name: "Walton Lift", logo: "/brands/walton.png" },
  { name: "Gold Kinen", logo: "/brands/gold-kinen.svg" },
  { name: "Unimart", logo: "/brands/unimart.png" },
  { name: "Kinokuniya", logo: "/brands/kinokuniya.png" },
  { name: "Houston" },
  { name: "Adonis Salon" },
  { name: "Banglalink", logo: "/brands/banglalink.svg" },
  { name: "Cirkle", logo: "/brands/cirkle.svg" },
  { name: "Shah Cement" },
  { name: "Seylon Tea" },
  { name: "Walton Refrigerator", logo: "/brands/walton.png" },
  { name: "M-Rise" },
  { name: "JTI", logo: "/brands/jti.svg" },
  { name: "PRAN", logo: "/brands/pran.png" },
  { name: "Le d’Or", logo: "/brands/le-dor.png" },
  { name: "Fiero" },
  { name: "Fair Electronics", logo: "/brands/fair-electronics.png" },
  { name: "Philip Morris", logo: "/brands/philip-morris.svg" },
  { name: "United Group", logo: "/brands/united-group.svg" },
  { name: "Club House DHK" },
];

/** A brand shown on the site: a CMS partner, or a past brand from the list above. */
export type ShownBrand = Partner & { logoPath?: string };

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** CMS partners first, then past brands not already among them (matched on name). */
export function withPastBrands(partners: Partner[]): ShownBrand[] {
  const seen = new Set(partners.map((p) => norm(p.brand_name)));
  const extra = PAST_BRANDS.filter((b) => !seen.has(norm(b.name))).map<ShownBrand>((b) => ({
    id: `past:${norm(b.name)}`,
    brand_name: b.name,
    website_url: null,
    public_blurb: null,
    proof_url: null,
    logo: null,
    logoPath: b.logo,
  }));
  return [...partners, ...extra];
}

export interface Interviewee {
  name: Text;
  /** Current role, checked November 2026. */
  role: Text;
  /** Constituency for members of parliament (13th Jatiya Sangsad, elected 12 February 2026). */
  seat?: Text;
  photo?: StaticImageData;
  /** CSS object-position for the square crop. */
  focus?: string;
  /** Required for CC BY-SA photos. */
  credit?: { author: string; license: string; licenseUrl: string; source: string };
}

const BNP: Text = { en: "BNP", bn: "বিএনপি" };
const mp = (en: string, bn: string, party: Text): Text => ({ en: `MP, ${en} (${party.en})`, bn: `সংসদ সদস্য, ${bn} (${party.bn})` });

export const INTERVIEWEES: Interviewee[] = [
  {
    name: { en: "Murtaza Qizilbash", bn: "মুর্তজা কিজিলবাশ" },
    role: { en: "Singer-songwriter, Lahore", bn: "গায়ক ও গীতিকার, লাহোর" },
    photo: murtazaQizilbash,
    focus: "50% 22%",
  },
  {
    name: { en: "Abdul Hannan Masud", bn: "আব্দুল হান্নান মাসউদ" },
    role: { en: "Senior Joint Chief Coordinator, National Citizen Party", bn: "জ্যেষ্ঠ যুগ্ম মুখ্য সমন্বয়ক, জাতীয় নাগরিক পার্টি" },
    seat: mp("Noakhali-6 (Hatiya)", "নোয়াখালী-৬ (হাতিয়া)", { en: "NCP", bn: "এনসিপি" }),
    photo: abdulHannanMasud,
  },
  {
    name: { en: "Asfar Hussain", bn: "আসফার হুসেইন" },
    role: { en: "Lead vocalist, Bayaan", bn: "প্রধান কণ্ঠশিল্পী, বায়ান" },
    photo: asfarHussain,
    focus: "50% 15%",
  },
  {
    name: { en: "Otilia", bn: "ওটিলিয়া" },
    role: { en: "Singer, Romania", bn: "সংগীতশিল্পী, রোমানিয়া" },
    photo: otilia,
    focus: "50% 25%",
  },
  {
    name: { en: "Bobby Hajjaj", bn: "ববি হাজ্জাজ" },
    role: { en: "State Minister for Primary and Mass Education", bn: "প্রাথমিক ও গণশিক্ষা প্রতিমন্ত্রী" },
    seat: mp("Dhaka-13", "ঢাকা-১৩", BNP),
    photo: bobbyHajjaj,
    focus: "50% 20%",
  },
  {
    name: { en: "Habibur Rashid Habib", bn: "হাবিবুর রশিদ হাবিব" },
    role: { en: "State Minister for Railways and Road Transport and Highways", bn: "রেলপথ এবং সড়ক পরিবহন ও মহাসড়ক প্রতিমন্ত্রী" },
    seat: mp("Dhaka-9", "ঢাকা-৯", BNP),
    photo: habiburRashidHabib,
    focus: "50% 20%",
  },
  {
    name: { en: "Abdul Awal Mintoo", bn: "আব্দুল আউয়াল মিন্টু" },
    role: { en: "Minister of Environment, Forest and Climate Change", bn: "পরিবেশ, বন ও জলবায়ু পরিবর্তন মন্ত্রী" },
    seat: mp("Feni-3", "ফেনী-৩", BNP),
    photo: abdulAwalMintoo,
    focus: "50% 20%",
  },
  {
    name: { en: "Rashna Imam", bn: "রাশনা ইমাম" },
    role: { en: "Senior Advocate, Supreme Court of Bangladesh", bn: "সিনিয়র অ্যাডভোকেট, বাংলাদেশ সুপ্রিম কোর্ট" },
    photo: rashnaImam,
    focus: "50% 20%",
  },
  {
    name: { en: "Barrister A. M. Mahbub Uddin Khokon", bn: "ব্যারিস্টার এ এম মাহবুব উদ্দিন খোকন" },
    role: { en: "Lawyer, Supreme Court of Bangladesh", bn: "আইনজীবী, বাংলাদেশ সুপ্রিম কোর্ট" },
    seat: mp("Noakhali-1", "নোয়াখালী-১", BNP),
    photo: mahbubUddinKhokon,
    focus: "40% 20%",
  },
  {
    name: { en: "Nayab Yusuf", bn: "নায়াব ইউসুফ" },
    role: { en: "Member of Parliament", bn: "সংসদ সদস্য" },
    seat: mp("Faridpur-3", "ফরিদপুর-৩", BNP),
    photo: nayabYusuf,
    focus: "50% 20%",
  },
  {
    name: { en: "Sumaya Matsushima", bn: "সুমাইয়া মাতসুশিমা" },
    role: { en: "Footballer, Bangladesh women’s national team", bn: "ফুটবলার, বাংলাদেশ জাতীয় নারী দল" },
    photo: sumayaMatsushima,
    focus: "50% 40%",
    credit: {
      author: "Redoy Meazi",
      license: "CC BY-SA 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
      source: "https://commons.wikimedia.org/wiki/File:Matsushima_Sumaya_%E2%80%8DSusu.jpg",
    },
  },
  {
    name: { en: "Masood Kamal", bn: "মাসুদ কামাল" },
    role: { en: "Journalist and political analyst", bn: "সাংবাদিক ও রাজনৈতিক বিশ্লেষক" },
    photo: masoodKamal,
    focus: "50% 30%",
  },
  {
    name: { en: "Nolberto Solano", bn: "নলবের্তো সোলানো" },
    role: { en: "Head coach, Pakistan men’s national football team", bn: "প্রধান কোচ, পাকিস্তান জাতীয় পুরুষ ফুটবল দল" },
    photo: nolbertoSolano,
    focus: "50% 4%",
    credit: {
      author: "Jcswayne",
      license: "CC BY-SA 3.0",
      licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/",
      source: "https://commons.wikimedia.org/wiki/File:Solano.JPG",
    },
  },
];
