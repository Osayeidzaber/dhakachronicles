"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { toActionError } from "@/lib/errors";
import { audit } from "@/lib/audit";

const schema = z.object({
  email: z.email(),
  password: z.string().min(1).max(200),
  next: z.string().optional(),
});

export interface LoginState {
  error?: string;
}

function safeNext(next: string | undefined): string {
  return next && next.startsWith("/admin") && !next.startsWith("//") ? next : "/admin";
}

export async function signIn(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Enter a valid email and password." };
  try {
    const ip = await clientIp();
    await rateLimit(`login:ip:${ip}`, 20, 900);
    await rateLimit(`login:email:${parsed.data.email.toLowerCase()}`, 8, 900);
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });
    if (error || !data.user) return { error: "Invalid email or password." };
    await audit(data.user.id, "auth.login", "user", data.user.id);
  } catch (err) {
    return { error: toActionError(err).error };
  }
  redirect(safeNext(parsed.data.next));
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
