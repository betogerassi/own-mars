import { moderationHistory, openModerationReports } from "../../../lib/server/store";
import { requireAdmin } from "../../../lib/server/admin";

export const runtime = "nodejs";

export function GET(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return Response.json({ error: denied.error }, { status: denied.status });
  return Response.json({ reports: openModerationReports(), actions: moderationHistory() });
}
