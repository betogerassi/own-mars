import { confirmedNeighborhoods, NeighborhoodUnavailableError, reserveNeighborhoodFounder } from "../../lib/server/store";
import { plotOwnerCookie, plotOwnerCookieOptions } from "../../lib/server/ownership";
import { cookies } from "next/headers";

export const runtime = "nodejs";

export function GET() {
  return Response.json({ neighborhoods: confirmedNeighborhoods() });
}

/** Creates only a temporary founder reservation; checkout confirmation grants the title. */
export async function POST(request: Request) {
  try {
    const reservation = reserveNeighborhoodFounder(await request.json());
    const response = Response.json({ neighborhood: reservation.neighborhood, founderPlot: reservation.founderPlot }, { status: 201 });
    (await cookies()).set(plotOwnerCookie(reservation.founderPlot.id), reservation.ownerToken, plotOwnerCookieOptions);
    return response;
  } catch (error) {
    const status = error instanceof NeighborhoodUnavailableError ? 409 : 400;
    return Response.json({ error: error instanceof Error ? error.message : "Could not reserve neighborhood." }, { status });
  }
}
