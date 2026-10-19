import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join } from "node:path";

export const runtime = "nodejs";

const MAX_BYTES = 2_000_000;
const signatures: Array<{ mime: string; extension: string; matches: (bytes: Uint8Array) => boolean }> = [
  { mime: "image/jpeg", extension: "jpg", matches: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: "image/png", extension: "png", matches: (b) => b.length >= 8 && b.slice(0, 8).every((value, index) => value === [137, 80, 78, 71, 13, 10, 26, 10][index]) },
  { mime: "image/webp", extension: "webp", matches: (b) => new TextDecoder().decode(b.slice(0, 4)) === "RIFF" && new TextDecoder().decode(b.slice(8, 12)) === "WEBP" },
];

export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get("artwork");
  if (!(file instanceof File) || file.size === 0 || file.size > MAX_BYTES) return Response.json({ error: "Upload a JPG, PNG, or WebP under 2 MB." }, { status: 400 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const format = signatures.find(({ matches }) => matches(bytes));
  if (!format) return Response.json({ error: "Only valid JPG, PNG, or WebP files are accepted." }, { status: 400 });
  const directory = join(process.cwd(), "public", "uploads");
  await mkdir(directory, { recursive: true });
  const filename = `${randomUUID()}.${format.extension}`;
  await writeFile(join(directory, filename), bytes, { flag: "wx" });
  return Response.json({ url: `/uploads/${filename}`, mime: format.mime }, { status: 201 });
}
