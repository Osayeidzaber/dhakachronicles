import type { SiteAd } from "@/lib/articles/queries";
import type { Lang } from "@/lib/db/types";
import { AdTracker } from "./ad-tracker";

type Img = NonNullable<SiteAd["creatives"]["wide"]>;

function srcset(img: Img, format: "avif" | "webp") {
  return img.variants
    .filter((v) => v.format === format)
    .sort((a, b) => a.width - b.width)
    .map((v) => `${v.url} ${v.width}w`)
    .join(", ");
}

/**
 * A clearly labelled paid banner. Uses the phone image on small screens and the wide one
 * elsewhere (`shape="square"` prefers the square image, e.g. inside articles).
 * Clicks go through /api/ads/click so they are counted; links are sponsored + nofollow.
 */
export function AdSlot({ ad, lang, shape = "banner", className = "" }: { ad: SiteAd | undefined; lang: Lang; shape?: "banner" | "square"; className?: string }) {
  if (!ad) return null;
  const { wide, mobile, square } = ad.creatives;
  const main = shape === "square" ? (square ?? wide ?? mobile) : (wide ?? mobile ?? square);
  const small = shape === "square" ? (square ?? mobile) : (mobile ?? square);
  if (!main) return null;
  const ratio = main === square ? "aspect-square" : main === mobile ? "aspect-[2/1]" : "aspect-[4/1]";
  const smallRatio = small && small !== main ? (small === square ? "max-sm:aspect-square" : "max-sm:aspect-[2/1]") : "";
  const sizes = shape === "square" ? "420px" : "(max-width: 1280px) 100vw, 1200px";
  const label = lang === "bn" ? "বিজ্ঞাপন" : "Advertisement";
  return (
    <aside aria-label={label} className={`flex flex-col gap-2 ${shape === "square" ? "mx-auto w-full max-w-[420px]" : ""} ${className}`}>
      <span className="text-[10px] font-semibold tracking-[0.16em] text-subtle uppercase">{label}</span>
      <AdTracker id={ad.id}>
        <a href={`/api/ads/click?id=${ad.id}`} target="_blank" rel="sponsored nofollow noopener" className="group block overflow-hidden rounded-2xl border border-line bg-surface">
          <picture>
            {small && small !== main && <source media="(max-width: 639px)" type="image/avif" srcSet={srcset(small, "avif")} sizes="100vw" />}
            {small && small !== main && <source media="(max-width: 639px)" type="image/webp" srcSet={srcset(small, "webp")} sizes="100vw" />}
            <source type="image/avif" srcSet={srcset(main, "avif")} sizes={sizes} />
            <source type="image/webp" srcSet={srcset(main, "webp")} sizes={sizes} />
            {/* eslint-disable-next-line @next/next/no-img-element -- pre-optimised variants from R2 */}
            <img
              src={main.public_url}
              alt={`${ad.advertiser} — ${label}`}
              loading="lazy"
              decoding="async"
              className={`${ratio} ${smallRatio} h-auto w-full object-cover transition duration-500 group-hover:scale-[1.01]`}
            />
          </picture>
        </a>
      </AdTracker>
    </aside>
  );
}
