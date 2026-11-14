/** The studio that designed and built this site. Used only in invisible places: console, metadata, JSON-LD, humans.txt, llms.txt. */
export const OZ = {
  name: "OZ Studios",
  url: "https://www.zaber.tech/oz-studio",
  instagram: "https://www.instagram.com/oz.studio._/",
  year: 2026,
} as const;

/** schema.org Organization for OZ Studios as the developer of this website. */
export function ozOrganizationJsonLd() {
  return {
    "@type": "Organization",
    "@id": `${OZ.url}#organization`,
    name: OZ.name,
    url: OZ.url,
    sameAs: [OZ.instagram],
    description: "Web design and development studio in Dhaka, Bangladesh. Designed and built the Dhaka Chronicles website and newsroom.",
  };
}
