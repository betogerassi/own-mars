export const CANVAS_WIDTH = 40_000;
export const CANVAS_HEIGHT = 25_000;
export const MIN_PLOT_SIZE = 10;
export const MAX_PLOT_SIZE = 100;

export type CommercialZone = "GENERAL_MARS" | "PRIME_MARS" | "ICONIC_MARS" | "MARS_LANDMARKS";
export const zoneRates: Record<CommercialZone, number> = { GENERAL_MARS: 1, PRIME_MARS: 3, ICONIC_MARS: 10, MARS_LANDMARKS: 25 };
export const zoneLabels: Record<CommercialZone, string> = { GENERAL_MARS: "General Mars", PRIME_MARS: "Prime Mars", ICONIC_MARS: "Iconic Mars", MARS_LANDMARKS: "Mars Landmarks" };

export type PlotRectangle = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PurchaseDraft = PlotRectangle & {
  lat: number;
  lon: number;
  name: string;
  message: string;
  url: string;
  image?: string;
};

export function isValidPlotSize(width: number, height: number) {
  return Number.isInteger(width) && Number.isInteger(height)
    && width >= MIN_PLOT_SIZE && height >= MIN_PLOT_SIZE
    && width <= MAX_PLOT_SIZE && height <= MAX_PLOT_SIZE;
}

export function rectangleFor(lat: number, lon: number, width: number, height: number): PlotRectangle {
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180 || !isValidPlotSize(width, height)) {
    throw new Error("Invalid plot coordinates or size.");
  }

  const centerX = Math.floor(((lon + 180) / 360) * CANVAS_WIDTH);
  const centerY = Math.floor(((90 - lat) / 180) * CANVAS_HEIGHT);
  return {
    x: Math.max(0, Math.min(CANVAS_WIDTH - width, centerX - Math.floor(width / 2))),
    y: Math.max(0, Math.min(CANVAS_HEIGHT - height, centerY - Math.floor(height / 2))),
    width,
    height,
  };
}

/** Rectangles touching at their edges are separate plots. */
export function rectanglesOverlap(a: PlotRectangle, b: PlotRectangle) {
  return a.x < b.x + b.width && a.x + a.width > b.x
    && a.y < b.y + b.height && a.y + a.height > b.y;
}

/** Geographic commercial zones. Later versions can replace these published bounds with curated GIS polygons. */
export function zoneAt(lat: number, lon: number): CommercialZone {
  const longitude = ((lon + 180) % 360 + 360) % 360 - 180;
  // Olympus Mons, Valles Marineris and polar caps: smallest, landmark-priced areas.
  if ((lat >= 12 && lat <= 25 && longitude >= -145 && longitude <= -125) ||
      (lat >= -18 && lat <= 2 && longitude >= -78 && longitude <= -30) || Math.abs(lat) >= 82) return "MARS_LANDMARKS";
  // Visible volcanic and canyon regions.
  if ((lat >= -35 && lat <= 35 && longitude >= -170 && longitude <= -85) ||
      (lat >= -30 && lat <= 30 && longitude >= -20 && longitude <= 55)) return "ICONIC_MARS";
  // Broad equatorial and mid-latitude bands, deliberately disjoint from iconic zones.
  if (Math.abs(lat) <= 55 && (longitude < -85 || longitude > 55)) return "PRIME_MARS";
  return "GENERAL_MARS";
}

/** Exact for each requested virtual cell; plots are currently capped at 100×100 (10k cells). */
export function priceForRectangle(rectangle: PlotRectangle) {
  let total = 0;
  const breakdown: Record<CommercialZone, number> = { GENERAL_MARS: 0, PRIME_MARS: 0, ICONIC_MARS: 0, MARS_LANDMARKS: 0 };
  for (let y = rectangle.y; y < rectangle.y + rectangle.height; y++) {
    const lat = 90 - ((y + 0.5) / CANVAS_HEIGHT) * 180;
    for (let x = rectangle.x; x < rectangle.x + rectangle.width; x++) {
      const lon = ((x + 0.5) / CANVAS_WIDTH) * 360 - 180;
      const zone = zoneAt(lat, lon);
      breakdown[zone]++;
      total += zoneRates[zone];
    }
  }
  return { total, breakdown };
}

export function sanitizeText(value: unknown, maximum: number) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

export function safeWebsite(value: unknown) {
  const candidate = sanitizeText(value, 300);
  if (!candidate) return "";
  try {
    const url = new URL(candidate);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : "";
  } catch {
    return "";
  }
}
