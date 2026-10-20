import { NeighborhoodUnavailableError, reserveNeighborhoodLot } from "../../../../lib/server/store";
import { plotOwnerCookie, plotOwnerCookieOptions } from "../../../../lib/server/ownership";
import { cookies } from "next/headers";

export const runtime = "nodejs";

export async function POST(request: Request, context: RouteContext<"/api/neighborhoods/[id]/join">) {
  const { id } = await context.params;
  try {
    const body = await request.json() as { lotIndex?: unknown };
    const reservation = reserveNeighborhoodLot(id, Number(body.lotIndex));
    const response = Response.json({ neighborhood: reservation.neighborhood, reservation: reservation.plot }, { status: 201 });
    (await cookies()).set(plotOwnerCookie(reservation.plot.id), reservation.ownerToken, plotOwnerCookieOptions);
    return response;
  } catch (error) {
    const status = error instanceof NeighborhoodUnavailableError ? 409 : 400;
    return Response.json({ error: error instanceof Error ? error.message : "Could not reserve neighborhood lot." }, { status });
  }
}
