import { publicDiscovery } from "../../lib/server/store";

export const runtime = "nodejs";

/** Read-only rankings derived exclusively from persisted publication and like records. */
export function GET() {
  return Response.json(publicDiscovery(), { headers: { "cache-control": "public, max-age=60" } });
}
