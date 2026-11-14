"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { audit } from "@/lib/audit";
import { publicMessage, toActionError } from "@/lib/errors";

const setPasswordSchema = z
  .object({
    full_name: z.string().trim().min(1, "Enter your name").max(120),
    password: z.string().min(10, "Use at least 10 characters").max(128),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, { message: "The passwords don't match", path: ["confirm"] });

export interface SetPasswordState {
  error?: string;
}

export async function setPassword(_prev: SetPasswordState, formData: FormData): Promise<SetPasswordState> {
  const parsed = setPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  try {
    const supabase = await createClient();
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) return { error: "Your invitation link has expired. Ask an administrator to send a new one." };
    const { error } = await supabase.auth.updateUser({ password: parsed.data.password, data: { full_name: parsed.data.full_name } });
    if (error) return { error: publicMessage(error) };
    await supabase.from("profiles").update({ full_name: parsed.data.full_name }).eq("id", user.id);
    const firstTime = !user.user_metadata?.password_set;
    if (firstTime) await supabase.auth.updateUser({ data: { password_set: true } });
    await audit(user.id, firstTime ? "team.joined" : "profile.password", "user", user.id);
  } catch (err) {
    return { error: toActionError(err).error };
  }
  redirect("/welcome?next=/admin");
}
