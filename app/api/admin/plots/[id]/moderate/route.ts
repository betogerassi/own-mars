import { moderatePlot } from "../../../../../lib/server/store";
export const runtime = "nodejs";
export async function POST(request: Request, context: RouteContext<"/api/admin/plots/[id]/moderate">) {
  const token = process.env.OWN_MARS_ADMIN_TOKEN;
  if (!token) return Response.json({ error: "Admin moderation is not configured." }, { status: 503 });
  if (request.headers.get("authorization") !== "Bearer " + token) return Response.json({ error: "Unauthorized." }, { status: 401 });
  try { const { id } = await context.params; const body = await request.json() as { action?: "HIDDEN_BY_MODERATION" | "REMOVED_BY_MODERATION"; reason?: string; administrator?: string }; if (body.action !== "HIDDEN_BY_MODERATION" && body.action !== "REMOVED_BY_MODERATION") throw new Error("Invalid moderation action."); return Response.json({ plot: moderatePlot(id, body.action, body.reason ?? "", body.administrator ?? "admin") }); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Could not moderate plot." }, { status: 400 }); }
}
