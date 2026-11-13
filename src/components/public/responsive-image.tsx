import type { ArticleImage } from "@/lib/articles/queries";

/**
 * <picture> with AVIF + WebP srcsets generated at upload time, falling back to
 * the original. Images are pre-optimized in R2, so next/image is not needed.
 */
export function ResponsiveImage({
  image,
  alt,
  sizes = "(max-width: 768px) 100vw, 768px",
  className,
  priority = false,
}: {
  image: ArticleImage;
  alt: string;
  sizes?: string;
  className?: string;
  priority?: boolean;
}) {
  const set = (format: "avif" | "webp") =>
    image.variants
      .filter((v) => v.format === format)
      .sort((a, b) => a.width - b.width)
      .map((v) => `${v.url} ${v.width}w`)
      .join(", ");
  const avif = set("avif");
  const webp = set("webp");
  return (
    <picture>
      {avif && <source type="image/avif" srcSet={avif} sizes={sizes} />}
      {webp && <source type="image/webp" srcSet={webp} sizes={sizes} />}
      <img
        src={image.public_url}
        alt={alt}
        width={image.width ?? undefined}
        height={image.height ?? undefined}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : undefined}
        decoding="async"
        className={className}
      />
    </picture>
  );
}
