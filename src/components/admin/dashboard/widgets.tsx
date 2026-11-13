"use client";

import { useEffect, useId, useRef, useState } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { RollingNumber } from "@/components/ui/vendor/cult/rolling-number";
import { liveReadersAction } from "@/app/(cms)/admin/newsroom-actions";

gsap.registerPlugin(useGSAP);

/** "Reading now": rolls to the new count every 15 seconds while the tab is visible. */
export function LiveReaders({ initial }: { initial: number }) {
  const [n, setN] = useState(initial);
  useEffect(() => {
    let stop = false;
    const tick = async () => {
      if (document.visibilityState !== "visible") return;
      const res = await liveReadersAction();
      if (!stop && res.ok) setN(res.data.total);
    };
    const id = window.setInterval(tick, 15_000);
    return () => {
      stop = true;
      window.clearInterval(id);
    };
  }, []);
  return (
    <span className="text-[56px] leading-none font-medium tracking-[-0.04em] tabular-nums">
      <RollingNumber value={n} />
    </span>
  );
}

/** Up/down chip with arrow and percentage. */
export function Delta({ pct, suffix = "vs previous" }: { pct: number | null; suffix?: string }) {
  if (pct === null) return <span className="text-xs text-muted">New · no earlier data</span>;
  const Icon = pct > 0 ? ArrowUpRight : pct < 0 ? ArrowDownRight : Minus;
  const up = pct > 0;
  return (
    <span className="flex items-center gap-2 text-xs text-muted">
      <span className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-medium ${up ? "bg-white text-black" : "border border-white/20 text-neutral-700"}`}>
        <Icon className="h-3 w-3" aria-hidden="true" />
        {Math.abs(pct)}%
      </span>
      {suffix}
    </span>
  );
}

/** Two-line area chart (this period vs previous) that draws itself in. */
export function ViewsChart({ points }: { points: { label: string; current: number; previous: number }[] }) {
  const id = useId().replace(/:/g, "");
  const root = useRef<HTMLDivElement>(null);
  const max = Math.max(1, ...points.flatMap((p) => [p.current, p.previous]));
  const x = (i: number) => (points.length === 1 ? 300 : (i * 600) / (points.length - 1));
  const y = (v: number) => 190 - (v / max) * 170;
  const line = (k: "current" | "previous") => points.map((p, i) => `${x(i)},${y(p[k])}`).join(" ");
  const labels = new Set(Array.from({ length: Math.min(points.length, 7) }, (_, i) => (points.length <= 7 ? i : Math.round((i * (points.length - 1)) / 6))));

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        root.current?.querySelectorAll<SVGPolylineElement>("polyline").forEach((el, i) => {
          const len = el.getTotalLength();
          gsap.fromTo(el, { strokeDasharray: len, strokeDashoffset: len }, { strokeDashoffset: 0, duration: 1.4, delay: i * 0.15, ease: "power2.out" });
        });
        gsap.from(root.current!.querySelector(".area"), { opacity: 0, duration: 1.2, delay: 0.4 });
      });
      return () => mm.revert();
    },
    { scope: root, dependencies: [points.length, max] },
  );

  if (!points.some((p) => p.current || p.previous)) {
    return <p className="grid h-60 place-items-center rounded-xl border border-dashed border-line text-sm text-muted">No views recorded yet for this period.</p>;
  }
  return (
    <div ref={root}>
      <svg viewBox="0 0 600 200" preserveAspectRatio="none" role="img" aria-label="Views over time, this period compared with the previous one" className="block h-60 w-full overflow-visible">
        <defs>
          <linearGradient id={`${id}-a`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity=".16" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[20, 105, 190].map((v) => (
          <path key={v} d={`M0 ${v}H600`} stroke="rgba(255,255,255,.07)" strokeDasharray="3 5" />
        ))}
        <path className="area" d={`M${x(0)} 200 ${points.map((p, i) => `L${x(i)} ${y(p.current)}`).join(" ")} L${x(points.length - 1)} 200Z`} fill={`url(#${id}-a)`} />
        <polyline points={line("previous")} fill="none" stroke="#555" strokeWidth="1.6" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        <polyline points={line("current")} fill="none" stroke="#fff" strokeWidth="2.2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="relative mt-2 h-4 text-[11px] text-subtle">
        {points.map((p, i) =>
          labels.has(i) ? (
            <span key={p.label + i} className="absolute -translate-x-1/2 whitespace-nowrap first:translate-x-0 last:-translate-x-full" style={{ left: `${(x(i) / 600) * 100}%` }}>
              {p.label}
            </span>
          ) : null,
        )}
      </div>
    </div>
  );
}

/** Fades dashboard panels in, one after another. */
export function Stagger({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const root = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.from(root.current!.querySelectorAll(":scope > *"), { y: 14, opacity: 0, filter: "blur(4px)", duration: 0.55, stagger: 0.06, ease: "power3.out", clearProps: "all" });
      });
      return () => mm.revert();
    },
    { scope: root },
  );
  return (
    <div ref={root} className={className}>
      {children}
    </div>
  );
}
