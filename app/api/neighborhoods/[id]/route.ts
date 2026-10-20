import { getNeighborhood } from "../../../lib/server/store";

export const runtime = "nodejs";

export async function GET(_request: Request, context: RouteContext<"/api/neighborhoods/[id]">) {
  const { id } = await context.params;
  const neighborhood = getNeighborhood(id);
  return neighborhood?.status === "confirmed"
    ? Response.json({ neighborhood })
    : Response.json({ error: "Confirmed neighborhood not found." }, { status: 404 });
}
