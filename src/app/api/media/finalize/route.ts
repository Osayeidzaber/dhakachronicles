import { z } from "zod";
import { jsonHandler } from "@/lib/http";
import { finalizeUpload } from "@/lib/media/service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Step 2: validates the uploaded bytes and generates optimized variants. */
export const POST = jsonHandler(async (req: Request) => {
  const { id } = z.object({ id: z.uuid() }).parse(await req.json());
  return finalizeUpload(id);
});
