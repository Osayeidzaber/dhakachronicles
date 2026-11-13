# Cloudflare R2 setup

## How uploads work

1. The browser asks `POST /api/media/presign`. The server checks the role, rate limit, MIME type and size (15 MB max), creates a `media` row with status `pending`, and returns a 5-minute presigned PUT URL for `tmp/<uuid>`.
2. The browser uploads the file directly to R2. The upload never passes through Vercel, so there's no 4.5 MB body limit.
3. The browser calls `POST /api/media/finalize`. The server then:
   - downloads the temp object;
   - checks the real bytes (magic number plus a Sharp decode, with a pixel limit to block decompression bombs);
   - strips EXIF/GPS data and applies the image's orientation;
   - writes the original and **WebP + AVIF** variants (320–1920 px, never upscaled) to `<folder>/<id>/`;
   - marks the media row `ready` and deletes the temp object.

The folder layout is `articles/YYYY/MM/<article-id>/`, `authors/`, `categories/`, `branding/`, `instagram/` and `uploads/`.

SVG, HTML and other non-image files are rejected. A database trigger refuses to delete media that a published or scheduled article uses.

## Steps

1. In the Cloudflare dashboard go to **R2 → Create bucket** (for example `dhakachronicles-media`).
2. **Custom domain:** open the bucket → Settings → Custom Domains → connect, for example `media.yourdomain.com`. That URL becomes `R2_PUBLIC_BASE_URL`.
3. **API token:** go to R2 → Manage API tokens → Create token with **Object Read & Write**, scoped to this bucket only. Copy the Access Key ID and Secret Access Key. Your Account ID is shown on the R2 overview page.
4. **CORS** (required for browser uploads): bucket → Settings → CORS policy:
   ```json
   [
     {
       "AllowedOrigins": ["https://YOUR-DOMAIN", "http://localhost:3000"],
       "AllowedMethods": ["PUT"],
       "AllowedHeaders": ["Content-Type"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```
5. **Lifecycle (recommended):** add a rule that deletes objects under the `tmp/` prefix after 1 day. This cleans up uploads that were abandoned before finalize.
6. **Environment variables:**
   ```
   R2_ACCOUNT_ID=...
   R2_ACCESS_KEY_ID=...
   R2_SECRET_ACCESS_KEY=...
   R2_BUCKET=dhakachronicles-media
   R2_PUBLIC_BASE_URL=https://media.yourdomain.com
   ```
