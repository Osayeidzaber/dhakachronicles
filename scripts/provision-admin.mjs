// Create (or promote) the first admin. Runs locally with the secret key; there is
// no public registration endpoint.
// Usage: node --env-file=.env.local scripts/provision-admin.mjs admin@example.com "Full Name"
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";

const [email, fullName = ""] = process.argv.slice(2);
if (!email) {
  console.error('Usage: node --env-file=.env.local scripts/provision-admin.mjs <email> "<name>"');
  process.exit(1);
}
const { SUPABASE_URL, SUPABASE_SECRET_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.error("SUPABASE_URL and SUPABASE_SECRET_KEY must be set.");
  process.exit(1);
}
const sb = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, { auth: { persistSession: false } });

const tempPassword = randomBytes(18).toString("base64url");
const { data, error } = await sb.auth.admin.createUser({
  email,
  password: tempPassword,
  email_confirm: true,
  app_metadata: { role: "admin" },
  user_metadata: { full_name: fullName },
});

let userId = data?.user?.id;
if (error) {
  // Existing user: promote instead.
  const { data: list } = await sb.auth.admin.listUsers({ perPage: 1000 });
  const existing = list?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (!existing) throw error;
  userId = existing.id;
  await sb.auth.admin.updateUserById(userId, { app_metadata: { role: "admin" } });
  console.log("Existing user promoted to admin.");
} else {
  console.log(`Admin created. Temporary password (change it after first login): ${tempPassword}`);
}
const { error: pErr } = await sb.from("profiles").upsert({ id: userId, role: "admin", full_name: fullName });
if (pErr) throw pErr;
console.log("Done.");
