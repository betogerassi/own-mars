import { moderatePlot } from "../../../../../lib/server/store";
import { requireAdmin } from "../../../../../lib/server/admin";
export const runtime = "nodejs";
export async function POST(request: Request, context: RouteContext<"/api/admin/plots/[id]/moderate">) {
  const denied = requireAdmin(request);
  if (denied) return Response.json({ error: denied.error }, { status: denied.status });
  try { const { id } = await context.params; const body = await request.json() as { action?: "HIDDEN_BY_MODERATION" | "REMOVED_BY_MODERATION"; reason?: string; administrator?: string }; if (body.action !== "HIDDEN_BY_MODERATION" && body.action !== "REMOVED_BY_MODERATION") throw new Error("Invalid moderation action."); return Response.json({ plot: moderatePlot(id, body.action, body.reason ?? "", body.administrator ?? "admin") }); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Could not moderate plot." }, { status: 400 }); }
}
