"use client";

import ShinyText from "@/components/ui/vendor/reactbits/ShinyText";

/** Quiet hairline grid behind the login hero (plain black, as in design/claude-design/Login.dc.html). */
export function LoginArt() {
  return (
    <div className="absolute inset-0" aria-hidden="true">
      <div className="hairline-grid absolute inset-0 opacity-60" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black" />
    </div>
  );
}

export function LoginHeadline() {
  return (
    <h2 className="font-display mt-4 max-w-xl text-[clamp(2.8rem,5.5vw,4.6rem)] leading-[1.12]">
      {/* pb keeps descenders (g, y) inside the clipped shine. */}
      <ShinyText text="Delivering timely, accurate," color="#8a8a8a" shineColor="#ffffff" speed={3.2} className="block pb-[0.08em]" />
      <ShinyText text="and engaging news." color="#8a8a8a" shineColor="#ffffff" speed={3.2} delay={0.4} className="block pb-[0.08em]" />
    </h2>
  );
}
