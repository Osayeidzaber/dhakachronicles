"use client";

import { useMemo, useState } from "react";
import { CalendarClock } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/** "YYYY-MM-DDTHH:mm" in the browser's local time (same format as <input type="datetime-local">). */
function toLocalValue(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function fromLocalValue(v: string): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

const dhaka = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Dhaka" });

/**
 * Schedule picker: calendar + 24h time + quick presets, in a popover.
 * Emits the same string as datetime-local; shows the Dhaka time it will go live.
 */
export function DateTimePicker({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  // Read the clock once when the picker mounts (render must stay pure).
  const [now] = useState(() => Date.now());
  const date = fromLocalValue(value);
  const time = value ? value.slice(11, 16) : "08:00";
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const setDay = (d: Date | undefined) => {
    if (!d) return;
    const [h, m] = time.split(":").map(Number);
    d.setHours(h, m, 0, 0);
    onChange(toLocalValue(d));
  };
  const setTime = (t: string) => {
    const base = date ?? new Date();
    const [h, m] = t.split(":").map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return;
    base.setHours(h, m, 0, 0);
    onChange(toLocalValue(base));
  };
  const preset = (fn: (d: Date) => void) => {
    const d = new Date();
    fn(d);
    d.setSeconds(0, 0);
    onChange(toLocalValue(d));
    setOpen(false);
  };
  const past = date ? date.getTime() < now : false;

  return (
    <div className="space-y-1.5">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          disabled={disabled}
          className="input flex h-11 w-full items-center gap-2 text-left disabled:opacity-50"
          aria-label="Choose when to publish"
        >
          <CalendarClock className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
          <span className={date ? "text-white" : "text-muted"}>{date ? dhaka.format(date) + " (Dhaka)" : "Pick a date and time"}</span>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto">
          <div className="flex flex-wrap gap-1.5">
            {[
              { label: "In 1 hour", fn: (d: Date) => d.setHours(d.getHours() + 1) },
              { label: "Tonight 9 pm", fn: (d: Date) => d.setHours(21, 0) },
              { label: "Tomorrow 8 am", fn: (d: Date) => (d.setDate(d.getDate() + 1), d.setHours(8, 0)) },
            ].map((p) => (
              <button key={p.label} type="button" onClick={() => preset(p.fn)} className="btn h-8 px-3 text-xs">
                {p.label}
              </button>
            ))}
          </div>
          <Calendar mode="single" selected={date ?? undefined} onSelect={setDay} disabled={{ before: today }} />
          <label className="flex items-center justify-between gap-3 border-t border-white/[0.08] pt-3 text-xs text-muted">
            Time (24h, your clock)
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="input h-9 w-28" />
          </label>
        </PopoverContent>
      </Popover>
      {past && <p className="text-xs text-amber-200">That time has already passed: it will publish immediately.</p>}
    </div>
  );
}
