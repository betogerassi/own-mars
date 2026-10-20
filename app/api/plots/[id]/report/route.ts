import { reportPlot } from "../../../../lib/server/store";
import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";
export const runtime = "nodejs";
export async function POST(request: Request, context: RouteContext<"/api/plots/[id]/report">) {
  try {
    const jar = await cookies();
    let visitor = jar.get("own_mars_visitor")?.value;
    if (!visitor) { visitor = randomUUID(); jar.set("own_mars_visitor", visitor, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 365 }); }
    const { id } = await context.params;
    const report = reportPlot(id, await request.json(), visitor);
    return Response.json({ report }, { status: report.submitted ? 201 : 409 });
  }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Could not submit report." }, { status: 400 }); }
}
