import { publishPlot, requirePlotOwner } from "../../../../lib/server/store";
import { plotOwnerCookie } from "../../../../lib/server/ownership";
import { cookies } from "next/headers";

export const runtime = "nodejs";

export async function POST(request: Request, context: RouteContext<"/api/plots/[id]/publish">) {
  try {
    const { id } = await context.params;
    requirePlotOwner(id, (await cookies()).get(plotOwnerCookie(id))?.value);
    return Response.json({ plot: publishPlot(id, await request.json()) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not publish plot." }, { status: 400 });
  }
}
