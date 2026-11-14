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
  const [hover, setHover] = useState<number | null>(null);
  const W = 600;
  const H = 220;
  const PAD = 14;
  const max = Math.max(1, ...points.flatMap((p) => [p.current, p.previous]));
  // A little headroom so the peak never touches the top edge.
  const top = niceMax(max * 1.15);
  const x = (i: number) => (points.length === 1 ? W / 2 : (i * W) / (points.length - 1));
  const y = (v: number) => H - PAD - (v / top) * (H - PAD * 2);
  const pts = (k: "current" | "previous") => points.map((p, i) => [x(i), y(p[k])] as const);
  const cur = smoothPath(pts("current"));
  const prev = smoothPath(pts("previous"));
  const area = `${cur} L${x(points.length - 1)} ${H} L${x(0)} ${H} Z`;
  const labels = new Set(Array.from({ length: Math.min(points.length, 7) }, (_, i) => (points.length <= 7 ? i : Math.round((i * (points.length - 1)) / 6))));
  const total = points.reduce((s, p) => s + p.current, 0);
  const prevTotal = points.reduce((s, p) => s + p.previous, 0);
  const peak = points.reduce((b, p, i) => (p.current > points[b].current ? i : b), 0);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        // Reveal left-to-right with a clip, so the line never breaks (unlike dash animation on a stretched SVG).
        gsap.fromTo(root.current!.querySelector(`#${id}-clip rect`), { attr: { width: 0 } }, { attr: { width: W }, duration: 1.3, ease: "power2.inOut" });
        gsap.from(root.current!.querySelectorAll(".stat"), { y: 8, opacity: 0, duration: 0.5, stagger: 0.08, ease: "power3.out" });
      });
      return () => mm.revert();
    },
    { scope: root, dependencies: [points.length, max] },
  );

  if (!points.some((p) => p.current || p.previous)) {
    return <p className="grid h-56 place-items-center rounded-xl border border-dashed border-line text-sm text-muted">No views recorded yet for this period.</p>;
  }

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const i = Math.round(((e.clientX - r.left) / r.width) * (points.length - 1));
    setHover(Math.max(0, Math.min(points.length - 1, i)));
  };
  const h = hover !== null ? points[hover] : null;
  const change = prevTotal ? Math.round(((total - prevTotal) / prevTotal) * 100) : null;

  return (
    <div ref={root} className="flex flex-col gap-5">
      <div className="flex flex-wrap gap-x-10 gap-y-3">
        <div className="stat">
          <p className="kicker">Total views</p>
          <p className="font-display mt-1 text-4xl leading-none tabular-nums">{total.toLocaleString("en")}</p>
        </div>
        <div className="stat">
          <p className="kicker">Peak</p>
          <p className="font-display mt-1 text-4xl leading-none tabular-nums">
            {points[peak].current.toLocaleString("en")}
            <span className="ml-2 align-middle font-sans text-xs text-muted">at {points[peak].label}</span>
          </p>
        </div>
        {change !== null && (
          <div className="stat">
            <p className="kicker">vs previous</p>
            <p className={`font-display mt-1 text-4xl leading-none tabular-nums ${change >= 0 ? "text-emerald-300" : "text-red-300"}`}>
              {change >= 0 ? "+" : ""}
              {change}%
            </p>
          </div>
        )}
      </div>

      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={`Views over time: ${total} this period, ${prevTotal} in the previous period`}
          className="block h-56 w-full touch-none overflow-visible"
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
        >
          <defs>
            <linearGradient id={`${id}-a`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="#fff" stopOpacity=".22" />
              <stop offset=".7" stopColor="#fff" stopOpacity=".03" />
              <stop offset="1" stopColor="#fff" stopOpacity="0" />
            </linearGradient>
            <clipPath id={`${id}-clip`}>
              <rect x="0" y="-20" width={W} height={H + 40} />
            </clipPath>
          </defs>
          {[0.25, 0.5, 0.75, 1].map((f) => (
            <path key={f} d={`M0 ${y(top * f)}H${W}`} stroke="rgba(255,255,255,.06)" strokeDasharray="2 6" vectorEffect="non-scaling-stroke" />
          ))}
          <g clipPath={`url(#${id}-clip)`}>
            <path d={area} fill={`url(#${id}-a)`} />
            <path d={prev} fill="none" stroke="#5c5c5c" strokeWidth="1.5" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
            <path d={cur} fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          </g>
          {hover !== null && <path d={`M${x(hover)} 0V${H}`} stroke="rgba(255,255,255,.25)" vectorEffect="non-scaling-stroke" />}
        </svg>

        {/* Dot + tooltip in HTML so they stay round and crisp on a stretched chart. */}
        {h && hover !== null && (
          <>
            <span
              className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-black bg-white shadow-[0_0_0_4px_rgba(255,255,255,.15)]"
              style={{ left: `${(x(hover) / W) * 100}%`, top: `${(y(h.current) / H) * 100}%` }}
            />
            <div
              className="pointer-events-none absolute top-0 z-10 rounded-xl border border-line bg-black/90 px-3 py-2 text-xs shadow-xl backdrop-blur"
              style={{ left: `${(x(hover) / W) * 100}%`, transform: `translateX(${hover > points.length / 2 ? "calc(-100% - 12px)" : "12px"})` }}
            >
              <p className="text-muted">{h.label}</p>
              <p className="mt-1 tabular-nums">
                <span className="mr-1.5 inline-block h-0.5 w-3 bg-white align-middle" />
                {h.current.toLocaleString("en")} views
              </p>
              <p className="tabular-nums text-muted">
                <span className="mr-1.5 inline-block h-0.5 w-3 bg-[#5c5c5c] align-middle" />
                {h.previous.toLocaleString("en")} previous
              </p>
            </div>
          </>
        )}
      </div>

      <div className="relative h-4 text-[11px] text-muted">
        {points.map((p, i) =>
          labels.has(i) ? (
            <span key={p.label + i} className="absolute -translate-x-1/2 whitespace-nowrap first:translate-x-0 last:-translate-x-full" style={{ left: `${(x(i) / W) * 100}%` }}>
              {p.label}
            </span>
          ) : null,
        )}
      </div>
    </div>
  );
}

/** Round a max up to a tidy axis value (1, 2, 5 × 10ⁿ). */
function niceMax(v: number) {
  const p = 10 ** Math.floor(Math.log10(Math.max(1, v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

/** Smooth curve through points (monotone cubic, so it never overshoots below zero). */
function smoothPath(p: (readonly [number, number])[]) {
  if (p.length < 2) return p.length ? `M${p[0][0]} ${p[0][1]}` : "";
  const n = p.length;
  const d = p.slice(0, -1).map((a, i) => (p[i + 1][1] - a[1]) / (p[i + 1][0] - a[0] || 1));
  const m = p.map((_, i) => {
    if (i === 0) return d[0];
    if (i === n - 1) return d[n - 2];
    return d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  });
  let s = `M${p[0][0]} ${p[0][1]}`;
  for (let i = 0; i < n - 1; i++) {
    const dx = (p[i + 1][0] - p[i][0]) / 3;
    s += ` C${p[i][0] + dx} ${p[i][1] + m[i] * dx} ${p[i + 1][0] - dx} ${p[i + 1][1] - m[i + 1] * dx} ${p[i + 1][0]} ${p[i + 1][1]}`;
  }
  return s;
}

/** Fades dashboard panels in, one after another. */
export function Stagger({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const root = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.from(root.current!.querySelectorAll(":scope > *"), { y: 14, opacity: 0, duration: 0.55, stagger: 0.06, ease: "power3.out", clearProps: "all" });
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
