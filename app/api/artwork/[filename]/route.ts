import { readFile } from "node:fs/promises";
import { cookies } from "next/headers";
import { artworkCookie, artworkPath, isArtworkFilename } from "../../../lib/server/artwork";
import { isPublicArtworkPath } from "../../../lib/server/store";

export const runtime = "nodejs";

const contentTypes: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };

export async function GET(_request: Request, context: RouteContext<"/api/artwork/[filename]">) {
  const { filename } = await context.params;
  if (!isArtworkFilename(filename)) return new Response(null, { status: 404 });
  const imagePath = `/api/artwork/${filename}`;
  const ownsUpload = Boolean((await cookies()).get(artworkCookie(filename))?.value);
  if (!ownsUpload && !isPublicArtworkPath(imagePath)) return new Response(null, { status: 404 });
  try {
    const bytes = await readFile(artworkPath(filename));
    const extension = filename.split(".").pop()!;
    return new Response(bytes, { headers: { "content-type": contentTypes[extension], "cache-control": "private, no-store", "x-content-type-options": "nosniff" } });
  } catch { return new Response(null, { status: 404 }); }
}
