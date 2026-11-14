import Link from "next/link";
import type { ArticleCard as Card } from "@/lib/articles/queries";
import { localized, relativeTime } from "@/lib/i18n";
import { articlePath } from "@/lib/seo/defaults";
import { ResponsiveImage } from "./responsive-image";

type Variant = "lead" | "card" | "row" | "compact" | "text";

function imageAlt(a: Card) {
  return a.featured_image_alt || (a.featured_image ? localized(a.featured_image, "alt_text", a.language) : "") || a.title;
}

function Meta({ a, showCategory = true }: { a: Card; showCategory?: boolean }) {
  const parts = [showCategory && a.category ? localized(a.category, "name", a.language) : null, relativeTime(a.published_at, a.language)].filter(Boolean);
  return (
    <p className="kicker flex flex-wrap items-center gap-x-2">
      {a.is_breaking && <span className="rounded-sm bg-white px-1.5 py-px text-[10px] font-bold text-black">{a.language === "bn" ? "ব্রেকিং" : "Breaking"}</span>}
      <span>{parts.join(" · ")}</span>
    </p>
  );
}

function Thumb({ a, sizes, ratio, priority, className = "" }: { a: Card; sizes: string; ratio: string; priority?: boolean; className?: string }) {
  if (!a.featured_image) return <div className={`${ratio} rounded-2xl border border-white/[0.06] bg-gradient-to-br from-[#161616] to-black ${className}`} />;
  return (
    <div className={`${ratio} overflow-hidden rounded-2xl border border-white/[0.06] bg-surface-3 ${className}`}>
      <ResponsiveImage image={a.featured_image} alt={imageAlt(a)} sizes={sizes} priority={priority} className="h-full w-full object-cover object-top transition duration-700 ease-out group-hover:scale-[1.03]" />
    </div>
  );
}

/** Story card in five layouts used across the site. */
export function ArticleCard({ a, variant = "card", priority = false }: { a: Card; variant?: Variant; priority?: boolean }) {
  const href = articlePath(a.language, a.slug);
  if (variant === "lead") {
    return (
      <article className="group">
        <Link href={href} className="grid items-center gap-6 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] md:gap-10">
          <Thumb a={a} sizes="(max-width: 768px) 100vw, 420px" ratio="aspect-[4/5]" priority={priority} />
          <div className="flex flex-col gap-5">
            <Meta a={a} />
            <h2 className="font-display text-[clamp(2.2rem,4.2vw,3.6rem)] leading-[1.04] transition group-hover:text-neutral-700">{a.title}</h2>
            {(a.subtitle || a.excerpt) && <p className="line-clamp-4 max-w-2xl text-lg leading-relaxed text-neutral-600">{a.subtitle || a.excerpt}</p>}
            {a.author && <p className="text-[13px] text-muted">{localized(a.author, "name", a.language)}</p>}
          </div>
        </Link>
      </article>
    );
  }
  if (variant === "row") {
    return (
      <article className="group border-b border-white/[0.08]">
        <Link href={href} className="grid gap-6 py-7 sm:grid-cols-[minmax(0,1fr)_200px] sm:items-center">
          <div className="flex flex-col gap-2.5">
            <Meta a={a} />
            <h3 className="font-display text-[clamp(1.6rem,3vw,2.25rem)] leading-[1.08] transition group-hover:text-neutral-700">{a.title}</h3>
            {a.excerpt && <p className="line-clamp-2 text-[15px] leading-relaxed text-neutral-600">{a.excerpt}</p>}
          </div>
          <Thumb a={a} sizes="200px" ratio="aspect-[4/5]" className="order-first w-full max-w-[200px] sm:order-none" />
        </Link>
      </article>
    );
  }
  if (variant === "compact") {
    return (
      <article className="group">
        <Link href={href} className="grid grid-cols-[84px_1fr] gap-4">
          <Thumb a={a} sizes="84px" ratio="aspect-square" className="rounded-xl" />
          <div className="flex flex-col gap-1.5">
            <Meta a={a} />
            <h3 className="text-[15px] leading-snug font-medium transition group-hover:text-neutral-700">{a.title}</h3>
          </div>
        </Link>
      </article>
    );
  }
  if (variant === "text") {
    return (
      <article className="group border-t border-white/[0.06]">
        <Link href={href} className="block py-3.5">
          <Meta a={a} showCategory={false} />
          <h3 className="mt-1 text-base leading-snug font-medium transition group-hover:text-neutral-700">{a.title}</h3>
        </Link>
      </article>
    );
  }
  return (
    <article className="group">
      <Link href={href} className="flex flex-col gap-3">
        <Thumb a={a} sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 320px" ratio="aspect-[4/5]" />
        <Meta a={a} />
        <h3 className="font-display text-[26px] leading-[1.12] transition group-hover:text-neutral-700">{a.title}</h3>
        {a.excerpt && <p className="line-clamp-2 text-[15px] leading-relaxed text-neutral-600">{a.excerpt}</p>}
      </Link>
    </article>
  );
}
