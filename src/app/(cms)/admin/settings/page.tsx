import { requirePageSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { aiSeoConfig, instagramConfig, r2Config, env } from "@/lib/env";
import { Flash, PageHeader } from "@/components/admin/ui";
import { saveSettingsAction } from "../actions";
import { seoDefaults, socialLinks, logoMediaId } from "@/lib/settings";

export const metadata = { title: "Settings" };

function Status({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2 text-sm">
      <span className={`badge ${ok ? "bg-green-100 text-green-800" : "bg-neutral-200 text-neutral-600"}`}>{ok ? "configured" : "not set"}</span>
      {label}
    </li>
  );
}

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const sp = await searchParams;
  await requirePageSession("settings.manage");
  const supabase = await createClient();
  const { data } = await supabase.from("site_settings").select("setting_key, setting_value");
  const s = Object.fromEntries((data ?? []).map((r: { setting_key: string; setting_value: unknown }) => [r.setting_key, r.setting_value]));
  const name = (s.site_name ?? {}) as { en?: string; bn?: string };
  const social = socialLinks(s);
  const seo = seoDefaults(s);

  return (
    <>
      <PageHeader title="Settings" />
      <Flash ok={sp.ok} error={sp.error} />
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
            <select name="default_language" defaultValue={(s.default_language as string) ?? "bn"} className="input mt-1">
              <option value="bn">Bangla</option>
              <option value="en">English</option>
            </select>
          </label>
          <label className="text-sm">
            Logo media ID (upload in Media → Branding)
            <input name="logo_media_id" defaultValue={logoMediaId(s) ?? ""} className="input mt-1 font-mono text-xs" />
          </label>
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
        <button className="btn btn-primary">Save settings</button>
      </form>

      <section className="card mt-6 max-w-3xl">
        <h2 className="mb-2 font-semibold">Integrations</h2>
        <p className="mb-2 text-xs text-neutral-500">Secrets are set as server environment variables (never stored in the browser or the database in plain text).</p>
        <ul className="space-y-1">
          <Status ok={!!r2Config()} label="Cloudflare R2 media storage" />
          <Status ok={!!instagramConfig()} label="Instagram API (Instagram Login)" />
          <Status ok={!!env().CRON_SECRET} label="Supabase Cron secret" />
          <Status ok={!!aiSeoConfig()} label="AI SEO suggestions (optional)" />
        </ul>
      </section>
    </>
  );
}
