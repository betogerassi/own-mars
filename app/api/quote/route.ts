import { priceForRectangle, rectangleFor, zoneLabels } from "../../lib/marketplace";

export const runtime = "nodejs";

export function GET(request: Request) {
  try {
    const query = new URL(request.url).searchParams;
    const rectangle = rectangleFor(
      Number(query.get("lat")),
      Number(query.get("lon")),
      Number(query.get("width")),
      Number(query.get("height")),
    );
    const price = priceForRectangle(rectangle);
    return Response.json({
      rectangle,
      total: price.total,
      breakdown: Object.entries(price.breakdown)
        .filter(([, pixels]) => pixels > 0)
        .map(([zone, pixels]) => ({ zone, label: zoneLabels[zone as keyof typeof zoneLabels], pixels })),
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not quote this plot." }, { status: 400 });
  }
}
