"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Particle = { x: number; y: number; r: number; color: string };

/**
 * Search field with rotating example placeholders; on submit the typed text dissolves
 * into particles (Dhaka Chronicles: dark field, white text, white arrow button).
 * Rewritten from Aceternity's PlaceholdersAndVanishInput: typed, accessible, reduced-motion aware,
 * and it reports the submitted value instead of a raw form event.
 */
export function PlaceholdersAndVanishInput({
  placeholders,
  onSubmit,
  onChange,
  defaultValue = "",
  label = "Search",
  name = "q",
  className,
}: {
  placeholders: string[];
  onSubmit: (value: string) => void;
  onChange?: (value: string) => void;
  defaultValue?: string;
  label?: string;
  name?: string;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const [current, setCurrent] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particles = useRef<Particle[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(defaultValue);
  const [animating, setAnimating] = useState(false);

  // Rotate placeholders every 3s, paused while the tab is hidden.
  useEffect(() => {
    if (placeholders.length < 2) return;
    let id: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (!id) id = setInterval(() => setCurrent((p) => (p + 1) % placeholders.length), 3000);
    };
    const stop = () => {
      if (id) clearInterval(id);
      id = null;
    };
    const onVis = () => (document.visibilityState === "visible" ? start() : stop());
    start();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [placeholders.length]);

  const draw = useCallback(() => {
    const input = inputRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!input || !canvas || !ctx) return;
    canvas.width = 800;
    canvas.height = 800;
    ctx.clearRect(0, 0, 800, 800);
    const cs = getComputedStyle(input);
    ctx.font = `${parseFloat(cs.fontSize) * 2}px ${cs.fontFamily}`;
    ctx.fillStyle = "#fff";
    ctx.fillText(input.value, 16, 40);
    const data = ctx.getImageData(0, 0, 800, 800).data;
    const out: Particle[] = [];
    for (let y = 0; y < 800; y++) {
      for (let x = 0; x < 800; x++) {
        const i = 4 * (y * 800 + x);
        if (data[i + 3] > 0) out.push({ x, y, r: 1, color: `rgba(255,255,255,${data[i + 3] / 255})` });
      }
    }
    particles.current = out;
  }, []);

  const vanish = (done: () => void) => {
    if (reduce) return done();
    draw();
    let pos = particles.current.reduce((m, p) => Math.max(m, p.x), 0);
    setAnimating(true);
    const frame = () => {
      const next: Particle[] = [];
      for (const p of particles.current) {
        if (p.x < pos) next.push(p);
        else if (p.r > 0) {
          p.x += Math.random() > 0.5 ? 1 : -1;
          p.y += Math.random() > 0.5 ? 1 : -1;
          p.r -= 0.05 * Math.random();
          next.push(p);
        }
      }
      particles.current = next;
      const ctx = canvasRef.current?.getContext("2d");
      if (ctx) {
        ctx.clearRect(pos, 0, 800, 800);
        for (const p of next) {
          if (p.x > pos) {
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x, p.y, Math.max(0, p.r), Math.max(0, p.r));
          }
        }
      }
      if (next.length > 0 && pos > -50) {
        pos -= 8;
        requestAnimationFrame(frame);
      } else {
        setAnimating(false);
        done();
      }
    };
    requestAnimationFrame(frame);
  };

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const q = value.trim();
    if (animating) return;
    if (!q) return onSubmit("");
    vanish(() => onSubmit(q));
  };

  return (
    <form
      role="search"
      onSubmit={submit}
      className={cn(
        "relative mx-auto h-14 w-full max-w-xl overflow-hidden rounded-full border border-white/15 bg-[#0a0a0a] transition-colors duration-300 focus-within:border-white/50",
        className,
      )}
    >
      <label htmlFor={`${name}-vanish`} className="sr-only">
        {label}
      </label>
      <canvas
        aria-hidden="true"
        ref={canvasRef}
        className={cn("pointer-events-none absolute top-[22%] left-4 origin-top-left scale-50 pr-20 sm:left-6", animating ? "opacity-100" : "opacity-0")}
      />
      <input
        id={`${name}-vanish`}
        ref={inputRef}
        name={name}
        type="search"
        autoComplete="off"
        enterKeyHint="search"
        value={value}
        onChange={(e) => {
          if (animating) return;
          setValue(e.target.value);
          onChange?.(e.target.value);
        }}
        className={cn(
          "relative z-10 h-full w-full rounded-full border-none bg-transparent pr-16 pl-5 text-base text-white focus:ring-0 focus:outline-none sm:pl-7 [&::-webkit-search-cancel-button]:appearance-none",
          animating && "text-transparent",
        )}
      />
      <button
        type="submit"
        aria-label={label}
        className="absolute top-1/2 right-2 z-20 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white text-black transition hover:bg-neutral-800 disabled:bg-white/10 disabled:text-muted"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
          <path d="M5 12h14M13 18l6-6M13 6l6 6" />
        </svg>
      </button>
      <div className="pointer-events-none absolute inset-0 flex items-center rounded-full" aria-hidden="true">
        <AnimatePresence mode="wait">
          {!value && (
            <motion.p
              key={`ph-${current}`}
              initial={reduce ? false : { y: 6, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={reduce ? undefined : { y: -12, opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="w-[calc(100%-4.5rem)] truncate pl-5 text-left text-base text-muted sm:pl-7"
            >
              {placeholders[current]}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </form>
  );
}
