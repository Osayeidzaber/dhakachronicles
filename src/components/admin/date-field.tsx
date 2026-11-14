"use client";

import { useState } from "react";
import { CalendarDays, X } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const pad = (n: number) => String(n).padStart(2, "0");
/** YYYY-MM-DD in local time (what <input type="date"> would submit). */
const toIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromIso = (v: string) => {
  const [y, m, d] = v.split("-").map(Number);
  return y && m && d ? new Date(y, m - 1, d) : null;
};
const label = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });

/**
 * Branded date picker for plain server-action forms: calendar popover, quick presets,
 * and a hidden input named `name` with the YYYY-MM-DD value.
 */
export function DateField({
  name,
  defaultValue = "",
  placeholder = "Any date",
  min,
  max,
  presets = [],
}: {
  name: string;
  defaultValue?: string;
  placeholder?: string;
  min?: string;
  max?: string;
  presets?: { label: string; daysAgo: number }[];
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(defaultValue);
  const date = value ? fromIso(value) : null;
  const disabled = [...(min ? [{ before: fromIso(min)! }] : []), ...(max ? [{ after: fromIso(max)! }] : [])];

  const pick = (d: Date | undefined) => {
    if (!d) return;
    setValue(toIso(d));
    setOpen(false);
  };

  return (
    <div className="relative mt-1">
      <input type="hidden" name={name} value={value} />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger className="input flex h-11 w-full items-center gap-2 pr-9 text-left" aria-label={`${placeholder}: choose a date`}>
          <CalendarDays className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
          <span className={`truncate ${date ? "text-white" : "text-muted"}`}>{date ? label.format(date) : placeholder}</span>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto">
          {presets.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {presets.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  className="btn h-8 px-3 text-xs"
                  onClick={() => {
                    const d = new Date();
                    d.setDate(d.getDate() - p.daysAgo);
                    pick(d);
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}
          <Calendar mode="single" selected={date ?? undefined} defaultMonth={date ?? undefined} onSelect={pick} disabled={disabled.length ? disabled : undefined} weekStartsOn={6} />
        </PopoverContent>
      </Popover>
      {value && (
        <button type="button" onClick={() => setValue("")} aria-label="Clear date" className="absolute top-1/2 right-2.5 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full text-muted transition hover:bg-white/10 hover:text-white">
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
