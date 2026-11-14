"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { uploadFile } from "./upload";

/**
 * Image input for plain server-action forms: uploads to R2 (optimised to AVIF/WebP),
 * then puts the media id in a hidden input named `name`.
 */
export function ImageField({
  name,
  label,
  defaultId,
  defaultUrl,
  hint,
  aspect = "square",
}: {
  name: string;
  label: string;
  defaultId?: string | null;
  defaultUrl?: string | null;
  hint?: string;
  aspect?: "square" | "wide" | "round";
}) {
  const input = useRef<HTMLInputElement>(null);
  const [id, setId] = useState(defaultId ?? "");
  const [preview, setPreview] = useState<string | null>(defaultUrl ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setBusy(true);
    setPreview(URL.createObjectURL(file));
    try {
      const media = await uploadFile(file, "branding");
      setId(media.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setPreview(defaultUrl ?? null);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  const box = aspect === "wide" ? "aspect-[3/1] w-full" : aspect === "round" ? "h-20 w-20 rounded-full" : "h-20 w-20";

  return (
    <div className="flex flex-col gap-1.5 text-xs text-muted">
      <span>{label}</span>
      <input type="hidden" name={name} value={id} />
      <div className={`flex gap-3 ${aspect === "wide" ? "flex-col" : "items-center"}`}>
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy}
          aria-label={preview ? `Replace ${label.toLowerCase()}` : `Upload ${label.toLowerCase()}`}
          className={`relative grid shrink-0 place-items-center overflow-hidden border border-dashed border-white/20 bg-white/[0.03] transition hover:border-white/50 ${box} ${aspect === "round" ? "" : "rounded-xl"}`}
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element -- local blob/R2 preview, not a page image
            <img src={preview} alt="" className={`h-full w-full ${aspect === "wide" ? "object-cover" : "object-contain p-1.5"}`} />
          ) : (
            <ImagePlus className="h-5 w-5" aria-hidden="true" />
          )}
          {busy && (
            <span className="absolute inset-0 grid place-items-center bg-black/60">
              <Loader2 className="h-5 w-5 animate-spin text-white" aria-hidden="true" />
            </span>
          )}
        </button>
        <div className="flex flex-col gap-1">
          <span className="text-[12px] text-subtle">{busy ? "Uploading and optimising…" : hint ?? "PNG, JPG or WebP"}</span>
          {id && !busy && (
            <button
              type="button"
              onClick={() => {
                setId("");
                setPreview(null);
              }}
              className="inline-flex items-center gap-1 self-start text-[12px] text-muted hover:text-white"
            >
              <X className="h-3 w-3" aria-hidden="true" /> Remove
            </button>
          )}
          {error && <span role="alert" className="text-[12px] text-red-300">{error}</span>}
        </div>
      </div>
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/avif" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
    </div>
  );
}
