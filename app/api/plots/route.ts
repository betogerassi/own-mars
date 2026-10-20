import { publishedPlots, reservePlot, PlotUnavailableError } from "../../lib/server/store";
import { plotOwnerCookie, plotOwnerCookieOptions } from "../../lib/server/ownership";
import { cookies } from "next/headers";

export const runtime = "nodejs";

export function GET() {
  return Response.json({ plots: publishedPlots() });
}

export async function POST(request: Request) {
  try {
    const reservation = reservePlot(await request.json());
    const response = Response.json({ reservation: reservation.plot }, { status: 201 });
    (await cookies()).set(plotOwnerCookie(reservation.plot.id), reservation.ownerToken, plotOwnerCookieOptions);
    return response;
  } catch (error) {
    const status = error instanceof PlotUnavailableError ? 409 : 400;
    return Response.json({ error: error instanceof Error ? error.message : "Could not reserve plot." }, { status });
  }
}
