import type { Lang } from "@/lib/db/types";

/** schema.org structured data builders. Output is serialized with safeJsonLd(). */

export function organizationJsonLd(p: { name: string; url: string; logoUrl?: string | null; sameAs?: string[]; email?: string }) {
  return {
    "@context": "https://schema.org",
    "@type": "NewsMediaOrganization",
    name: p.name,
    url: p.url,
    ...(p.logoUrl ? { logo: { "@type": "ImageObject", url: p.logoUrl } } : {}),
    ...(p.sameAs?.length ? { sameAs: p.sameAs } : {}),
    ...(p.email ? { email: p.email, contactPoint: { "@type": "ContactPoint", contactType: "editorial", email: p.email } } : {}),
  };
}

export function newsArticleJsonLd(p: {
  url: string;
  headline: string;
  description: string;
  language: Lang;
  imageUrls: string[];
  datePublished: string;
  dateModified: string;
  authorName?: string | null;
  authorUrl?: string | null;
  publisherName: string;
  publisherLogo?: string | null;
  section?: string | null;
  keywords?: string[];
}) {
  return {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    mainEntityOfPage: { "@type": "WebPage", "@id": p.url },
    headline: p.headline.slice(0, 110),
    description: p.description,
    inLanguage: p.language === "bn" ? "bn-BD" : "en",
    ...(p.imageUrls.length ? { image: p.imageUrls } : {}),
    datePublished: p.datePublished,
    dateModified: p.dateModified,
    ...(p.authorName ? { author: [{ "@type": "Person", name: p.authorName, ...(p.authorUrl ? { url: p.authorUrl } : {}) }] } : {}),
    publisher: {
      "@type": "NewsMediaOrganization",
      name: p.publisherName,
      ...(p.publisherLogo ? { logo: { "@type": "ImageObject", url: p.publisherLogo } } : {}),
    },
    ...(p.section ? { articleSection: p.section } : {}),
    ...(p.keywords?.length ? { keywords: p.keywords.join(", ") } : {}),
  };
}

export function breadcrumbJsonLd(items: { name: string; url: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: it.url })),
  };
}

/** Serialize for a <script type="application/ld+json"> tag, escaping "<" to prevent breaking out of the tag. */
export function safeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
