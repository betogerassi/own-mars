import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";
import { likePublishedPlot } from "../../../../lib/server/store";

export const runtime = "nodejs";

export async function POST(_request: Request, context: RouteContext<"/api/plots/[id]/like">) {
  try {
    const jar = await cookies();
    let visitor = jar.get("own_mars_visitor")?.value;
    if (!visitor) {
      visitor = randomUUID();
      jar.set("own_mars_visitor", visitor, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 365 });
    }
    const { id } = await context.params;
    return Response.json(likePublishedPlot(id, visitor));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not like plot." }, { status: 404 });
  }
}
