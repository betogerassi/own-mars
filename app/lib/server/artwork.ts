import "server-only";
import { randomUUID } from "node:crypto";
import { join } from "node:path";

const pattern = /^[0-9a-f-]{36}\.(jpg|png|webp)$/;
export const artworkDirectory = join(process.cwd(), "data", "uploads");
export const artworkCookie = (filename: string) => `own_mars_upload_${filename.slice(0, 36)}`;
export const artworkCookieOptions = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 };

export function newArtworkFilename(extension: "jpg" | "png" | "webp") { return `${randomUUID()}.${extension}`; }
export function isArtworkFilename(filename: string) { return pattern.test(filename); }
export function artworkPath(filename: string) {
  if (!isArtworkFilename(filename)) throw new Error("Invalid artwork path.");
  return join(artworkDirectory, filename);
}
