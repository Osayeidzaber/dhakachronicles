import "server-only";
import {
  DeleteObjectsCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2Config } from "@/lib/env";
import { AppError } from "@/lib/errors";

/** Cloudflare R2 via the S3 API. Credentials stay on the server. */
let client: S3Client | null = null;

export function r2() {
  const cfg = r2Config();
  if (!cfg) throw new AppError("Media storage is not set up yet.", "NOT_CONFIGURED");
  client ??= new S3Client({
    region: "auto",
    endpoint: `https://${cfg.accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
  });
  return { client, cfg };
}

export function publicUrl(key: string): string {
  const cfg = r2Config();
  if (!cfg) throw new AppError("Media storage is not set up yet.", "NOT_CONFIGURED");
  return `${cfg.publicBaseUrl}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

/** Short-lived presigned PUT for the browser to upload a temporary object. */
export async function presignPut(key: string, contentType: string, contentLength: number): Promise<string> {
  const { client: c, cfg } = r2();
  return getSignedUrl(
    c,
    new PutObjectCommand({ Bucket: cfg.bucket, Key: key, ContentType: contentType, ContentLength: contentLength }),
    { expiresIn: 300 },
  );
}

export async function putObject(key: string, body: Buffer, contentType: string): Promise<void> {
  const { client: c, cfg } = r2();
  await c.send(
    new PutObjectCommand({
      Bucket: cfg.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );
}

export async function getObjectBytes(key: string, maxBytes: number): Promise<Buffer> {
  const { client: c, cfg } = r2();
  const res = await c.send(new GetObjectCommand({ Bucket: cfg.bucket, Key: key }));
  if (!res.Body) throw new AppError("Uploaded file not found.", "NOT_FOUND");
  if ((res.ContentLength ?? 0) > maxBytes) throw new AppError("File is too large.", "VALIDATION");
  const bytes = Buffer.from(await res.Body.transformToByteArray());
  if (bytes.length > maxBytes) throw new AppError("File is too large.", "VALIDATION");
  return bytes;
}

export async function deleteObjects(keys: string[]): Promise<void> {
  if (!keys.length) return;
  const { client: c, cfg } = r2();
  for (let i = 0; i < keys.length; i += 1000) {
    await c.send(
      new DeleteObjectsCommand({
        Bucket: cfg.bucket,
        Delete: { Objects: keys.slice(i, i + 1000).map((Key) => ({ Key })), Quiet: true },
      }),
    );
  }
}
