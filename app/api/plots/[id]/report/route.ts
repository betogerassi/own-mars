import { reportPlot } from "../../../../lib/server/store";
export const runtime = "nodejs";
export async function POST(request: Request, context: RouteContext<"/api/plots/[id]/report">) {
  try { const { id } = await context.params; return Response.json({ report: reportPlot(id, await request.json()) }, { status: 201 }); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Could not submit report." }, { status: 400 }); }
}
