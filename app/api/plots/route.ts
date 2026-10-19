import { publishedPlots, reservePlot, PlotUnavailableError } from "../../lib/server/store";

export const runtime = "nodejs";

export function GET() {
  return Response.json({ plots: publishedPlots() });
}

export async function POST(request: Request) {
  try {
    const plot = reservePlot(await request.json());
    return Response.json({ reservation: plot }, { status: 201 });
  } catch (error) {
    const status = error instanceof PlotUnavailableError ? 409 : 400;
    return Response.json({ error: error instanceof Error ? error.message : "Could not reserve plot." }, { status });
  }
}
