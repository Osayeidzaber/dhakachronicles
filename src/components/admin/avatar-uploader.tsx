"use client";

import { useRef, useState, useTransition } from "react";
import { Camera, Loader2 } from "lucide-react";
import { Avatar } from "./avatar";
import { uploadFile } from "./upload";
import { updateProfileAction } from "@/app/(cms)/admin/newsroom-actions";

/** Profile photo with a camera button: uploads to R2 (optimized), then saves it to the profile. */
export function AvatarUploader({ name, url }: { name: string; url: string | null }) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(url);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const onFile = (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setPreview(URL.createObjectURL(file));
    start(async () => {
      try {
        const media = await uploadFile(file, "authors");
        const fd = new FormData();
        fd.set("full_name", name);
        fd.set("avatar_media_id", media.id);
        await updateProfileAction(fd);
      } catch (err) {
        // updateProfileAction redirects on success; Next signals that with a thrown redirect.
        if (err instanceof Error && err.message === "NEXT_REDIRECT") throw err;
        setError(err instanceof Error ? err.message : "Upload failed");
        setPreview(url);
      }
    });
  };

  return (
    <div className="relative">
      <div className="rounded-full border-4 border-black shadow-[0_0_0_1px_rgba(255,255,255,0.14)]">
        <Avatar name={name} url={preview} size={128} />
      </div>
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={busy}
        aria-label="Change profile photo"
        className="absolute right-1 bottom-1 grid h-10 w-10 place-items-center rounded-full bg-white text-black transition hover:scale-105"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Camera className="h-4 w-4" aria-hidden="true" />}
      </button>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
      {error && (
        <p role="alert" className="absolute top-full mt-2 w-60 text-xs text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
