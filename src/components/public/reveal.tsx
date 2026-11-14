"use client";

import AnimatedContent from "@/components/ui/vendor/reactbits/AnimatedContent";

/** Soft fade-and-rise as a section scrolls into view (skipped for reduced motion). */
export function Reveal({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  return (
    <AnimatedContent distance={20} duration={0.6} ease="power3.out" initialOpacity={0} scale={0.985} threshold={0.12} delay={delay} className={className}>
      {children}
    </AnimatedContent>
  );
}
