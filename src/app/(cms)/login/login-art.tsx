"use client";

import dynamic from "next/dynamic";
import ShinyText from "@/components/ui/vendor/reactbits/ShinyText";

// WebGL grid: client-only and loaded after first paint so sign-in stays fast.
const CursorGrid = dynamic(() => import("@/components/ui/vendor/reactbits/CursorGrid"), { ssr: false });

/** Cursor-following grid behind the login hero. */
export function LoginArt() {
  return (
    <div className="absolute inset-0" aria-hidden="true">
      <div className="hairline-grid absolute inset-0 opacity-60" />
      <CursorGrid cellSize={56} color="#ffffff" gridColor="#ffffff" gridOpacity={0.06} maxOpacity={0.35} radius={180} className="absolute inset-0" />
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
    </div>
  );
}

export function LoginHeadline() {
  return (
    <h2 className="font-display mt-4 text-[clamp(3.5rem,8vw,7rem)] leading-[0.95]">
      <ShinyText text="The desk" color="#5c5c5c" shineColor="#ffffff" speed={3.2} className="block" />
      <ShinyText text="is open." color="#5c5c5c" shineColor="#ffffff" speed={3.2} delay={0.4} className="block" />
    </h2>
  );
}
