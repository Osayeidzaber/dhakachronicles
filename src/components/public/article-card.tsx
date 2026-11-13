import Link from "next/link";
import type { ArticleCard as Card } from "@/lib/articles/queries";
import { formatDate, localized } from "@/lib/i18n";
import { articlePath } from "@/lib/seo/defaults";
import { ResponsiveImage } from "./responsive-image";

export function ArticleCard({ a, size = "md" }: { a: Card; size?: "lg" | "md" | "sm" }) {
  const alt = a.featured_image_alt || (a.featured_image ? localized(a.featured_image, "alt_text", a.language) : "") || a.title;
  return (
    <article className="group">
      <Link href={articlePath(a.language, a.slug)} className="block">
        {a.featured_image && size !== "sm" && (
          <ResponsiveImage
            image={a.featured_image}
            alt={alt}
            sizes={size === "lg" ? "(max-width: 768px) 100vw, 66vw" : "(max-width: 768px) 100vw, 33vw"}
            className="mb-2 aspect-video w-full rounded object-cover"
            priority={size === "lg"}
          />
        )}
        {a.category && <p className="text-xs font-semibold text-accent uppercase">{localized(a.category, "name", a.language)}</p>}
        <h3 className={`font-bold leading-snug group-hover:underline ${size === "lg" ? "text-2xl md:text-3xl" : size === "md" ? "text-lg" : "text-base"}`}>{a.title}</h3>
        {size !== "sm" && a.excerpt && <p className="mt-1 line-clamp-3 text-sm text-muted">{a.excerpt}</p>}
        <p className="mt-1 text-xs text-muted">
          <time dateTime={a.published_at}>{formatDate(a.published_at, a.language)}</time>
        </p>
      </Link>
    </article>
  );
}
