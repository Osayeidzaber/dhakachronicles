"use client";

import { useState } from "react";
import type { Lang } from "@/lib/db/types";

const COPY = {
  en: {
    name: "Your name",
    company: "Company or brand",
    email: "Email",
    phone: "Phone (optional)",
    format: "What are you interested in?",
    budget: "Budget (optional)",
    message: "Tell us about your campaign",
    send: "Send enquiry",
    sending: "Sending…",
    done: "Thank you. We have your enquiry and will reply within two working days.",
    formats: ["Website banner", "Instagram post", "Reel", "Sponsored article", "Event coverage", "Not sure yet"],
  },
  bn: {
    name: "আপনার নাম",
    company: "প্রতিষ্ঠান বা ব্র্যান্ড",
    email: "ইমেইল",
    phone: "ফোন (ঐচ্ছিক)",
    format: "কোনটিতে আগ্রহী?",
    budget: "বাজেট (ঐচ্ছিক)",
    message: "আপনার ক্যাম্পেইন সম্পর্কে লিখুন",
    send: "পাঠান",
    sending: "পাঠানো হচ্ছে…",
    done: "ধন্যবাদ। আমরা দুই কর্মদিবসের মধ্যে উত্তর দেব।",
    formats: ["ওয়েবসাইট ব্যানার", "ইনস্টাগ্রাম পোস্ট", "রিল", "স্পনসরড প্রতিবেদন", "ইভেন্ট কভারেজ", "এখনো ঠিক করিনি"],
  },
} as const;

/** Advertiser enquiry: creates a lead in Brand deals and notifies the team. */
export function AdEnquiryForm({ lang }: { lang: Lang }) {
  const c = COPY[lang];
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setState("sending");
    const body = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const res = await fetch("/api/advertise", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!json.ok) throw new Error(json.error ?? "Something went wrong");
      setState("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setState("idle");
    }
  }

  if (state === "done") {
    return (
      <p role="status" className="reveal rounded-2xl border border-white/20 bg-white/[0.04] p-6 text-[15px] leading-relaxed">
        {c.done}
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
      <input name="name" required maxLength={200} placeholder={c.name} aria-label={c.name} className="input h-12" autoComplete="name" />
      <input name="company" required maxLength={200} placeholder={c.company} aria-label={c.company} className="input h-12" autoComplete="organization" />
      <input name="email" type="email" required placeholder={c.email} aria-label={c.email} className="input h-12" autoComplete="email" />
      <input name="phone" type="tel" maxLength={40} placeholder={c.phone} aria-label={c.phone} className="input h-12" autoComplete="tel" />
      <select name="format" aria-label={c.format} className="input h-12" defaultValue="">
        <option value="" disabled>
          {c.format}
        </option>
        {c.formats.map((f) => (
          <option key={f} value={f}>
            {f}
          </option>
        ))}
      </select>
      <input name="budget" maxLength={100} placeholder={c.budget} aria-label={c.budget} className="input h-12" />
      <textarea name="message" rows={4} maxLength={2000} placeholder={c.message} aria-label={c.message} className="input sm:col-span-2" />
      {/* Honeypot for bots; hidden from people and screen readers. */}
      <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
      {error && (
        <p role="alert" className="text-sm text-red-300 sm:col-span-2">
          {error}
        </p>
      )}
      <button type="submit" disabled={state === "sending"} className="btn btn-primary h-12 px-6 sm:col-span-2 sm:justify-self-start">
        {state === "sending" ? c.sending : c.send}
      </button>
    </form>
  );
}
