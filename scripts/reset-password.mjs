// Set a random temporary password for a staff account. Runs locally with the secret key.
// The password is printed only in your terminal; change it after signing in.
// Usage: node --env-file=.env.local scripts/reset-password.mjs admin@example.com
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";

const [email] = process.argv.slice(2);
if (!email) {
  console.error("Usage: node --env-file=.env.local scripts/reset-password.mjs <email>");
  process.exit(1);
}
const { SUPABASE_URL, SUPABASE_SECRET_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.error("SUPABASE_URL and SUPABASE_SECRET_KEY must be set.");
  process.exit(1);
}
const sb = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, { auth: { persistSession: false } });

const { data, error: listErr } = await sb.auth.admin.listUsers({ perPage: 1000 });
if (listErr) throw listErr;
const user = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
if (!user) {
  console.error(`No account found for ${email}.`);
  process.exit(1);
}
const tempPassword = randomBytes(12).toString("base64url");
const { error } = await sb.auth.admin.updateUserById(user.id, { password: tempPassword });
if (error) throw error;
console.log(`Temporary password for ${email}: ${tempPassword}`);
console.log("Sign in, change it right away, then clear this terminal.");
