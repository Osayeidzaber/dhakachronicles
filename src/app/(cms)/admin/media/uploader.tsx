"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { uploadFile } from "@/components/admin/upload";

type Folder = "uploads" | "authors" | "categories" | "branding";

/** Multi-file uploader for the media library. */
export function Uploader() {
  const router = useRouter();
  const [folder, setFolder] = useState<Folder>("uploads");
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    const lines: string[] = [];
    for (const f of Array.from(files)) {
      try {
        await uploadFile(f, folder);
        lines.push(`✓ ${f.name}`);
      } catch (e) {
        lines.push(`✕ ${f.name}: ${e instanceof Error ? e.message : "failed"}`);
      }
      setLog([...lines]);
    }
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="card mb-6 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <select className="input w-auto" value={folder} onChange={(e) => setFolder(e.target.value as Folder)} aria-label="Folder">
          <option value="uploads">General</option>
          <option value="authors">Authors</option>
          <option value="categories">Categories</option>
          <option value="branding">Branding</option>
        </select>
        <label className={`btn btn-primary cursor-pointer ${busy ? "opacity-50" : ""}`}>
          {busy ? "Uploading…" : "Upload images"}
          <input type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif,image/avif" className="hidden" disabled={busy} onChange={(e) => onFiles(e.target.files)} />
        </label>
        <span className="text-xs text-neutral-500">JPEG, PNG, WebP, GIF, AVIF · max 15 MB · WebP/AVIF variants generated automatically</span>
      </div>
      {log.length > 0 && (
        <ul className="text-sm">
          {log.map((l, i) => (
            <li key={i} className={l.startsWith("✕") ? "text-red-700" : "text-green-800"}>
              {l}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
