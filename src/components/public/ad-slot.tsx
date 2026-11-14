import type { SiteAd } from "@/lib/articles/queries";
import type { Lang } from "@/lib/db/types";
import { ResponsiveImage } from "./responsive-image";

/** A clearly labelled paid banner. Links are sponsored + nofollow, per search engine rules. */
export function AdSlot({ ad, lang, className = "" }: { ad: SiteAd | undefined; lang: Lang; className?: string }) {
  if (!ad) return null;
  return (
    <aside aria-label={lang === "bn" ? "বিজ্ঞাপন" : "Advertisement"} className={`flex flex-col gap-2 ${className}`}>
      <span className="text-[10px] font-semibold tracking-[0.16em] text-subtle uppercase">{lang === "bn" ? "বিজ্ঞাপন" : "Advertisement"}</span>
      <a href={ad.ad_link_url} target="_blank" rel="sponsored nofollow noopener" className="group block overflow-hidden rounded-2xl border border-line bg-surface">
        <ResponsiveImage
          image={ad.image}
          alt={`${ad.brand_name}${lang === "bn" ? " — বিজ্ঞাপন" : " — advertisement"}`}
          sizes="(max-width: 768px) 100vw, 1200px"
          className="aspect-[3/1] w-full object-cover transition duration-500 group-hover:scale-[1.01]"
        />
      </a>
    </aside>
  );
}
