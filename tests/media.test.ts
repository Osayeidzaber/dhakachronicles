import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { buildFolder, safeFilename, sniffImageType, variantWidths } from "@/lib/media/validation";
import { processImage } from "@/lib/media/images";
import { presignSchema } from "@/lib/media/service";

async function png(width: number, height: number): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: { r: 200, g: 30, b: 30 } } }).png().toBuffer();
}

describe("upload validation", () => {
  it("detects real image types from bytes", async () => {
    expect(sniffImageType(await png(10, 10))).toBe("image/png");
    expect(sniffImageType(await sharp(await png(10, 10)).jpeg().toBuffer())).toBe("image/jpeg");
    expect(sniffImageType(await sharp(await png(10, 10)).webp().toBuffer())).toBe("image/webp");
  });

  it("rejects non-images even if named like one", () => {
    expect(sniffImageType(Buffer.from("<?php echo 'hi'; ?> padding padding"))).toBeNull();
    expect(sniffImageType(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'></svg>"))).toBeNull();
  });

  it("validates presign requests (type, size, folder)", () => {
    expect(presignSchema.parse({ filename: "a.jpg", contentType: "image/jpeg", size: 1000 }).folder).toBe("uploads");
    expect(() => presignSchema.parse({ filename: "a.svg", contentType: "image/svg+xml", size: 1000 })).toThrow();
    expect(() => presignSchema.parse({ filename: "a.jpg", contentType: "image/jpeg", size: 50 * 1024 * 1024 })).toThrow();
    expect(() => presignSchema.parse({ filename: "a.jpg", contentType: "image/jpeg", size: 10, folder: "../etc" })).toThrow();
  });

  it("builds the R2 folder layout", () => {
    expect(buildFolder("articles", { articleId: "abc", date: new Date("2026-03-05T00:00:00Z") })).toBe("articles/2026/03/abc");
    expect(buildFolder("branding")).toBe("branding");
    expect(safeFilename("../../evil name.jpg")).toBe("evil_name.jpg");
  });
});

describe("image optimization", () => {
  it("creates WebP and AVIF responsive variants without upscaling", async () => {
    const out = await processImage(await png(1000, 500));
    expect(out.width).toBe(1000);
    expect(out.height).toBe(500);
    expect(out.original.contentType).toBe("image/png");
    const widths = [...new Set(out.variants.map((v) => v.width))];
    expect(widths).toEqual(variantWidths(1000));
    expect(Math.max(...widths)).toBeLessThanOrEqual(1000);
    expect(out.variants.some((v) => v.format === "avif")).toBe(true);
    expect(out.variants.some((v) => v.format === "webp")).toBe(true);
  });

  it("rejects corrupt images", async () => {
    const bad = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]);
    await expect(processImage(bad)).rejects.toThrow();
  });
});
