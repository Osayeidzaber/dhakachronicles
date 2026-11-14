"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { uploadFile } from "@/components/admin/upload";
import { FileUpload, type FileStatus } from "@/components/ui/vendor/aceternity/file-upload";

type Folder = "uploads" | "authors" | "categories" | "branding";

/** Media library uploader: drag-and-drop zone with a live status per file. */
export function Uploader() {
  const router = useRouter();
  const [folder, setFolder] = useState<Folder>("uploads");
  const [statuses, setStatuses] = useState<Record<string, FileStatus>>({});
  const [busy, setBusy] = useState(false);

  async function onFiles(files: File[]) {
    if (!files.length) return;
    setBusy(true);
    const key = (f: File) => `${f.name}-${f.lastModified}`;
    setStatuses((s) => ({ ...s, ...Object.fromEntries(files.map((f) => [key(f), { state: "uploading" as const }])) }));
    for (const f of files) {
      try {
        await uploadFile(f, folder);
        setStatuses((s) => ({ ...s, [key(f)]: { state: "done" } }));
      } catch (e) {
        setStatuses((s) => ({ ...s, [key(f)]: { state: "failed", message: e instanceof Error ? e.message : "Upload failed" } }));
      }
    }
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="card mb-6 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-sm text-muted">
          Folder
          <select className="input h-9 w-auto" value={folder} onChange={(e) => setFolder(e.target.value as Folder)}>
            <option value="uploads">General</option>
            <option value="authors">Authors</option>
            <option value="categories">Sections</option>
            <option value="branding">Branding</option>
          </select>
        </label>
        <span className="text-xs text-muted">JPEG, PNG, WebP, GIF, AVIF · up to 15 MB · WebP/AVIF copies made automatically</span>
      </div>
      <FileUpload
        onChange={onFiles}
        disabled={busy}
        maxSize={15 * 1024 * 1024}
        accept={{ "image/jpeg": [".jpg", ".jpeg"], "image/png": [".png"], "image/webp": [".webp"], "image/gif": [".gif"], "image/avif": [".avif"] }}
        title={busy ? "Uploading…" : "Upload images"}
        hint="Drag images here, or click to choose (several at once is fine)"
        statuses={statuses}
      />
    </div>
  );
}
