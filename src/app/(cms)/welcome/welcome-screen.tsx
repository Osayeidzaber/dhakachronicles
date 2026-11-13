"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import BlurText from "@/components/ui/vendor/reactbits/BlurText";
import { Avatar } from "@/components/admin/avatar";

gsap.registerPlugin(useGSAP);

export function WelcomeScreen({ name, fullName, avatarUrl, role, next }: { name: string; fullName: string; avatarUrl: string | null; role: string; next: string }) {
  const router = useRouter();
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    router.prefetch(next);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t = window.setTimeout(() => router.replace(next), reduce ? 600 : 2200);
    return () => window.clearTimeout(t);
  }, [next, router]);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.from(".w-avatar", { scale: 0.6, opacity: 0, duration: 0.7, ease: "power3.out" });
        gsap.from(".w-meta", { y: 10, opacity: 0, duration: 0.6, delay: 0.7, ease: "power2.out" });
        gsap.fromTo(".w-bar", { scaleX: 0 }, { scaleX: 1, duration: 2, ease: "power1.inOut", transformOrigin: "left center" });
        gsap.to(root.current, { opacity: 0, filter: "blur(8px)", duration: 0.35, delay: 1.85, ease: "power2.in" });
      });
      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <main ref={root} className="flex min-h-screen flex-col items-center justify-center gap-7 bg-black px-6 text-center text-white">
      <div className="w-avatar rounded-full shadow-[0_0_0_10px_rgba(255,255,255,0.03)]">
        <Avatar name={fullName} url={avatarUrl} size={96} />
      </div>
      <p className="kicker w-meta">Signed in</p>
      <h1 className="font-display flex flex-wrap items-baseline justify-center gap-x-5 text-[clamp(3.5rem,10vw,8rem)] leading-[0.95]">
        <BlurText text="Welcome" animateBy="words" direction="bottom" delay={60} />
        <span className="text-subtle">—</span>
        <BlurText text={name} animateBy="letters" direction="bottom" delay={45} />
      </h1>
      <p className="w-meta text-base text-muted capitalize">{role}</p>
      <div className="h-[2px] w-60 overflow-hidden rounded bg-white/10">
        <div className="w-bar h-full bg-white" />
      </div>
      <Link href={next} className="w-meta text-sm text-neutral-600 hover:text-white">
        Opening your desk →
      </Link>
    </main>
  );
}
