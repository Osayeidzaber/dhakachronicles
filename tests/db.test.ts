import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

// Minimal stand-in for what Supabase provides (auth schema, roles, auth.uid()).
const SUPABASE_STUB = `
create role anon; create role authenticated; create role service_role bypassrls;
create schema auth;
create table auth.users (id uuid primary key, email text, raw_app_meta_data jsonb default '{}', raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema public, auth to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`;

const ADMIN = "00000000-0000-0000-0000-00000000000a";
const WRITER = "00000000-0000-0000-0000-00000000000b";
const NOBODY = "00000000-0000-0000-0000-00000000000c";
const EDITOR = "00000000-0000-0000-0000-00000000000d";
const WRITER2 = "00000000-0000-0000-0000-00000000000e";
let db: PGlite;

async function as<T>(role: "anon" | "authenticated", sub: string | null, fn: () => Promise<T>) {
  await db.exec(`set role ${role}; select set_config('request.jwt.claim.sub', '${sub ?? ""}', false);`);
  try { return await fn(); } finally { await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`); }
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_STUB);
  const dir = join(__dirname, "../supabase/migrations");
  for (const f of readdirSync(dir).sort()) await db.exec(readFileSync(join(dir, f), "utf8"));
  await db.exec(readFileSync(join(__dirname, "../supabase/seed.sql"), "utf8"));
  await db.exec(`
    insert into auth.users (id, raw_app_meta_data) values
      ('${ADMIN}', '{"role":"admin"}'), ('${WRITER}', '{"role":"writer"}'), ('${NOBODY}', '{"role":"superuser"}'),
      ('${EDITOR}', '{"role":"editor"}'), ('${WRITER2}', '{"role":"writer"}');
  `);
}, 60_000);

describe("schema", () => {
  it("provisions roles only from app_metadata", async () => {
    const { rows } = await db.query<{ id: string; role: string | null }>("select id, role from profiles order by id");
    expect(rows.map((r) => r.role)).toEqual(["admin", "writer", null, "editor", "writer"]);
  });

  it("enforces slug uniqueness per language but allows same slug across languages", async () => {
    await db.exec(`insert into articles (language, title, slug, created_by) values ('en','A','same-slug','${ADMIN}')`);
    await db.exec(`insert into articles (language, title, slug, created_by) values ('bn','A','same-slug','${ADMIN}')`);
    await expect(db.exec(`insert into articles (language, title, slug) values ('en','B','same-slug')`)).rejects.toThrow();
  });

  it("allows one translation per language in a group", async () => {
    const g = "11111111-1111-1111-1111-111111111111";
    await db.exec(`insert into articles (translation_group_id, language, title, slug) values ('${g}','en','T','tr-en'), ('${g}','bn','টি','টি-বাংলা')`);
    await expect(db.exec(`insert into articles (translation_group_id, language, title, slug) values ('${g}','en','T2','tr-en-2')`)).rejects.toThrow();
  });

  it("publishes due scheduled articles", async () => {
    await db.exec(`insert into articles (language, title, slug, status, scheduled_at) values ('en','S','sched', 'scheduled', now() - interval '1 minute')`);
    const { rows } = await db.query<{ slug: string }>("select slug from publish_due_articles()");
    expect(rows.map((r) => r.slug)).toContain("sched");
    const { rows: a } = await db.query<{ status: string; published_at: string | null }>("select status, published_at from articles where slug='sched'");
    expect(a[0].status).toBe("published");
    expect(a[0].published_at).not.toBeNull();
  });

  it("rejects duplicate Instagram imports", async () => {
    await db.exec(`insert into instagram_imports (instagram_media_id, media_type) values ('ig1','IMAGE')`);
    await expect(db.exec(`insert into instagram_imports (instagram_media_id, media_type) values ('ig1','IMAGE')`)).rejects.toThrow();
  });
});

describe("row level security", () => {
  it("anonymous visitors only see published articles", async () => {
    await db.exec(`insert into articles (language, title, slug, status) values ('en','Draft','secret-draft','draft')`);
    const rows = await as("anon", null, async () => (await db.query<{ slug: string }>("select slug from articles")).rows);
    expect(rows.map((r) => r.slug)).toContain("sched");
    expect(rows.map((r) => r.slug)).not.toContain("secret-draft");
  });

  it("anonymous visitors cannot read profiles or audit logs", async () => {
    const profiles = await as("anon", null, () => db.query("select * from profiles"));
    const audit = await as("anon", null, () => db.query("select * from audit_logs"));
    expect(profiles.rows).toHaveLength(0);
    expect(audit.rows).toHaveLength(0);
  });

  it("writers cannot publish directly", async () => {
    await expect(as("authenticated", WRITER, () =>
      db.exec(`insert into articles (language, title, slug, status, published_at, created_by) values ('en','W','w-pub','published', now(), '${WRITER}')`),
    )).rejects.toThrow();
    await as("authenticated", WRITER, () =>
      db.exec(`insert into articles (language, title, slug, status, created_by) values ('en','W','w-draft','draft','${WRITER}')`));
  });

  it("users cannot elevate their own role", async () => {
    await expect(as("authenticated", WRITER, () => db.exec(`update profiles set role='admin' where id='${WRITER}'`))).rejects.toThrow();
  });

  it("accounts without a role have no CMS access", async () => {
    await expect(as("authenticated", NOBODY, () =>
      db.exec(`insert into articles (language, title, slug, created_by) values ('en','N','n-1','${NOBODY}')`),
    )).rejects.toThrow();
  });

  it("captures a revision when the title changes", async () => {
    await db.exec(`update articles set title='Changed' where slug='w-draft'`);
    const { rows } = await db.query<{ n: number }>(`select count(*)::int n from article_revisions r join articles a on a.id=r.article_id where a.slug='w-draft'`);
    expect(rows[0].n).toBe(1);
  });

  it("editors can publish any article; timestamps are set", async () => {
    await as("authenticated", EDITOR, () => db.exec(`update articles set status='published' where slug='w-draft'`));
    const { rows } = await db.query<{ published_at: string | null; first_published_at: string | null }>(
      "select published_at, first_published_at from articles where slug='w-draft'",
    );
    expect(rows[0].published_at).not.toBeNull();
    expect(rows[0].first_published_at).not.toBeNull();
  });

  it("writers cannot edit another writer's draft or their own published article", async () => {
    await as("authenticated", WRITER2, () =>
      db.exec(`insert into articles (language, title, slug, created_by) values ('en','W2','w2-draft','${WRITER2}')`));
    await as("authenticated", WRITER, () => db.exec(`update articles set title='hijack' where slug='w2-draft'`));
    await as("authenticated", WRITER, () => db.exec(`update articles set title='edit live' where slug='w-draft'`));
    const { rows } = await db.query<{ slug: string; title: string }>("select slug, title from articles where slug in ('w2-draft','w-draft') order by slug");
    expect(rows.find((r) => r.slug === "w2-draft")?.title).toBe("W2");
    expect(rows.find((r) => r.slug === "w-draft")?.title).toBe("Changed");
  });

  it("writers cannot set breaking/featured flags", async () => {
    await as("authenticated", WRITER, () =>
      db.exec(`insert into articles (language, title, slug, is_breaking, is_featured, created_by) values ('en','F','w-flags',true,true,'${WRITER}')`));
    const { rows } = await db.query<{ is_breaking: boolean; is_featured: boolean }>("select is_breaking, is_featured from articles where slug='w-flags'");
    expect(rows[0]).toEqual({ is_breaking: false, is_featured: false });
  });

  it("instagram tokens are never readable by staff", async () => {
    const rows = await as("authenticated", ADMIN, async () => (await db.query("select * from instagram_tokens")).rows);
    expect(rows).toHaveLength(0);
  });
});

describe("media and instagram functions", () => {
  it("refuses to delete media used by a published article, allows unused media", async () => {
    await db.exec(`insert into media (id, r2_key, public_url, original_filename, mime_type, file_size, status)
      values ('aaaaaaaa-0000-0000-0000-000000000001','k1','https://m/1','a.jpg','image/jpeg',1,'ready'),
             ('aaaaaaaa-0000-0000-0000-000000000002','k2','https://m/2','b.jpg','image/jpeg',1,'ready')`);
    await db.exec(`update articles set featured_image_id='aaaaaaaa-0000-0000-0000-000000000001' where slug='sched'`);
    await expect(db.exec(`delete from media where id='aaaaaaaa-0000-0000-0000-000000000001'`)).rejects.toThrow(/published/);
    await db.exec(`delete from media where id='aaaaaaaa-0000-0000-0000-000000000002'`);
  });

  it("creates an Instagram draft atomically, idempotently, and notifies editors", async () => {
    await db.exec(`insert into instagram_imports (id, instagram_media_id, media_type, caption, permalink)
      values ('bbbbbbbb-0000-0000-0000-000000000001','ig-200','IMAGE','Caption text','https://www.instagram.com/p/x/')`);
    const call = `select create_instagram_draft('bbbbbbbb-0000-0000-0000-000000000001','en','Caption text','caption-text-ig-200',
      '{"type":"doc","content":[]}'::jsonb,'Caption text', array[]::uuid[]) as id`;
    const first = (await db.query<{ id: string }>(call)).rows[0].id;
    const second = (await db.query<{ id: string }>(call)).rows[0].id;
    expect(second).toBe(first);
    const { rows } = await db.query<{ status: string; source_type: string; imp: string }>(
      `select a.status, a.source_type, i.status as imp from articles a join instagram_imports i on i.article_id=a.id where a.id='${first}'`,
    );
    expect(rows[0]).toEqual({ status: "draft", source_type: "instagram", imp: "imported" });
    const n = await db.query<{ n: number }>("select count(*)::int n from notifications where type='instagram_import'");
    expect(n.rows[0].n).toBe(2); // admin + editor
  });

  it("rate limiter allows up to the limit within a window", async () => {
    const hits = [];
    for (let i = 0; i < 4; i++) hits.push((await db.query<{ ok: boolean }>("select rate_limit_hit('t', 3, 60) as ok")).rows[0].ok);
    expect(hits).toEqual([true, true, true, false]);
  });

  it("records live readers via heartbeat and only shows them to staff", async () => {
    await as("anon", null, () => db.query("select reader_heartbeat('sess-aaaaaaaaaaaaaaaa', null, 'bn')"));
    await as("anon", null, () => db.query("select reader_heartbeat('sess-bbbbbbbbbbbbbbbb', null, 'xx')"));
    await expect(db.query("insert into reader_presence (session_id) values ('short')")).rejects.toThrow();
    const anon = await as("anon", null, () => db.query<{ r: unknown }>("select live_readers() as r"));
    expect(anon.rows[0].r).toBeNull();
    const anonRows = await as("anon", null, () => db.query("select * from reader_presence"));
    expect(anonRows.rows).toHaveLength(0);
    const staff = await as("authenticated", WRITER, () => db.query<{ r: { total: number } }>("select live_readers() as r"));
    expect(staff.rows[0].r.total).toBe(2);
  });

  it("counts hourly views by language only for published articles", async () => {
    const { rows } = await db.query<{ id: string }>("select id from articles where status='published' limit 1");
    await db.query(`select record_article_view('${rows[0].id}')`);
    const h = await db.query<{ n: number }>("select coalesce(sum(views),0)::int n from site_hourly_views");
    expect(h.rows[0].n).toBeGreaterThan(0);
    await expect(db.exec("insert into site_hourly_views (hour, language) values (now(), 'fr')")).rejects.toThrow();
  });

  it("restricts Instagram import mode to draft or publish", async () => {
    await db.exec("insert into instagram_accounts (ig_user_id, username) values ('ig-mode', 'x')");
    const r = await db.query<{ m: string }>("select import_mode m from instagram_accounts where ig_user_id='ig-mode'");
    expect(r.rows[0].m).toBe("draft");
    await expect(db.exec("update instagram_accounts set import_mode='auto' where ig_user_id='ig-mode'")).rejects.toThrow();
  });

  it("lets each account read only its own activity unless editor", async () => {
    await db.exec(`insert into audit_logs (user_id, action, target_type) values ('${WRITER}','x.own','t'), ('${ADMIN}','x.other','t')`);
    const w = await as("authenticated", WRITER, () => db.query<{ action: string }>("select action from audit_logs where action like 'x.%'"));
    expect(w.rows.map((r) => r.action)).toEqual(["x.own"]);
    const e = await as("authenticated", EDITOR, () => db.query("select action from audit_logs where action like 'x.%'"));
    expect(e.rows).toHaveLength(2);
  });

  it("keeps brand deals staff-only: editors manage, admins delete, others see nothing", async () => {
    const ins = await as("authenticated", EDITOR, () =>
      db.query<{ id: string }>(`insert into brand_deals (brand_name, fee_amount) values ('Test Brand', 1000) returning id`),
    );
    const id = ins.rows[0].id;
    const w = await as("authenticated", WRITER, () => db.query("select id from brand_deals"));
    expect(w.rows).toHaveLength(0);
    await expect(as("authenticated", WRITER, () => db.exec(`insert into brand_deals (brand_name) values ('X')`))).rejects.toThrow();
    await expect(as("anon", null, () => db.query("select id from brand_deals"))).rejects.toThrow();
    await as("authenticated", EDITOR, () => db.exec(`delete from brand_deals where id = '${id}'`));
    const still = await as("authenticated", ADMIN, () => db.query(`select id from brand_deals where id = '${id}'`));
    expect(still.rows).toHaveLength(1);
    await as("authenticated", ADMIN, () => db.exec(`delete from brand_deals where id = '${id}'`));
    const gone = await as("authenticated", ADMIN, () => db.query(`select id from brand_deals where id = '${id}'`));
    expect(gone.rows).toHaveLength(0);
  });

  it("validates brand deal fields", async () => {
    await expect(db.exec(`insert into brand_deals (brand_name) values ('  ')`)).rejects.toThrow();
    await expect(db.exec(`insert into brand_deals (brand_name, fee_amount) values ('B', -1)`)).rejects.toThrow();
    await expect(db.exec(`insert into brand_deals (brand_name, currency) values ('B', 'taka')`)).rejects.toThrow();
    await expect(db.exec(`insert into brand_deals (brand_name, contact_email) values ('B', 'nope')`)).rejects.toThrow();
    await expect(db.exec(`insert into brand_deals (brand_name, paid) values ('B', true)`)).rejects.toThrow();
  });

  it("exposes most-read ids to the public without view counts", async () => {
    const { rows } = await as("anon", null, () => db.query<Record<string, unknown>>("select * from most_read('en', 7, 5)"));
    for (const r of rows) expect(Object.keys(r)).toEqual(["article_id"]);
    const bad = await as("anon", null, () => db.query("select * from most_read('fr', 7, 5)"));
    expect(bad.rows).toHaveLength(0);
  });
});
