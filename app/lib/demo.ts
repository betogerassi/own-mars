export type PlotSize = { width: number; height: number };
export type Spot = { id: string; lat: number; lon: number; width: number; height: number; name: string; message: string; url: string; image?: string; crop: number; x: number; y: number };

export function validPlot(width: number, height: number) {
  return Number.isInteger(width) && Number.isInteger(height) && width >= 10 && height >= 10 && width <= 100 && height <= 100;
}
export function priceOf({ width, height }: PlotSize) { return validPlot(width, height) ? width * height : 0; }
export function pointToLatLon(point: { x: number; y: number; z: number }) {
  const radius = Math.hypot(point.x, point.y, point.z);
  return { lat: Math.asin(point.y / radius) * 180 / Math.PI, lon: Math.atan2(point.z, point.x) * 180 / Math.PI };
}
export function encodeSpot(spot: Spot) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(spot)))).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}
export function decodeSpot(encoded: string): Spot | null {
  try {
    const normalized = encoded.replaceAll('-', '+').replaceAll('_', '/');
    const json = decodeURIComponent(escape(atob(normalized + '==='.slice((normalized.length + 3) % 4))));
    const spot = JSON.parse(json) as Spot;
    return validPlot(spot.width, spot.height) && Number.isFinite(spot.lat) && Number.isFinite(spot.lon) ? spot : null;
  } catch { return null; }
}
