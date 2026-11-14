import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { supabaseConfig } from "@/lib/env";

export const dynamic = "force-dynamic";

/** Who is signed in (from the httpOnly session cookie), so public pages can greet staff. */
export async function GET() {
  if (!supabaseConfig()) return NextResponse.json({ staff: false });
  try {
    const s = await getSession();
    const staff = !!s?.profile.role && !!s?.profile.is_active;
    return NextResponse.json(
      staff ? { staff: true, name: (s!.profile.full_name ?? "").split(" ")[0] || null } : { staff: false },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json({ staff: false }, { headers: { "Cache-Control": "private, no-store" } });
  }
}
