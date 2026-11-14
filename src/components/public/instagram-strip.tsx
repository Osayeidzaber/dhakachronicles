"use client";

import { LogoLoop, type LogoItem } from "@/components/ui/vendor/reactbits/LogoLoop";

/** Slow, endless strip of the latest Instagram posters (pauses on hover, each links to its story). */
export function InstagramStrip({ items, label }: { items: { href: string; src: string; alt: string }[]; label: string }) {
  if (items.length < 3) return null;
  // No href on the loop items: LogoLoop would wrap them in its own new-tab link. We render the link ourselves.
  const hrefBySrc = new Map(items.map((i) => [i.src, i.href]));
  const logos: LogoItem[] = items.map((i) => ({ src: i.src, alt: i.alt, title: i.alt }));
  return (
    <LogoLoop
      logos={logos}
      logoHeight={150}
      gap={14}
      pauseOnHover
      fadeOut
      fadeOutColor="#000000"
      ariaLabel={label}
      renderItem={(item, key) =>
        "src" in item ? (
          <a key={key} href={hrefBySrc.get(item.src)} title={item.title} className="block overflow-hidden rounded-xl border border-white/[0.08] transition hover:border-white/40">
            {/* eslint-disable-next-line @next/next/no-img-element -- R2 poster, already optimized */}
            <img src={item.src} alt={item.alt ?? ""} loading="lazy" className="h-[150px] w-[120px] object-cover object-top" />
          </a>
        ) : null
      }
    />
  );
}
