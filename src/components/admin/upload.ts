import type { Media } from "@/lib/db/types";

type Folder = "articles" | "authors" | "categories" | "branding" | "uploads";

/**
 * Browser upload flow: ask the server for a presigned URL, PUT the file straight
 * to R2, then ask the server to verify + optimize it. No credentials in the browser.
 */
export async function uploadFile(file: File, folder: Folder = "uploads", articleId?: string): Promise<Media> {
  const presign = await fetch("/api/media/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename: file.name, contentType: file.type, size: file.size, folder, articleId }),
  }).then((r) => r.json() as Promise<{ ok: boolean; error?: string; data?: { id: string; uploadUrl: string; headers: Record<string, string> } }>);
  if (!presign.ok || !presign.data) throw new Error(presign.error ?? "Could not start upload");

  const put = await fetch(presign.data.uploadUrl, { method: "PUT", headers: presign.data.headers, body: file });
  if (!put.ok) throw new Error(`Upload to storage failed (${put.status}). Check the R2 CORS settings.`);

  const fin = await fetch("/api/media/finalize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: presign.data.id }),
  }).then((r) => r.json() as Promise<{ ok: boolean; error?: string; data?: Media }>);
  if (!fin.ok || !fin.data) throw new Error(fin.error ?? "Processing failed");
  return fin.data;
}
