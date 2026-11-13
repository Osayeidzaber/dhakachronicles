import { jsonHandler } from "@/lib/http";
import { createUpload } from "@/lib/media/service";

export const dynamic = "force-dynamic";

/** Step 1: returns a presigned R2 URL for a temporary object. */
export const POST = jsonHandler(async (req: Request) => createUpload(await req.json()));
