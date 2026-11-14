import { requirePageSession } from "@/lib/auth/session";
import { SwitchField } from "@/components/admin/form-controls";
import { SubmitButton } from "@/components/admin/submit-button";
import { ImageField } from "@/components/admin/image-field";
import { createClient } from "@/lib/supabase/server";
import { aiSeoConfig, instagramConfig, r2Config, env } from "@/lib/env";
import { Flash, PageHeader } from "@/components/admin/ui";
import { saveSettingsAction } from "../actions";
import { saveDiscordAction, testDiscordAction } from "../newsroom-actions";
import { DISCORD_EVENTS, DISCORD_EVENT_LABELS, getDiscordSettings } from "@/lib/discord";
import { seoDefaults, socialLinks, logoMediaId } from "@/lib/settings";

export const metadata = { title: "Settings" };

function Status({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center gap-3 border-t border-white/5 py-3 text-sm first:border-0">
      <span className={`h-2 w-2 rounded-full ${ok ? "bg-white" : "border border-muted"}`} aria-hidden="true" />
      <span className="flex-1">{label}</span>
      <span className="text-xs text-muted">{ok ? "Connected" : "Not set"}</span>
    </li>
  );
}

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const sp = await searchParams;
  await requirePageSession("settings.manage");
  const supabase = await createClient();
  const { data } = await supabase.from("site_settings").select("setting_key, setting_value");
  const s = Object.fromEntries((data ?? []).map((r: { setting_key: string; setting_value: unknown }) => [r.setting_key, r.setting_value]));
  const logoId = logoMediaId(s);
  const logoUrl = logoId ? ((await supabase.from("media").select("public_url").eq("id", logoId).maybeSingle()).data?.public_url ?? null) : null;
  const name = (s.site_name ?? {}) as { en?: string; bn?: string };
  const social = socialLinks(s);
  const seo = seoDefaults(s);
  const discord = await getDiscordSettings();

  return (
    <>
      <PageHeader title="Settings" />
      <Flash ok={sp.ok} error={sp.error} />

      <section className="card mb-6 max-w-3xl">
        <h2 className="text-[15px] font-medium">Discord notifications</h2>
        <p className="mt-1 text-[13px] text-muted">
          In Discord: channel settings → Integrations → Webhooks → New webhook → Copy URL. It is stored encrypted and never shown again.
        </p>
        <ul className="mt-3 flex flex-wrap gap-2 text-xs">
          <li className="badge">Article log · {discord.configured ? "connected" : "not set"}</li>
          <li className="badge">Activity log · {discord.activityConfigured ? "connected (server env)" : "set DISCORD_ACTIVITY_WEBHOOK_URL"}</li>
          <li className="badge">Alerts · {discord.alertsConfigured ? "connected (server env)" : discord.activityConfigured ? "sent to activity log" : "set DISCORD_ALERTS_WEBHOOK_URL"}</li>
        </ul>
        <form action={saveDiscordAction} className="mt-4 flex flex-col gap-4">
          <label className="block text-[13px] text-neutral-600">
            Webhook URL {discord.configured && <span className="ml-1 text-white">· saved</span>}
            <input
              name="webhook_url"
              type="password"
              autoComplete="off"
              placeholder={discord.configured ? "Leave empty to keep the saved webhook" : "https://discord.com/api/webhooks/…"}
              className="input mt-1.5"
            />
          </label>
          <fieldset className="grid gap-2 sm:grid-cols-2">
            <legend className="mb-2 text-[13px] text-neutral-600">Send a message when</legend>
            {DISCORD_EVENTS.map((e) => (
              <div key={e} className="rounded-xl border border-line px-4 py-3">
                <SwitchField name={`event_${e}`} label={DISCORD_EVENT_LABELS[e]} defaultChecked={discord.events[e]} />
              </div>
            ))}
          </fieldset>
          <div className="flex flex-wrap gap-2">
            <SubmitButton className="btn btn-primary" pendingLabel="Saving…">Save</SubmitButton>
            {discord.configured && (
              <button name="clear" value="1" className="btn btn-danger">
                Remove webhook
              </button>
            )}
          </div>
        </form>
        {(discord.configured || discord.activityConfigured) && (
          <form action={testDiscordAction} className="mt-3">
            <button className="btn h-9 text-xs">Send test message</button>
          </form>
        )}
      </section>
      <form action={saveSettingsAction} className="card max-w-3xl space-y-4">
        <h2 className="font-semibold">Website</h2>
        <div className="grid gap-2 md:grid-cols-2">
          <label className="text-sm">
            Site name (English)
            <input name="site_name_en" defaultValue={name.en ?? "Dhaka Chronicles"} required className="input mt-1" />
          </label>
          <label className="text-sm">
            Site name (Bangla)
            <input name="site_name_bn" defaultValue={name.bn ?? ""} required className="input mt-1" lang="bn" />
          </label>
          <label className="text-sm">
            Default language
            <select name="default_language" defaultValue={(s.default_language as string) ?? "en"} className="input mt-1">
              <option value="bn">Bangla</option>
              <option value="en">English</option>
            </select>
          </label>
          <ImageField name="logo_media_id" label="Logo (optional; the built-in logo is used if empty)" defaultId={logoMediaId(s)} defaultUrl={logoUrl} hint="PNG with a transparent background" />
        </div>

        <h2 className="font-semibold">Social links</h2>
        <div className="grid gap-2 md:grid-cols-2">
          {(["facebook", "instagram", "x", "youtube"] as const).map((k) => (
            <label key={k} className="text-sm capitalize">
              {k}
              <input name={`social_${k}`} type="url" defaultValue={social[k] ?? ""} placeholder="https://" className="input mt-1" />
            </label>
          ))}
        </div>

        <h2 className="font-semibold">SEO defaults</h2>
        <label className="block text-sm">
          Title suffix
          <input name="seo_title_suffix" defaultValue={seo.title_suffix} className="input mt-1" maxLength={60} />
        </label>
        <label className="block text-sm">
          Default description (English)
          <textarea name="seo_description_en" defaultValue={seo.description_en} className="input mt-1" rows={2} maxLength={300} />
        </label>
        <label className="block text-sm">
          Default description (Bangla)
          <textarea name="seo_description_bn" defaultValue={seo.description_bn} className="input mt-1" rows={2} maxLength={300} lang="bn" />
        </label>
        <SubmitButton className="btn btn-primary" pendingLabel="Saving…">Save settings</SubmitButton>
      </form>

      <section className="card mt-6 max-w-3xl">
        <h2 className="mb-2 text-[15px] font-medium">Integrations</h2>
        <p className="mb-2 text-xs text-neutral-500">Secrets are set as server environment variables (never stored in the browser or the database in plain text).</p>
        <ul className="space-y-1">
          <Status ok={!!r2Config()} label="Cloudflare R2 media storage" />
          <Status ok={!!instagramConfig()} label="Instagram API (Unified Login)" />
          <Status ok={!!env().CRON_SECRET} label="Supabase Cron secret" />
          <Status ok={!!aiSeoConfig()} label="AI SEO suggestions (optional)" />
        </ul>
      </section>
    </>
  );
}
