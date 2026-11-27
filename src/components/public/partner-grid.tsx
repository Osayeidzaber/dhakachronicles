import Image from "next/image";
import type { Lang } from "@/lib/db/types";
import type { ShownBrand } from "@/lib/portfolio";
import { ResponsiveImage } from "./responsive-image";

/** Logo wall of brands we've worked with. With `detailed`, each tile shows what we did and links to proof. */
export function PartnerGrid({ partners, lang, detailed = false }: { partners: ShownBrand[]; lang: Lang; detailed?: boolean }) {
  const bn = lang === "bn";
  // The logo wall uses light tiles so every logo shows in its own colours, whatever they are.
  const logoClass = `object-contain ${detailed ? "h-12 w-24" : "h-12 w-full max-w-[140px]"}`;
  return (
    <ul className={`grid gap-3 ${detailed ? "sm:grid-cols-2 lg:grid-cols-3" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6"}`}>
      {partners.map((p) => {
        const hasLogo = !!(p.logo || p.logoPath);
        return (
          <li key={p.id} className={`flex flex-col rounded-2xl ${detailed ? "gap-4 border border-line bg-surface p-5" : "items-center justify-center bg-[#f4f3ef] p-4 text-[#111] transition hover:bg-white"}`}>
            <div className={`flex items-center gap-3 ${detailed ? "" : "h-14 w-full justify-center"}`}>
              {p.logo ? (
                <ResponsiveImage image={p.logo} alt={p.brand_name} sizes="160px" className={logoClass} />
              ) : p.logoPath ? (
                <Image src={p.logoPath} alt={detailed ? "" : p.brand_name} width={140} height={48} unoptimized={p.logoPath.endsWith(".svg")} className={logoClass} />
              ) : (
                <span className="font-display text-center text-xl leading-tight">{p.brand_name}</span>
              )}
              {detailed && hasLogo && <span className="font-medium">{p.brand_name}</span>}
            </div>
            {/* One logo can stand for several brands of a group (Walton Lift, Walton Refrigerator): name them. */}
            {!detailed && p.logoPath && (
              <span aria-hidden className="mt-1 text-center text-[11px] leading-tight text-[#6b6a66]">
                {p.brand_name}
              </span>
            )}
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
        );
      })}
    </ul>
  );
}
