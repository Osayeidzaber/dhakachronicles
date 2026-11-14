"use client";

import { useState } from "react";
import type { Lang } from "@/lib/db/types";

const C = {
  en: {
    link: "Report an error",
    title: "Spotted a mistake?",
    note: "Tell us what is wrong. An editor will check it.",
    kinds: { fact: "Wrong fact", typo: "Typo or grammar", translation: "Translation problem", image: "Wrong photo or caption", other: "Something else" },
    message: "What is wrong, and what should it say?",
    email: "Your email, if you want a reply (optional)",
    send: "Send report",
    sending: "Sending…",
    cancel: "Cancel",
    done: "Thank you. Our editors have your report.",
  },
  bn: {
    link: "ভুল জানান",
    title: "কোনো ভুল চোখে পড়েছে?",
    note: "কী ভুল তা জানান। একজন সম্পাদক যাচাই করবেন।",
    kinds: { fact: "তথ্যগত ভুল", typo: "বানান বা ব্যাকরণ", translation: "অনুবাদে ভুল", image: "ভুল ছবি বা ক্যাপশন", other: "অন্য কিছু" },
    message: "কী ভুল, আর সঠিকটি কী হবে?",
    email: "উত্তর চাইলে আপনার ইমেইল (ঐচ্ছিক)",
    send: "পাঠান",
    sending: "পাঠানো হচ্ছে…",
    cancel: "বাতিল",
    done: "ধন্যবাদ। সম্পাদকেরা আপনার বার্তা পেয়েছেন।",
  },
} as const;

/** A small link under every story that opens a form; reports go to the newsroom's alerts channel. */
export function ReportError({ articleId, lang }: { articleId: string; lang: Lang }) {
  const c = C[lang];
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setState("sending");
    try {
      const body = { ...Object.fromEntries(new FormData(e.currentTarget)), articleId };
      const res = await fetch("/api/report", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!json.ok) throw new Error(json.error ?? "Something went wrong");
      setState("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setState("idle");
    }
  }

  if (state === "done") return <p role="status" className="mt-8 text-sm text-neutral-600">{c.done}</p>;

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="mt-8 inline-flex items-center gap-2 text-sm text-muted transition hover:text-white">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M4 22V4a1 1 0 0 1 1-1h12l-2 4 2 4H5" />
        </svg>
        {c.link}
      </button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="reveal mt-8 flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5">
      <div>
        <p className="font-medium">{c.title}</p>
        <p className="text-[13px] text-muted">{c.note}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {Object.entries(c.kinds).map(([k, label], i) => (
          <label key={k} className="cursor-pointer">
            <input type="radio" name="kind" value={k} defaultChecked={i === 0} className="peer sr-only" />
            <span className="inline-block rounded-full border border-line px-3 py-1.5 text-[13px] text-neutral-600 transition peer-checked:border-white peer-checked:bg-white peer-checked:text-black peer-focus-visible:ring-2 peer-focus-visible:ring-white/50">
              {label}
            </span>
          </label>
        ))}
      </div>
      <textarea name="message" required minLength={5} maxLength={1500} rows={3} placeholder={c.message} aria-label={c.message} className="input" />
      <input name="email" type="email" placeholder={c.email} aria-label={c.email} className="input" autoComplete="email" />
      <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
      {error && (
        <p role="alert" className="text-sm text-red-300">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button type="submit" disabled={state === "sending"} className="btn btn-primary">
          {state === "sending" ? c.sending : c.send}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="btn">
          {c.cancel}
        </button>
      </div>
    </form>
  );
}
