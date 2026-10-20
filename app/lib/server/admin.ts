import "server-only";
import { timingSafeEqual } from "node:crypto";

export function requireAdmin(request: Request) {
  const token = process.env.OWN_MARS_ADMIN_TOKEN;
  if (!token) return { error: "Admin moderation is not configured.", status: 503 } as const;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  const expectedBytes = Buffer.from(token);
  const suppliedBytes = Buffer.from(supplied);
  if (expectedBytes.length !== suppliedBytes.length || !timingSafeEqual(expectedBytes, suppliedBytes)) return { error: "Unauthorized.", status: 401 } as const;
  return null;
}
