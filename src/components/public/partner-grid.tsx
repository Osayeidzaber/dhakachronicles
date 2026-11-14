import type { Partner } from "@/lib/articles/queries";
import type { Lang } from "@/lib/db/types";
import { ResponsiveImage } from "./responsive-image";

/** Logo wall of brands we've worked with. With `detailed`, each tile shows what we did and links to proof. */
export function PartnerGrid({ partners, lang, detailed = false }: { partners: Partner[]; lang: Lang; detailed?: boolean }) {
  const bn = lang === "bn";
  return (
    <ul className={`grid gap-3 ${detailed ? "sm:grid-cols-2 lg:grid-cols-3" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6"}`}>
      {partners.map((p) => (
        <li key={p.id} className={`flex flex-col rounded-2xl border border-line bg-surface ${detailed ? "gap-4 p-5" : "items-center justify-center p-4"}`}>
          <div className={`flex items-center gap-3 ${detailed ? "" : "h-14 w-full justify-center"}`}>
            {p.logo ? (
              <ResponsiveImage image={p.logo} alt={p.brand_name} sizes="160px" className={`object-contain ${detailed ? "h-12 w-24" : "h-12 w-full max-w-[140px] opacity-80 grayscale transition hover:opacity-100 hover:grayscale-0"}`} />
            ) : (
              <span className="font-display text-xl">{p.brand_name}</span>
            )}
            {detailed && p.logo && <span className="font-medium">{p.brand_name}</span>}
          </div>
          {detailed && (
            <>
              {p.public_blurb && <p className="text-[15px] leading-relaxed text-neutral-600">{p.public_blurb}</p>}
              <div className="mt-auto flex flex-wrap gap-3 text-[13px]">
                {p.proof_url && (
                  <a href={p.proof_url} target="_blank" rel="noopener noreferrer" className="text-white underline decoration-white/30 underline-offset-4 hover:decoration-white">
                    {bn ? "কাজটি দেখুন ↗" : "See the work ↗"}
                  </a>
                )}
                {p.website_url && (
                  <a href={p.website_url} target="_blank" rel="noopener noreferrer nofollow" className="text-muted hover:text-white">
                    {bn ? "ওয়েবসাইট" : "Website"}
                  </a>
                )}
              </div>
            </>
          )}
        </li>
      ))}
    </ul>
  );
}
