import { getPlot } from "../../../lib/server/store";

export const runtime = "nodejs";

export async function GET(_request: Request, context: RouteContext<"/api/plots/[id]">) {
  const { id } = await context.params;
  const plot = getPlot(id);
  return plot && plot.status === "paid"
    ? Response.json({ plot })
    : Response.json({ error: "Published plot not found." }, { status: 404 });
}
