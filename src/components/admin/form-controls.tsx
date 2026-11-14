"use client";

import { useRef, useState } from "react";
import HoldButton from "@/components/ui/vendor/reactbits/HoldButton";
import SquishSwitch from "@/components/ui/vendor/reactbits/SquishSwitch";

/** Destructive submit: hold for ~1 second to confirm, then the surrounding form submits. */
export function HoldSubmit({ children = "Hold to delete", doneLabel = "Deleting…", className = "" }: { children?: React.ReactNode; doneLabel?: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  return (
    <span ref={ref} className={`inline-block ${className}`}>
      <HoldButton doneLabel={doneLabel} onHold={() => ref.current?.closest("form")?.requestSubmit()} className="w-full">
        {children}
      </HoldButton>
    </span>
  );
}

/** On/off switch that posts like a checkbox ("on" when checked) inside a normal form. */
export function SwitchField({ name, label, defaultChecked = false, disabled = false }: { name: string; label: string; defaultChecked?: boolean; disabled?: boolean }) {
  const [on, setOn] = useState(defaultChecked);
  return (
    <span className="flex items-center justify-between gap-4">
      <span className="text-sm text-neutral-700">{label}</span>
      <SquishSwitch checked={on} onChange={setOn} ariaLabel={label} disabled={disabled} />
      {on && <input type="hidden" name={name} value="on" />}
    </span>
  );
}
