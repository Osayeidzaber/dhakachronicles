# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary: the Bangladeshi diaspora.** Readers living abroad who follow news from home in Bangla or English, often reaching an article from the `@dhakachronicles` Instagram account. They read on phones and desktops across time zones, and each language edition must stand on its own.

**Secondary: the newsroom.** Admins, editors and writers who use the CMS (`/admin`) to turn Instagram imports into verified articles, review, schedule and publish them.

## Product Purpose

Dhaka Chronicles is a bilingual (Bangla `bn` + English `en`) digital news publication. It turns fast social posts from `@dhakachronicles` into verified, readable, searchable articles with proper bylines, SEO and archives. Success means diaspora readers trust it as their source for Dhaka news and come back to the site, not only the Instagram feed.

## Positioning

Instagram-native, but verified. The publication grew out of a social account; every Instagram post enters the system as a draft, and an editor verifies and writes it up before anything is published. Legacy Dhaka outlets cannot claim that social-first origin; social-only accounts cannot claim the editorial verification.

## Operating Context

- Content flows: Instagram sync → draft → editor review → publish or schedule. Imports never auto-publish.
- Each article exists once per language, linked by translation group; one language can publish before the other.
- Readers arrive from Instagram links, search engines, Google News (news sitemap) and RSS.

## Capabilities and Constraints

- One Next.js 16 app (App Router) holds both the public site and the CMS; Supabase, Cloudflare R2, Tailwind v4.
- Public routes: home (breaking, featured, latest), latest, article, category, tag, author, search, privacy.
- Supabase credentials stay server-only; no browser Supabase client.
- Bangla text and Bangla slugs are first-class; search uses a `simple` config (no Bangla stemming).
- Only the `dhakachronicles` Instagram account may be connected.

## Brand Commitments

- Readers see the name **Dhaka Chronicles** (matching the Instagram account). "BNews" in older docs is not the public name.
- Never mix languages within one article.

## Evidence on Hand

- Real content comes from the `@dhakachronicles` Instagram account once connected; there is no production content yet.
- No testimonials, readership numbers, press or awards exist; future work must not invent them.

## Product Principles

1. Verification before speed: nothing reaches readers without an editor.
2. Two equal editions: Bangla and English each read as a complete publication.
3. Distance-aware: write and present for readers far from Dhaka who need context.
4. Earn the return visit: give readers a reason to come to the site, not just scroll the feed.

## Accessibility & Inclusion

Correct `lang` attributes per edition and good Bangla font rendering are required. No further standard has been set.
