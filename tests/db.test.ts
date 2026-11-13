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
      ('${ADMIN}', '{"role":"admin"}'), ('${WRITER}', '{"role":"writer"}'), ('${NOBODY}', '{"role":"superuser"}');
  `);
}, 60_000);

describe("schema", () => {
  it("provisions roles only from app_metadata", async () => {
    const { rows } = await db.query<{ id: string; role: string | null }>("select id, role from profiles order by id");
    expect(rows.map((r) => r.role)).toEqual(["admin", "writer", null]);
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
});
