# Instagram setup (@dhakachronicles)

The integration uses only Meta's official **Instagram API with Instagram Login** (`graph.instagram.com`). There is no scraping and no unofficial API. Until the steps below are done, the admin Instagram page shows "not configured" and nothing is imported.

## Done in code

- OAuth (Instagram Login) with a single-use CSRF `state` that is bound to the admin who started it.
- Short-lived token exchanged for a long-lived (~60 day) token, stored **AES-256-GCM encrypted** in `instagram_tokens`. That table has no RLS policies, so only the service role can read it.
- **Account check:** after authorization the app reads `/me`. If the username isn't `INSTAGRAM_EXPECTED_USERNAME` (default `dhakachronicles`), nothing is stored and the admin sees an error.
- Automatic token refresh when less than 10 days remain. An expired token marks the account `token_expired` and asks for a reconnect.
- Sync paginates `/me/media` with the fields `id, caption, media_type, media_url, thumbnail_url, permalink, timestamp, children{...}`.
  - Duplicates are detected by `instagram_media_id`, which also has a UNIQUE constraint in the database.
  - Image, carousel (each child image) and video (thumbnail only) posts are supported. Media that can't be downloaded is recorded rather than crashing the sync.
  - Media is downloaded server-side (Instagram CDN hosts only), optimized and stored in R2.
  - Each post becomes a **draft** with the caption kept verbatim, plus the permalink and timestamp. Editors are notified.
  - Failed imports retry with backoff (5m, 20m, 80m, 5h20m; at most 5 attempts) and can be retried by hand.
  - Only one sync can run at a time; a sync stuck for more than 30 minutes is released automatically.
- Historical import lets you set the max posts, page size, max pages and a date range.
- Auto-import toggle. Supabase Cron calls `/api/cron/instagram-sync` every 15 minutes.
- Nothing is ever published automatically.

## Manual steps (Meta)

1. **Make @dhakachronicles a Professional account.** In the Instagram app: Settings → Account type → switch to **Business** or **Creator**.
2. **Create a Meta app.** At https://developers.facebook.com/apps choose **Create app**, then the use case *Manage messaging & content on Instagram* (type: Business).
3. In the app dashboard go to **Instagram → API setup with Instagram login**.
   - Note the **Instagram app ID** and **Instagram app secret**. These are `INSTAGRAM_APP_ID` and `INSTAGRAM_APP_SECRET`, *not* the Facebook app ID.
   - Under **Set up Instagram business login → Business login settings**, add the OAuth redirect URIs:
     - `https://YOUR-DOMAIN/api/instagram/callback` (production)
     - `http://localhost:3000/api/instagram/callback` (development, if Meta allows it for your app; otherwise use a tunnel)

     The URI must match `INSTAGRAM_REDIRECT_URI` exactly.
4. **Permissions:** the app requests only `instagram_business_basic`, which is enough to read the account's profile and media.
5. **Access level:**
   - While the app is in Development mode, add the @dhakachronicles account under **App roles → Roles → Instagram testers** and accept the invite from Instagram (Settings → Website permissions → Apps and websites → Tester invites).
   - To use the app in Live mode, submit `instagram_business_basic` for **App Review** (Advanced Access) with a screencast of the connect-and-import flow, and complete Business Verification if Meta asks for it.
6. **Environment variables:**
   ```
   INSTAGRAM_APP_ID=...
   INSTAGRAM_APP_SECRET=...
   INSTAGRAM_REDIRECT_URI=https://YOUR-DOMAIN/api/instagram/callback
   INSTAGRAM_EXPECTED_USERNAME=dhakachronicles
   TOKEN_ENCRYPTION_KEY=<node -e "console.log(require('crypto').randomBytes(32).toString('base64'))">
   ```
   R2 must also be configured, because imported media is stored there.
7. **Connect:** go to Admin → Instagram → **Connect Instagram**, log in as **@dhakachronicles** and approve. Then run **Run historical import** and turn on **automatic synchronization** if you want it.

## Limits and notes

- Rate limits are counted per account per hour (Meta's BUC limits). Scheduled syncs fetch at most one page of 25 posts. For large historical imports, run several smaller imports.
- Instagram's `media_url` values expire, so the importer downloads media right away during the sync.
- Some media isn't returned by the API (for example, reels with copyrighted audio may have no `media_url`). The draft is still created, without that media.
- Reconnecting a different account than `dhakachronicles` is refused, and the attempt is written to `audit_logs`.
